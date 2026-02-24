<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import Calendar from '$lib/components/calendar/Calendar.svelte';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';

	let mounted = false;
	let viewType: 'month' | 'week' | 'list' = 'month';
	let currentViewDate = new Date();
	let showPopup = false;
	let popupMessage = '';

	// Sync state from URL on initial load
	if (browser) {
		const urlView = $page.url.searchParams.get('view');
		if (urlView && ['month', 'week', 'list'].includes(urlView)) {
			viewType = urlView as 'month' | 'week' | 'list';
		}
		const urlDate = $page.url.searchParams.get('date');
		if (urlDate) {
			currentViewDate = new Date(urlDate + 'T00:00:00');
		}
	}

	// Sync state to URL reactively
	$: if (browser && mounted) {
		const url = new URL(window.location.href);
		url.searchParams.set('view', viewType);
		url.searchParams.set('date', currentViewDate.toISOString().split('T')[0]);
		goto(url.toString(), { replaceState: true, keepFocus: true });
	}

	function showPopupMessage(message: string): void {
		popupMessage = message;
		showPopup = true;
	}

	onMount(() => {
		setTimeout(() => { mounted = true; }, 100);
	});
</script>

<svelte:head>
	<title>Calendar</title>
</svelte:head>

<MainLayout pageTitle="Calendar">
	<PopupNotification message={popupMessage} bind:show={showPopup} duration={3000} variant="navbar" />

	<div class="h-full w-full p-2 overflow-hidden flex flex-col">
		<div class="flex justify-between items-center mb-3 px-1 fade-in {mounted ? 'mounted' : ''}">
			<div class="flex gap-1 bg-[#BDBDBB]/10 p-1 rounded-full">
				<button class="px-6 py-2 rounded-full text-sm font-bold transition-all cursor-pointer {viewType === 'month' ? 'bg-[#E1FF00] text-black' : 'text-[#BDBDBB] hover:bg-[#BDBDBB]/20 hover:text-white'}" on:click={() => (viewType = 'month')}>Month</button>
				<button class="px-6 py-2 rounded-full text-sm font-bold transition-all cursor-pointer {viewType === 'week' ? 'bg-[#E1FF00] text-black' : 'text-[#BDBDBB] hover:bg-[#BDBDBB]/20 hover:text-white'}" on:click={() => (viewType = 'week')}>Week</button>
				<button class="px-6 py-2 rounded-full text-sm font-bold transition-all cursor-pointer {viewType === 'list' ? 'bg-[#E1FF00] text-black' : 'text-[#BDBDBB] hover:bg-[#BDBDBB]/20 hover:text-white'}" on:click={() => (viewType = 'list')}>List</button>
			</div>
		</div>

		<div class="flex-1 min-h-0 fade-in {mounted ? 'mounted' : ''}">
			<Calendar bind:viewType bind:currentViewDate />
		</div>
	</div>
</MainLayout>

<style>
	.fade-in { opacity: 0; transform: translateY(10px); transition: opacity 0.3s ease-out, transform 0.3s ease-out; }
	.fade-in.mounted { opacity: 1; transform: translateY(0); }
</style>