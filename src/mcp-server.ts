import * as http from 'http'
import { randomUUID } from 'crypto'
import { z, ZodError } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { App } from 'obsidian'
import type { TaskQueue } from './task-queue'
import type { BragiSettings } from './settings'
import {
	createMcpToolRegistry,
	type GetCanvas,
	type McpToolDef,
	type McpToolResult,
	type RunGeneration,
} from './mcp-tool-registry'

type JsonRpcId = string | number | null

interface JsonRpcRequest {
	jsonrpc?: '2.0'
	id?: JsonRpcId
	method?: string
	params?: unknown
}

interface JsonRpcResponse {
	jsonrpc: '2.0'
	id: JsonRpcId
	result?: unknown
	error?: {
		code: number
		message: string
		data?: unknown
	}
}

interface ToolCallParams {
	name?: unknown
	arguments?: unknown
}

const PROTOCOL_VERSION = '2025-06-18'

function jsonResponse(id: JsonRpcId, result: unknown): JsonRpcResponse {
	return { jsonrpc: '2.0', id, result }
}

function jsonError(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
	return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } }
}

function toolInputSchema(tool: McpToolDef): unknown {
	return zodToJsonSchema(z.object(tool.inputSchema), {
		name: tool.name,
		$refStrategy: 'none',
	})
}

export class BragiMcpServer {
	private httpServer: http.Server | null = null
	private sessions = new Set<string>()

	constructor(
		private getCanvas: GetCanvas,
		private app: App,
		private runGeneration?: RunGeneration,
		private getSettings?: () => BragiSettings,
		private taskQueue?: TaskQueue,
		private getOutputDir?: () => string,
		private rememberGeneratedAsset?: (path: string) => void,
		private rememberCanvasPath?: (path: string) => void,
	) {}

	private get tools(): McpToolDef[] {
		return createMcpToolRegistry({
			getCanvas: this.getCanvas,
			app: this.app,
			runGeneration: this.runGeneration,
			getSettings: this.getSettings,
			taskQueue: this.taskQueue,
			getOutputDir: this.getOutputDir,
			rememberGeneratedAsset: this.rememberGeneratedAsset,
			rememberCanvasPath: this.rememberCanvasPath,
		})
	}

	async start(port: number): Promise<void> {
		this.httpServer = http.createServer((req, res) => {
			void this.handleHttpRequest(req, res)
		})

		return new Promise<void>((resolve, reject) => {
			this.httpServer!.on('error', (err: NodeJS.ErrnoException) => {
				console.error(`Bragi MCP server failed to start on port ${port}:`, err.message)
				reject(err instanceof Error ? err : new Error(String(err)))
			})
			this.httpServer!.listen(port, '127.0.0.1', () => {
				resolve()
			})
		})
	}

	private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
		res.setHeader('Access-Control-Allow-Origin', '*')
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
		res.setHeader('Access-Control-Allow-Headers', '*')
		res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')

		if (req.method === 'OPTIONS') {
			res.writeHead(204)
			res.end()
			return
		}

		if (req.url !== '/mcp' && !req.url?.startsWith('/mcp?')) {
			res.writeHead(404)
			res.end('Not found')
			return
		}

		if (!this.authorize(req, res)) return

		try {
			if (req.method === 'DELETE') {
				this.closeSession(req)
				res.writeHead(204)
				res.end()
				return
			}

			if (req.method === 'GET') {
				res.writeHead(200, {
					'Content-Type': 'text/event-stream',
					'Cache-Control': 'no-cache',
					Connection: 'keep-alive',
				})
				res.write('event: endpoint\ndata: /mcp\n\n')
				res.end()
				return
			}

			if (req.method !== 'POST') {
				res.writeHead(405)
				res.end('Method not allowed')
				return
			}

			const body = await readJsonBody(req)
			const response = await this.handleBody(body, res)
			if (response === null) {
				res.writeHead(204)
				res.end()
				return
			}

			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify(response))
		} catch (err) {
			console.error('Bragi MCP error:', err)
			if (!res.headersSent) {
				res.writeHead(500, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify(jsonError(null, -32603, err instanceof Error ? err.message : String(err))))
			}
		}
	}

	private authorize(req: http.IncomingMessage, res: http.ServerResponse): boolean {
		const expectedToken = (this.getSettings?.()?.mcpToken || '').trim()
		if (!expectedToken) return true

		const authHeader = req.headers['authorization']
		const auth = Array.isArray(authHeader) ? authHeader[0] : authHeader
		const presented = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
		if (presented === expectedToken) return true

		res.writeHead(401, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify(jsonError(null, -32001, 'Unauthorized')))
		return false
	}

	private closeSession(req: http.IncomingMessage): void {
		const sessionIdHeader = req.headers['mcp-session-id']
		const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader
		if (sessionId) this.sessions.delete(sessionId)
	}

	private async handleBody(body: unknown, res: http.ServerResponse): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
		if (Array.isArray(body)) {
			const responses = await Promise.all(body.map(item => this.handleRequest(item, res)))
			const concrete = responses.filter((item): item is JsonRpcResponse => item !== null)
			return concrete.length > 0 ? concrete : null
		}

		return this.handleRequest(body, res)
	}

	private async handleRequest(raw: unknown, res: http.ServerResponse): Promise<JsonRpcResponse | null> {
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			return jsonError(null, -32600, 'Invalid request')
		}

		const request = raw as JsonRpcRequest
		const id = request.id ?? null
		const isNotification = request.id === undefined
		if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
			return isNotification ? null : jsonError(id, -32600, 'Invalid request')
		}

		try {
			switch (request.method) {
				case 'initialize':
					return this.handleInitialize(request, res)
				case 'notifications/initialized':
					return null
				case 'ping':
					return isNotification ? null : jsonResponse(id, {})
				case 'tools/list':
					return isNotification ? null : jsonResponse(id, this.listTools())
				case 'tools/call':
					return isNotification ? null : jsonResponse(id, await this.callTool(request.params))
				default:
					return isNotification ? null : jsonError(id, -32601, `Method not found: ${request.method}`)
			}
		} catch (err) {
			if (isNotification) return null
			if (err instanceof ZodError) {
				return jsonError(id, -32602, 'Invalid params', err.errors)
			}
			return jsonError(id, -32603, err instanceof Error ? err.message : String(err))
		}
	}

	private handleInitialize(request: JsonRpcRequest, res: http.ServerResponse): JsonRpcResponse | null {
		if (request.id === undefined) return null
		const sessionId = randomUUID()
		this.sessions.add(sessionId)
		res.setHeader('Mcp-Session-Id', sessionId)
		const params = request.params as { protocolVersion?: unknown } | undefined
		return jsonResponse(request.id, {
			protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL_VERSION,
			capabilities: { tools: {} },
			serverInfo: { name: 'bragi-canvas', version: '1.0.0' },
		})
	}

	private listTools(): { tools: Array<{ name: string; description: string; inputSchema: unknown }> } {
		return {
			tools: this.tools.map(tool => ({
				name: tool.name,
				description: tool.description,
				inputSchema: toolInputSchema(tool),
			})),
		}
	}

	private async callTool(params: unknown): Promise<McpToolResult> {
		const toolParams = params as ToolCallParams | undefined
		if (!toolParams || typeof toolParams.name !== 'string') {
			throw new Error('tools/call requires params.name')
		}

		const tool = this.tools.find(item => item.name === toolParams.name)
		if (!tool) throw new Error(`Unknown tool: ${toolParams.name}`)

		const args = z.object(tool.inputSchema).parse(toolParams.arguments ?? {})
		return tool.handler(args)
	}

	async stop(): Promise<void> {
		this.sessions.clear()
		if (!this.httpServer) return

		await new Promise<void>((resolve) => {
			this.httpServer?.close(() => resolve())
		})
		this.httpServer = null
	}
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = []
		req.on('data', chunk => chunks.push(chunk))
		req.on('end', () => {
			const raw = Buffer.concat(chunks).toString('utf8')
			if (!raw) return resolve(undefined)
			try {
				resolve(JSON.parse(raw))
			} catch (err) {
				reject(err instanceof Error ? err : new Error(String(err)))
			}
		})
		req.on('error', reject)
	})
}
