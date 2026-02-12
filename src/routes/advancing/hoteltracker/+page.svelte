<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import HotelTrackerSelector from '$lib/components/hoteltracker/HotelTrackerSelector.svelte';
	import HotelTrackerGrid from '$lib/components/hoteltracker/HotelTrackerGrid.svelte';

	let selectedTrackerId: number | null = null;
	let mounted = false;
	
	// Create a reference to the child component
	let selectorComponent: any;

	onMount(() => {
		setTimeout(() => (mounted = true), 150);
		
		// Check URL for ID on load
		const paramId = $page.url.searchParams.get('id');
		if (paramId) {
			selectedTrackerId = Number(paramId);
		}
	});

	function handleSelect(event: CustomEvent) {
		const item = event.detail;
		if (item) {
			selectedTrackerId = item.id;
			// Update URL without reloading
			const newUrl = new URL($page.url);
			newUrl.searchParams.set('id', String(item.id));
			goto(newUrl.toString(), { keepFocus: true, noScroll: true, replaceState: false });
		} else {
			selectedTrackerId = null;
			const newUrl = new URL($page.url);
			newUrl.searchParams.delete('id');
			goto(newUrl.toString(), { keepFocus: true, noScroll: true });
		}
	}
</script>

<svelte:head>
	<title>Hotel Tracker - NCG</title>
</svelte:head>

<MainLayout pageTitle="Hotel Tracker">
	<div class="h-full overflow-hidden p-6">
		<div class="tracker-container fade-in {mounted ? 'mounted' : ''}">
			<div class="selector-column">
				<HotelTrackerSelector 
					bind:this={selectorComponent} 
					selectedId={selectedTrackerId}
					on:select={handleSelect} 
				/>
			</div>

			<div class="grid-column">
				{#if selectedTrackerId}
					{#key selectedTrackerId}
						<HotelTrackerGrid 
							trackerId={selectedTrackerId} 
							on:saved={() => selectorComponent.loadTrackers(true)}
						/>
					{/key}
				{:else}
					<div class="h-full flex items-center justify-center bg-navbar border-2 border-gray1 rounded-xl text-gray2">
						<p>Select or create a Hotel Tracker entry to begin.</p>
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
		grid-template-columns: 320px 1fr;
		gap: 16px;
		height: 100%;
	}
	.selector-column {
		width: 320px;
		min-width: 320px;
		height: 100%;
		overflow: hidden;
	}
	.grid-column {
		height: 100%;
		min-width: 0;
		overflow: hidden;
	}
</style>