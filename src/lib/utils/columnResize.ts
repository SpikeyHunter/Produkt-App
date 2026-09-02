// Per-user column widths for the resizable tables (Revenue tickets, Costs).
// Stored in localStorage so a layout you set once sticks across sessions.

const PREFIX = 'produkt.cols.';

export interface ResizableColumn {
	id: string;
	width: number; // percentage of the table width
}

export function loadColumnWidths<T extends ResizableColumn>(key: string, columns: T[]): T[] {
	if (typeof localStorage === 'undefined') return columns;
	try {
		const raw = localStorage.getItem(PREFIX + key);
		if (!raw) return columns;
		const saved = JSON.parse(raw) as Record<string, number>;
		return columns.map((c) =>
			typeof saved?.[c.id] === 'number' && saved[c.id] > 0 ? { ...c, width: saved[c.id] } : c
		);
	} catch {
		return columns;
	}
}

export function saveColumnWidths(key: string, columns: ResizableColumn[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(
			PREFIX + key,
			JSON.stringify(Object.fromEntries(columns.map((c) => [c.id, c.width])))
		);
	} catch {
		/* storage unavailable — widths just won't persist */
	}
}

/**
 * Drag math shared by every resizable table: the delta is measured against the
 * TABLE's own width (not the window), and the neighbouring column gives up
 * what the dragged column gains so the layout never overflows.
 */
export function applyResize<T extends ResizableColumn>(
	columns: T[],
	index: number,
	startWidth: number,
	neighborStartWidth: number,
	deltaPx: number,
	tableWidthPx: number,
	minWidth = 3
): T[] {
	const width = tableWidthPx > 0 ? tableWidthPx : 1;
	let diff = (deltaPx / width) * 100;
	const next = columns.map((c) => ({ ...c }));
	const neighbor = index + 1 < next.length ? index + 1 : null;
	// Clamp so neither column collapses below the minimum.
	diff = Math.max(minWidth - startWidth, diff);
	if (neighbor !== null) diff = Math.min(neighborStartWidth - minWidth, diff);
	next[index].width = startWidth + diff;
	if (neighbor !== null) next[neighbor].width = neighborStartWidth - diff;
	return next;
}

/**
 * Fast column resizer. During the drag it writes widths straight onto the
 * <col> elements (rAF-throttled, pointer-captured) and never touches
 * component state — so there's no re-render per mouse move. The final
 * widths are committed to state + storage once, on release.
 */
export function createColumnResizer<T extends ResizableColumn>(opts: {
	key: string | (() => string);
	getTable: () => HTMLTableElement | null | undefined;
	getColumns: () => T[];
	commit: (cols: T[]) => void;
	onStart?: (index: number) => void;
	onEnd?: () => void;
	minWidth?: number;
}) {
	const min = opts.minWidth ?? 3;
	const keyOf = () => (typeof opts.key === 'function' ? opts.key() : opts.key);

	function pointerdown(e: PointerEvent, index: number) {
		const table = opts.getTable();
		const cols = opts.getColumns();
		if (!table || !cols[index] || cols[index].id === 'drag') return;
		e.preventDefault();
		e.stopPropagation();

		const handle = e.currentTarget as HTMLElement;
		try {
			handle.setPointerCapture(e.pointerId);
		} catch {
			/* older browsers */
		}

		const colEls = Array.from(table.querySelectorAll('colgroup > col')) as HTMLElement[];
		const tableW = table.getBoundingClientRect().width || 1;
		const startX = e.clientX;
		const startW = cols[index].width;
		const nIdx = index + 1 < cols.length ? index + 1 : -1;
		const nStartW = nIdx >= 0 ? cols[nIdx].width : 0;

		let pendingX = startX;
		let raf = 0;
		let diff = 0;

		const compute = (x: number) => {
			let d = ((x - startX) / tableW) * 100;
			d = Math.max(min - startW, d);
			if (nIdx >= 0) d = Math.min(nStartW - min, d);
			return d;
		};
		const paint = () => {
			raf = 0;
			diff = compute(pendingX);
			if (colEls[index]) colEls[index].style.width = `${startW + diff}%`;
			if (nIdx >= 0 && colEls[nIdx]) colEls[nIdx].style.width = `${nStartW - diff}%`;
		};
		const move = (ev: PointerEvent) => {
			pendingX = ev.clientX;
			if (!raf) raf = requestAnimationFrame(paint);
		};
		const up = () => {
			if (raf) cancelAnimationFrame(raf);
			paint();
			handle.removeEventListener('pointermove', move);
			handle.removeEventListener('pointerup', up);
			handle.removeEventListener('pointercancel', up);
			try {
				handle.releasePointerCapture(e.pointerId);
			} catch {
				/* noop */
			}
			document.body.style.cursor = '';
			document.body.style.userSelect = '';

			const next = cols.map((c) => ({ ...c }));
			next[index].width = startW + diff;
			if (nIdx >= 0) next[nIdx].width = nStartW - diff;
			opts.commit(next);
			saveColumnWidths(keyOf(), next);
			opts.onEnd?.();
		};

		handle.addEventListener('pointermove', move);
		handle.addEventListener('pointerup', up);
		handle.addEventListener('pointercancel', up);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		opts.onStart?.(index);
	}

	return { pointerdown };
}
