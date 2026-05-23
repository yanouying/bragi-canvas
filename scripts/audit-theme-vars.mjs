import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cssPath = path.join(pluginRoot, 'src/styles.css')
const text = readFileSync(cssPath, 'utf8')
const pannIdx = text.indexOf('/* Pannellum 2.5.7 runtime CSS')
const main = pannIdx === -1 ? text : text.slice(0, pannIdx)

const obsidianVars = [...main.matchAll(/var\((--(?!bragi)[a-z0-9-]+)/g)]
	.map((m) => m[1])
const counts = obsidianVars.reduce((acc, name) => {
	acc[name] = (acc[name] || 0) + 1
	return acc
}, {})

const allowed = new Set(['--layer-modal', '--size-4-4'])
const unexpected = Object.entries(counts).filter(([name]) => !allowed.has(name))

console.log('[audit:theme] Bragi CSS audit (excluding pannellum bundle)')
console.log('Allowed Obsidian vars:', [...allowed].map((n) => `${n} (${counts[n] || 0})`).join(', ') || 'none')
if (unexpected.length) {
	console.error('[audit:theme] Unexpected Obsidian theme vars still present:')
	for (const [name, count] of unexpected) console.error(`  ${count}x ${name}`)
	process.exit(1)
}

console.log('[audit:theme] OK — Bragi UI uses independent --bragi-* tokens')
