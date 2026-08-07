export interface SeedanceReferenceLimits {
	images: number
	videos: number
	audios: number
}

export function isSeedance25ModelId(modelId: string): boolean {
	return /seedance-2[.-]5(?:-|$)/.test(modelId)
}

export function getSeedanceReferenceLimits(modelId: string): SeedanceReferenceLimits {
	return isSeedance25ModelId(modelId)
		? { images: 30, videos: 10, audios: 10 }
		: { images: 9, videos: 3, audios: 3 }
}
