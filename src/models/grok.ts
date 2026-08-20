import type { ModelConfig } from './types'

const LEGACY_GROK_IMAGE_RATIOS = [
	{ label: '1:1', value: '1:1' },
	{ label: '16:9', value: '16:9' },
	{ label: '9:16', value: '9:16' },
	{ label: '4:3', value: '4:3' },
	{ label: '3:4', value: '3:4' },
	{ label: '3:2', value: '3:2' },
	{ label: '2:3', value: '2:3' },
	{ label: '2:1', value: '2:1' },
	{ label: '1:2', value: '1:2' },
]

const XAI_GROK_IMAGE_2_RATIOS = [
	{ label: 'Auto', value: 'auto' },
	...LEGACY_GROK_IMAGE_RATIOS,
	{ label: '19.5:9', value: '19.5:9' },
	{ label: '9:19.5', value: '9:19.5' },
	{ label: '20:9', value: '20:9' },
	{ label: '9:20', value: '9:20' },
]

function secondOptions(min: number, max: number) {
	return Array.from({ length: max - min + 1 }, (_, index) => {
		const seconds = min + index
		return { label: `${seconds}s`, value: String(seconds) }
	})
}

export const grokImagine: ModelConfig = {
	id: 'grok-imagine',
	name: 'Grok Imagine',
	type: 'image',
	supportedProviders: {
		xai: { apiModelId: 'grok-imagine-image-2.0' },
		fal: { apiModelId: 'xai/grok-imagine-image' },
	},
	modes: ['text-to-image', 'image-ref-to-image'],
	params: [
		{
			id: 'aspectRatio',
			label: 'Aspect Ratio',
			type: 'select',
			options: XAI_GROK_IMAGE_2_RATIOS,
			default: 'auto',
			providerOverrides: {
				fal: { options: LEGACY_GROK_IMAGE_RATIOS, default: '1:1' },
			},
		},
		{
			id: 'resolution',
			label: 'Resolution',
			type: 'select',
			options: [
				{ label: '1K', value: '1k' },
				{ label: '2K', value: '2k' },
			],
			default: '1k',
			providerOverrides: {
				fal: { hidden: true },
			},
		},
		{
			id: 'quality',
			label: 'Quality',
			type: 'select',
			options: [
				{ label: 'Low', value: 'low' },
				{ label: 'Medium', value: 'medium' },
			],
			default: 'medium',
			providerOverrides: {
				fal: { hidden: true },
			},
		},
	],
}

export const grokVideo: ModelConfig = {
	id: 'grok-video',
	name: 'Grok Video',
	type: 'video',
	supportedProviders: {
		xai: { apiModelId: 'grok-imagine-video-1.5', aggregated: true },
		fal: { apiModelId: 'xai/grok-imagine-video', modes: ['text-to-video', 'first-frame', 'image-ref', 'video-extend'] },
		// Gateway maps sv-grok-video to the fal grok base id and picks the sub-endpoint
		// by input shape: 1 image -> image-to-video, 2+ -> reference-to-video, video -> extend.
		svnewapi: { apiModelId: 'sv-grok-video', modes: ['text-to-video', 'first-frame', 'image-ref', 'video-extend'] },
	},
	modes: ['text-to-video', 'first-frame', 'image-ref', 'video-edit', 'video-extend'],
	params: [
		{
			id: 'duration',
			label: 'Duration',
			type: 'select',
			modes: ['text-to-video', 'first-frame', 'image-ref', 'video-extend'],
			options: secondOptions(1, 15),
			optionsByMode: {
				'image-ref': secondOptions(1, 10),
				'video-extend': secondOptions(2, 10),
			},
			default: '5',
			providerOverrides: {
				xai: {
					optionsByMode: {
						'image-ref': secondOptions(1, 15),
						'video-extend': secondOptions(2, 10),
					},
				},
			},
		},
		{
			id: 'aspect_ratio',
			label: 'Ratio',
			type: 'select',
			modes: ['text-to-video', 'first-frame', 'image-ref'],
			options: [
				{ label: '16:9', value: '16:9' },
				{ label: '9:16', value: '9:16' },
				{ label: '1:1', value: '1:1' },
				{ label: '4:3', value: '4:3' },
				{ label: '3:4', value: '3:4' },
				{ label: '3:2', value: '3:2' },
				{ label: '2:3', value: '2:3' },
			],
			default: '16:9',
		},
		{
			id: 'resolution',
			label: 'Resolution',
			type: 'select',
			modes: ['text-to-video', 'first-frame', 'image-ref'],
			options: [
				{ label: '480p', value: '480p' },
				{ label: '720p', value: '720p' },
				{ label: '1080p', value: '1080p' },
			],
			optionsByMode: {
				'image-ref': [
					{ label: '480p', value: '480p' },
					{ label: '720p', value: '720p' },
				],
			},
			default: '720p',
		},
	],
}
