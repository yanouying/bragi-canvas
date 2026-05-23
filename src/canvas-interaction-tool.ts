import type { Canvas } from './types/canvas-internal'

export type CanvasInteractionTool = 'cursor' | 'hand'

interface CanvasPanInternals {
	isHoldingSpace?: boolean
	moverEl?: HTMLElement & { detach?: () => void }
	wrapperEl?: HTMLElement | null
	zIndexCounter?: number
}

let preferredTool: CanvasInteractionTool = 'cursor'
let activeCanvas: Canvas | null = null
let displayChangeCallback: (() => void) | null = null
let panObserver: MutationObserver | null = null
let observedWrapper: HTMLElement | null = null

export function getPreferredInteractionTool(): CanvasInteractionTool {
	return preferredTool
}

export function getActiveInteractionTool(canvas: Canvas): CanvasInteractionTool {
	if (preferredTool === 'hand') return 'hand'
	return isObsidianPanActive(canvas) ? 'hand' : 'cursor'
}

export function setInteractionToolDisplaySync(callback: (() => void) | null): void {
	displayChangeCallback = callback
}

export function setCanvasInteractionTool(canvas: Canvas, tool: CanvasInteractionTool): void {
	preferredTool = tool
	activeCanvas = canvas
	applyCanvasInteractionTool(canvas, tool)
	ensurePanStateObserver(canvas)
}

export function syncCanvasInteractionTool(canvas: Canvas): void {
	activeCanvas = canvas
	applyCanvasInteractionTool(canvas, preferredTool)
	ensurePanStateObserver(canvas)
}

export function teardownCanvasInteractionTool(): void {
	panObserver?.disconnect()
	panObserver = null
	observedWrapper = null
	displayChangeCallback = null

	if (activeCanvas) applyCanvasInteractionTool(activeCanvas, 'cursor')
	activeCanvas = null
	preferredTool = 'cursor'
}

function isObsidianPanActive(canvas: Canvas): boolean {
	const internals = canvas as unknown as CanvasPanInternals
	return !!internals.isHoldingSpace && !!internals.moverEl?.parentElement
}

function applyCanvasInteractionTool(canvas: Canvas, tool: CanvasInteractionTool): void {
	const internals = canvas as unknown as CanvasPanInternals
	const wrapper = internals.wrapperEl
	const mover = internals.moverEl
	if (!wrapper || !mover) return

	if (tool === 'hand') {
		if (!mover.parentElement) {
			wrapper.appendChild(mover)
			mover.style.zIndex = String((internals.zIndexCounter ?? 0) + 4)
		}
		internals.isHoldingSpace = true
		wrapper.classList.add('bragi-canvas-hand-tool')
		raiseCardMenuAboveMover(wrapper, internals.zIndexCounter ?? 0)
		return
	}

	if (typeof mover.detach === 'function') mover.detach()
	else mover.remove()
	internals.isHoldingSpace = false
	wrapper.classList.remove('bragi-canvas-hand-tool')
	resetCardMenuLayer(wrapper)
}

function raiseCardMenuAboveMover(wrapper: HTMLElement, zIndexCounter: number): void {
	const menu = wrapper.querySelector<HTMLElement>('.canvas-card-menu')
	if (!menu) return
	menu.style.zIndex = String(zIndexCounter + 10)
}

function resetCardMenuLayer(wrapper: HTMLElement): void {
	const menu = wrapper.querySelector<HTMLElement>('.canvas-card-menu')
	menu?.style.removeProperty('z-index')
}

function ensurePanStateObserver(canvas: Canvas): void {
	const wrapper = (canvas as unknown as CanvasPanInternals).wrapperEl
	if (!wrapper) return
	if (observedWrapper === wrapper && panObserver) return

	panObserver?.disconnect()
	observedWrapper = wrapper
	panObserver = new MutationObserver(() => handleObsidianPanChange(canvas))
	panObserver.observe(wrapper, { childList: true })
}

function handleObsidianPanChange(canvas: Canvas): void {
	if (preferredTool === 'hand') {
		if (!isObsidianPanActive(canvas)) {
			applyCanvasInteractionTool(canvas, 'hand')
		}
	}
	notifyDisplayChange()
}

function notifyDisplayChange(): void {
	displayChangeCallback?.()
}
