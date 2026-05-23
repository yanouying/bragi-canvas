import { optionalStringParam, stringParam } from './params'

const SIZE_BY_RATIO_AND_TIER: Record<string, Record<string, string>> = {
	'1:1': { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880' },
	'3:2': { '1K': '1536x1024', '2K': '2048x1360', '4K': '3520x2336' },
	'2:3': { '1K': '1024x1536', '2K': '1360x2048', '4K': '2336x3520' },
	'4:3': { '1K': '1024x768', '2K': '2048x1536', '4K': '3312x2480' },
	'3:4': { '1K': '768x1024', '2K': '1536x2048', '4K': '2480x3312' },
	'5:4': { '1K': '1280x1024', '2K': '2560x2048', '4K': '3216x2576' },
	'4:5': { '1K': '1024x1280', '2K': '2048x2560', '4K': '2576x3216' },
	'16:9': { '1K': '1536x864', '2K': '2048x1152', '4K': '3840x2160' },
	'9:16': { '1K': '864x1536', '2K': '1152x2048', '4K': '2160x3840' },
	'2:1': { '1K': '2048x1024', '2K': '2688x1344', '4K': '3840x1920' },
	'1:2': { '1K': '1024x2048', '2K': '1344x2688', '4K': '1920x3840' },
	'3:1': { '1K': '1536x512', '2K': '3072x1024', '4K': '3840x1280' },
	'1:3': { '1K': '512x1536', '2K': '1024x3072', '4K': '1280x3840' },
	'21:9': { '1K': '2016x864', '2K': '2688x1152', '4K': '3840x1648' },
	'9:21': { '1K': '864x2016', '2K': '1152x2688', '4K': '1648x3840' },
}

export function resolveOpenAIImageSize(params?: Record<string, unknown>): string {
	const explicitSize = optionalStringParam(params?.size)
	if (explicitSize) return explicitSize

	const aspectRatio = stringParam(params?.aspectRatio, '1:1')
	if (aspectRatio.toLowerCase() === 'auto') return 'auto'

	const imageSize = stringParam(params?.imageSize, '2K')
	if (imageSize.toLowerCase() === 'auto') return 'auto'

	const tier = imageSize.toUpperCase()
	return SIZE_BY_RATIO_AND_TIER[aspectRatio]?.[tier] || SIZE_BY_RATIO_AND_TIER['1:1']['2K']
}
