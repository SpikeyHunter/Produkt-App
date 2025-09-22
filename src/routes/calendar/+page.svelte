<script lang="ts">
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import Calendar from '$lib/components/calendar/Calendar.svelte';
	import CalendarAddEvent from '$lib/components/calendar/CalendarAddEvent.svelte';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';

	// State
	let mounted = false;
	let selectedDate = new Date();
	let showAddEventModal = false;
	let viewType: 'month' | 'week' | 'list' = 'month';

	// Popup notification state
	let showPopup = false;
	let popupMessage = '';

	// Show popup message
	function showPopupMessage(message: string): void {
		popupMessage = message;
		showPopup = true;
	}

	// Handle event success
	function handleEventSuccess(event: CustomEvent) {
		showPopupMessage(event.detail.message);
	}

	// Handle event error
	function handleEventError(event: CustomEvent) {
		showPopupMessage(event.detail.message);
	}

	// Handle edit event from calendar
	function handleEditEvent(event: CustomEvent) {
		// For now, just show a message - you can implement edit functionality later
		showPopupMessage('Edit functionality coming soon!');
		console.log('Edit event:', event.detail.event);
	}

	onMount(() => {
		setTimeout(() => {
			mounted = true;
		}, 150);
	});
</script>

<svelte:head>
	<title>Calendar — Produkt App</title>
</svelte:head>

<MainLayout pageTitle="Calendar">
	<PopupNotification message={popupMessage} bind:show={showPopup} duration={3000} variant="navbar" />

	<div class="h-full py-6 px-4 overflow-auto">
		<div class="mx-auto">
			<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.1s;">
				<div class="flex justify-between items-center mb-1 px-5 flex-wrap gap-4">
					<div class="flex gap-2 bg-gray2/10 p-1 rounded-4xl">
						<button
							class="px-4 py-2 rounded-4xl font-bold transition-all cursor-pointer {viewType === 'month'
								? 'bg-lime text-black'
								: 'bg-transparent text-gray2 hover:bg-gray2/20 hover:text-white'}"
							on:click={() => (viewType = 'month')}>Month</button
						>
						<button
							class="px-4 py-2 rounded-4xl font-bold transition-all cursor-pointer {viewType === 'week'
								? 'bg-lime text-black'
								: 'bg-transparent text-gray2 hover:bg-gray2/20 hover:text-white'}"
							on:click={() => (viewType = 'week')}>Week</button
						>
						<button
							class="px-4 py-2 rounded-4xl font-bold transition-all cursor-pointer {viewType === 'list'
								? 'bg-lime text-black'
								: 'bg-transparent text-gray2 hover:bg-gray2/20 hover:text-white'}"
							on:click={() => (viewType = 'list')}>List</button
						>
					</div>

					<button
						class="flex items-center gap-2 px-6 py-3 bg-lime text-black rounded-3xl font-bold transition-all hover:opacity-90 cursor-pointer"
						on:click={() => (showAddEventModal = true)}
					>
						<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
							><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg
						>
						Add Event
					</button>
				</div>
			</div>

			<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.2s;">
				<Calendar 
					bind:selectedDate 
					{viewType} 
					on:editEvent={handleEditEvent}
				/>
			</div>
		</div>
	</div>

	<CalendarAddEvent
		bind:isOpen={showAddEventModal}
		{selectedDate}
		on:success={handleEventSuccess}
		on:error={handleEventError}
		on:close={() => (showAddEventModal = false)}
	/>
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
</style>