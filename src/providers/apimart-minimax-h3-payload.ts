export const MINIMAX_H3_MODEL_ID = 'MiniMax-H3'

const MINIMAX_H3_MODES = new Set([
	'text-to-video',
	'first-frame',
	'first-last-frame',
	'image-ref',
	'video-ref',
])
const MINIMAX_H3_RESOLUTIONS = new Set(['2K', '768P'])
const MINIMAX_H3_RATIOS = new Set(['adaptive', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'])

export interface ApimartMinimaxH3Request {
	model: typeof MINIMAX_H3_MODEL_ID
	prompt: string
	duration: number
	resolution: '2K' | '768P'
	watermark: boolean
	aspect_ratio?: string
	first_frame_image?: string
	last_frame_image?: string
	image_urls?: string[]
	video_urls?: string[]
	audio_urls?: string[]
}

function stringParam(value: unknown, fallback: string): string {
	if (typeof value === 'string' && value.trim()) return value.trim()
	if (typeof value === 'number' || typeof value === 'boolean') return String(value)
	return fallback
}

function stringList(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
		: []
}

function booleanParam(value: unknown, fallback: boolean): boolean {
	if (value === undefined || value === null || value === '') return fallback
	if (value === true || value === 'true') return true
	if (value === false || value === 'false') return false
	throw new Error('APIMart MiniMax-H3 watermark must be true or false.')
}

function assertNoReferences(genMode: string, refImages: string[], refVideos: string[], refAudios: string[]): void {
	if (refImages.length + refVideos.length + refAudios.length > 0) {
		throw new Error(`APIMart MiniMax-H3 ${genMode} mode does not accept reference media.`)
	}
}

export function buildApimartMinimaxH3Request(
	prompt: string,
	params: Record<string, unknown> = {},
): ApimartMinimaxH3Request {
	if (!prompt.trim()) throw new Error('APIMart MiniMax-H3 prompt is required.')
	if (prompt.length > 7000) throw new Error('APIMart MiniMax-H3 prompt must be at most 7000 characters.')

	const genMode = stringParam(params.genMode, 'text-to-video')
	if (!MINIMAX_H3_MODES.has(genMode)) {
		throw new Error(`APIMart MiniMax-H3 does not support ${genMode} mode.`)
	}

	const duration = Number(params.duration ?? params.durationSeconds ?? 5)
	if (!Number.isInteger(duration) || duration < 4 || duration > 15) {
		throw new Error('APIMart MiniMax-H3 duration must be a whole number from 4 to 15 seconds.')
	}

	const resolution = stringParam(params.resolution, '2K').toUpperCase()
	if (!MINIMAX_H3_RESOLUTIONS.has(resolution)) {
		throw new Error('APIMart MiniMax-H3 resolution must be 2K or 768P.')
	}

	const ratio = stringParam(params.aspect_ratio ?? params.aspectRatio ?? params.ratio, 'adaptive').toLowerCase()
	if (!MINIMAX_H3_RATIOS.has(ratio)) {
		throw new Error(`APIMart MiniMax-H3 does not support aspect ratio ${ratio}.`)
	}

	const refImages = stringList(params.refImages)
	const refVideos = stringList(params.refVideos)
	const refAudios = stringList(params.refAudios)
	if (refImages.length > 9) throw new Error('APIMart MiniMax-H3 supports at most 9 reference images.')
	if (refVideos.length > 3) throw new Error('APIMart MiniMax-H3 supports at most 3 reference videos.')
	if (refAudios.length > 3) throw new Error('APIMart MiniMax-H3 supports at most 3 reference audio clips.')
	if (refAudios.length > 0 && refImages.length + refVideos.length === 0) {
		throw new Error('APIMart MiniMax-H3 reference audio must be paired with a reference image or video.')
	}

	const body: ApimartMinimaxH3Request = {
		model: MINIMAX_H3_MODEL_ID,
		prompt,
		duration,
		resolution: resolution as '2K' | '768P',
		watermark: booleanParam(params.watermark ?? params.aigc_watermark, false),
	}

	if (genMode === 'text-to-video') {
		assertNoReferences(genMode, refImages, refVideos, refAudios)
		body.aspect_ratio = ratio === 'adaptive' ? '16:9' : ratio
		return body
	}

	if (genMode === 'first-frame') {
		if (refImages.length !== 1) {
			throw new Error('APIMart MiniMax-H3 first-frame mode requires exactly one reference image.')
		}
		if (refVideos.length > 0 || refAudios.length > 0) {
			throw new Error('APIMart MiniMax-H3 first-frame mode cannot be combined with reference video or audio.')
		}
		body.first_frame_image = refImages[0]
		return body
	}

	if (genMode === 'first-last-frame') {
		if (refImages.length !== 2) {
			throw new Error('APIMart MiniMax-H3 first-last-frame mode requires exactly two reference images.')
		}
		if (refVideos.length > 0 || refAudios.length > 0) {
			throw new Error('APIMart MiniMax-H3 first-last-frame mode cannot be combined with reference video or audio.')
		}
		body.first_frame_image = refImages[0]
		body.last_frame_image = refImages[1]
		return body
	}

	if (genMode === 'image-ref' && refImages.length === 0) {
		throw new Error('APIMart MiniMax-H3 image-ref mode requires at least one reference image.')
	}
	if (genMode === 'image-ref' && refVideos.length > 0) {
		throw new Error('APIMart MiniMax-H3 image-ref mode does not accept reference videos; use video-ref mode.')
	}
	if (genMode === 'video-ref' && refVideos.length === 0) {
		throw new Error('APIMart MiniMax-H3 video-ref mode requires at least one reference video.')
	}
	body.aspect_ratio = ratio
	if (refImages.length > 0) body.image_urls = refImages
	if (refVideos.length > 0) body.video_urls = refVideos
	if (refAudios.length > 0) body.audio_urls = refAudios
	return body
}
