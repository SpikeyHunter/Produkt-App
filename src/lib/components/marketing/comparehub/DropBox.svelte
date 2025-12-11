<script lang="ts">
	import type { CompareEventData } from '$lib/types/compare';

	export let boxIndex: number;
	export let eventData: CompareEventData | null = null;
	export let formatEventDate: (dateString: string) => string;
	export let onDrop: (eventData: CompareEventData) => void;
	export let onRemove: () => void;

	let dragover = false;

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragover = true;
	}

	function handleDragLeave() {
		dragover = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragover = false;
		try {
			const rawData = e.dataTransfer?.getData('application/json');
			if (!rawData) return;
			const data = JSON.parse(rawData);
			onDrop(data);
		} catch (err) {
			console.error('Drop error', err);
		}
	}
</script>

<div
	class="relative rounded-2xl min-h-[90px] flex items-center justify-center transition-all duration-200 border-2"
	class:bg-navbar={!dragover}
	class:bg-gray1={dragover}
	class:border-transparent={!dragover}
	class:border-lime={dragover}
	role="region"
	aria-label="Event drop zone {boxIndex + 1}"
	on:dragover={handleDragOver}
	on:dragleave={handleDragLeave}
	on:drop={handleDrop}
>
	{#if eventData}
		<div class="flex items-center gap-3 w-full p-3 relative group">
			<button 
				class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-navbar border border-gray2 text-gray2 hover:text-black hover:bg-lime hover:border-lime flex items-center justify-center transition-all shadow-md z-10"
				on:click|stopPropagation={onRemove}
				aria-label="Remove event"
			>
				<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
					<path d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>

			<div class="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-gray1 border border-gray2/10 flex items-center justify-center">
				{#if eventData.flyer_url}
					<img class="w-full h-full object-cover" src={eventData.flyer_url} alt={eventData.name} />
				{:else}
					<div class="w-full h-full bg-gray1"></div>
				{/if}
			</div>

			<div class="flex flex-col min-w-0 flex-1">
				<div class="text-white font-bold text-sm leading-tight mb-0.5 truncate pr-2">
					{eventData.name}
				</div>
				<div class="text-gray2 text-xs">
					{formatEventDate(eventData.event_date)}
				</div>
			</div>
		</div>
	{:else}
		<span class="text-3xl text-gray2/30 font-light select-none">+</span>
	{/if}
</div>