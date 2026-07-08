<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import type { SetListData, SetListSong, TracklistTrack, TracklistSection } from '$lib/types/tour';

	export let data: SetListData = {};
	export let tracklist: TracklistTrack[] = []; // default template from Settings

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);

	// Reassign `data` so Svelte fires cross-component reactivity + autosave,
	// exactly like the other per-date sections.
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	// Inputs match the rounded, lime-accented style used by Production / Show Budget.
	const inputCls =
		'w-full bg-black/20 rounded-full px-3 h-8 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors';
	const labelCls = 'text-[10px] font-bold uppercase tracking-wider text-gray2/70';

	const SECTIONS: { id: TracklistSection; label: string }[] = [
		{ id: 'main', label: 'Main Set' },
		{ id: 'encore', label: 'Encore' }
	];

	const sectionOf = (s: SetListSong): TracklistSection => s.section ?? 'main';

	// ---------- one-time migration ----------
	// Older shows split main/encore with an `is_encore_break` marker row. Convert
	// to an explicit per-song `section` (everything after the marker = encore) and
	// drop the marker so the section model is the single source of truth.
	function normalize(list: SetListSong[]): SetListSong[] {
		let seenBreak = false;
		const out: SetListSong[] = [];
		for (const s of list) {
			if (s.is_encore_break) {
				seenBreak = true;
				continue;
			}
			out.push({ ...s, section: s.section ?? (seenBreak ? 'encore' : 'main') });
		}
		return out;
	}

	// ---------- undo / redo ----------
	// Snapshots on discrete actions (add/remove/reorder/section-move/load) and on
	// blur of a text field — not on every keystroke.
	let history: SetListSong[][] = [];
	let historyIndex = -1;
	let suppressHistory = false;

	function pushHistory() {
		if (suppressHistory) return;
		history = [...history.slice(0, historyIndex + 1), structuredClone(data.songs || [])];
		historyIndex = history.length - 1;
	}
	function restore(index: number) {
		historyIndex = index;
		suppressHistory = true;
		data.songs = structuredClone(history[historyIndex]);
		suppressHistory = false;
		changed();
	}
	function undo() {
		if (historyIndex > 0) restore(historyIndex - 1);
	}
	function redo() {
		if (historyIndex < history.length - 1) restore(historyIndex + 1);
	}
	function handleKeydown(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		if (!mod || e.key.toLowerCase() !== 'z') return;
		e.preventDefault();
		if (e.shiftKey) redo();
		else undo();
	}

	onMount(() => {
		const songs = data.songs || [];
		if (songs.some((s) => s.is_encore_break) || songs.some((s) => !s.section)) {
			data.songs = normalize(songs);
			changed();
		}
		history = [structuredClone(data.songs || [])];
		historyIndex = 0;
		window.addEventListener('keydown', handleKeydown);
	});
	onDestroy(() => window.removeEventListener('keydown', handleKeydown));

	// ---------- list ops ----------
	function loadTemplate() {
		data.songs = [...tracklist]
			.sort((a, b) => a.order - b.order)
			.map((t) => ({
				id: uid(),
				name: t.name,
				section: t.section ?? 'main',
				singer_notes: t.singer_notes || '',
				video_notes: t.vj_notes || '',
				ld_notes: t.ld_notes || '',
				other_notes: t.other_notes || ''
			}));
		changed();
		pushHistory();
	}

	function addSong(section: TracklistSection = 'main') {
		data.songs = [...(data.songs || []), { id: uid(), name: '', section }];
		changed();
		pushHistory();
	}

	function removeSong(id: string) {
		data.songs = (data.songs || []).filter((s) => s.id !== id);
		changed();
		pushHistory();
	}

	// ---------- drag & drop (reorder + move across sections) ----------
	let draggingId: string | null = null;
	let draggingSection: TracklistSection | null = null;
	let dragOverId: string | null = null;
	let dragOverSection: TracklistSection | null = null;

	$: isCrossSectionDrag =
		draggingSection !== null && dragOverSection !== null && draggingSection !== dragOverSection;

	function handleDragStart(e: DragEvent, id: string, section: TracklistSection) {
		draggingId = id;
		draggingSection = section;
		e.dataTransfer?.setData('text/plain', id);
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function handleDragOverRow(e: DragEvent, id: string, section: TracklistSection) {
		e.preventDefault();
		dragOverId = id;
		dragOverSection = section;
	}
	function handleDragOverSectionEmpty(e: DragEvent, section: TracklistSection) {
		e.preventDefault();
		dragOverId = null;
		dragOverSection = section;
	}
	function handleDragEnd() {
		draggingId = null;
		draggingSection = null;
		dragOverId = null;
		dragOverSection = null;
	}
	function handleDrop(e: DragEvent, targetId: string | null, section: TracklistSection) {
		e.preventDefault();
		const sourceId = draggingId;
		handleDragEnd();
		if (!sourceId || sourceId === targetId) return;

		const list = [...(data.songs || [])];
		const sourceIdx = list.findIndex((s) => s.id === sourceId);
		if (sourceIdx === -1) return;
		const [moved] = list.splice(sourceIdx, 1);
		moved.section = section;

		if (targetId === null) {
			// Dropped on empty section area — append to the end of that section.
			let insertAt = list.length;
			for (let i = list.length - 1; i >= 0; i--) {
				if (sectionOf(list[i]) === section) {
					insertAt = i + 1;
					break;
				}
			}
			list.splice(insertAt, 0, moved);
		} else {
			const targetIdx = list.findIndex((s) => s.id === targetId);
			list.splice(targetIdx === -1 ? list.length : targetIdx, 0, moved);
		}

		data.songs = list;
		changed();
		pushHistory();
	}

	// ---------- derived ----------
	$: sections = SECTIONS.map((s) => ({
		...s,
		songs: (data.songs || []).filter((x) => sectionOf(x) === s.id)
	}));

	// Continuous numbering: main first, then encore.
	$: numberById = (() => {
		const map: Record<string, number> = {};
		let n = 1;
		for (const sec of SECTIONS) {
			for (const x of (data.songs || []).filter((s) => sectionOf(s) === sec.id)) {
				map[x.id] = n++;
			}
		}
		return map;
	})();

	$: hasSongs = (data.songs || []).length > 0;
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between gap-3 flex-wrap">
		<p class="text-[11px] text-gray2">
			Drag rows to reorder or move between Main &amp; Encore · ⌘/Ctrl+Z to undo.
		</p>
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="cursor-pointer text-gray2 hover:text-white disabled:opacity-30 disabled:cursor-default transition p-1"
				aria-label="Undo"
				title="Undo (⌘/Ctrl+Z)"
				disabled={historyIndex <= 0}
				on:click={undo}
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
			</button>
			<button
				type="button"
				class="cursor-pointer text-gray2 hover:text-white disabled:opacity-30 disabled:cursor-default transition p-1"
				aria-label="Redo"
				title="Redo (⌘/Ctrl+Shift+Z)"
				disabled={historyIndex >= history.length - 1}
				on:click={redo}
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></svg>
			</button>
			{#if tracklist.length && !hasSongs}
				<button
					type="button"
					class="cursor-pointer px-3 py-1 rounded-full bg-lime text-black text-xs font-bold hover:brightness-110 transition-all"
					on:click={loadTemplate}
				>
					Load default tracklist
				</button>
			{/if}
		</div>
	</div>

	{#each sections as sec}
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="text-[13px] font-bold uppercase tracking-wider text-lime">{sec.label}</span>
				<span class="text-[11px] text-gray2/60 font-mono">{sec.songs.length}</span>
				{#if dragOverSection === sec.id && draggingSection !== null && draggingSection !== sec.id}
					<span class="text-[10px] font-bold uppercase tracking-wider text-orange-400">→ Move here</span>
				{/if}
			</div>

			{#if sec.songs.length > 0}
				<div class="hidden md:grid grid-cols-[24px_28px_1.4fr_1fr_1fr_1fr_1fr_24px] gap-2 px-2 mb-1.5">
					<span></span>
					<span class="{labelCls} text-right">#</span>
					<span class="{labelCls} px-3">Song</span>
					<span class="{labelCls} px-3">Singer</span>
					<span class="{labelCls} px-3">Video</span>
					<span class="{labelCls} px-3">LD</span>
					<span class="{labelCls} px-3">Other</span>
					<span></span>
				</div>
			{/if}

			<div
				class="space-y-1.5 rounded-2xl transition-all duration-150 {dragOverSection === sec.id && !dragOverId
					? isCrossSectionDrag
						? 'bg-orange-400/10 ring-2 ring-orange-400/60'
						: 'bg-lime/5 ring-1 ring-lime/30'
					: ''}"
				role="list"
				on:dragover={(e) => handleDragOverSectionEmpty(e, sec.id)}
				on:drop={(e) => handleDrop(e, null, sec.id)}
			>
				{#each sec.songs as song (song.id)}
					{@const isDropTarget = dragOverId === song.id && draggingId !== song.id}
					{@const crossHere = isDropTarget && draggingSection !== null && draggingSection !== sec.id}

					<!-- Insertion line: lime = same-section reorder, orange = moving sections. -->
					{#if isDropTarget}
						<div class="h-[3px] rounded-full -my-[1.5px] transition-all {crossHere ? 'bg-orange-400' : 'bg-lime'}"></div>
					{/if}

					<div
						class="grid grid-cols-[24px_28px_1fr_24px] md:grid-cols-[24px_28px_1.4fr_1fr_1fr_1fr_1fr_24px] gap-2 items-center rounded-xl px-2 py-1.5 transition-all duration-150 {draggingId === song.id
							? 'opacity-30 scale-[0.98] bg-black/30'
							: isDropTarget
								? crossHere
									? 'bg-orange-400/10 ring-1 ring-orange-400/50'
									: 'bg-lime/10 ring-1 ring-lime/60'
								: 'bg-gray1/30'}"
						role="listitem"
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, song.id, sec.id)}
						on:dragover={(e) => handleDragOverRow(e, song.id, sec.id)}
						on:dragend={handleDragEnd}
						on:drop={(e) => handleDrop(e, song.id, sec.id)}
					>
						<span class="cursor-grab active:cursor-grabbing text-gray2 hover:text-white transition shrink-0" aria-label="Drag to reorder">
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
								<circle cx="8" cy="6" r="1.4" /><circle cx="16" cy="6" r="1.4" />
								<circle cx="8" cy="12" r="1.4" /><circle cx="16" cy="12" r="1.4" />
								<circle cx="8" cy="18" r="1.4" /><circle cx="16" cy="18" r="1.4" />
							</svg>
						</span>

						<span class="text-xs font-black text-gray2 text-right shrink-0">{numberById[song.id]}.</span>

						<input class={inputCls} placeholder="Song name" bind:value={song.name} on:input={changed} on:change={pushHistory} />

						<input class="{inputCls} hidden md:block" placeholder="Singer" bind:value={song.singer_notes} on:input={changed} on:change={pushHistory} />
						<input class="{inputCls} hidden md:block" placeholder="Video" bind:value={song.video_notes} on:input={changed} on:change={pushHistory} />
						<input class="{inputCls} hidden md:block" placeholder="LD" bind:value={song.ld_notes} on:input={changed} on:change={pushHistory} />
						<input class="{inputCls} hidden md:block" placeholder="Other" bind:value={song.other_notes} on:input={changed} on:change={pushHistory} />

						<button class="cursor-pointer text-gray2 hover:text-problem transition shrink-0" on:click={() => removeSong(song.id)} aria-label="Remove song">
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
						</button>
					</div>
				{:else}
					<div class="flex items-center justify-center py-5 text-center border border-dashed border-gray1 rounded-xl">
						<p class="text-xs text-gray2 italic">
							No songs in {sec.label.toLowerCase()} yet{draggingId ? ' — drop here' : ''}.
						</p>
					</div>
				{/each}
			</div>

			<button class="cursor-pointer text-xs font-bold text-gray2 hover:text-lime transition mt-2" on:click={() => addSong(sec.id)}>
				+ Add to {sec.label}
			</button>
		</div>
	{/each}

	{#if !hasSongs && !tracklist.length}
		<p class="text-xs text-gray2 italic">
			Empty set list — add songs above, or build a default tracklist in Settings to load here.
		</p>
	{/if}
</div>