import type { ModelConfig } from './types'

const FLUX_IMAGE_RATIOS = [
	{ label: '1:1', value: '1:1' },
	{ label: '16:9', value: '16:9' },
	{ label: '9:16', value: '9:16' },
	{ label: '3:2', value: '3:2' },
	{ label: '2:3', value: '2:3' },
	{ label: '4:3', value: '4:3' },
	{ label: '3:4', value: '3:4' },
	{ label: '4:5', value: '4:5' },
	{ label: '5:4', value: '5:4' },
]

export const flux2Klein9b: ModelConfig = {
	id: 'flux-2-klein-9b',
	name: 'FLUX.2 Klein 9B',
	type: 'image',
	supportedProviders: {
		bfl: { apiModelId: 'flux-2-klein-9b', refDelivery: { image: 'inline' } },
		runpod: { apiModelId: 'flux-2-klein-9b', refDelivery: { image: 'inline' } },
	},
	modes: ['text-to-image', 'image-ref-to-image'],
	params: [
		{
			id: 'aspectRatio',
			label: 'Aspect Ratio',
			type: 'select',
			modes: ['text-to-image'],
			options: FLUX_IMAGE_RATIOS,
			default: '1:1',
		},
		{
			id: 'targetLongEdge',
			label: 'Long Edge',
			type: 'select',
			options: [
				{ label: '1536', value: '1536' },
				{ label: '2048', value: '2048' },
				{ label: '3072', value: '3072' },
			],
			default: '2048',
		},
		{
			id: 'seed',
			label: 'Seed',
			type: 'number',
			default: 297123813229487,
			min: 1,
			step: 1,
		},
		{
			id: 'safetyTolerance',
			label: 'Safety',
			type: 'select',
			options: [
				{ label: '0', value: '0' },
				{ label: '1', value: '1' },
				{ label: '2', value: '2' },
				{ label: '3', value: '3' },
				{ label: '4', value: '4' },
				{ label: '5', value: '5' },
			],
			default: '2',
		},
		{
			id: 'outputFormat',
			label: 'Format',
			type: 'select',
				options: [
					{ label: 'PNG', value: 'png' },
					{ label: 'JPEG', value: 'jpeg' },
					{ label: 'WebP', value: 'webp' },
				],
				providerOverrides: {
					runpod: {
						options: [{ label: 'PNG', value: 'png' }],
						default: 'png',
					},
				},
				default: 'png',
			},
		{
			id: 'enableColorMatch',
			label: 'Color Match',
			type: 'select',
			modes: ['image-ref-to-image'],
			options: [
				{ label: 'Off', value: 'false' },
				{ label: 'On', value: 'true' },
			],
			default: 'false',
		},
	],
}
