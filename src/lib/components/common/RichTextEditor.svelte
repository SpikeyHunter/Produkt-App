<script lang="ts">
	import { onMount } from 'svelte';
	import { portal } from '$lib/utils/portalUtils';
	import Dropdown from './Dropdown.svelte';

	// Rich text editor (contenteditable). `value` is HTML.
	export let value = '';
	export let placeholder = '';
	export let minHeight = '320px';
	export let maxHeight = '60vh'; // 'none' lets the editor grow with the page
	// fill: the editor stretches to its parent's height and scrolls internally
	// (parent must give it a bounded height, e.g. flex-1 min-h-0).
	export let fill = false;
	export let disabled = false;
	export let onInput: (() => void) | null = null;

	let editor: HTMLDivElement;
	let wrapper: HTMLDivElement;
	let internalChange = false;

	const headingOptions = [
		{ value: 'h1', label: 'Heading 1', class: 'text-xl font-black' },
		{ value: 'h2', label: 'Heading 2', class: 'text-lg font-bold' },
		{ value: 'h3', label: 'Heading 3', class: 'text-base font-bold' },
		{ value: 'h4', label: 'Heading 4', class: 'text-sm font-bold' },
		{ value: 'h5', label: 'Heading 5', class: 'text-xs font-bold' },
		{ value: 'h6', label: 'Heading 6', class: 'text-[10px] font-bold' },
		{ value: 'p', label: 'Normal', class: 'text-sm font-normal', divider: true }
	];
	let headingValue = 'p';

	// ---------- selection bookkeeping ----------
	// Toolbar clicks (color pickers, modals) steal focus from the contenteditable,
	// which silently kills execCommand. Track the last in-editor range and restore
	// it right before applying any command.
	let savedRange: Range | null = null;

	function saveSelection() {
		const sel = window.getSelection();
		if (sel && sel.rangeCount > 0 && editor && editor.contains(sel.anchorNode)) {
			savedRange = sel.getRangeAt(0).cloneRange();
		}
	}

	function restoreSelection() {
		editor.focus();
		if (savedRange) {
			const sel = window.getSelection();
			sel?.removeAllRanges();
			sel?.addRange(savedRange);
		}
	}

	// Toolbar buttons highlight when the cursor sits in matching formatting.
	let fmt = { bold: false, italic: false, underline: false, strike: false, ol: false, ul: false };

	function refreshFormatState() {
		try {
			const sel = window.getSelection();
			if (!sel || !editor || !editor.contains(sel.anchorNode)) return;
			fmt = {
				bold: document.queryCommandState('bold'),
				italic: document.queryCommandState('italic'),
				underline: document.queryCommandState('underline'),
				strike: document.queryCommandState('strikeThrough'),
				ol: document.queryCommandState('insertOrderedList'),
				ul: document.queryCommandState('insertUnorderedList')
			};
		} catch {
			/* noop */
		}
	}

	onMount(() => {
		editor.innerHTML = value || '';
		const onSel = () => {
			saveSelection();
			refreshFormatState();
		};
		document.addEventListener('selectionchange', onSel);
		return () => document.removeEventListener('selectionchange', onSel);
	});

	// Keep the editor in sync when value is replaced from outside (template load).
	$: if (editor && !internalChange && editor.innerHTML !== (value || '')) {
		editor.innerHTML = value || '';
	}

	function handleInput() {
		internalChange = true;
		value = editor.innerHTML;
		onInput?.();
		if (selectedImg && !editor.contains(selectedImg)) deselectImg();
		else if (selectedImg) computeOverlay();
		setTimeout(() => (internalChange = false), 0);
	}

	// Paste as plain text: strip any formatting the clipboard carries and keep
	// only the text (line breaks preserved).
	function handlePaste(e: ClipboardEvent) {
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		if (!text) return;
		const html = escHtml(text).replace(/\r\n/g, '\n').replace(/\n/g, '<br />');
		document.execCommand('insertHTML', false, html);
		handleInput();
	}

	function exec(command: string, arg?: string) {
		if (disabled) return;
		restoreSelection();
		document.execCommand(command, false, arg);
		handleInput();
		refreshFormatState();
	}

	// Colors need styleWithCSS so they come out as inline styles (font tags are
	// unreliable for hiliteColor). Toggle it off right after so bold/italic keep
	// producing plain tags.
	function execStyled(command: string, arg: string) {
		if (disabled) return;
		restoreSelection();
		document.execCommand('styleWithCSS', false, 'true');
		document.execCommand(command, false, arg);
		document.execCommand('styleWithCSS', false, 'false');
		handleInput();
	}

	function setBlock(tag: string) {
		headingValue = tag;
		exec('formatBlock', tag);
	}

	function syncBlock() {
		try {
			const v = (document.queryCommandValue('formatBlock') || '').toLowerCase();
			headingValue = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(v) ? v : 'p';
		} catch {
			/* noop */
		}
	}

	// ---------- color popover ----------
	let colorMenu: 'fore' | 'back' | null = null;
	const PALETTE = [
		'#FFFFFF', '#E4E4E4', '#BDBDBB', '#8A8A8A', '#4D4D4D', '#212121', '#000000',
		'#E1FF00', '#FFD93D', '#FF9F43', '#FF5A5A', '#FF6BD6', '#B15AFF', '#4DA3FF',
		'#39C0C8', '#4CD964', '#2E8B57', '#A56A3A', '#F5E6C8', '#FFB4B4', '#C9E1FF'
	];

	function toggleColorMenu(which: 'fore' | 'back') {
		saveSelection();
		colorMenu = colorMenu === which ? null : which;
	}

	function applyColor(c: string) {
		const cmd = colorMenu === 'back' ? 'hiliteColor' : 'foreColor';
		colorMenu = null;
		execStyled(cmd, c);
	}

	function clearBgColor() {
		colorMenu = null;
		execStyled('hiliteColor', 'transparent');
	}

	function colorMenuOutside(node: HTMLElement) {
		const handler = (e: MouseEvent) => {
			if (!node.contains(e.target as Node)) colorMenu = null;
		};
		document.addEventListener('click', handler, true);
		return { destroy: () => document.removeEventListener('click', handler, true) };
	}

	// ---------- modals (link / image / table) ----------
	let activeModal: 'link' | 'image' | 'table' | null = null;

	function escHtml(s: string) {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
	function escAttr(s: string) {
		return escHtml(s).replace(/"/g, '&quot;');
	}

	// Link
	let linkText = '';
	let linkUrl = '';
	let editingAnchor: HTMLAnchorElement | null = null;

	function findAnchorAtSelection(): HTMLAnchorElement | null {
		const sel = window.getSelection();
		let node: Node | null = sel?.anchorNode ?? null;
		while (node && node !== editor) {
			if (node instanceof HTMLAnchorElement) return node;
			node = node.parentNode;
		}
		return null;
	}

	function openLinkModal() {
		if (disabled) return;
		saveSelection();
		editingAnchor = findAnchorAtSelection();
		linkUrl = editingAnchor?.getAttribute('href') ?? '';
		linkText = editingAnchor
			? (editingAnchor.textContent ?? '')
			: (window.getSelection()?.toString() ?? '');
		activeModal = 'link';
	}

	function normalizeUrl(raw: string): string {
		const u = raw.trim();
		if (!u) return '';
		return /^(https?:\/\/|mailto:|tel:)/i.test(u) ? u : `https://${u}`;
	}

	function applyLink() {
		const url = normalizeUrl(linkUrl);
		if (!url) return;
		const text = linkText.trim() || linkUrl.trim();
		activeModal = null;
		if (editingAnchor) {
			editingAnchor.setAttribute('href', url);
			editingAnchor.textContent = text;
			editingAnchor = null;
			handleInput();
		} else {
			restoreSelection();
			document.execCommand(
				'insertHTML',
				false,
				`<a href="${escAttr(url)}">${escHtml(text)}</a>`
			);
			handleInput();
		}
	}

	// Image
	let fileInput: HTMLInputElement;
	let dragOver = false;

	function openImageModal() {
		if (disabled) return;
		saveSelection();
		activeModal = 'image';
	}

	function downscaleImage(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onerror = () => reject(new Error('read failed'));
			reader.onload = () => {
				const src = String(reader.result);
				const img = new Image();
				img.onload = () => {
					const MAX = 1400;
					const scale = Math.min(1, MAX / Math.max(img.width, img.height));
					if (scale >= 1) return resolve(src);
					const canvas = document.createElement('canvas');
					canvas.width = Math.round(img.width * scale);
					canvas.height = Math.round(img.height * scale);
					canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
					resolve(
						file.type === 'image/png'
							? canvas.toDataURL('image/png')
							: canvas.toDataURL('image/jpeg', 0.85)
					);
				};
				img.onerror = () => resolve(src);
				img.src = src;
			};
			reader.readAsDataURL(file);
		});
	}

	async function insertImageFile(file: File) {
		if (!file || !file.type.startsWith('image/')) return;
		const dataUrl = await downscaleImage(file);
		activeModal = null;
		restoreSelection();
		document.execCommand('insertHTML', false, `<img src="${dataUrl}" style="width: 320px;" />`);
		handleInput();
	}

	function onFilePicked(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (f) insertImageFile(f);
		(e.currentTarget as HTMLInputElement).value = '';
	}

	function onModalDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const f = e.dataTransfer?.files?.[0];
		if (f) insertImageFile(f);
	}

	// Direct drop onto the editor body (no modal needed).
	function onEditorDrop(e: DragEvent) {
		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;
		const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
		if (imgs.length === 0) return;
		e.preventDefault();
		const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
		if (range) savedRange = range;
		for (const f of imgs) insertImageFile(f);
	}

	// ---------- image select / move / resize / wrap ----------
	let selectedImg: HTMLImageElement | null = null;
	let overlay: { x: number; y: number; w: number; h: number } | null = null;

	function computeOverlay() {
		if (!selectedImg || !wrapper) {
			overlay = null;
			return;
		}
		const wr = wrapper.getBoundingClientRect();
		const ir = selectedImg.getBoundingClientRect();
		overlay = { x: ir.left - wr.left, y: ir.top - wr.top, w: ir.width, h: ir.height };
	}

	function deselectImg() {
		selectedImg = null;
		overlay = null;
	}

	function onEditorClick(e: MouseEvent) {
		const t = e.target as HTMLElement;
		if (t instanceof HTMLImageElement) {
			selectedImg = t;
			computeOverlay();
		} else {
			deselectImg();
		}
	}

	function startResize(e: PointerEvent, corner: 'nw' | 'ne' | 'sw' | 'se') {
		e.preventDefault();
		e.stopPropagation();
		const img = selectedImg;
		if (!img) return;
		const startX = e.clientX;
		const startW = img.getBoundingClientRect().width;
		const dir = corner === 'ne' || corner === 'se' ? 1 : -1;
		const move = (ev: PointerEvent) => {
			const w = Math.max(48, Math.round(startW + dir * (ev.clientX - startX)));
			img.style.width = `${w}px`;
			img.style.height = 'auto';
			computeOverlay();
		};
		const up = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			handleInput();
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}

	function setImgWrap(mode: 'left' | 'inline' | 'right') {
		const img = selectedImg;
		if (!img) return;
		if (mode === 'left') {
			img.style.float = 'left';
			img.style.margin = '4px 14px 6px 0';
		} else if (mode === 'right') {
			img.style.float = 'right';
			img.style.margin = '4px 0 6px 14px';
		} else {
			img.style.float = '';
			img.style.margin = '4px 0';
		}
		handleInput();
		computeOverlay();
	}

	function deleteSelectedImg() {
		selectedImg?.remove();
		deselectImg();
		handleInput();
	}

	// Table
	let tableRows = 3;
	let tableCols = 3;
	let tableHeader = true;

	function openTableModal() {
		if (disabled) return;
		saveSelection();
		activeModal = 'table';
	}

	function insertTable() {
		const rows = Math.min(Math.max(Number(tableRows) || 3, 1), 30);
		const cols = Math.min(Math.max(Number(tableCols) || 3, 1), 12);
		activeModal = null;
		let html = '<table class="rte-table"><tbody>';
		for (let r = 0; r < rows; r++) {
			html += '<tr>';
			for (let c = 0; c < cols; c++) {
				html += r === 0 && tableHeader ? '<th><br /></th>' : '<td><br /></td>';
			}
			html += '</tr>';
		}
		html += '</tbody></table><p><br /></p>';
		exec('insertHTML', html);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (activeModal) {
			activeModal = null;
			e.stopPropagation();
		} else if (colorMenu) {
			colorMenu = null;
		} else if (selectedImg) {
			deselectImg();
		}
	}

	const btn =
		'w-8 h-8 flex items-center justify-center rounded-lg text-gray2 hover:text-white hover:bg-gray1 cursor-pointer text-sm font-bold';
	const modalInput =
		'w-full bg-gray1 rounded-xl px-4 py-2 text-sm font-bold text-white placeholder-gray2 focus:outline-none';
</script>

<svelte:window on:keydown={onKeydown} on:resize={computeOverlay} />

<div
	class="rounded-2xl bg-gray1 overflow-hidden {fill ? 'h-full flex flex-col min-h-0' : ''} {disabled
		? 'opacity-60 pointer-events-none'
		: ''}"
>
	<!-- Toolbar -->
	<div class="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-navbar bg-gray1 shrink-0">
		<div class="mr-1 w-32" on:mousedown={saveSelection} role="none">
			<Dropdown
				options={headingOptions}
				bind:value={headingValue}
				small
				onChange={(v) => setBlock(v)}
			/>
		</div>

		<button type="button" class="{btn} {fmt.bold ? 'bg-navbar text-lime' : ''}" title="Bold" on:mousedown|preventDefault={saveSelection} on:click={() => exec('bold')}><b>B</b></button>
		<button type="button" class="{btn} {fmt.italic ? 'bg-navbar text-lime' : ''}" title="Italic" on:mousedown|preventDefault={saveSelection} on:click={() => exec('italic')}><i>I</i></button>
		<button type="button" class="{btn} underline {fmt.underline ? 'bg-navbar text-lime' : ''}" title="Underline" on:mousedown|preventDefault={saveSelection} on:click={() => exec('underline')}>U</button>
		<button type="button" class="{btn} line-through {fmt.strike ? 'bg-navbar text-lime' : ''}" title="Strikethrough" on:mousedown|preventDefault={saveSelection} on:click={() => exec('strikeThrough')}>S</button>

		<span class="w-px h-5 bg-navbar mx-1"></span>

		<!-- Colors -->
		<div class="relative flex items-center gap-0.5" use:colorMenuOutside>
			<button
				type="button"
				class="{btn} {colorMenu === 'fore' ? 'bg-navbar text-white' : ''}"
				title="Text color"
				on:mousedown|preventDefault={saveSelection}
				on:click={() => toggleColorMenu('fore')}
			>
				<span class="flex flex-col items-center leading-none">
					<span class="text-[13px] font-black">A</span>
					<span class="w-4 h-[3px] rounded-full bg-lime mt-0.5"></span>
				</span>
			</button>
			<button
				type="button"
				class="{btn} {colorMenu === 'back' ? 'bg-navbar text-white' : ''}"
				title="Text background color"
				on:mousedown|preventDefault={saveSelection}
				on:click={() => toggleColorMenu('back')}
			>
				<span class="w-5 h-5 rounded bg-navbar flex items-center justify-center">
					<span class="text-[11px] font-black bg-lime text-black px-0.5 rounded-sm">A</span>
				</span>
			</button>

			{#if colorMenu}
				<div class="absolute left-0 top-full mt-1.5 bg-navbar border border-gray1 rounded-xl shadow-2xl z-[95] p-2.5 w-[196px]">
					<p class="text-[10px] font-black uppercase tracking-widest text-gray2 mb-2 px-0.5">
						{colorMenu === 'fore' ? 'Text Color' : 'Background Color'}
					</p>
					<div class="grid grid-cols-7 gap-1.5">
						{#each PALETTE as c (c)}
							<button
								type="button"
								class="w-5 h-5 rounded-md border border-white/10 cursor-pointer hover:scale-110 transition-transform"
								style="background: {c};"
								title={c}
								on:click={() => applyColor(c)}
								aria-label="Color {c}"
							></button>
						{/each}
					</div>
					<div class="flex items-center justify-between mt-2.5">
						<label class="flex items-center gap-1.5 text-[11px] font-bold text-gray2 cursor-pointer hover:text-white">
							<input
								type="color"
								class="w-5 h-5 rounded-md cursor-pointer bg-transparent border-none p-0"
								on:change={(e) => applyColor(e.currentTarget.value)}
							/>
							Custom
						</label>
						{#if colorMenu === 'back'}
							<button type="button" class="text-[11px] font-bold text-gray2 hover:text-white cursor-pointer" on:click={clearBgColor}>None</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<span class="w-px h-5 bg-navbar mx-1"></span>

		<button type="button" class="{btn} {fmt.ol ? 'bg-navbar text-lime' : ''}" title="Numbered list" on:mousedown|preventDefault={saveSelection} on:click={() => exec('insertOrderedList')}>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path></svg>
		</button>
		<button type="button" class="{btn} {fmt.ul ? 'bg-navbar text-lime' : ''}" title="Bullet list" on:mousedown|preventDefault={saveSelection} on:click={() => exec('insertUnorderedList')}>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="9" y1="6" x2="21" y2="6"></line><line x1="9" y1="12" x2="21" y2="12"></line><line x1="9" y1="18" x2="21" y2="18"></line><circle cx="4" cy="6" r="1.2" fill="currentColor"></circle><circle cx="4" cy="12" r="1.2" fill="currentColor"></circle><circle cx="4" cy="18" r="1.2" fill="currentColor"></circle></svg>
		</button>
		<button type="button" class={btn} title="Outdent" on:mousedown|preventDefault={saveSelection} on:click={() => exec('outdent')}>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="11" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line><polyline points="7 9 4 12 7 15"></polyline></svg>
		</button>
		<button type="button" class={btn} title="Indent" on:mousedown|preventDefault={saveSelection} on:click={() => exec('indent')}>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="11" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line><polyline points="4 9 7 12 4 15"></polyline></svg>
		</button>

		<span class="w-px h-5 bg-navbar mx-1"></span>

		<button type="button" class={btn} title="Link" on:mousedown|preventDefault={saveSelection} on:click={openLinkModal}>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
		</button>
		<button type="button" class={btn} title="Image" on:mousedown|preventDefault={saveSelection} on:click={openImageModal}>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
		</button>
		<button type="button" class={btn} title="Insert table" on:mousedown|preventDefault={saveSelection} on:click={openTableModal}>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
		</button>
		<button type="button" class={btn} title="Clear formatting" on:mousedown|preventDefault={saveSelection} on:click={() => exec('removeFormat')}>
			<span class="text-xs font-black">T<sub>x</sub></span>
		</button>
	</div>

	<!-- Editable area -->
	<div class="relative {fill ? 'flex-1 min-h-0' : ''}" bind:this={wrapper}>
		<div
			bind:this={editor}
			contenteditable={!disabled}
			on:input={handleInput}
			on:paste={handlePaste}
			on:click={onEditorClick}
			on:keyup={syncBlock}
			on:mouseup={syncBlock}
			on:drop={onEditorDrop}
			on:dragover={(e) => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); }}
			on:scroll={computeOverlay}
			data-placeholder={placeholder}
			role="textbox"
			tabindex="0"
			class="rte-content px-5 py-4 text-sm text-white focus:outline-none overflow-y-auto leading-relaxed"
			style={fill ? 'height: 100%;' : `min-height: ${minHeight}; max-height: ${maxHeight};`}
		></div>

		<!-- Image selection overlay: 4 corner resize handles + wrap toolbar -->
		{#if selectedImg && overlay}
			<div
				class="absolute pointer-events-none border-2 border-lime rounded-md"
				style="left: {overlay.x - 2}px; top: {overlay.y - 2}px; width: {overlay.w + 4}px; height: {overlay.h + 4}px;"
			>
				<div class="pointer-events-auto absolute -left-1.5 -top-1.5 w-3 h-3 bg-lime rounded-full cursor-nwse-resize" on:pointerdown={(e) => startResize(e, 'nw')} role="none"></div>
				<div class="pointer-events-auto absolute -right-1.5 -top-1.5 w-3 h-3 bg-lime rounded-full cursor-nesw-resize" on:pointerdown={(e) => startResize(e, 'ne')} role="none"></div>
				<div class="pointer-events-auto absolute -left-1.5 -bottom-1.5 w-3 h-3 bg-lime rounded-full cursor-nesw-resize" on:pointerdown={(e) => startResize(e, 'sw')} role="none"></div>
				<div class="pointer-events-auto absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-lime rounded-full cursor-nwse-resize" on:pointerdown={(e) => startResize(e, 'se')} role="none"></div>

				<div
					class="pointer-events-auto absolute left-0 flex items-center gap-0.5 bg-navbar border border-gray1 rounded-lg shadow-xl p-1"
					style="top: {overlay.y > 44 ? '-40px' : '8px'};"
				>
					<button type="button" title="Wrap text right of image" class="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer {selectedImg.style.float === 'left' ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}" on:click={() => setImgWrap('left')}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="8" height="8" rx="1"></rect><line x1="14" y1="6" x2="21" y2="6"></line><line x1="14" y1="10" x2="21" y2="10"></line><line x1="3" y1="16" x2="21" y2="16"></line><line x1="3" y1="20" x2="21" y2="20"></line></svg>
					</button>
					<button type="button" title="Inline (no wrap)" class="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer {!selectedImg.style.float ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}" on:click={() => setImgWrap('inline')}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="4" x2="21" y2="4"></line><rect x="7" y="8" width="10" height="8" rx="1"></rect><line x1="3" y1="20" x2="21" y2="20"></line></svg>
					</button>
					<button type="button" title="Wrap text left of image" class="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer {selectedImg.style.float === 'right' ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}" on:click={() => setImgWrap('right')}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="13" y="5" width="8" height="8" rx="1"></rect><line x1="3" y1="6" x2="10" y2="6"></line><line x1="3" y1="10" x2="10" y2="10"></line><line x1="3" y1="16" x2="21" y2="16"></line><line x1="3" y1="20" x2="21" y2="20"></line></svg>
					</button>
					<span class="w-px h-4 bg-gray1 mx-0.5"></span>
					<button type="button" title="Delete image" class="w-7 h-7 flex items-center justify-center rounded-md text-gray2 hover:text-problem cursor-pointer" on:click={deleteSelectedImg}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- ---------- Modals ---------- -->
{#if activeModal}
	<div
		use:portal
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
		on:click|self={() => (activeModal = null)}
		role="none"
	>
		<div class="bg-navbar rounded-3xl p-6 w-full max-w-md shadow-2xl">
			{#if activeModal === 'link'}
				<h4 class="text-white font-black text-base mb-4">{editingAnchor ? 'Edit Link' : 'Insert Link'}</h4>
				<div class="flex flex-col gap-3">
					<div>
						<span class="block text-[11px] font-bold text-gray2 mb-1.5 ml-1 uppercase tracking-widest">Link Text</span>
						<input type="text" bind:value={linkText} placeholder="Text shown in the document" class={modalInput} />
					</div>
					<div>
						<span class="block text-[11px] font-bold text-gray2 mb-1.5 ml-1 uppercase tracking-widest">URL</span>
						<input
							type="text"
							bind:value={linkUrl}
							placeholder="www.example.com"
							class={modalInput}
							on:keydown={(e) => e.key === 'Enter' && applyLink()}
						/>
					</div>
				</div>
				<div class="flex gap-3 justify-end mt-5">
					<button type="button" on:click={() => (activeModal = null)} class="px-5 py-2 bg-gray1 text-white font-bold text-sm rounded-full hover:bg-gray2/30 cursor-pointer">Cancel</button>
					<button type="button" on:click={applyLink} disabled={!linkUrl.trim()} class="px-5 py-2 bg-lime text-black font-black text-sm rounded-full hover:opacity-90 cursor-pointer disabled:opacity-40">
						{editingAnchor ? 'Save Link' : 'Insert Link'}
					</button>
				</div>
			{:else if activeModal === 'image'}
				<h4 class="text-white font-black text-base mb-4">Insert Image</h4>
				<div
					class="rounded-2xl border-2 border-dashed {dragOver ? 'border-lime bg-lime/5' : 'border-gray1'} h-44 flex flex-col items-center justify-center gap-2.5 cursor-pointer"
					on:click={() => fileInput.click()}
					on:dragover|preventDefault={() => (dragOver = true)}
					on:dragleave={() => (dragOver = false)}
					on:drop={onModalDrop}
					role="button"
					tabindex="0"
					on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
				>
					<svg class="w-8 h-8 {dragOver ? 'text-lime' : 'text-gray2'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
					<p class="text-sm font-bold {dragOver ? 'text-lime' : 'text-gray2'}">Drag &amp; drop an image here</p>
					<span class="px-4 py-1.5 bg-gray1 text-white text-xs font-bold rounded-full">Browse Files</span>
				</div>
				<input type="file" accept="image/*" bind:this={fileInput} class="hidden" on:change={onFilePicked} />
				<p class="text-[11px] text-gray2 font-medium mt-3 ml-1">Once inserted: click the image to move it, resize it from the corners, or wrap text around it.</p>
				<div class="flex justify-end mt-4">
					<button type="button" on:click={() => (activeModal = null)} class="px-5 py-2 bg-gray1 text-white font-bold text-sm rounded-full hover:bg-gray2/30 cursor-pointer">Cancel</button>
				</div>
			{:else if activeModal === 'table'}
				<h4 class="text-white font-black text-base mb-4">Insert Table</h4>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<span class="block text-[11px] font-bold text-gray2 mb-1.5 ml-1 uppercase tracking-widest">Rows</span>
						<input type="number" min="1" max="30" bind:value={tableRows} class={modalInput} />
					</div>
					<div>
						<span class="block text-[11px] font-bold text-gray2 mb-1.5 ml-1 uppercase tracking-widest">Columns</span>
						<input type="number" min="1" max="12" bind:value={tableCols} class={modalInput} />
					</div>
				</div>
				<div class="flex items-center gap-3 mt-4">
					<span class="text-xs font-bold {tableHeader ? 'text-white' : 'text-gray2'}">Header row</span>
					<button
						type="button"
						role="switch"
						aria-checked={tableHeader}
						aria-label="Header row"
						on:click={() => (tableHeader = !tableHeader)}
						class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent focus:outline-none {tableHeader ? 'bg-lime' : 'bg-[#444]'}"
					>
						<span aria-hidden="true" class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-150 {tableHeader ? 'translate-x-5' : 'translate-x-0'}"></span>
					</button>
				</div>
				<div class="flex gap-3 justify-end mt-5">
					<button type="button" on:click={() => (activeModal = null)} class="px-5 py-2 bg-gray1 text-white font-bold text-sm rounded-full hover:bg-gray2/30 cursor-pointer">Cancel</button>
					<button type="button" on:click={insertTable} class="px-5 py-2 bg-lime text-black font-black text-sm rounded-full hover:opacity-90 cursor-pointer">Insert Table</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.rte-content {
		font-weight: 400; /* never inherit bold from the surrounding UI */
		scrollbar-width: thin;
		scrollbar-color: #4d4d4d transparent;
	}
	/* Always-visible scrollbar so long documents are obviously scrollable */
	.rte-content::-webkit-scrollbar {
		width: 8px;
	}
	.rte-content::-webkit-scrollbar-thumb {
		background: #4d4d4d;
		border-radius: 8px;
	}
	.rte-content::-webkit-scrollbar-thumb:hover {
		background: #6b6b6b;
	}
	.rte-content::-webkit-scrollbar-track {
		background: transparent;
	}
	.rte-content :global(b),
	.rte-content :global(strong) {
		font-weight: 700;
	}
	.rte-content :global(u) {
		font-weight: inherit; /* underline never implies bold */
	}
	.rte-content:empty::before {
		content: attr(data-placeholder);
		color: #6b6b6b;
		pointer-events: none;
	}
	.rte-content :global(h1) {
		font-size: 1.35rem;
		font-weight: 800;
		margin: 0.6em 0 0.25em;
	}
	.rte-content :global(h2) {
		font-size: 1.2rem;
		font-weight: 800;
		margin: 0.6em 0 0.25em;
	}
	.rte-content :global(h3) {
		font-size: 1.05rem;
		font-weight: 700;
		margin: 0.5em 0 0.2em;
	}
	.rte-content :global(h4) {
		font-size: 0.95rem;
		font-weight: 700;
		margin: 0.5em 0 0.2em;
	}
	.rte-content :global(h5) {
		font-size: 0.88rem;
		font-weight: 700;
		margin: 0.4em 0 0.15em;
	}
	.rte-content :global(h6) {
		font-size: 0.82rem;
		font-weight: 700;
		margin: 0.4em 0 0.15em;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.rte-content :global(p) {
		margin: 0 0 0.4em;
	}
	.rte-content :global(ul) {
		list-style: disc;
		padding-left: 1.4em;
		margin: 0.3em 0;
	}
	.rte-content :global(ol) {
		list-style: decimal;
		padding-left: 1.4em;
		margin: 0.3em 0;
	}
	.rte-content :global(a) {
		color: #e1ff00;
		text-decoration: underline;
	}
	.rte-content :global(img) {
		max-width: 100%;
		border-radius: 8px;
		margin: 4px 0;
		cursor: pointer;
	}
	.rte-content :global(table.rte-table) {
		border-collapse: collapse;
		width: 100%;
		margin: 0.4em 0;
	}
	.rte-content :global(table.rte-table td),
	.rte-content :global(table.rte-table th) {
		border: 1px solid #444;
		padding: 4px 8px;
		min-width: 2em;
	}
	.rte-content :global(table.rte-table th) {
		background: rgba(225, 255, 0, 0.08);
		font-weight: 700;
		text-align: left;
	}
</style>
