import { readFileSync, watch, type FSWatcher } from 'fs'
import { join } from 'path'

const STYLE_ID = 'bragi-canvas-hot-styles'

/** Dev-only: re-inject styles.css when the file changes on disk. */
export function startCssHotReload(pluginDir: string): () => void {
	const cssPath = join(pluginDir, 'styles.css')
	let styleEl: HTMLStyleElement | null = null
	let watcher: FSWatcher | null = null
	let debounceTimer: ReturnType<typeof setTimeout> | null = null

	const apply = () => {
		try {
			const css = readFileSync(cssPath, 'utf8')
			if (!styleEl) {
				styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null
				if (!styleEl) {
					styleEl = document.createElement('style')
					styleEl.id = STYLE_ID
					document.head.appendChild(styleEl)
				}
			}
			styleEl.textContent = css
		} catch (err) {
			console.warn('[Bragi] CSS hot reload failed:', err)
		}
	}

	const scheduleApply = () => {
		if (debounceTimer) clearTimeout(debounceTimer)
		debounceTimer = setTimeout(() => {
			debounceTimer = null
			apply()
		}, 50)
	}

	apply()
	watcher = watch(cssPath, scheduleApply)

	return () => {
		if (debounceTimer) clearTimeout(debounceTimer)
		watcher?.close()
		watcher = null
		styleEl?.remove()
		styleEl = null
	}
}
