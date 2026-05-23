/* eslint-disable @typescript-eslint/no-unsafe-member-access -- Canvas preview nodes use runtime-shaped internals. */
import { existsSync } from 'fs'
import { join } from 'path'
import { Notice } from 'obsidian'
import { markNodeFailed, styleGeneratingPlaceholder } from './canvas-ops'
import type { Canvas } from './types/canvas-internal'

const PREVIEW_FLAG = '.bragi-preview-placeholders'
const NODE_WIDTH = 320
const NODE_HEIGHT = 200
const NODE_GAP = 40

function getCanvasCenter(canvas: Canvas): { x: number; y: number } {
	const posCenter = (canvas as unknown as { posCenter?: () => { x: number; y: number } }).posCenter
	if (typeof posCenter === 'function') return posCenter.call(canvas)
	return { x: 0, y: 0 }
}

/** Spawn generating + failed demo nodes near the current viewport center. */
export function spawnPlaceholderStylePreviews(canvas: Canvas): boolean {
	try {
		const center = getCanvasCenter(canvas)
		const totalWidth = NODE_WIDTH * 2 + NODE_GAP
		const startX = center.x - totalWidth / 2
		const y = center.y - NODE_HEIGHT / 2

		const genNode = canvas.createTextNode({
			text: '',
			pos: { x: startX, y },
			size: { width: NODE_WIDTH, height: NODE_HEIGHT },
			focus: false,
		})
		styleGeneratingPlaceholder(genNode, 'nano-banana-pro', Date.now() - 12_000)

		const failedNode = canvas.createTextNode({
			text: '',
			pos: { x: startX + NODE_WIDTH + NODE_GAP, y },
			size: { width: NODE_WIDTH, height: NODE_HEIGHT },
			focus: false,
		})
		markNodeFailed(failedNode, 'API rate limit exceeded — retry in 30s')

		void canvas.requestSave()
		return true
	} catch (err) {
		console.error('Bragi placeholder preview failed:', err)
		new Notice(`Bragi preview failed: ${err instanceof Error ? err.message : String(err)}`)
		return false
	}
}

/** Drop an empty `.bragi-preview-placeholders` file in the plugin folder to auto-spawn once per canvas. */
export function maybeSpawnPlaceholderStylePreviews(
	canvas: Canvas,
	pluginDir: string,
	canvasPath: string | undefined,
	spawnedCanvasPaths: Set<string>,
): void {
	if (!existsSync(join(pluginDir, PREVIEW_FLAG))) return
	if (!canvasPath || spawnedCanvasPaths.has(canvasPath)) return

	if (spawnPlaceholderStylePreviews(canvas)) {
		spawnedCanvasPaths.add(canvasPath)
		new Notice('Bragi preview: generating + failed nodes added near viewport center. Remove .bragi-preview-placeholders to stop auto-spawn.')
	}
}
