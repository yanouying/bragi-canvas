declare module 'electron' {
	export const remote: {
		dialog: {
			showOpenDialog(options: {
				title?: string
				filters?: Array<{ name: string; extensions: string[] }>
				properties?: string[]
			}): Promise<{ canceled: boolean; filePaths: string[] }>
		}
	}
}
