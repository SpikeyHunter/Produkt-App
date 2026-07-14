<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { NotesData, NoteItem, NotePriority } from '$lib/types/tour';

	export let data: NotesData = {};

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);

	// Priority → app colors (info #c4b5fd, question #93c5fd, warning = tentatif, emergency = problem).
	// Grid order: top-left, top-right, bottom-left, bottom-right.
	const CARDS: {
		value: NotePriority;
		label: string;
		chip: string;
		border: string;
		text: string;
	}[] = [
		{ value: 'info', label: 'Information', chip: 'bg-confirmed text-black', border: 'border-confirmed/60', text: 'text-info' },
		{ value: 'question', label: 'Question', chip: 'bg-question text-black', border: 'border-question/60', text: 'text-question' },
		{ value: 'warning', label: 'Warning', chip: 'bg-tentatif text-black', border: 'border-tentatif/60', text: 'text-tentatif' },
		{ value: 'emergency', label: 'Emergency', chip: 'bg-problem text-black', border: 'border-problem', text: 'text-problem' }
	];

	// Each card is a single editable textarea. We keep the existing
	// NotesData.items model (so the tab-panel ring and any other consumers
	// keep working): all notes for a priority are stored as one item whose
	// `text` is the card's full content. If a priority somehow has multiple
	// legacy items, we join them with newlines for editing and collapse back
	// to a single item on save.
	function textFor(priority: NotePriority): string {
		return (data.items || [])
			.filter((i) => i.priority === priority)
			.map((i) => i.text)
			.join('\n');
	}

	function updateText(priority: NotePriority, value: string) {
		// Drop every existing item for this priority, then re-add one if there's text.
		const others = (data.items || []).filter((i) => i.priority !== priority);
		const trimmed = value.trim();

		if (trimmed === '') {
			data.items = others;
		} else {
			// Preserve the original id/created_at for this priority if we had one.
			const existing = (data.items || []).find((i) => i.priority === priority);
			const item: NoteItem = {
				id: existing?.id ?? uid(),
				text: value,
				priority,
				created_at: existing?.created_at ?? new Date().toISOString()
			};
			data.items = [...others, item];
		}

		data = { ...data };
		dispatch('change');
	}
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 h-full min-h-[420px]">
	{#each CARDS as card (card.value)}
		<div class="flex flex-col min-h-0 rounded-xl border {card.border} bg-black/30 overflow-hidden">
			<div class="flex items-center gap-2 px-3 py-2 border-b border-gray1 shrink-0">
				<span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md {card.chip}">
					{card.label}
				</span>
			</div>
			<textarea
				class="flex-1 w-full min-h-0 resize-none bg-transparent px-3 py-2.5 text-sm text-white placeholder-gray1 focus:outline-none custom-scrollbar {card.value === 'emergency' ? 'font-bold' : ''}"
				placeholder={`Add notes here`}
				value={textFor(card.value)}
				on:input={(e) => updateText(card.value, (e.currentTarget as HTMLTextAreaElement).value)}
			></textarea>
		</div>
	{/each}
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 2px;
	}
</style>