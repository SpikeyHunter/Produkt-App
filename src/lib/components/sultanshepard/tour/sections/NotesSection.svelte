<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { NotesData, NoteItem, NotePriority } from '$lib/types/tour';

	export let data: NotesData = {};

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	// Priority → app colors (info #c4b5fd, question #93c5fd, warning = tentatif, emergency = problem)
	const PRIORITIES: { value: NotePriority; label: string; chip: string; border: string }[] = [
		{ value: 'info', label: 'Info', chip: 'bg-info text-black', border: 'border-info/60' },
		{ value: 'question', label: 'Question', chip: 'bg-question text-black', border: 'border-question/60' },
		{ value: 'warning', label: 'Warning', chip: 'bg-tentatif text-black', border: 'border-tentatif/60' },
		{ value: 'emergency', label: 'EMERGENCY', chip: 'bg-problem text-black', border: 'border-problem' }
	];

	const ORDER: Record<NotePriority, number> = { emergency: 0, warning: 1, question: 2, info: 3 };

	let newText = '';
	let newPriority: NotePriority = 'info';

	$: items = [...(data.items || [])].sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
	$: counts = PRIORITIES.map((p) => ({
		...p,
		count: (data.items || []).filter((i) => i.priority === p.value).length
	}));

	function add() {
		const text = newText.trim();
		if (!text) return;
		const item: NoteItem = {
			id: uid(),
			text,
			priority: newPriority,
			created_at: new Date().toISOString()
		};
		data.items = [...(data.items || []), item];
		newText = '';
		changed();
	}

	function setPriority(item: NoteItem, p: NotePriority) {
		item.priority = p;
		changed();
	}

	function remove(id: string) {
		data.items = (data.items || []).filter((i) => i.id !== id);
		changed();
	}

	const meta = (p: NotePriority) => PRIORITIES.find((x) => x.value === p) || PRIORITIES[0];
</script>

<div class="space-y-3">
	<!-- counts -->
	{#if (data.items || []).length > 0}
		<div class="flex flex-wrap gap-2">
			{#each counts as c}
				{#if c.count > 0}
					<span class="text-[10px] font-bold px-2 py-0.5 rounded-md {c.chip}">
						{c.count} {c.label}
					</span>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- add row -->
	<div class="flex flex-col sm:flex-row gap-2">
		<textarea
			class="flex-1 bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white placeholder-gray2 focus:outline-none focus:border-lime resize-none"
			rows="2"
			placeholder="Write a note…"
			bind:value={newText}
			on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), add())}
		></textarea>
		<div class="flex sm:flex-col gap-2">
			<select
				class="bg-black/40 border border-gray1 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-lime"
				bind:value={newPriority}
			>
				{#each PRIORITIES as p}
					<option value={p.value}>{p.label}</option>
				{/each}
			</select>
			<button
				class="px-4 py-2 rounded-lg bg-lime text-black text-sm font-bold hover:opacity-90 transition"
				on:click={add}
			>
				Add
			</button>
		</div>
	</div>

	{#if items.length === 0}
		<p class="text-sm text-gray2 italic">No notes yet.</p>
	{:else}
		<ul class="space-y-2">
			{#each items as item (item.id)}
				{@const m = meta(item.priority)}
				<li class="bg-black/30 border-l-4 {m.border} border border-gray1 rounded-lg px-3 py-2.5 group">
					<div class="flex items-start gap-3">
						<span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 mt-0.5 {m.chip}">
							{m.label}
						</span>
						<p class="flex-1 text-sm text-white whitespace-pre-wrap {item.priority === 'emergency' ? 'font-bold' : ''}">
							{item.text}
						</p>
						<button
							class="opacity-0 group-hover:opacity-100 text-gray2 hover:text-problem transition shrink-0"
							on:click={() => remove(item.id)}
							aria-label="Delete note"
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					</div>
					<!-- quick re-prioritize -->
					<div class="mt-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
						{#each PRIORITIES as p}
							<button
								class="text-[9px] px-1.5 py-0.5 rounded {item.priority === p.value ? p.chip : 'text-gray2 hover:text-white'}"
								on:click={() => setPriority(item, p.value)}
							>
								{p.label}
							</button>
						{/each}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>