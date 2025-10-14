<script lang="ts">
	import type { CompTicketData, CompStatus as CompStatusType } from '$lib/types/comptickets';
	import type { Writable } from 'svelte/store';
	export let data: Writable<CompTicketData>;
	
	const statuses: CompStatusType['status'][] = ['None', 'Progress', 'To Send', 'Sent'];

	$: hasUnsentComps = 
		$data.ga_comps?.some(c => !c.sent) ||
		$data.vip_comps?.some(c => !c.sent) || 
		$data.other_comps?.some(c => !c.sent);

	function handleStatusChange(newStatus: CompStatusType['status']) {
		if ($data.comp_status.status === newStatus && newStatus !== 'Sent') return;

		if (newStatus === 'Sent') {
			if (!hasUnsentComps) return;

			data.update(currentData => {
				currentData.ga_comps = currentData.ga_comps.map(c => c.sent ? c : { ...c, sent: true });
				currentData.vip_comps = currentData.vip_comps.map(c => c.sent ? c : { ...c, sent: true });
				currentData.other_comps = currentData.other_comps.map(c => c.sent ? c : { ...c, sent: true });
				
				currentData.comp_status.status = 'Progress';
				return currentData;
			});
		} else {
			if (!hasUnsentComps && newStatus !== 'None') return;
			data.update(currentData => {
				currentData.comp_status.status = newStatus;
				return currentData;
			});
		}
	}
	
	function getButtonClasses(status: CompStatusType['status'], isSelected: boolean): string {
		const base = 'px-4 py-2.5 rounded-3xl text-sm font-bold transition-all';
		const hasAnyComps = $data.ga_comps?.length > 0 || $data.vip_comps?.length > 0 || $data.other_comps?.length > 0;

		// --- Disabled States ---
		if (!hasAnyComps && status !== 'None') {
			return `${base} bg-gray1 text-gray-400 opacity-50 cursor-not-allowed`;
		}
		if (!hasAnyComps && status === 'None') {
			return `${base} bg-problem text-black cursor-not-allowed`;
		}
		if (!hasUnsentComps && (status === 'To Send' || status === 'Sent')) {
			return `${base} bg-gray1 text-gray-400 opacity-50 cursor-not-allowed`;
		}
		
		// --- Selected State ---
		if (isSelected) {
			const colorMap = {
				'None': 'bg-problem text-black',
				'Progress': 'bg-tentatif text-black',
				'To Send': 'bg-proposed text-black',
				'Sent': '' // 'Sent' is an action, it cannot be the selected persistent state.
			};
			return `${base} ${colorMap[status]}`;
		}

		// --- Default (Unselected) States ---
		const hoverColorMap = {
			'None': 'hover:bg-problem',
			'Progress': 'hover:bg-tentatif',
			'To Send': 'hover:bg-proposed',
			'Sent': 'hover:bg-confirmed'
		};
		
		return `${base} bg-gray1 text-gray3 ${hoverColorMap[status]} hover:text-black cursor-pointer`;
	}
</script>

<div class="bg-navbar border border-gray1 rounded-xl p-4">
	<h3 class="text-white text-sm font-bold mb-3">Comp Status</h3>
	<div class="grid grid-cols-2 gap-2">
		{#each statuses as status}
			<button
				on:click={() => handleStatusChange(status)}
				class={getButtonClasses(status, $data.comp_status.status === status)}
				disabled={
					(!hasUnsentComps && (status === 'To Send' || status === 'Sent')) ||
					(($data.ga_comps.length === 0 && $data.vip_comps.length === 0 && $data.other_comps.length === 0) && status !== 'None')
				}
				title={!hasUnsentComps && (status === 'To Send' || status === 'Sent') ? 'Add new comps to send' : ''}
			>
				{status}
			</button>
		{/each}
	</div>
	{#if !hasUnsentComps && ($data.ga_comps.length > 0 || $data.vip_comps.length > 0 || $data.other_comps.length > 0)}
		<p class="text-xs text-gray3 mt-2 text-center">All current comps have been sent. Add new comps to enable actions.</p>
	{/if}
</div>