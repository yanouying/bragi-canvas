import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const tempDir = await mkdtemp(join(tmpdir(), 'bragi-mcp-reference-'))
const bundlePath = join(tempDir, 'mcp-tool-registry.mjs')

function makeNode(data) {
	return {
		id: data.id,
		text: data.type === 'text' ? data.text : undefined,
		getData: () => data,
	}
}

function makeCanvas(nodeData, initialEdges = []) {
	const nodes = new Map(nodeData.map(data => [data.id, makeNode(data)]))
	let serialized = { nodes: nodeData, edges: initialEdges }
	let runtimeEdges = []
	let frameCount = 0

	const materializeEdges = () => serialized.edges.map(data => ({
		id: data.id,
		from: { node: nodes.get(data.fromNode), side: data.fromSide },
		to: { node: nodes.get(data.toNode), side: data.toSide },
		getData: () => data,
	}))

	return {
		nodes,
		edges: new Map(),
		selection: new Set(),
		getData: () => serialized,
		getEdgesForNode: node => runtimeEdges.filter(edge => edge.from.node.id === node.id || edge.to.node.id === node.id),
		importData: data => { serialized = data },
		requestFrame: async () => {
			frameCount++
			runtimeEdges = materializeEdges()
		},
		requestSave: async () => {},
		get frameCount() { return frameCount },
	}
}

try {
	await build({
		entryPoints: ['src/mcp-tool-registry.ts'],
		bundle: true,
		platform: 'node',
		format: 'esm',
		outfile: bundlePath,
		logLevel: 'silent',
		plugins: [{
			name: 'mock-obsidian',
			setup(buildApi) {
				buildApi.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'mock-obsidian' }))
				buildApi.onLoad({ filter: /.*/, namespace: 'mock-obsidian' }, () => ({
					contents: `
						export class Modal {}
						export class Notice {}
						export class Plugin {}
						export class PluginSettingTab {}
						export class Setting {}
						export class TFile {}
						export class TFolder {}
						export function addIcon() {}
						export function getLanguage() { return 'en' }
						export function normalizePath(path) { return path }
						export async function requestUrl() { throw new Error('Unexpected requestUrl call') }
						export function setIcon() {}
						export function setTooltip() {}
					`,
					loader: 'js',
				}))
			},
		}],
	})

	const { createMcpToolRegistry } = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`)
	const image = { id: 'image-ref', type: 'file', file: 'refs/style.png', x: 0, y: 0, width: 400, height: 400 }
	const prompt = { id: 'prompt', type: 'text', text: 'Keep the subject and change the lighting', x: 500, y: 0, width: 300, height: 200 }
	const app = { vault: { getAbstractFileByPath: () => null } }

	// connect_nodes must not return until getEdgesForNode() can see the new edge.
	const connectedCanvas = makeCanvas([image, prompt])
	const connectedTools = createMcpToolRegistry({ getCanvas: () => connectedCanvas, app })
	const connect = connectedTools.find(tool => tool.name === 'connect_nodes')
	const getUpstream = connectedTools.find(tool => tool.name === 'get_upstream')
	assert.ok(connect && getUpstream)
	await connect.handler({
		fromId: image.id,
		toId: prompt.id,
		fromSide: 'right',
		toSide: 'left',
		toEnd: 'arrow',
	})
	assert.equal(connectedCanvas.frameCount, 1)
	const upstreamResult = await getUpstream.handler({ id: prompt.id })
	assert.deepEqual(JSON.parse(upstreamResult.content[0].text).images, ['refs/style.png'])

	// generate must also provide its own frame barrier for callers that imported an
	// edge immediately before invoking GPT Image 2 through MCP.
	const pendingEdge = {
		id: 'pending-ref-edge',
		fromNode: image.id,
		fromSide: 'right',
		toNode: prompt.id,
		toSide: 'left',
		toEnd: 'arrow',
	}
	const generationCanvas = makeCanvas([image, prompt], [pendingEdge])
	let capturedImages = []
	const settings = {
		providers: { openai: 'test-key' },
		providerModelPrefs: { openai: { 'gpt-image-2': true } },
		modelPrefs: { 'gpt-image-2': { enabled: true, selectedProvider: 'openai' } },
		modelOrder: { image: [], video: [], text: [], audio: [] },
		apiModelIdOverrides: {},
	}
	const generationTools = createMcpToolRegistry({
		getCanvas: () => generationCanvas,
		app,
		getSettings: () => settings,
		runGeneration: async node => {
			const upstream = generationCanvas.getEdgesForNode(node)
			capturedImages = upstream
				.filter(edge => edge.to.node.id === node.id && edge.getData().toEnd === 'arrow')
				.map(edge => edge.from.node.getData().file)
			return { placeholderIds: ['placeholder'], expectedOutputType: 'image' }
		},
	})
	const generate = generationTools.find(tool => tool.name === 'generate')
	assert.ok(generate)
	await generate.handler({ nodeId: prompt.id, modelId: 'gpt-image-2', batchCount: 1 })
	assert.equal(generationCanvas.frameCount, 1)
	assert.deepEqual(capturedImages, ['refs/style.png'])

	console.log('MCP GPT Image 2 reference-generation checks passed.')
} finally {
	await rm(tempDir, { recursive: true, force: true })
}
