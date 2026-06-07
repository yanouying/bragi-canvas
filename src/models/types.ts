export type GenerationType = 'image' | 'video' | 'text' | 'audio'

export type ImageMode = 'text-to-image' | 'image-ref-to-image'
export type VideoMode = 'text-to-video' | 'first-frame' | 'image-ref' | 'first-last-frame' | 'multi-image-ref' | 'video-ref' | 'video-extend' | 'video-edit'
export type TextMode = 'text-to-text'
export type AudioMode = 'tts' | 'music' | 'sound-effect'

export type Mode = ImageMode | VideoMode | TextMode | AudioMode
export type VoiceSourceMode = 'builtin' | 'reference' | 'design'

export interface ParamOption {
	label: string
	value: string
}

export interface ModelParamProviderOverride {
	options?: ParamOption[]
	default?: string | number
	min?: number
	max?: number
	step?: number
	unit?: string
	/** Hide this param entirely for the provider (e.g. a wrapper that omits it). */
	hidden?: boolean
}

export interface ModelParam {
	id: string
	label: string
	type: 'select' | 'number' | 'range'
	/**
	 * Restrict this parameter to specific generation modes. Omit for parameters
	 * that apply to every mode on the model.
	 */
	modes?: Mode[]
	options?: ParamOption[]
	/**
	 * Mode-specific option overrides. When the user picks one of these modes, the
	 * param's dropdown is rebuilt from `optionsByMode[mode]` instead of `options`.
	 * If the currently-selected value isn't in the new list, it snaps back to `default`.
	 * Used e.g. for xAI video where image-ref caps duration at 10s while others go to 15s.
	 */
	optionsByMode?: Record<string, ParamOption[]>
	/**
	 * Provider-specific parameter overrides for cases where wrappers expose a
	 * narrower schema than the native upstream model.
	 */
	providerOverrides?: Record<string, ModelParamProviderOverride>
	default: string | number
	min?: number
	max?: number
	step?: number
	unit?: string   // e.g. 's' for seconds
}

/**
 * Provider-specific config for a model.
 * Different providers may use different API model IDs for the same model.
 */
export interface ProviderConfig {
	apiModelId: string
	/**
	 * This provider routes the model's modes to multiple upstream model IDs
	 * internally (e.g. DashScope Wan 2.7, DashScope voice). The catalog
	 * `apiModelId` is a display-only umbrella; routing lives in the provider.
	 * Marking aggregated locks the API-model-id editor (a single editable id
	 * would be meaningless / could corrupt routing).
	 */
	aggregated?: boolean
	/**
	 * Opt-in: expose the API-model-id pencil editor for this provider×model.
	 * Defaults to false — most models show a static, non-editable id. Use for
	 * providers that accept arbitrary upstream model ids (e.g. BytePlus C-Dance).
	 * Ignored when `aggregated` is true.
	 */
	editableApiModelId?: boolean
	/**
	 * Restrict this provider to a subset of the model's `modes`. Omit to inherit
	 * all of the model's modes. Used when a provider exposes only part of an
	 * aggregated model (e.g. MuleRouter only offers Wan 2.7 first-frame i2v).
	 */
	modes?: Mode[]
}

export interface ModelConfig {
	id: string
	name: string
	type: GenerationType
	supportedProviders: Record<string, ProviderConfig>  // provider name → config
	modes: Mode[]
	params: ModelParam[]
	voiceConfig?: {
		builtin: boolean
		clone: boolean
		design?: boolean
		modelIds?: Partial<Record<VoiceSourceMode, string>>
		sampleModelId?: string
	}
}
