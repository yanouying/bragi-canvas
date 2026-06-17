import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const source = readFileSync('src/providers/svnewapi.ts', 'utf8')

assert.match(
	source,
	/function numericParam\(value: unknown\): number \| undefined/,
	'SV NewAPI audio generation must parse numeric params before sending JSON.',
)

assert.match(
	source,
	/const speed = numericParam\(options\.speed\)[\s\S]*if \(speed !== undefined\) body\.speed = speed/,
	'SV NewAPI audio generation must send speed as a top-level audio request field.',
)

assert.match(
	source,
	/const metadata: JsonRecord = \{\}/,
	'SV NewAPI audio generation must build request metadata for provider-specific audio params.',
)

assert.match(
	source,
	/if \(options\.mode === 'sound-effect'\)[\s\S]*metadata\.duration_seconds = duration/,
	'SV NewAPI sound effects must send duration as metadata.duration_seconds.',
)

assert.match(
	source,
	/const voiceSettings: JsonRecord = \{\}[\s\S]*voiceSettings\.stability = stability[\s\S]*voiceSettings\.similarity_boost = similarityBoost[\s\S]*voiceSettings\.style = style[\s\S]*metadata\.voice_settings = voiceSettings/,
	'SV NewAPI ElevenLabs TTS must send voice settings in metadata.voice_settings.',
)

assert.match(
	source,
	/if \(Object\.keys\(metadata\)\.length > 0\) body\.metadata = metadata/,
	'SV NewAPI audio generation must attach metadata only when it has provider-specific fields.',
)

console.log('SV NewAPI audio parameter checks passed.')
