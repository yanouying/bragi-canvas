import type BragiCanvas from './main'
import type { Canvas, CanvasNode } from './types/canvas-internal'
import {
	type Token360AssetCreds,
	getToken360Asset,
	isToken360AssetNotFound,
	uploadToken360Asset,
	waitForToken360AssetActive,
} from './providers/token360-assets'

const PROVIDER_KEY = 'token360'
function imageExtToMime(ext: string): string {
	if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
	if (ext === 'webp') return 'image/webp'
	return 'image/png'
}

function sniffImageExt(bytes: ArrayBuffer): 'png' | 'jpg' | 'webp' | null {
	const b = new Uint8Array(bytes)
	if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
	if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
	if (
		b.length >= 12 &&
		b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
		b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
	) return 'webp'
	return null
}

function basenameWithoutExt(filename: string): string {
	const index = filename.lastIndexOf('.')
	return index > 0 ? filename.slice(0, index) : filename
}

function getImageFileInfo(filePath: string, bytes: ArrayBuffer): { ext: 'png' | 'jpg' | 'webp'; mime: string; filename: string } {
	const originalName = filePath.split('/').pop() || 'ref'
	const ext = sniffImageExt(bytes)
	if (!ext) throw new Error(`Token360 assets support PNG, JPG, JPEG, or WebP images only: ${originalName}`)
	return {
		ext,
		mime: imageExtToMime(ext),
		filename: `${basenameWithoutExt(originalName)}.${ext}`,
	}
}

function convertImageToPng(bytes: ArrayBuffer, mime: string): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
		const image = new Image()
		image.onload = () => {
			const width = image.naturalWidth || image.width
			const height = image.naturalHeight || image.height
			URL.revokeObjectURL(url)
			if (!width || !height) {
				reject(new Error('Token360 asset upload: image has no dimensions'))
				return
			}
			const canvas = createEl('canvas')
			canvas.width = width
			canvas.height = height
			const ctx = canvas.getContext('2d')
			if (!ctx) {
				reject(new Error('Token360 asset upload: could not create image canvas'))
				return
			}
			ctx.drawImage(image, 0, 0)
			canvas.toBlob(blob => {
				if (!blob) {
					reject(new Error('Token360 asset upload: could not convert image to PNG'))
					return
				}
				blob.arrayBuffer().then(resolve, reject)
			}, 'image/png')
		}
		image.onerror = () => {
			URL.revokeObjectURL(url)
			reject(new Error('Token360 asset upload: could not decode image'))
		}
		image.src = url
	})
}

async function prepareUploadImage(filePath: string, bytes: ArrayBuffer): Promise<{ bytes: ArrayBuffer; mime: string; filename: string }> {
	const info = getImageFileInfo(filePath, bytes)
	if (info.ext !== 'webp') return { bytes, mime: info.mime, filename: info.filename }
	return {
		bytes: await convertImageToPng(bytes, info.mime),
		mime: 'image/png',
		filename: `${basenameWithoutExt(info.filename)}.png`,
	}
}

function findNodeByPath(canvas: Canvas, filePath: string): CanvasNode | null {
	for (const node of canvas.nodes.values()) {
		const d = node.getData() as { type?: string; file?: string }
		if (d.type === 'file' && d.file === filePath) return node
	}
	return null
}

export function getToken360AssetCreds(plugin: BragiCanvas): Token360AssetCreds | null {
	const providers = plugin.settings.providers
	const apiKey = (providers.token360 || '').trim()
	const groupId = (providers.token360AssetGroupId || '').trim()
	if (!apiKey || !groupId) return null
	return { apiKey, groupId }
}

function getCachedAssetId(node: CanvasNode): string | null {
	const d = node.getData() as { bragiAssetIds?: Record<string, string> }
	return d.bragiAssetIds?.[PROVIDER_KEY] || null
}

function setCachedAssetId(node: CanvasNode, assetId: string): void {
	const d = node.getData() as { bragiAssetIds?: Record<string, string> }
	const map = { ...(d.bragiAssetIds || {}), [PROVIDER_KEY]: assetId }
	node.setData({ ...d, bragiAssetIds: map })
}

function clearCachedAssetId(node: CanvasNode): void {
	const d = node.getData() as { bragiAssetIds?: Record<string, string> }
	if (!d.bragiAssetIds) return
	const rest = { ...d.bragiAssetIds }
	delete rest[PROVIDER_KEY]
	node.setData({ ...d, bragiAssetIds: rest })
}

export async function ensureToken360Asset(
	plugin: BragiCanvas,
	canvas: Canvas,
	filePath: string,
	creds: Token360AssetCreds,
): Promise<string> {
	const binary = await plugin.app.vault.adapter.readBinary(filePath)
	const upload = await prepareUploadImage(filePath, binary)
	const node = findNodeByPath(canvas, filePath)

	if (node) {
		const cached = getCachedAssetId(node)
		if (cached) {
			try {
				const { status } = await getToken360Asset(creds, cached)
				if (status === 'Active') return `asset://${cached}`
				if (status === 'Processing') {
					await waitForToken360AssetActive(creds, cached)
					return `asset://${cached}`
				}
				clearCachedAssetId(node)
				if (status === 'Rejected') {
					throw new Error(`Reference image rejected by Token360 review: ${upload.filename}`)
				}
				if (status === 'Inactive') {
					throw new Error(`Reference image inactive in Token360: ${upload.filename}`)
				}
			} catch (err: unknown) {
				if (isToken360AssetNotFound(err)) {
					clearCachedAssetId(node)
				} else {
					throw err
				}
			}
		}
	}

	const assetId = await uploadToken360Asset(creds, upload.filename, upload.mime, upload.bytes)
	await waitForToken360AssetActive(creds, assetId)
	if (node) setCachedAssetId(node, assetId)
	return `asset://${assetId}`
}
