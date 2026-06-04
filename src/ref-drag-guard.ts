/**
 * Shared drag guard for reference strips (image / text / audio thumbnails).
 *
 * The ref strips are rebuilt by a 1s polling refresh. While the user is
 * drag-reordering a thumbnail we must NOT rebuild the strip, or the element
 * being dragged gets yanked out of the DOM and the drop breaks. The previous
 * implementation used a per-module `isDragging` boolean flipped on `dragstart`
 * / `dragend`. The problem: in Electron a drag's `dragend` can be lost (drop
 * outside the window, a cancelled drag, or the source element removed
 * mid-drag). A single lost `dragend` left the flag stuck `true` for the rest of
 * the session, permanently wedging the refresh — newly connected upstream
 * nodes would silently never render until the plugin reloaded.
 *
 * This guard is self-healing: the "dragging" state auto-expires after a short
 * window, so a lost `dragend` can stall a refresh by at most DRAG_MAX_MS rather
 * than forever. Only one ref drag can happen at a time, so a single shared
 * guard is sufficient across all strip types.
 */

// Generous enough to cover a deliberate human reorder drag, short enough that a
// lost dragend self-recovers quickly (the refresh interval is 1s anyway).
const DRAG_MAX_MS = 3000

let dragStartedAt = 0

export function beginRefDrag(): void {
	dragStartedAt = Date.now()
}

export function endRefDrag(): void {
	dragStartedAt = 0
}

export function isRefDragActive(): boolean {
	if (dragStartedAt === 0) return false
	if (Date.now() - dragStartedAt > DRAG_MAX_MS) {
		// Treat as a lost dragend and recover so refreshes don't stay wedged.
		dragStartedAt = 0
		return false
	}
	return true
}
