import { copyFileSync, existsSync, readFileSync, watch } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcCss = path.join(pluginRoot, 'src/styles.css')
const rootCss = path.join(pluginRoot, 'styles.css')
const configPath = path.join(pluginRoot, '.dev-vault-plugin')

function readVaultPluginDir() {
	if (process.env.BRAGI_VAULT_PLUGIN_DIR?.trim()) {
		return process.env.BRAGI_VAULT_PLUGIN_DIR.trim()
	}
	if (existsSync(configPath)) {
		return readFileSync(configPath, 'utf8').trim()
	}
	throw new Error(
		'Set your vault plugin path in .dev-vault-plugin or BRAGI_VAULT_PLUGIN_DIR.\n' +
			`Example: echo "/path/to/vault/.obsidian/plugins/bragi-canvas" > ${configPath}`,
	)
}

function syncStyles(vaultDir) {
	copyFileSync(srcCss, rootCss)
	copyFileSync(srcCss, path.join(vaultDir, 'styles.css'))
	console.log(`[dev:styles] synced ${new Date().toLocaleTimeString()}`)
}

const vaultDir = readVaultPluginDir()
if (!existsSync(vaultDir)) {
	throw new Error(`Vault plugin directory not found: ${vaultDir}`)
}

syncStyles(vaultDir)
watch(srcCss, () => syncStyles(vaultDir))

console.log('[dev:styles] watching src/styles.css')
console.log(`[dev:styles] vault plugin: ${vaultDir}`)
console.log('[dev:styles] edit src/styles.css to copy it into the dev vault plugin folder')
