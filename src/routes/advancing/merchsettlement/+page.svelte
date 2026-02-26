<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import MerchSelector from '$lib/components/merchsettlement/MerchSelector.svelte';
	import MerchGrid from '$lib/components/merchsettlement/MerchGrid.svelte';

	let selectedSettlementId: number | null = null;
	let mounted = false;
	let selectorComponent: any;

	onMount(() => {
		setTimeout(() => (mounted = true), 150);
		const paramId = $page.url.searchParams.get('id');
		if (paramId) {
			selectedSettlementId = Number(paramId);
		}
	});

	function handleSelect(event: CustomEvent) {
		const item = event.detail;
		if (item) {
			selectedSettlementId = item.id;
			const newUrl = new URL($page.url);
			newUrl.searchParams.set('id', String(item.id));
			goto(newUrl.toString(), { keepFocus: true, noScroll: true, replaceState: false });
		} else {
			selectedSettlementId = null;
			const newUrl = new URL($page.url);
			newUrl.searchParams.delete('id');
			goto(newUrl.toString(), { keepFocus: true, noScroll: true });
		}
	}
</script>

<svelte:head>
	<title>Merch Settlement</title>
</svelte:head>

<MainLayout pageTitle="Merch Settlement">
	<div class="h-full overflow-hidden p-6">
		<div class="tracker-container fade-in {mounted ? 'mounted' : ''}">
			<div class="selector-column">
				<MerchSelector 
					bind:this={selectorComponent} 
					selectedId={selectedSettlementId}
					on:select={handleSelect} 
				/>
			</div>

			<div class="grid-column">
				{#if selectedSettlementId}
					{#key selectedSettlementId}
						<MerchGrid 
							settlementId={selectedSettlementId} 
							on:saved={() => selectorComponent.loadSettlements(true)}
						/>
					{/key}
				{:else}
					<div class="h-full flex items-center justify-center bg-navbar border-2 border-gray1 rounded-xl text-gray2">
						<p>Select or create a Merch Settlement to begin.</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</MainLayout>

<style>
	.fade-in {
		opacity: 0;
		transform: translateY(20px);
		transition: opacity 0.6s ease-out, transform 0.6s ease-out;
	}
	.fade-in.mounted {
		opacity: 1;
		transform: translateY(0);
	}
	.tracker-container {
		display: grid;
		grid-template-columns: 280px 1fr;
		gap: 16px;
		height: 100%;
	}
	.selector-column {
		width: 280px;
		min-width: 280px;
		height: 100%;
		overflow: hidden;
	}
	.grid-column {
		height: 100%;
		min-width: 0;
		overflow: hidden;
	}
</style>