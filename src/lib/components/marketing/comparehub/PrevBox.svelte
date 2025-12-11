<script lang="ts">
	import type { CompareEventData } from '$lib/types/compare';

	export let boxIndex: number;
	export let mainEventId: number | null;
	export let compareEvents: CompareEventData[] = [];
	export let onDrop: (eventData: CompareEventData) => void;
	export let onRemove: (eventId: number) => void;

	let dragover = false;
	$: isEnabled = !!mainEventId;
	$: hasItems = compareEvents.length > 0;

	function handleDragOver(e: DragEvent) {
		if (!isEnabled) return;
		e.preventDefault();
		dragover = true;
	}

	function handleDrop(e: DragEvent) {
		if (!isEnabled) return;
		e.preventDefault();
		dragover = false;
		try {
			const rawData = e.dataTransfer?.getData('application/json');
			if (!rawData) return;
			onDrop(JSON.parse(rawData));
		} catch(err) { console.error(err); }
	}
</script>

<div
	class="relative rounded-xl flex flex-col justify-center transition-all duration-200 border mt-2 p-1"
	class:bg-navbar={!dragover && isEnabled}
	class:bg-gray1={!isEnabled}
	class:border-dashed={!hasItems && !dragover}
	class:border-solid={hasItems || dragover}
	class:border-gray2={!dragover && isEnabled && !hasItems}
	class:border-gray2-20={!isEnabled}
	class:border-lime={dragover}
	class:border-gray2-50={hasItems && !dragover} 
	class:cursor-pointer={isEnabled}
	class:cursor-not-allowed={!isEnabled}
	style="min-height: 44px;"
	role="region"
	aria-label="Previous event drop zone {boxIndex + 1}"
	on:dragover={handleDragOver}
	on:dragleave={() => (dragover = false)}
	on:drop={handleDrop}
>
	{#if !isEnabled}
		<div class="flex items-center justify-center h-full py-1">
			<span class="text-gray2/10 text-xl font-bold" aria-hidden="true">+</span>
		</div>
	{:else if hasItems}
		<div class="flex flex-col gap-1 w-full max-h-[110px] overflow-y-auto pr-1 custom-scrollbar">
			{#each compareEvents as event (event.event_id)}
				<div class="flex items-center justify-between w-full px-2 py-1.5 bg-gray1/50 rounded-lg border border-gray2/10 relative group shrink-0">
					<span class="text-lime text-[11px] font-bold truncate max-w-[85%]">
						{event.name}
					</span>
					<button 
						class="w-4 h-4 rounded-full text-gray2 hover:text-[var(--color-problem)] hover:bg-gray1 flex items-center justify-center transition-colors cursor-pointer"
						on:click|stopPropagation={() => onRemove(event.event_id)} 
						aria-label="Remove event"
					>
						<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
							<path d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{:else}
		<div class="flex items-center justify-center py-1">
			<span class="text-gray2/40 text-lg hover:text-lime transition-colors font-bold" aria-hidden="true">+</span>
		</div>
	{/if}
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 3px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--color-gray2);
		border-radius: 4px;
		opacity: 0.3;
	}
	.border-gray2-50 {
		border-color: rgba(189, 189, 187, 0.3);
	}
</style>