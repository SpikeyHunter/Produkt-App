<script lang="ts">
	import type { EventAdvance } from '$lib/services/eventsService';
	import ContractEngine from './ContractEngine.svelte';
	import FinancialEngine from './FinancialEngine.svelte';

	export let advance: EventAdvance | null = null;

	type TabType = 'Contract' | 'Invoice' | 'W8_9';
	const TABS: TabType[] = ['Contract', 'Invoice', 'W8_9'];

	let activeTab: TabType = 'Contract';
	let currentAdvanceId: string | undefined = undefined;

	$: if (advance?.id && advance.id !== currentAdvanceId) {
		currentAdvanceId = advance.id;
		activeTab = 'Contract';
	}
</script>

<div class="flex flex-col h-full relative">
	{#if !advance}
		<div class="flex-1 flex flex-col items-center justify-center p-8 text-center">
			<svg
				class="w-12 h-12 text-gray2 mb-4 opacity-50"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
				<polyline points="14 2 14 8 20 8" />
				<line x1="16" y1="13" x2="8" y2="13" />
				<line x1="16" y1="17" x2="8" y2="17" />
				<polyline points="10 9 9 9 8 9" />
			</svg>
			<p class="text-gray3 italic text-sm">Select an event to view its documents</p>
		</div>
	{:else}
		<div class="flex w-full bg-navbar border-b border-gray1 pt-2 px-4 shrink-0">
			{#each TABS as tab}
				<button
					class="flex-1 text-center pb-3 pt-2 text-sm font-bold transition-colors border-b-2 cursor-pointer
					{activeTab === tab
						? 'text-lime border-lime'
						: 'text-gray3 border-transparent hover:text-white hover:bg-gray1/30 rounded-t-lg'}"
					on:click={() => (activeTab = tab)}
				>
					{tab === 'W8_9' ? advance?.w_type || 'W8/9' : tab}
				</button>
			{/each}
		</div>
		<div class="flex-1 relative overflow-hidden bg-gray1/10 flex flex-col">
			{#if activeTab === 'Contract'}
				<ContractEngine bind:advance />
			{:else}
				<FinancialEngine bind:advance tab={activeTab} />
			{/if}
		</div>
	{/if}
</div>
