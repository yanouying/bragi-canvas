import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import esbuild from 'esbuild'

const tempDir = await mkdtemp(path.join(tmpdir(), 'bragi-legnext-v8-2-'))
const entry = path.join(tempDir, 'entry.ts')
const outfile = path.join(tempDir, 'legnext-v8-2.mjs')

const obsidianStub = {
	name: 'obsidian-stub',
	setup(build) {
		build.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'obsidian-stub' }))
		build.onLoad({ filter: /.*/, namespace: 'obsidian-stub' }, () => ({
			loader: 'js',
			contents: 'export const requestUrl = () => { throw new Error("requestUrl should not be called"); };',
		}))
	},
}

try {
	await writeFile(entry, `
		export { buildLegnextPrompt } from ${JSON.stringify(path.resolve('src/providers/legnext.ts'))}
		export { midjourneyV8, midjourneyNiji7 } from ${JSON.stringify(path.resolve('src/models/midjourney.ts'))}
	`)

	await esbuild.build({
		entryPoints: [entry],
		bundle: true,
		platform: 'node',
		format: 'esm',
		outfile,
		logLevel: 'silent',
		plugins: [obsidianStub],
	})

	const { buildLegnextPrompt, midjourneyV8, midjourneyNiji7 } = await import(pathToFileURL(outfile).href)

	assert.equal(midjourneyV8.id, 'midjourney-v8')
	assert.equal(midjourneyV8.name, 'Midjourney V8.2')
	assert.deepEqual(midjourneyV8.modes, ['text-to-image'])
	assert.deepEqual(
		midjourneyV8.params.map(param => param.id),
		['ar', 'resolution', 'stylize', 'chaos', 'style', 'stop', 'weird'],
	)
	assert.equal(midjourneyV8.params.some(param => param.id === 'quality'), false)

	assert.equal(
		buildLegnextPrompt('Cinematic lighthouse', {
			modelId: 'midjourney-v8',
			ar: '1:1',
			resolution: 'standard',
			stylize: 100,
			chaos: 0,
			style: 'default',
			stop: 100,
			weird: 0,
		}),
		'Cinematic lighthouse --v 8.2 --ar 1:1',
	)

	assert.equal(
		buildLegnextPrompt('Cinematic lighthouse', {
			modelId: 'midjourney-v8',
			ar: '16:9',
			resolution: 'hd',
			stylize: 250,
			chaos: 20,
			style: 'raw',
			stop: 80,
			weird: 500,
		}),
		'Cinematic lighthouse --v 8.2 --ar 16:9 --stylize 250 --hd --chaos 20 --style raw --stop 80 --weird 500',
	)

	const explicitFlags = 'Portrait --version 8.1 --aspect 16:9 --s 300 --hd --c 25 --raw --stop 70 --w 900'
	assert.equal(
		buildLegnextPrompt(explicitFlags, {
			modelId: 'midjourney-v8',
			ar: '1:1',
			resolution: 'hd',
			stylize: 200,
			chaos: 10,
			style: 'raw',
			stop: 60,
			weird: 400,
		}),
		explicitFlags,
		'Explicit long and short aliases must win without duplicate flags.',
	)

	assert.equal(
		buildLegnextPrompt('Portrait --seed 42 --cref https://example.test/ref.png', {
			modelId: 'midjourney-v8',
			stylize: 200,
			chaos: 10,
		}),
		'Portrait --seed 42 --cref https://example.test/ref.png --v 8.2 --ar 1:1 --stylize 200 --chaos 10',
		'Short aliases must not collide with longer flag names.',
	)

	const legacyQuality = buildLegnextPrompt('Legacy settings', {
		modelId: 'midjourney-v8',
		quality: '4',
	})
	assert.equal(legacyQuality, 'Legacy settings --v 8.2 --ar 1:1')
	assert.doesNotMatch(legacyQuality, /(?:^|\s)--q(?:uality)?(?=\s|=|$)/i)

	assert.equal(midjourneyNiji7.id, 'midjourney-niji-7')
	assert.equal(
		buildLegnextPrompt('Anime skyline', {
			modelId: 'midjourney-niji-7',
			ar: '9:16',
			stylize: 200,
			resolution: 'hd',
			chaos: 20,
		}),
		'Anime skyline --niji 7 --ar 9:16 --stylize 200',
		'Niji 7 behavior must remain unchanged by V8.2-only params.',
	)

	assert.throws(
		() => buildLegnextPrompt('Bad resolution', { resolution: '4k' }),
		/Resolution must be standard or hd/,
	)
	assert.throws(
		() => buildLegnextPrompt('Bad style', { style: 'expressive' }),
		/Style must be default or raw/,
	)

	console.log('Legnext Midjourney V8.2 checks passed.')
} finally {
	await rm(tempDir, { recursive: true, force: true })
}
