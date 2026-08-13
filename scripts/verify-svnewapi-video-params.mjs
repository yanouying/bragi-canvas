import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const source = readFileSync('src/providers/svnewapi.ts', 'utf8')
const directSeedanceSource = readFileSync('src/providers/seedance.ts', 'utf8')

assert.match(
	source,
	/const duration = optionalString\(params\.duration \|\| params\.durationSeconds\)/,
	'SV NewAPI video generation must read duration and durationSeconds.',
)

assert.match(
	source,
	/if \(SV_VIDEO_SEEDANCE_RE\.test\(modelId\)\) \{[\s\S]*?if \(duration\) metadata\.duration = duration === '-1' \? -1 : parseInt\(duration, 10\)/,
	'SV NewAPI Seedance must forward Auto duration as metadata.duration = -1 to match direct Ark Seedance.',
)

assert.match(
	source,
	/const SV_VIDEO_SEEDANCE_RE = \/\^sv-seedance-2\\\.\(\?:0\|5\)\(\?:-\|\$\)\//,
	'SV NewAPI Seedance special handling must include Seedance 2.0 and 2.5 virtual models.',
)

assert.match(
	source,
	/if \(genMode\) \{[\s\S]*?body\.mode = genMode[\s\S]*?metadata\.genMode = genMode[\s\S]*?\}[\s\S]*?if \(outputFormat\) metadata\.output_format = outputFormat/,
	'SV NewAPI Seedance must forward mode and output_format through the gateway metadata contract.',
)

assert.match(
	source,
	/metadata\.generate_audio = params\.generate_audio !== false && params\.generate_audio !== 'false'/,
	'SV NewAPI Seedance must preserve boolean false generate_audio values.',
)

assert.match(
	source,
	/\} else \{[\s\S]*?if \(duration && duration !== '-1'\) body\.duration = duration/,
	'SV NewAPI non-Seedance video models should continue omitting duration = -1.',
)

assert.match(
	directSeedanceSource,
	/const duration = Number\.parseInt\(stringParam\(params, 'duration', is25 \? '-1' : '5'\), 10\)[\s\S]*?duration,/,
	'Direct BytePlus/Volcengine Seedance must continue forwarding Auto duration as numeric -1.',
)

console.log('SV NewAPI video parameter checks passed.')
