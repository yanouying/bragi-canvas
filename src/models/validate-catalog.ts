import type { ModelConfig, Mode } from './types'

/**
 * Static, no-network validation of the model/provider catalog. Run by
 * `scripts/check-catalog.mjs` so any agent adding a model/provider stays
 * compliant with the integration standard. Returns a list of human-readable
 * error strings (empty when the catalog is valid).
 */
export function validateCatalog(models: ModelConfig[], providerIds: string[]): string[] {
	const errors: string[] = []
	const providerSet = new Set(providerIds)
	const seenIds = new Set<string>()

	for (const model of models) {
		const where = `model "${model.id}"`

		if (seenIds.has(model.id)) errors.push(`${where}: duplicate model id`)
		seenIds.add(model.id)

		const modeSet = new Set<Mode>(model.modes)
		const paramIds = new Set(model.params.map(p => p.id))
		const coveredModes = new Set<Mode>()

		const providerEntries = Object.entries(model.supportedProviders)
		if (providerEntries.length === 0) errors.push(`${where}: has no supportedProviders`)

		for (const [providerId, cfg] of providerEntries) {
			const pwhere = `${where} provider "${providerId}"`

			if (!providerSet.has(providerId)) {
				errors.push(`${pwhere}: unknown provider id (not in the provider registry)`)
			}
			if (!cfg.apiModelId || !cfg.apiModelId.trim()) {
				errors.push(`${pwhere}: empty apiModelId`)
			}
			if (cfg.aggregated && cfg.editableApiModelId) {
				errors.push(`${pwhere}: aggregated providers must not also set editableApiModelId (the id editor is locked for aggregated models)`)
			}
			if (cfg.modes) {
				for (const mode of cfg.modes) {
					if (!modeSet.has(mode)) errors.push(`${pwhere}: declares mode "${mode}" that is not in model.modes`)
				}
			}
			for (const mode of (cfg.modes ?? model.modes)) {
				if (modeSet.has(mode)) coveredModes.add(mode)
			}
		}

		// Every mode the model advertises must be offered by at least one provider.
		for (const mode of model.modes) {
			if (!coveredModes.has(mode)) {
				errors.push(`${where}: mode "${mode}" is not offered by any provider (orphan mode)`)
			}
		}

		// providerOverrides must reference real params and connected providers.
		for (const param of model.params) {
			if (!param.providerOverrides) continue
			if (!paramIds.has(param.id)) continue
			for (const providerId of Object.keys(param.providerOverrides)) {
				if (!model.supportedProviders[providerId]) {
					errors.push(`${where} param "${param.id}": providerOverrides references provider "${providerId}" that is not in supportedProviders`)
				}
			}
		}

		// Aggregated audio: a DashScope voice model that clones/designs, or maps
		// voice modes to multiple upstream ids, routes the model id internally and
		// must mark its DashScope entry aggregated so the id editor stays locked.
		const dashscope = model.supportedProviders.dashscope
		const needsAggregatedMarker = model.type === 'audio'
			&& !!dashscope
			&& (!!model.voiceConfig?.modelIds || !!(model.voiceConfig?.clone || model.voiceConfig?.design))
		if (needsAggregatedMarker && !dashscope?.aggregated) {
			errors.push(`${where}: DashScope voice model with clone/design/modelIds must set supportedProviders.dashscope.aggregated = true`)
		}
	}

	return errors
}
