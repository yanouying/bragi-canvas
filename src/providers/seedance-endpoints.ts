export const VOLCENGINE_SEEDANCE_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'

export const BYTEPLUS_SEEDANCE_ENDPOINT = 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks'

export function normalizeSeedanceEndpoint(endpoint: string | undefined, fallback: string): string {
	return (endpoint?.trim() || fallback).replace(/\/+$/, '')
}
