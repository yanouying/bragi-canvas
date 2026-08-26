import type { ModelConfig } from './types'

export const midjourneyV8: ModelConfig = {
	id: 'midjourney-v8',
	name: 'Midjourney V8.2',
	type: 'image',
	supportedProviders: {
		legnext: { apiModelId: 'midjourney' },
	},
	modes: ['text-to-image'],
	params: [
		{
			id: 'ar',
			label: 'Aspect Ratio',
			type: 'select',
			options: [
				{ label: '1:1', value: '1:1' },
				{ label: '16:9', value: '16:9' },
				{ label: '9:16', value: '9:16' },
				{ label: '4:3', value: '4:3' },
				{ label: '3:4', value: '3:4' },
				{ label: '3:2', value: '3:2' },
				{ label: '2:3', value: '2:3' },
				{ label: '4:5', value: '4:5' },
				{ label: '5:4', value: '5:4' },
				{ label: '21:9', value: '21:9' },
			],
			default: '1:1',
		},
		{
			id: 'resolution',
			label: 'Resolution',
			type: 'select',
			options: [
				{ label: 'Standard (1K)', value: 'standard' },
				{ label: 'HD (2K, 1.5x cost)', value: 'hd' },
			],
			default: 'standard',
		},
		{
			id: 'stylize',
			label: 'Stylize',
			type: 'range',
			min: 0,
			max: 1000,
			step: 50,
			default: 100,
		},
		{
			id: 'chaos',
			label: 'Chaos',
			type: 'range',
			min: 0,
			max: 100,
			step: 1,
			default: 0,
		},
		{
			id: 'style',
			label: 'Style',
			type: 'select',
			options: [
				{ label: 'Default', value: 'default' },
				{ label: 'Raw', value: 'raw' },
			],
			default: 'default',
		},
		{
			id: 'stop',
			label: 'Stop',
			type: 'range',
			min: 10,
			max: 100,
			step: 10,
			default: 100,
		},
		{
			id: 'weird',
			label: 'Weird',
			type: 'range',
			min: 0,
			max: 3000,
			step: 50,
			default: 0,
		},
	],
}

export const midjourneyNiji7: ModelConfig = {
	id: 'midjourney-niji-7',
	name: 'Midjourney niji 7',
	type: 'image',
	supportedProviders: {
		legnext: { apiModelId: 'midjourney' },
	},
	modes: ['text-to-image'],
	params: [
		{
			id: 'ar',
			label: 'Aspect Ratio',
			type: 'select',
			options: [
				{ label: '1:1', value: '1:1' },
				{ label: '16:9', value: '16:9' },
				{ label: '9:16', value: '9:16' },
				{ label: '4:3', value: '4:3' },
				{ label: '3:4', value: '3:4' },
				{ label: '3:2', value: '3:2' },
				{ label: '2:3', value: '2:3' },
			],
			default: '1:1',
		},
		{
			id: 'stylize',
			label: 'Stylize',
			type: 'range',
			min: 0,
			max: 1000,
			step: 50,
			default: 100,
		},
	],
}
