import type { RequestUrlResponse } from 'obsidian'

interface GoogleErrorResponse {
	error?: {
		message?: string
		status?: string
		code?: number
	}
}

export function throwForGoogleError(provider: string, response: RequestUrlResponse): void {
	const data = response.json as GoogleErrorResponse | undefined
	if (response.status < 400 && !data?.error) return

	const message = data?.error?.message || response.text || `Request failed, status ${response.status}`
	const status = data?.error?.status ? ` (${data.error.status})` : ''
	throw new Error(`${provider}: ${message}${status}`)
}
