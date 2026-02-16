<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';

	export let events: any[] = [];
	export let loading = false;

	// Controlled by Parent
	export let mode: 'EVENT' | 'ALL' = 'EVENT';
	export let timeFilter: 'ALL' | 'LIVE' | 'PAST' = 'ALL';
	export let selectedEventId: number | null = null;

	const dispatch = createEventDispatcher();
	let searchTerm = '';
	let listContainer: HTMLElement;

	const timeFilterOptions: ('LIVE' | 'PAST' | 'ALL')[] = ['LIVE', 'PAST', 'ALL'];

	// Auto-Scroll: Only triggers when selectedEventId actually changes
	let lastScrolledId: number | null = null;

	$: if (selectedEventId && listContainer && selectedEventId !== lastScrolledId) {
		scrollToEvent(selectedEventId);
	}

	async function scrollToEvent(id: number) {
		await tick();
		const el = document.getElementById(`event-item-${id}`);
		if (el) {
			lastScrolledId = id;
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	const excludeKeywords = [
		'test',
		'réservations',
		'pass',
		'event',
		'template',
		'produktworld',
		'piknic',
		'oktoberfest'
	];

	// Split Logic
	let liveEvents: any[] = [];
	let pastEvents: any[] = [];

	$: {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const filtered = events.filter((event) => {
			if (!event.event_name) return false;

			const nameLower = event.event_name.toLowerCase();
			if (excludeKeywords.some((keyword) => nameLower.includes(keyword))) return false;

			if (searchTerm) {
				return (
					nameLower.includes(searchTerm.toLowerCase()) ||
					(event.event_venue && event.event_venue.toLowerCase().includes(searchTerm.toLowerCase()))
				);
			}
			return true;
		});

		liveEvents = filtered
			.filter((e) => new Date(e.event_date) >= today)
			.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

		pastEvents = filtered
			.filter((e) => new Date(e.event_date) < today)
			.sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
	}

	function handleEventClick(event: any) {
		dispatch('select', event);
	}

	function handleFilterClick(newFilter: 'ALL' | 'LIVE' | 'PAST') {
		dispatch('filterChange', newFilter);
	}

	function formatDate(dateString: string): string {
		if (!dateString) return 'TBD';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="absolute inset-0 flex flex-col bg-navbar">
	<div class="p-3 border-b border-gray1 space-y-3 bg-gray1/30 flex-shrink-0 z-10">
		<div class="flex items-center justify-between">
			<h2 class="text-white font-bold text-base">
				{mode === 'ALL' ? 'Select Event' : 'Select Event'}
			</h2>
		</div>

		<div class="bg-gray1 p-1 rounded-full flex gap-1">
			{#each timeFilterOptions as t}
				<button
					class="flex-1 py-1.5 text-[10px] font-bold rounded-full transition-all uppercase tracking-wide cursor-pointer
                    {timeFilter === t
						? 'bg-lime text-black shadow-md'
						: 'text-gray2 hover:text-white'}"
					on:click={() => handleFilterClick(t)}
				>
					{t}
				</button>
			{/each}
		</div>

		<div class="relative">
			<svg
				class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray2"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"
				></line></svg
			>
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Search events..."
				class="w-full bg-gray1 text-white rounded-full pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-lime placeholder-gray2 transition-all"
			/>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-2 scroll-smooth" bind:this={listContainer}>
		{#if loading}
			<div class="p-8 text-center">
				<div
					class="animate-spin w-6 h-6 border-2 border-lime border-t-transparent rounded-full mx-auto"
				></div>
			</div>
		{:else}
			{#if (timeFilter === 'ALL' || timeFilter === 'LIVE') && liveEvents.length > 0}
				{#if timeFilter === 'ALL'}
					<div
						class="px-2 py-2 mb-1 text-[14px] font-bold text-lime uppercase tracking-wider opacity-100 bg-navbar z-20 shadow-sm"
					>
						Upcoming
					</div>
				{/if}
				{#each liveEvents as event (event.id || event.event_id)}
					<button
						id={`event-item-${event.event_id}`}
						class="w-full text-left p-2.5 rounded-2xl flex items-center gap-3 group transition-all duration-200 border cursor-pointer mb-1
                        {selectedEventId === event.event_id
							? 'bg-gray1/80 border-lime shadow-[0_0_10px_rgba(132,204,22,0.1)]'
							: 'border-transparent hover:bg-gray1/50 hover:border-gray2/50'}"
						on:click={() => handleEventClick(event)}
					>
						<div class="w-10 h-10 rounded-xl bg-gray1 flex-shrink-0 overflow-hidden relative">
							{#if event.event_flyer}
								<img src={event.event_flyer} alt="" class="w-full h-full object-cover" />
							{:else}
								<div
									class="w-full h-full flex items-center justify-center text-gray2 text-[9px] font-bold"
								>
									IMG
								</div>
							{/if}
						</div>
						<div class="flex-1 min-w-0">
							<div
								class="text-white text-xs font-bold truncate group-hover:text-lime transition-colors"
							>
								{event.event_name}
							</div>
							<div class="text-gray2 text-[10px] font-medium mt-0.5">
								{formatDate(event.event_date)}
							</div>
						</div>
					</button>
				{/each}
			{/if}

			{#if timeFilter === 'ALL' && liveEvents.length > 0 && pastEvents.length > 0}
				<div class="h-4"></div>
			{/if}

			{#if (timeFilter === 'ALL' || timeFilter === 'PAST') && pastEvents.length > 0}
				{#if timeFilter === 'ALL'}
					<div
						class="px-2 py-2 mb-1 text-[14px] font-bold text-gray2 uppercase tracking-wider opacity-100 bg-navbar z-20 shadow-sm"
					>
						Past Events
					</div>
				{/if}
				{#each pastEvents as event (event.id || event.event_id)}
					<button
						id={`event-item-${event.event_id}`}
						class="w-full text-left p-2.5 rounded-2xl flex items-center gap-3 group transition-all duration-200 border cursor-pointer mb-1
                        {selectedEventId === event.event_id
							? 'bg-gray1/80 border-lime shadow-[0_0_10px_rgba(132,204,22,0.1)]'
							: 'border-transparent hover:bg-gray1/50 hover:border-gray2/50'}"
						on:click={() => handleEventClick(event)}
					>
						<div class="w-10 h-10 rounded-xl bg-gray1 flex-shrink-0 overflow-hidden relative">
							{#if event.event_flyer}
								<img src={event.event_flyer} alt="" class="w-full h-full object-cover" />
							{:else}
								<div
									class="w-full h-full flex items-center justify-center text-gray2 text-[9px] font-bold"
								>
									IMG
								</div>
							{/if}
						</div>
						<div class="flex-1 min-w-0">
							<div
								class="text-white text-xs font-bold truncate group-hover:text-lime transition-colors"
							>
								{event.event_name}
							</div>
							<div class="text-gray2 text-[10px] font-medium mt-0.5">
								{formatDate(event.event_date)}
							</div>
						</div>
					</button>
				{/each}
			{/if}

			{#if liveEvents.length === 0 && pastEvents.length === 0}
				<div class="p-8 text-center text-gray2 text-xs">No events found</div>
			{/if}
		{/if}
	</div>
</div>
