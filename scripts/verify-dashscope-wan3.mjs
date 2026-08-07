import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const tempDir = await mkdtemp(join(tmpdir(), 'bragi-dashscope-wan3-'))

try {
	const outfile = join(tempDir, 'dashscope.mjs')
	await build({
		entryPoints: ['src/providers/dashscope.ts'],
		bundle: true,
		platform: 'node',
		format: 'esm',
		outfile,
		logLevel: 'silent',
		plugins: [{
			name: 'mock-obsidian',
			setup(buildApi) {
				buildApi.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'mock-obsidian' }))
				buildApi.onLoad({ filter: /.*/, namespace: 'mock-obsidian' }, () => ({
					contents: `
						export function normalizePath(value) { return value }
						export async function requestUrl(options) { return process.__bragiWan3RequestHandler(options) }
					`,
					loader: 'js',
				}))
			},
		}],
	})

	const { DashScopeVideoProvider } = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`)
	const requests = []
	process.__bragiWan3RequestHandler = async (request) => {
		requests.push(request)
		return { status: 200, json: { output: { task_id: `task-${requests.length}` } } }
	}
	const app = { vault: { adapter: {} } }
	const provider = new DashScopeVideoProvider(
		'test-key',
		app,
		'_bragi/assets',
		'https://workspace.ap-southeast-1.maas.aliyuncs.com/api/v1',
	)

	assert.deepEqual(await provider.generateVideo('Moonlit rooftop', {
		modelId: 'wan3.0-video',
		genMode: 'text-to-video',
	}), { done: false, taskId: 'task-1' })
	assert.equal(requests[0].url, 'https://workspace.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis')
	assert.equal(requests[0].headers['X-DashScope-Async'], 'enable')
	assert.deepEqual(JSON.parse(requests[0].body), {
		model: 'wan3.0-video',
		input: { prompt: 'Moonlit rooftop' },
		parameters: {
			resolution: '1080P',
			ratio: 'adaptive',
			duration: 5,
			audio: true,
			watermark: false,
		},
	})

	await provider.generateVideo('Use Image 1, Video 1, and Audio 1', {
		modelId: 'wan3.0-video',
		genMode: 'video-ref',
		refImages: ['https://example.com/ref.png'],
		refVideos: ['https://example.com/ref.mp4'],
		refAudios: ['https://example.com/ref.mp3'],
		refPdfs: ['https://example.com/brief.pdf'],
		resolution: '480P',
		ratio: '9:16',
		duration: '-1',
		audio: 'false',
		seed: 2147483648,
	})
	assert.deepEqual(JSON.parse(requests[1].body), {
		model: 'wan3.0-video',
		input: {
			prompt: 'Use Image 1, Video 1, and Audio 1',
			media: [
				{ type: 'reference_image', url: 'https://example.com/ref.png' },
				{ type: 'reference_video', url: 'https://example.com/ref.mp4' },
				{ type: 'reference_audio', url: 'https://example.com/ref.mp3' },
				{ type: 'file', url: 'https://example.com/brief.pdf' },
			],
		},
		parameters: {
			resolution: '480P',
			ratio: '9:16',
			duration: -1,
			audio: false,
			watermark: false,
			seed: 2147483647,
		},
	})

	await provider.generateVideo('Transition between frames', {
		modelId: 'wan3.0-video',
		genMode: 'first-last-frame',
		refImages: ['https://example.com/first.png', 'https://example.com/last.png'],
	})
	assert.deepEqual(JSON.parse(requests[2].body).input.media, [
		{ type: 'first_frame', url: 'https://example.com/first.png' },
		{ type: 'last_frame', url: 'https://example.com/last.png' },
	])

	await assert.rejects(
		() => provider.generateVideo('Missing ref', { modelId: 'wan3.0-video', genMode: 'image-ref' }),
		/requires at least one upstream reference/,
	)
	await assert.rejects(
		() => provider.generateVideo('Invalid mix', {
			modelId: 'wan3.0-video',
			genMode: 'first-frame',
			refImages: ['https://example.com/first.png'],
			refAudios: ['https://example.com/ref.mp3'],
		}),
		/cannot be combined with reference video, audio, or files/,
	)

	console.log('DashScope Wan 3.0 checks passed.')
} finally {
	delete process.__bragiWan3RequestHandler
	await rm(tempDir, { recursive: true, force: true })
}
