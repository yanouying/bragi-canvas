import { setIcon, setTooltip, Notice, App, Modal } from 'obsidian'
import { remote } from 'electron'
import * as fs from 'fs'
import { around } from 'monkey-around'
import type { Canvas, CanvasNode } from './types/canvas-internal'

/**
 * Download a media file from the vault to the user's local filesystem.
 * Uses Electron's native save dialog.
 */
async function downloadMediaFile(vaultPath: string, node: CanvasNode): Promise<void> {
	try {
		const app = node.app
		const adapter = app.vault.adapter
		const fileName = vaultPath.split('/').pop() || 'download'
		const ext = fileName.split('.').pop() || ''

		// Read file from vault
		const data = await adapter.readBinary(vaultPath)

		// Use Electron's dialog to save
		const result = await remote.dialog.showSaveDialog({
			defaultPath: fileName,
			filters: [
				{ name: ext.toUpperCase(), extensions: [ext] },
				{ name: 'All Files', extensions: ['*'] },
			],
		})

		if (result.canceled || !result.filePath) return

		// Write using Node.js fs
		fs.writeFileSync(result.filePath, Buffer.from(data))
		new Notice(`Saved: ${result.filePath.split('/').pop()}`)
	} catch (err: unknown) {
		// Fallback: create a download link
		try {
			const app = node.app
			const resourcePath = app.vault.adapter.getResourcePath(vaultPath)
			const a = createEl('a')
			a.href = resourcePath
			a.download = vaultPath.split('/').pop() || 'download'
			activeDocument.body.appendChild(a)
			a.click()
			activeDocument.body.removeChild(a)
			new Notice('Download started')
		} catch {
			new Notice(`Download failed: ${err.message}`)
		}
	}
}

let menuUninstaller: (() => void) | null = null

/** Map from Obsidian's built-in icon tooltip keywords to our custom icon names */
const ICON_REPLACEMENTS: Record<string, string> = {
	'remove': 'bragi-delete',
	'delete': 'bragi-delete',
	'trash': 'bragi-delete',
	'color': 'bragi-color',
	'colour': 'bragi-color',
	'zoom': 'bragi-focus',
	'focus': 'bragi-focus',
	'fit': 'bragi-focus',
	'edit': 'bragi-edit',
	'bragi-edit': 'bragi-edit',
	'pencil': 'bragi-edit',
	'group': 'bragi-group',
	'align': 'bragi-align',
}

/**
 * Replace Obsidian's built-in canvas menu icons with Bragi custom icons.
 * Matches by aria-label / tooltip text (case-insensitive keyword matching).
 */
/**
 * Find the built-in menu button whose aria-label contains the given keyword (case-insensitive).
 * Excludes Bragi-injected buttons.
 */
function findBuiltinByLabel(menuEl: HTMLElement, keyword: string): HTMLElement | null {
	const btns = menuEl.querySelectorAll('.clickable-icon')
	const kw = keyword.toLowerCase()
	for (const el of Array.from(btns)) {
		const cls = el.className
		if (cls.includes('bragi-')) continue
		const label = getButtonLabel(el as HTMLElement)
		if (label.includes(kw)) return el as HTMLElement
	}
	return null
}

type MoreDropdownItem = {
	label: string
	icon: string
	btn: HTMLElement
}

function getButtonLabel(el: HTMLElement): string {
	return [
		el.getAttribute('aria-label'),
		el.getAttribute('data-tooltip'),
		el.getAttribute('title'),
		el.ariaLabel,
		el.textContent,
	]
		.filter((value): value is string => Boolean(value))
		.join(' ')
		.toLowerCase()
}

function getNativeMenuButtons(menuEl: HTMLElement): HTMLElement[] {
	return Array.from(menuEl.querySelectorAll('.clickable-icon'))
		.filter((el): el is HTMLElement => el.instanceOf(HTMLElement))
		.filter(el => !el.className.includes('bragi-'))
}

function insertMenuButton(menuEl: HTMLElement, button: HTMLElement, anchor?: Element | null): void {
	if (anchor?.parentElement) {
		anchor.parentElement.insertBefore(button, anchor)
		return
	}
	menuEl.appendChild(button)
}

function getKnownMoreItems(menuEl: HTMLElement): MoreDropdownItem[] {
	return [
		{ label: 'Edit', icon: 'bragi-edit', btn: findBuiltinByLabel(menuEl, 'edit') || findBuiltinByLabel(menuEl, 'pencil') },
		{ label: 'Set colour', icon: 'bragi-color', btn: findBuiltinByLabel(menuEl, 'colo') },
		{ label: 'Zoom to fit', icon: 'bragi-focus', btn: findBuiltinByLabel(menuEl, 'zoom') || findBuiltinByLabel(menuEl, 'focus') || findBuiltinByLabel(menuEl, 'fit') },
		{ label: 'Delete', icon: 'bragi-delete', btn: findBuiltinByLabel(menuEl, 'delete') || findBuiltinByLabel(menuEl, 'remove') || findBuiltinByLabel(menuEl, 'trash') },
	].filter((item): item is MoreDropdownItem => Boolean(item.btn))
}

function getFallbackMoreItems(menuEl: HTMLElement): MoreDropdownItem[] {
	const nativeItems = getNativeMenuButtons(menuEl)
		.filter(btn => !btn.classList.contains('bragi-hidden'))
		.slice(-3)
		.map((btn, index) => ({
			label: btn.getAttribute('aria-label') || btn.getAttribute('title') || `Action ${index + 1}`,
			icon: 'bragi-more',
			btn,
		}))

	if (nativeItems.length > 0) return nativeItems

	return Array.from(menuEl.querySelectorAll('.bragi-duplicate, .bragi-asset-btn, .bragi-download'))
		.filter((el): el is HTMLElement => el.instanceOf(HTMLElement))
		.map((btn, index) => ({
			label: btn.getAttribute('aria-label') || btn.getAttribute('title') || `Action ${index + 1}`,
			icon: btn.classList.contains('bragi-download')
				? 'bragi-download'
				: btn.classList.contains('bragi-duplicate')
					? 'bragi-duplicate'
					: 'link',
			btn,
		}))
}

function getMoreItems(menuEl: HTMLElement): { items: MoreDropdownItem[]; shouldHide: boolean } {
	const known = getKnownMoreItems(menuEl)
	if (known.length > 0) return { items: known, shouldHide: true }
	return { items: getFallbackMoreItems(menuEl), shouldHide: false }
}

function replaceBuiltinIcons(menuEl: HTMLElement): void {
	const icons = menuEl.querySelectorAll('.clickable-icon:not(.bragi-gen-image):not(.bragi-gen-video):not(.bragi-gen-text)')
	icons.forEach((el) => {
		const label = getButtonLabel(el as HTMLElement)
		for (const [keyword, iconName] of Object.entries(ICON_REPLACEMENTS)) {
			if (label.includes(keyword)) {
				setIcon(el as HTMLElement, iconName)
				break
			}
		}
	})
}

// ── Native align menu hover control ────────────────────────────────────
let nativeAlignCloseTimer: ReturnType<typeof setTimeout> | null = null

function cancelNativeAlignClose(): void {
	if (nativeAlignCloseTimer) {
		activeWindow.clearTimeout(nativeAlignCloseTimer)
		nativeAlignCloseTimer = null
	}
}

function scheduleNativeAlignClose(): void {
	cancelNativeAlignClose()
	nativeAlignCloseTimer = activeWindow.setTimeout(() => closeNativeAlignMenu(), 150)
}

function getOpenAlignMenu(): HTMLElement | null {
	const menus = activeDocument.querySelectorAll('.menu')
	for (const el of Array.from(menus)) {
		if (el.querySelector('.menu-scroll')) return el as HTMLElement
	}
	return null
}

function closeNativeAlignMenu(): void {
	cancelNativeAlignClose()
	const existing = getOpenAlignMenu()
	if (existing) existing.remove()
}

function openNativeAlignMenu(alignBtn: HTMLElement): void {
	cancelNativeAlignClose()
	// Already open?
	if (getOpenAlignMenu()) return
	alignBtn.click()
	// Attach hover handlers once the native menu renders
	requestAnimationFrame(() => {
		const m = getOpenAlignMenu()
		if (!m) return
		m.addEventListener('mouseenter', cancelNativeAlignClose)
		m.addEventListener('mouseleave', scheduleNativeAlignClose)
	})
}

let bragiDropdownCloseTimer: ReturnType<typeof setTimeout> | null = null

function cancelBragiDropdownClose(): void {
	if (bragiDropdownCloseTimer) {
		activeWindow.clearTimeout(bragiDropdownCloseTimer)
		bragiDropdownCloseTimer = null
	}
}

function scheduleBragiDropdownClose(): void {
	cancelBragiDropdownClose()
	bragiDropdownCloseTimer = activeWindow.setTimeout(() => {
		closeBragiDropdown()
	}, 150)
}

/** Close any open Bragi dropdown. */
function closeBragiDropdown(): void {
	cancelBragiDropdownClose()
	activeDocument.querySelectorAll('.bragi-more-dropdown').forEach((el) => el.remove())
}

/** Render a hover-triggered dropdown anchored directly below the ellipsis button. */
function openBragiMoreDropdown(moreBtn: HTMLElement, menuEl: HTMLElement): void {
	cancelBragiDropdownClose()
	if (activeDocument.querySelector('.bragi-more-dropdown')) return

	const { items } = getMoreItems(menuEl)
	if (items.length === 0) return

	const btnRect = moreBtn.getBoundingClientRect()
	const toolbarRect = menuEl.getBoundingClientRect()
	const dropdown = createDiv()
	dropdown.className = 'bragi-more-dropdown'
	dropdown.style.left = `${btnRect.left}px`
	dropdown.style.top = `${toolbarRect.bottom - 1}px`

	for (const { label, icon, btn } of items) {
		const item = dropdown.createDiv({ cls: 'bragi-more-dropdown-item' })
		const iconEl = item.createDiv({ cls: 'bragi-more-dropdown-icon' })
		setIcon(iconEl, icon)
		item.createDiv({ cls: 'bragi-more-dropdown-label', text: label })
		item.addEventListener('click', (e) => {
			e.stopPropagation()
			const wasHidden = btn.classList.contains('bragi-hidden')
			btn.classList.remove('bragi-hidden')
			btn.click()
			if (wasHidden) btn.classList.add('bragi-hidden')
			closeBragiDropdown()
		})
	}

	dropdown.addEventListener('mouseenter', cancelBragiDropdownClose)
	dropdown.addEventListener('mouseleave', scheduleBragiDropdownClose)

	activeDocument.body.appendChild(dropdown)
}

/**
 * Patch the canvas popup menu's render() method to inject Bragi Canvas buttons
 * and restyle the entire menu.
 * Uses the "double render" trick from obsidian-advanced-canvas.
 */
export function patchCanvasMenu(
	canvas: Canvas,
	onGenerateImage: (node: CanvasNode) => void,
	onGenerateVideo: (node: CanvasNode) => void,
	onGenerateText?: (node: CanvasNode) => void,
	onGenerateAudio?: (node: CanvasNode) => void,
	onSTT?: (node: CanvasNode) => void,
	onIsolateAudio?: (node: CanvasNode) => void,
	onDuplicate?: (node: CanvasNode) => void,
	onBatchGenerate?: (type: 'image' | 'video' | 'text' | 'audio', nodes: CanvasNode[]) => void,
	onPanorama?: (node: CanvasNode) => void,
	onGridSplit?: (node: CanvasNode) => void,
	onAssetId?: (node: CanvasNode) => void,
): void {
	if (menuUninstaller) return

	const menu = (canvas as unknown).menu
	if (!menu) return

	menuUninstaller = around(menu.constructor.prototype, {
		render: (next: unknown) => function (this: unknown, ...args: unknown) {
			const result = next.call(this, ...args)

			const menuEl = this.menuEl as HTMLElement
			if (!menuEl) return result

			// Always add class and replace built-in icons (each render resets them)
			menuEl.classList.add('bragi-canvas-menu')
			replaceBuiltinIcons(menuEl)

			const canvas = this.canvas as Canvas
			const selSize = canvas?.selection?.size || 0

			// ── More dropdown — collapse delete / color / focus / edit into ellipsis menu ──
			if (selSize >= 1) {
				const { items: collapsed, shouldHide } = getMoreItems(menuEl)

				// Re-hide every render (builtins may be recreated on selection change)
				if (shouldHide) {
					for (const { btn } of collapsed) btn.classList.add('bragi-hidden')
				}

				if (collapsed.length > 0 && !menuEl.querySelector('.bragi-more')) {
					const moreBtn = createDiv()
					moreBtn.className = 'clickable-icon bragi-more'
					setIcon(moreBtn, 'bragi-more')
					setTooltip(moreBtn, 'More', { placement: 'top' })

					const anchor = collapsed[0].btn
					insertMenuButton(menuEl, moreBtn, anchor)

					moreBtn.addEventListener('mouseenter', () => openBragiMoreDropdown(moreBtn, menuEl))
					moreBtn.addEventListener('mouseleave', () => scheduleBragiDropdownClose())
					moreBtn.addEventListener('click', (e) => {
						e.stopPropagation()
						openBragiMoreDropdown(moreBtn, menuEl)
					})
				}
			}

			// ── Pin (quick purple color) — insert before color palette button ──
			if (selSize >= 1 && !menuEl.querySelector('.bragi-pin')) {
				const colorBtn = findBuiltinByLabel(menuEl, 'colo')
				const pinBtn = createDiv()
				pinBtn.className = 'clickable-icon bragi-pin'
				setIcon(pinBtn, 'bragi-pin')
				setTooltip(pinBtn, 'Mark', { placement: 'top' })
				pinBtn.addEventListener('click', (e) => {
					e.stopPropagation()
					const nodes = Array.from(canvas.selection)
					for (const n of nodes) {
						const d = n.getData() as unknown
						n.setData({ ...d, color: d.color === '6' ? '' : '6' })
					}
					void canvas.requestSave()
				})
				insertMenuButton(menuEl, pinBtn, colorBtn)
			}

			// ── 360° viewer — single image node, insert before Mark (Pin) ──
			if (selSize === 1 && onPanorama && !menuEl.querySelector('.bragi-pano')) {
				const only = Array.from(canvas.selection)[0]
				const d = only?.getData() as unknown
				const isImage = d?.type === 'file' && /\.(png|jpe?g|webp)$/i.test(d.file || '')
				if (isImage) {
					const pinBtn = menuEl.querySelector('.bragi-pin')
					const anchor = pinBtn || findBuiltinByLabel(menuEl, 'colo')
					if (anchor) {
						const panoBtn = createDiv()
						panoBtn.className = 'clickable-icon bragi-pano'
						setIcon(panoBtn, 'bragi-360')
						setTooltip(panoBtn, '360° viewer', { placement: 'top' })
						panoBtn.addEventListener('click', (e) => {
							e.stopPropagation()
							onPanorama(only)
						})
						insertMenuButton(menuEl, panoBtn, anchor)
					}
				}
			}

			// ── Split grid — single image node, leftmost (before 360) ──
			if (selSize === 1 && onGridSplit && !menuEl.querySelector('.bragi-split')) {
				const only = Array.from(canvas.selection)[0]
				const d = only?.getData() as unknown
				const isImage = d?.type === 'file' && /\.(png|jpe?g|webp|gif)$/i.test(d.file || '')
				if (isImage) {
					const panoBtn = menuEl.querySelector('.bragi-pano')
					const pinBtn = menuEl.querySelector('.bragi-pin')
					const anchor = panoBtn || pinBtn || findBuiltinByLabel(menuEl, 'colo')
					if (anchor) {
						const splitBtn = createDiv()
						splitBtn.className = 'clickable-icon bragi-split'
						setIcon(splitBtn, 'bragi-split')
						setTooltip(splitBtn, 'Split grid', { placement: 'top' })
						splitBtn.addEventListener('click', (e) => {
							e.stopPropagation()
							onGridSplit(only)
						})
						insertMenuButton(menuEl, splitBtn, anchor)
					}
				}
			}

			// ── Align button: hover-to-open (native menu) ──
			if (selSize > 1) {
				const alignBtn = findBuiltinByLabel(menuEl, 'align') || findBuiltinByLabel(menuEl, 'arrange')
				if (alignBtn && !(alignBtn as unknown)._bragiHoverBound) {
					(alignBtn as unknown)._bragiHoverBound = true
					alignBtn.addEventListener('mouseenter', () => openNativeAlignMenu(alignBtn))
					alignBtn.addEventListener('mouseleave', scheduleNativeAlignClose)
				}
			}

			if (!canvas?.selection || selSize === 0) return result

			// ── Multi-select: batch generate buttons ──
			if (selSize > 1) {
				if (menuEl.querySelector('.bragi-gen-image, .bragi-gen-video, .bragi-gen-text, .bragi-gen-audio')) return result
				if (!onBatchGenerate) return result
				const allNodes = Array.from(canvas.selection)
				const promptNodes = allNodes.filter(n => {
					const d = n.getData() as unknown
					return d.type === 'text' || (d.type === 'file' && /\.md$/i.test(d.file || ''))
				})
				if (promptNodes.length === 0) return result

				menuEl.createDiv({ cls: 'canvas-menu-separator bragi-separator' })

				for (const [type, icon, label] of [
					['image', 'bragi-gen-image', 'Generate Image'],
					['video', 'bragi-gen-video', 'Generate Video'],
					['text', 'bragi-gen-text', 'Generate Text'],
					['audio', 'bragi-gen-audio', 'Generate Audio'],
				] as const) {
					const btn = menuEl.createDiv({ cls: `clickable-icon bragi-gen-${type}` })
					setIcon(btn, icon)
					setTooltip(btn, `${label} (${promptNodes.length})`, { placement: 'top' })
					btn.addEventListener('click', (e) => {
						e.stopPropagation()
						onBatchGenerate(type, promptNodes)
					})
				}

				next.call(this)
				return result
			}

			const selectedNode = canvas.selection.values().next().value as CanvasNode
			const nodeData = selectedNode.getData()

			const isTextNode = nodeData.type === 'text'
			const isNoteNode = nodeData.type === 'file' && (nodeData as unknown).file?.endsWith('.md')
			const filePath = (nodeData as unknown).file || ''
			const isAudioNode = nodeData.type === 'file' && /\.(mp3|wav|flac|m4a|ogg|aac)$/i.test(filePath)
			const isMediaNode = nodeData.type === 'file' && /\.(png|jpg|jpeg|webp|gif|mp4|mov|webm|mp3|wav|flac|m4a|ogg|aac)$/i.test(filePath)
			const isGenerating = (nodeData as unknown).bragiGenerating === true || (nodeData as unknown).ovidGenerating === true

			// Generating node: hide all menu items except focus/zoom
			if (isGenerating) {
				const items = menuEl.querySelectorAll('.clickable-icon')
				items.forEach((el) => {
					const label = (el.getAttribute('aria-label') || '').toLowerCase()
					if (!label.includes('zoom') && !label.includes('focus') && !label.includes('fit')) {
						(el as HTMLElement).classList.add('bragi-hidden')
					}
				})
				// Also hide separators
				menuEl.querySelectorAll('.canvas-menu-separator').forEach((el) => {
					(el as HTMLElement).classList.add('bragi-hidden')
				})
				next.call(this)
				return result
			}

			if (!isTextNode && !isNoteNode && !isAudioNode && !isMediaNode) return result

			// Duplicate with connections — right after the built-in edit icon
			if (onDuplicate && !menuEl.querySelector('.bragi-duplicate')) {
				const edges = canvas.getEdgesForNode(selectedNode)
				const hasIncoming = edges?.some(e => e.to.node.id === selectedNode.id)
				if (hasIncoming) {
					const dupBtn = menuEl.createDiv({ cls: 'clickable-icon bragi-duplicate' })
					setIcon(dupBtn, 'bragi-duplicate')
					setTooltip(dupBtn, 'Duplicate with Connections', { placement: 'top' })
					dupBtn.addEventListener('click', (e) => {
						e.stopPropagation()
						onDuplicate(selectedNode)
					})
				}
			}

			// Separator between duplicate/built-in icons and generation icons
			if (!menuEl.querySelector('.bragi-actions-separator')) {
				menuEl.createDiv({ cls: 'canvas-menu-separator bragi-separator bragi-actions-separator' })
			}

			if (isTextNode || isNoteNode) {
				// Text/note node: image, video, text, audio
				if (!menuEl.querySelector('.bragi-gen-image')) {
					const imgBtn = menuEl.createDiv({ cls: 'clickable-icon bragi-gen-image' })
					setIcon(imgBtn, 'bragi-gen-image')
					setTooltip(imgBtn, 'Generate image', { placement: 'top' })
					imgBtn.addEventListener('click', (e) => {
						e.stopPropagation()
						onGenerateImage(selectedNode)
					})
				}

				if (!menuEl.querySelector('.bragi-gen-video')) {
					const vidBtn = menuEl.createDiv({ cls: 'clickable-icon bragi-gen-video' })
					setIcon(vidBtn, 'bragi-gen-video')
					setTooltip(vidBtn, 'Generate video', { placement: 'top' })
					vidBtn.addEventListener('click', (e) => {
						e.stopPropagation()
						onGenerateVideo(selectedNode)
					})
				}

				if (onGenerateText && !menuEl.querySelector('.bragi-gen-text')) {
					const txtBtn = menuEl.createDiv({ cls: 'clickable-icon bragi-gen-text' })
					setIcon(txtBtn, 'bragi-gen-text')
					setTooltip(txtBtn, 'Generate text', { placement: 'top' })
					txtBtn.addEventListener('click', (e) => {
						e.stopPropagation()
						onGenerateText(selectedNode)
					})
				}

				if (onGenerateAudio && !menuEl.querySelector('.bragi-gen-audio')) {
					const audioBtn = menuEl.createDiv({ cls: 'clickable-icon bragi-gen-audio' })
					setIcon(audioBtn, 'bragi-gen-audio')
					setTooltip(audioBtn, 'Generate audio', { placement: 'top' })
					audioBtn.addEventListener('click', (e) => {
						e.stopPropagation()
						onGenerateAudio(selectedNode)
					})
				}
			}

			if (isAudioNode) {
				// Audio file node: STT, isolate
				if (onSTT && !menuEl.querySelector('.bragi-stt')) {
					const sttBtn = menuEl.createDiv({ cls: 'clickable-icon bragi-stt' })
					setIcon(sttBtn, 'bragi-stt')
					setTooltip(sttBtn, 'Speech to text', { placement: 'top' })
					sttBtn.addEventListener('click', (e) => {
						e.stopPropagation()
						onSTT(selectedNode)
					})
				}

				if (onIsolateAudio && !menuEl.querySelector('.bragi-isolate')) {
					const isolateBtn = menuEl.createDiv({ cls: 'clickable-icon bragi-isolate' })
					setIcon(isolateBtn, 'bragi-isolate')
					setTooltip(isolateBtn, 'Isolate audio', { placement: 'top' })
					isolateBtn.addEventListener('click', (e) => {
						e.stopPropagation()
						onIsolateAudio(selectedNode)
					})
				}
			}

			if (isImageNode && onAssetId && !menuEl.querySelector('.bragi-asset-btn')) {
				const currentAssetId = (nodeData as unknown).bragiAssetId || ''
				const assetBtn = menuEl.createDiv({ cls: `clickable-icon bragi-asset-btn ${currentAssetId ? 'has-asset' : ''}` })
				setIcon(assetBtn, 'link')
				setTooltip(assetBtn, currentAssetId ? 'Asset ID bound' : 'Set asset ID', { placement: 'top' })
				assetBtn.addEventListener('click', (e) => {
					e.stopPropagation()
					onAssetId(selectedNode)
				})
			}

			// Download button for all media nodes (image, video, audio)
			if (isMediaNode && !menuEl.querySelector('.bragi-download')) {
				const downloadBtn = menuEl.createDiv({ cls: 'clickable-icon bragi-download' })
				setIcon(downloadBtn, 'bragi-download')
				setTooltip(downloadBtn, 'Download', { placement: 'top' })
				downloadBtn.addEventListener('click', (e) => {
					e.stopPropagation()
					void downloadMediaFile(filePath, selectedNode)
				})
			}

			// Re-render to recalculate position with new width
			next.call(this)

			return result
		},
	})
}

/** Map from canvas control aria-label keywords to Bragi control icon names.
 *  Matches actual Obsidian aria-labels: "Canvas settings", "Zoom in",
 *  "Reset zoom", "Zoom to fit\n(⇧ 1)", "Zoom out", "Undo", "Redo", "Canvas help". */
const CANVAS_CTRL_REPLACEMENTS: [string, string][] = [
	['zoom in', 'bragi-ctrl-zoom-in'],
	['zoom out', 'bragi-ctrl-zoom-out'],
	['zoom to fit', 'bragi-ctrl-zoom-fit'],
	['reset zoom', 'bragi-ctrl-reset'],
	['undo', 'bragi-ctrl-undo'],
	['redo', 'bragi-ctrl-redo'],
	['canvas settings', 'bragi-ctrl-settings'],
	['canvas help', 'bragi-ctrl-help'],
]

/**
 * Replace Obsidian's built-in canvas control icons (right-side toolbar)
 * with Bragi custom icons.
 */
export function replaceCanvasControlIcons(containerEl: HTMLElement): void {
	const icons = containerEl.querySelectorAll('.canvas-controls .canvas-control-item')
	icons.forEach((el) => {
		const label = (el.getAttribute('aria-label') || '').toLowerCase()
		if (label.includes('canvas settings')) {
			const group = (el as HTMLElement).closest('.canvas-control-group')
			if (group) group.classList.add('bragi-hidden')
			else (el as HTMLElement).classList.add('bragi-hidden')
			return
		}
		for (const [keyword, iconName] of CANVAS_CTRL_REPLACEMENTS) {
			if (label.includes(keyword)) {
				setIcon(el as HTMLElement, iconName)
				break
			}
		}
	})
}

/** Map from bottom card menu aria-label keywords to Bragi card icon names.
 *  Matches actual Obsidian aria-labels: "Drag to add card",
 *  "Drag to add note from vault", "Drag to add media from vault". */
const CANVAS_CARD_REPLACEMENTS: [string, string][] = [
	['add note', 'bragi-card-clipboard'],
	['add media', 'bragi-card-file'],
	['add card', 'bragi-card-text'],
]

/**
 * Replace Obsidian's built-in canvas card menu icons (bottom toolbar)
 * with Bragi custom icons, and append export / import / settings buttons.
 */
export function replaceCanvasCardMenuIcons(containerEl: HTMLElement, app?: App, pluginId?: string): void {
	const menu = containerEl.querySelector('.canvas-card-menu')
	if (!menu) return

	const icons = menu.querySelectorAll('.canvas-card-menu-button')
	icons.forEach((el) => {
		const label = (el.getAttribute('aria-label') || '').toLowerCase()
		for (const [keyword, iconName] of CANVAS_CARD_REPLACEMENTS) {
			if (label.includes(keyword)) {
				setIcon(el as HTMLElement, iconName)
				break
			}
		}
	})

	if (!app) return
	if (menu.querySelector('.bragi-card-separator')) return // already injected

	const makeBtn = (iconName: string, tooltip: string, onClick: () => void): HTMLElement => {
		const btn = createDiv()
		btn.className = 'canvas-card-menu-button bragi-card-extra'
		setIcon(btn, iconName)
		setTooltip(btn, tooltip, { placement: 'top' })
		btn.addEventListener('click', (e) => {
			e.preventDefault()
			e.stopPropagation()
			onClick()
		})
		return btn
	}

	const sep = createDiv()
	sep.className = 'bragi-card-separator'
	menu.appendChild(sep)

	menu.appendChild(makeBtn('bragi-card-export', 'Export canvas as .bragi package', () => {
		(app as unknown).commands.executeCommandById('bragi-canvas:bragi-export-canvas')
	}))

	menu.appendChild(makeBtn('bragi-card-import', 'Import .bragi package', () => {
		new BragiImportChoiceModal(app, (mode) => {
			const id = mode === 'merge' ? 'bragi-canvas:bragi-import-merge' : 'bragi-canvas:bragi-import-new'
			;(app as unknown).commands.executeCommandById(id)
		}).open()
	}))

	menu.appendChild(makeBtn('bragi-card-settings', 'Bragi Canvas settings', () => {
		const setting = (app as unknown).setting
		setting.open()
		setting.openTabById(pluginId || 'bragi-canvas')
	}))
}

class BragiImportChoiceModal extends Modal {
	constructor(app: App, private onChoose: (mode: 'merge' | 'new') => void) {
		super(app)
	}

	onOpen() {
		const { contentEl, titleEl, modalEl } = this
		modalEl.classList.add('bragi-modal')
		titleEl.setText('Import canvas')
		contentEl.createEl('p', { text: 'Where should the contents go?' })

		const btnRow = contentEl.createDiv({ cls: 'modal-button-container' })

		const newBtn = btnRow.createEl('button', { text: 'Open as new canvas' })
		newBtn.addEventListener('click', () => {
			this.close()
			this.onChoose('new')
		})

		const mergeBtn = btnRow.createEl('button', { text: 'Add to this canvas', cls: 'mod-cta' })
		mergeBtn.addEventListener('click', () => {
			this.close()
			this.onChoose('merge')
		})
	}

	onClose() {
		this.contentEl.empty()
	}
}

export function unpatchCanvasMenu(): void {
	if (menuUninstaller) {
		menuUninstaller()
		menuUninstaller = null
	}
}

export function removeToolbarButtons(): void {
	activeDocument.querySelectorAll('.bragi-gen-image, .bragi-gen-video, .bragi-gen-text, .bragi-gen-audio, .bragi-stt, .bragi-isolate, .bragi-download, .bragi-asset-btn, .bragi-duplicate, .bragi-pin, .bragi-pano, .bragi-split, .bragi-grid, .bragi-more').forEach(el => {
		if (el.previousElementSibling?.classList.contains('canvas-menu-separator')) {
			el.previousElementSibling.remove()
		}
		el.remove()
	})
	activeDocument.querySelectorAll('.canvas-card-menu .bragi-card-extra, .canvas-card-menu .bragi-card-separator').forEach(el => el.remove())
}
