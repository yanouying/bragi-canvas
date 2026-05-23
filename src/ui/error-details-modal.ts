import { Modal, type App } from 'obsidian'
import type { CanvasNode } from '../types/canvas-internal'

export function getNodeErrorDetails(node: CanvasNode): string {
	const d = node.getData() as { bragiGenError?: string }
	const error = d.bragiGenError?.trim()
	return error || 'No error details available.'
}

export class ErrorDetailsModal extends Modal {
	constructor(app: App, private readonly errorMessage: string) {
		super(app)
	}

	onOpen(): void {
		const { contentEl, titleEl, modalEl } = this
		modalEl.classList.add('bragi-modal')
		titleEl.setText('Error details')

		const body = contentEl.createEl('textarea', { cls: 'bragi-error-details-body' })
		body.value = this.errorMessage
		body.readOnly = true

		const row = contentEl.createDiv({ cls: 'modal-button-container' })
		const selectBtn = row.createEl('button', { text: 'Select all', cls: 'mod-cta' })
		const closeBtn = row.createEl('button', { text: 'Close' })
		selectBtn.addEventListener('click', () => {
			body.focus()
			body.select()
		})
		closeBtn.addEventListener('click', () => this.close())
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
