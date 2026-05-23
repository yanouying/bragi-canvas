/** DotmSquare19 loader + centered elapsed + bottom model pill. */

import { buildSquare19Grid, mountSquare19Loader, stopSquare19Loader } from './dotm-square-19'

export interface GeneratingOverlayElements {
	overlayEl: HTMLDivElement
	loaderEl: HTMLDivElement
	modelEl: HTMLSpanElement
	elapsedEl: HTMLDivElement
}

export function createGeneratingOverlay(): GeneratingOverlayElements {
	const overlayEl = createDiv({ cls: 'bragi-generating-overlay' })
	const center = overlayEl.createDiv({ cls: 'bragi-generating-center' })
	const loaderEl = center.createDiv({ cls: 'bragi-generating-loader bragi-dmx-root bragi-dotm-square-19' })
	loaderEl.setAttr('role', 'status')
	loaderEl.setAttr('aria-label', 'Loading')
	buildSquare19Grid(loaderEl)
	mountSquare19Loader(loaderEl)
	const elapsedEl = center.createDiv({ cls: 'bragi-generating-elapsed' })
	const pill = overlayEl.createDiv({ cls: 'bragi-generating-model-pill' })
	const modelEl = pill.createSpan({ cls: 'bragi-generating-model' })
	return { overlayEl, loaderEl, modelEl, elapsedEl }
}

export function formatGeneratingElapsed(startedAt: number): string {
	const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
	return `${elapsed}s`
}

export function updateGeneratingOverlay(
	elements: GeneratingOverlayElements,
	modelName: string,
	startedAt: number,
): void {
	elements.modelEl.textContent = modelName
	elements.elapsedEl.textContent = formatGeneratingElapsed(startedAt)
}

export function stopGeneratingOverlayAnimation(elements: GeneratingOverlayElements): void {
	stopSquare19Loader(elements.loaderEl)
}

export function findGeneratingOverlay(nodeEl: HTMLElement): GeneratingOverlayElements | null {
	const overlayEl = nodeEl.querySelector<HTMLDivElement>('.bragi-generating-overlay')
	if (!overlayEl) return null
	const loaderEl = overlayEl.querySelector<HTMLDivElement>('.bragi-generating-loader')
	const modelEl = overlayEl.querySelector<HTMLSpanElement>('.bragi-generating-model')
	const elapsedEl = overlayEl.querySelector<HTMLDivElement>('.bragi-generating-elapsed')
	if (!loaderEl || !modelEl || !elapsedEl) return null
	const running = (loaderEl as { _bragiSquare19Stop?: () => void })._bragiSquare19Stop
	if (!running) mountSquare19Loader(loaderEl)
	return { overlayEl, loaderEl, modelEl, elapsedEl }
}
