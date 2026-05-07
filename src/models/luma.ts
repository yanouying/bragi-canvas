import type { ModelConfig } from './types'

export const lumaUni1: ModelConfig = {
	id: 'luma-uni-1',
	name: 'Luma Uni-1',
	type: 'image',
	supportedProviders: {
		luma: { apiModelId: 'uni-1' },
	},
	modes: ['text-to-image', 'image-ref-to-image'],
	params: [
		{
			id: 'aspectRatio',
			label: 'Aspect Ratio',
			type: 'select',
			options: [
				{ label: '1:1', value: '1:1' },
				{ label: '16:9', value: '16:9' },
				{ label: '9:16', value: '9:16' },
				{ label: '3:2', value: '3:2' },
				{ label: '2:3', value: '2:3' },
			],
			default: '1:1',
		},
	],
}
