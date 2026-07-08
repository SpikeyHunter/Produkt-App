<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import type { TracklistTrack, TracklistSection } from '$lib/types/tour';
	import { setSetting } from '$lib/services/tourService';

	export let tracklist: TracklistTrack[] = [];

	// Export action so the SettingsModal can manage the "Add Track" button in its header
	export function triggerNew() {
		addTrack();
	}

	const dispatch = createEventDispatcher();

	// Shared input styling — borderless, rounded-full (matches TourCrew / TourMerch)
	// Placeholder uses a more muted tone than the gray2 label text above it.
	const inputCls =
		'w-full bg-black/40 rounded-full px-3 py-1.5 text-sm text-white placeholder-gray2/40 focus:outline-none focus:ring-1 focus:ring-gray2 transition';
	const labelCls = 'text-[10px] uppercase tracking-wider text-gray2';

	const SECTIONS: { id: TracklistSection; label: string }[] = [
		{ id: 'main', label: 'Main Set' },
		{ id: 'encore', label: 'Encore' }
	];

	function uid() {
		return Math.random().toString(36).slice(2, 10);
	}

	function blankTrack(section: TracklistSection): TracklistTrack {
		return { id: uid(), order: 0, section, name: '', singer_notes: '', vj_notes: '', ld_notes: '', other_notes: '' };
	}

	function renumber(list: TracklistTrack[]): TracklistTrack[] {
		// Continuous numbering across both sections, main first then encore,
		// independent of the order tracks happen to sit in the array.
		const main = list.filter((t) => t.section === 'main');
		const encore = list.filter((t) => t.section === 'encore');
		let n = 1;
		const stamp = (arr: TracklistTrack[]) => arr.map((t) => ({ ...t, order: n++ }));
		return [...stamp(main), ...stamp(encore)];
	}

	// ---------- undo/redo history ----------
	// Snapshots are pushed on discrete actions (add/remove/reorder/section-move),
	// not on every keystroke — text edits autosave but don't spam the history stack.
	let history: TracklistTrack[][] = [structuredClone(tracklist)];
	let historyIndex = 0;
	let suppressHistory = false;

	function pushHistory() {
		if (suppressHistory) return;
		history = [...history.slice(0, historyIndex + 1), structuredClone(tracklist)];
		historyIndex = history.length - 1;
	}

	function undo() {
		if (historyIndex <= 0) return;
		historyIndex--;
		suppressHistory = true;
		tracklist = structuredClone(history[historyIndex]);
		suppressHistory = false;
	}

	function redo() {
		if (historyIndex >= history.length - 1) return;
		historyIndex++;
		suppressHistory = true;
		tracklist = structuredClone(history[historyIndex]);
		suppressHistory = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		const mod = e.metaKey || e.ctrlKey;
		if (!mod || e.key.toLowerCase() !== 'z') return;
		e.preventDefault();
		if (e.shiftKey) redo();
		else undo();
	}

	onMount(() => window.addEventListener('keydown', handleKeydown));
	onDestroy(() => window.removeEventListener('keydown', handleKeydown));

	// ---------- autosave ----------
	let saveTimer: ReturnType<typeof setTimeout>;
	let savingState: 'idle' | 'saving' | 'saved' = 'idle';
	let initialized = false;

	function scheduleSave() {
		if (!initialized) return;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(commitSave, 600);
	}

	async function commitSave() {
		savingState = 'saving';
		try {
			const payload = tracklist.filter((t) => t.name.trim());
			await setSetting('tracklist', payload);
			dispatch('saved');
			savingState = 'saved';
			setTimeout(() => (savingState = 'idle'), 1500);
		} catch (e) {
			console.error('Failed to autosave tracklist', e);
			savingState = 'idle';
		}
	}

	queueMicrotask(() => (initialized = true));
	$: tracklist, scheduleSave();
	onDestroy(() => clearTimeout(saveTimer));

	// ---------- list ops ----------
	function addTrack(section: TracklistSection = 'main') {
		tracklist = renumber([...tracklist, blankTrack(section)]);
		pushHistory();
	}

	function removeTrack(id: string) {
		tracklist = renumber(tracklist.filter((t) => t.id !== id));
		pushHistory();
	}

	// Called on blur/change of a text field — commits a history snapshot
	// without firing on every keystroke.
	function commitEdit() {
		pushHistory();
	}

	// ---------- drag and drop ----------
	let draggingId: string | null = null;
	let draggingSection: TracklistSection | null = null;
	let dragOverId: string | null = null;
	let dragOverSection: TracklistSection | null = null;

	// True once we know both where the drag started and where it's hovering,
	// and those two sections differ — used to render a distinct "moving to a
	// different section" treatment vs. a plain same-section reorder.
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

		const list = [...tracklist];
		const sourceIdx = list.findIndex((t) => t.id === sourceId);
		if (sourceIdx === -1) return;
		const [moved] = list.splice(sourceIdx, 1);
		moved.section = section;

		if (targetId === null) {
			// Dropped on empty section area — append to end of that section
			let insertAt = list.length;
			for (let i = list.length - 1; i >= 0; i--) {
				if (list[i].section === section) {
					insertAt = i + 1;
					break;
				}
			}
			list.splice(insertAt, 0, moved);
		} else {
			const targetIdx = list.findIndex((t) => t.id === targetId);
			list.splice(targetIdx === -1 ? list.length : targetIdx, 0, moved);
		}

		tracklist = renumber(list);
		pushHistory();
	}

	$: sections = SECTIONS.map((s) => ({
		...s,
		tracks: tracklist.filter((t) => t.section === s.id)
	}));
</script>

<div class="space-y-6">
	<p class="text-xs text-gray2">
		Default set list template — loadable into any show's Set List tab. Drag rows to reorder.
		Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z to redo.
	</p>

	{#each sections as sec}
		<div>
			<div class="flex items-center gap-2 mb-2">
				<h3 class="text-xs font-bold text-gray2 uppercase tracking-wider">{sec.label}</h3>
				{#if dragOverSection === sec.id && draggingSection !== null && draggingSection !== sec.id}
					<span class="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
						→ Move to {sec.label}
					</span>
				{/if}
			</div>

			{#if sec.tracks.length > 0}
				<div class="hidden md:grid grid-cols-[24px_28px_1fr_1fr_1fr_1fr_1fr_24px] gap-2 px-2 mb-1.5">
					<span></span>
					<span class="{labelCls} text-right">#</span>
					<span class="{labelCls} px-3">Song Name</span>
					<span class="{labelCls} px-3">Singer Notes</span>
					<span class="{labelCls} px-3">VJ Notes</span>
					<span class="{labelCls} px-3">LD Notes</span>
					<span class="{labelCls} px-3">Other Notes</span>
					<span></span>
				</div>
			{/if}

			<div
				class="space-y-1.5 rounded-2xl transition-all duration-150 {dragOverSection === sec.id &&
				!dragOverId
					? isCrossSectionDrag
						? 'bg-orange-400/10 ring-2 ring-orange-400/60'
						: 'bg-lime/5 ring-1 ring-lime/30'
					: ''}"
				role="list"
				on:dragover={(e) => handleDragOverSectionEmpty(e, sec.id)}
				on:drop={(e) => handleDrop(e, null, sec.id)}
			>
				{#each sec.tracks as track (track.id)}
					{@const isDropTarget = dragOverId === track.id && draggingId !== track.id}
					{@const crossHere = isDropTarget && draggingSection !== null && draggingSection !== sec.id}

					<!-- Insertion line: shows exactly where the dragged row will land.
					     Lime = reordering within the same section. Orange = moving into
					     a different section than the one the drag started in. -->
					{#if isDropTarget}
						<div
							class="h-[3px] rounded-full -my-[1.5px] transition-all {crossHere
								? 'bg-orange-400'
								: 'bg-lime'}"
						></div>
					{/if}

					<div
						class="grid grid-cols-[24px_28px_1fr_24px] md:grid-cols-[24px_28px_1fr_1fr_1fr_1fr_1fr_24px] gap-2 items-center rounded-xl px-2 py-1.5 transition-all duration-150 {draggingId ===
						track.id
							? 'opacity-30 scale-[0.98] bg-black/30'
							: isDropTarget
								? crossHere
									? 'bg-orange-400/10 ring-1 ring-orange-400/50'
									: 'bg-lime/10 ring-1 ring-lime/60'
								: 'bg-black/30'}"
						role="listitem"
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, track.id, sec.id)}
						on:dragover={(e) => handleDragOverRow(e, track.id, sec.id)}
						on:dragend={handleDragEnd}
						on:drop={(e) => handleDrop(e, track.id, sec.id)}
					>
						<span
							class="cursor-grab active:cursor-grabbing text-gray2 hover:text-white transition shrink-0"
							aria-label="Drag to reorder"
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
								<circle cx="8" cy="6" r="1.4" /><circle cx="16" cy="6" r="1.4" />
								<circle cx="8" cy="12" r="1.4" /><circle cx="16" cy="12" r="1.4" />
								<circle cx="8" cy="18" r="1.4" /><circle cx="16" cy="18" r="1.4" />
							</svg>
						</span>

						<span class="text-xs font-black text-gray2 text-right shrink-0">{track.order}.</span>

						<input
							class={inputCls}
							placeholder="Song name"
							bind:value={track.name}
							on:change={commitEdit}
						/>

						<input
							class="{inputCls} hidden md:block"
							placeholder="Singer notes"
							bind:value={track.singer_notes}
							on:change={commitEdit}
						/>
						<input
							class="{inputCls} hidden md:block"
							placeholder="VJ notes"
							bind:value={track.vj_notes}
							on:change={commitEdit}
						/>
						<input
							class="{inputCls} hidden md:block"
							placeholder="LD notes"
							bind:value={track.ld_notes}
							on:change={commitEdit}
						/>
						<input
							class="{inputCls} hidden md:block"
							placeholder="Other notes"
							bind:value={track.other_notes}
							on:change={commitEdit}
						/>

						<button
							class="cursor-pointer text-gray2 hover:text-problem transition shrink-0"
							on:click={() => removeTrack(track.id)}
							aria-label="Remove track"
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					</div>
				{:else}
					<div
						class="flex items-center justify-center py-6 text-center border border-dashed border-gray1 rounded-xl"
					>
						<p class="text-xs text-gray2 italic">
							No tracks in {sec.label.toLowerCase()} yet.
						</p>
					</div>
				{/each}
			</div>

			<button
				class="cursor-pointer text-xs text-gray2 hover:text-lime transition mt-2"
				on:click={() => addTrack(sec.id)}
			>
				+ Add to {sec.label}
			</button>
		</div>
	{/each}
</div>