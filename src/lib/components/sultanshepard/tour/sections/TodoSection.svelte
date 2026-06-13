<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { TodosData, TodoItem } from '$lib/types/tour';

	export let data: TodosData = {};

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	let newText = '';

	$: items = data.items || [];
	$: doneCount = items.filter((i) => i.done).length;

	function add() {
		const text = newText.trim();
		if (!text) return;
		const item: TodoItem = { id: uid(), text, done: false };
		data.items = [...items, item];
		newText = '';
		changed();
	}

	function toggle(item: TodoItem) {
		item.done = !item.done;
		changed();
	}

	function remove(id: string) {
		data.items = items.filter((i) => i.id !== id);
		changed();
	}

	function clearDone() {
		data.items = items.filter((i) => !i.done);
		changed();
	}
</script>

<div class="space-y-3">
	<!-- add row -->
	<div class="flex gap-2">
		<input
			class="flex-1 bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white placeholder-gray2 focus:outline-none focus:border-lime"
			placeholder="Add a task…"
			bind:value={newText}
			on:keydown={(e) => e.key === 'Enter' && add()}
		/>
		<button
			class="px-4 py-2 rounded-lg bg-lime text-black text-sm font-bold hover:opacity-90 transition"
			on:click={add}
		>
			Add
		</button>
	</div>

	{#if items.length === 0}
		<p class="text-sm text-gray2 italic">No tasks yet.</p>
	{:else}
		<div class="flex items-center justify-between">
			<span class="text-xs text-gray2">{doneCount}/{items.length} done</span>
			{#if doneCount > 0}
				<button class="text-xs text-gray2 hover:text-problem transition" on:click={clearDone}>
					Clear completed
				</button>
			{/if}
		</div>

		<ul class="space-y-1.5">
			{#each items as item (item.id)}
				<li
					class="flex items-center gap-3 bg-black/30 border border-gray1 rounded-lg px-3 py-2 group"
				>
					<button
						class="w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition
							{item.done ? 'bg-confirmed border-confirmed' : 'border-gray2 hover:border-lime'}"
						on:click={() => toggle(item)}
						aria-label="Toggle task"
					>
						{#if item.done}
							<svg class="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
								<polyline points="20 6 9 17 4 12" />
							</svg>
						{/if}
					</button>
					<span class="flex-1 text-sm {item.done ? 'text-gray2 line-through' : 'text-white'}">
						{item.text}
					</span>
					<button
						class="opacity-0 group-hover:opacity-100 text-gray2 hover:text-problem transition shrink-0"
						on:click={() => remove(item.id)}
						aria-label="Delete task"
					>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
