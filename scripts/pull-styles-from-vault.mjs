import { copyFileSync, existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configPath = path.join(pluginRoot, '.dev-vault-plugin')

function readVaultPluginDir() {
	if (process.env.BRAGI_VAULT_PLUGIN_DIR?.trim()) {
		return process.env.BRAGI_VAULT_PLUGIN_DIR.trim()
	}
	if (existsSync(configPath)) {
		return readFileSync(configPath, 'utf8').trim()
	}
	throw new Error('Set your vault plugin path in .dev-vault-plugin or BRAGI_VAULT_PLUGIN_DIR.')
}

const vaultDir = readVaultPluginDir()
const vaultCss = path.join(vaultDir, 'styles.css')
if (!existsSync(vaultCss)) {
	throw new Error(`Missing ${vaultCss}`)
}

copyFileSync(vaultCss, path.join(pluginRoot, 'src/styles.css'))
copyFileSync(vaultCss, path.join(pluginRoot, 'styles.css'))
console.log('[pull:styles] copied vault styles.css → src/styles.css + styles.css')
