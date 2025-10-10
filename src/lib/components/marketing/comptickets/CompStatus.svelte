<!-- /src/lib/components/marketing/comptickets/CompStatus.svelte -->
<script lang="ts">
	import type { CompTicketData, CompStatus as CompStatusType } from '$lib/types/comptickets';
	import type { Writable } from 'svelte/store';

	export let data: Writable<CompTicketData>;
	
	const statuses: CompStatusType['status'][] = ['None', 'Progress', 'To Send', 'Sent'];

	// Check if there are any comps
	$: hasComps = ($data.ga_comps?.length || 0) > 0 || 
	              ($data.vip_comps?.length || 0) > 0 || 
	              ($data.other_comps?.length || 0) > 0;

	function handleStatusChange(newStatus: CompStatusType['status']) {
		// Only allow changes if there are comps and not already selected
		if (!hasComps || $data.comp_status.status === newStatus) return;
		
		// Use the .update method to ensure Svelte's reactivity is triggered
		data.update(currentData => {
			currentData.comp_status.status = newStatus;
			return currentData;
		});
	}
	
	function getButtonClasses(status: string, isSelected: boolean): string {
		const base = 'px-4 py-2.5 rounded-3xl text-sm font-bold transition-all';
		
		// If no comps and status is not "None", show as disabled
		if (!hasComps && status !== 'None') {
			return `${base} bg-gray1 text-gray-400 opacity-50 cursor-not-allowed`;
		}
		
		// If status is "None" and no comps, force it to look selected but disabled for interaction
		if (!hasComps && status === 'None') {
			return `${base} bg-problem text-black cursor-not-allowed`;
		}
		
		if (isSelected) {
			const colorMap = {
				'None': 'bg-problem text-black cursor-pointer',
				'Progress': 'bg-tentatif text-black cursor-pointer',
				'To Send': 'bg-proposed text-black cursor-pointer',
				'Sent': 'bg-confirmed text-black cursor-pointer'
			};
			return `${base} ${colorMap[status as keyof typeof colorMap]}`;
		}
		const hoverColorMap = {
			'None': 'hover:bg-problem',
			'Progress': 'hover:bg-tentatif',
			'To Send': 'hover:bg-proposed',
			'Sent': 'hover:bg-confirmed'
		};
		return `${base} bg-gray1 text-gray3 ${hoverColorMap[status as keyof typeof hoverColorMap]} hover:text-black cursor-pointer`;
	}
</script>

<div class="bg-navbar border border-gray1 rounded-xl p-4">
	<h3 class="text-white text-sm font-bold mb-3">Comp Status</h3>
	<div class="grid grid-cols-2 gap-2">
		{#each statuses as status}
			<button
				on:click={() => handleStatusChange(status)}
				class={getButtonClasses(status, $data.comp_status.status === status)}
				disabled={!hasComps && status !== 'None'}
				title={!hasComps && status !== 'None' ? 'Add comps to change status' : ''}
			>
				{status}
			</button>
		{/each}
	</div>
	{#if !hasComps}
		<p class="text-xs text-gray3 mt-2 text-center">Add comps to change status</p>
	{/if}
</div>