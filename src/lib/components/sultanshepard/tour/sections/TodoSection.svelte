<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { TodosData, TodoColumn, TodoItem } from '$lib/types/tour';

	export let data: TodosData = {};

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	const DEFAULT_TITLES = ['General', 'Production', 'Other'];

	// Migrate legacy flat `items` (or first-run) into 3 named columns.
	function ensureColumns() {
		if (data.columns && data.columns.length) return;
		const legacy = data.items || [];
		data.columns = DEFAULT_TITLES.map((title, i) => ({
			id: uid(),
			title,
			items: i === 0 ? legacy : []
		}));
		data.items = undefined;
		changed();
	}

	onMount(ensureColumns);

	$: columns = data.columns || [];

	// Per-column "new task" input text, keyed by column id.
	let newTexts: Record<string, string> = {};

	// Editing state for column titles.
	let editingTitle: string | null = null;

	function sortedItems(col: TodoColumn): TodoItem[] {
		// Undone first (in original order), done items sink to the bottom.
		return [...col.items].sort((a, b) => Number(a.done) - Number(b.done));
	}

	function add(col: TodoColumn) {
		const text = (newTexts[col.id] || '').trim();
		if (!text) return;
		col.items = [...col.items, { id: uid(), text, done: false }];
		newTexts = { ...newTexts, [col.id]: '' };
		data.columns = columns.map((c) => (c.id === col.id ? col : c));
		changed();
	}

	function toggle(col: TodoColumn, item: TodoItem) {
		item.done = !item.done;
		data.columns = columns.map((c) => (c.id === col.id ? { ...c, items: c.items } : c));
		changed();
	}

	function remove(col: TodoColumn, id: string) {
		col.items = col.items.filter((i) => i.id !== id);
		data.columns = columns.map((c) => (c.id === col.id ? col : c));
		changed();
	}

	function clearDone(col: TodoColumn) {
		col.items = col.items.filter((i) => !i.done);
		data.columns = columns.map((c) => (c.id === col.id ? col : c));
		changed();
	}

	function renameColumn(col: TodoColumn, value: string) {
		const title = value.trim() || col.title;
		col.title = title;
		data.columns = columns.map((c) => (c.id === col.id ? col : c));
		changed();
	}

	// Focus-on-mount action — avoids the `autofocus` attribute (a11y_autofocus).
	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
	{#each columns as col (col.id)}
		{@const items = sortedItems(col)}
		{@const doneCount = col.items.filter((i) => i.done).length}
		<div class="bg-gray1/20 rounded-2xl p-3 flex flex-col gap-2.5 min-w-0">
			<!-- Column title (editable) -->
			<div class="flex items-center justify-between gap-2">
				{#if editingTitle === col.id}
					<input
						class="flex-1 min-w-0 bg-black/40 rounded-full px-3 py-1 text-[13px] font-bold uppercase tracking-wider text-lime outline-none border border-lime/50"
						value={col.title}
						use:focusOnMount
						on:blur={(e) => {
							renameColumn(col, e.currentTarget.value);
							editingTitle = null;
						}}
						on:keydown={(e) => {
							if (e.key === 'Enter') e.currentTarget.blur();
							if (e.key === 'Escape') editingTitle = null;
						}}
					/>
				{:else}
					<button
						type="button"
						class="flex-1 min-w-0 text-left text-[13px] font-bold uppercase tracking-wider text-lime truncate rounded-full px-3 py-1 -ml-3 hover:bg-black/30 transition-colors"
						on:click={() => (editingTitle = col.id)}
						title="Click to rename"
					>
						{col.title}
					</button>
				{/if}
				{#if col.items.length}
					<span class="text-[10px] text-gray2 shrink-0 font-mono">{doneCount}/{col.items.length}</span>
				{/if}
			</div>

			<!-- Add row -->
			<div class="flex gap-1.5">
				<input
					class="flex-1 min-w-0 bg-black/40 border border-gray1 rounded-full px-3 py-1.5 text-sm text-white placeholder-gray2 focus:outline-none focus:border-lime transition-colors"
					placeholder="Add a task…"
					bind:value={newTexts[col.id]}
					on:keydown={(e) => e.key === 'Enter' && add(col)}
				/>
				<button
					type="button"
					class="shrink-0 w-8 h-8 rounded-full bg-lime text-black flex items-center justify-center font-bold hover:brightness-110 transition-all disabled:opacity-30 disabled:pointer-events-none"
					disabled={!(newTexts[col.id] || '').trim()}
					on:click={() => add(col)}
					aria-label="Add task"
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<path d="M12 5v14M5 12h14" />
					</svg>
				</button>
			</div>

			<!-- List -->
			{#if items.length === 0}
				<p class="text-xs text-gray2 italic px-1 py-1">No tasks yet.</p>
			{:else}
				<ul class="flex flex-col gap-1">
					{#each items as item (item.id)}
						<li
							class="flex items-center gap-2.5 rounded-full pl-1.5 pr-2.5 py-1.5 group transition-colors
								{item.done ? '' : 'bg-black/30 hover:bg-black/40'}"
						>
							<button
								type="button"
								class="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors
									{item.done ? 'bg-lime border-lime' : 'border-gray2 hover:border-lime'}"
								on:click={() => toggle(col, item)}
								aria-label="Toggle task"
							>
								{#if item.done}
									<svg class="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
										<polyline points="20 6 9 17 4 12" />
									</svg>
								{/if}
							</button>
							<span
								class="flex-1 min-w-0 text-sm break-words {item.done
									? 'text-gray2/60 line-through'
									: 'text-white'}"
							>
								{item.text}
							</span>
							<button
								type="button"
								class="opacity-0 group-hover:opacity-100 text-gray2 hover:text-problem transition-all shrink-0 rounded-full p-0.5"
								on:click={() => remove(col, item.id)}
								aria-label="Delete task"
							>
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if doneCount > 0}
				<button
					type="button"
					class="self-start text-[11px] text-gray2 hover:text-problem transition-colors rounded-full px-2 py-0.5 -ml-2"
					on:click={() => clearDone(col)}
				>
					Clear completed
				</button>
			{/if}
		</div>
	{/each}
</div>