<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { formatShortDate, parseLocalDate } from '$lib/components/booking/talentpayments/paymentStatus';

	export let events: any[] = [];
	export let loading = false;
	export let mode: 'EVENT' | 'ALL' = 'EVENT';
	export let timeFilter: 'ALL' | 'LIVE' | 'PAST' = 'ALL';
	export let selectedEventId: number | null = null;

	const dispatch = createEventDispatcher();
	let searchTerm = '';
	let listContainer: HTMLElement;

	const timeFilterOptions: ('LIVE' | 'PAST' | 'ALL')[] = ['LIVE', 'PAST', 'ALL'];

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

	let liveEvents: any[] = [];
	let pastEvents: any[] = [];

	$: {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const term = searchTerm.trim().toLowerCase();

		const filtered = events.filter((event) => {
			if (!event.event_name) return false;

			const nameLower = event.event_name.toLowerCase();
			if (excludeKeywords.some((keyword) => nameLower.includes(keyword))) return false;

			if (term) {
				return (
					nameLower.includes(term) ||
					(event.event_venue && event.event_venue.toLowerCase().includes(term))
				);
			}
			return true;
		});

		liveEvents = filtered
			.filter((e) => (parseLocalDate(e.event_date) ?? new Date(0)) >= today)
			.sort(
				(a, b) =>
					(parseLocalDate(a.event_date)?.getTime() ?? 0) -
					(parseLocalDate(b.event_date)?.getTime() ?? 0)
			);

		pastEvents = filtered
			.filter((e) => (parseLocalDate(e.event_date) ?? new Date(0)) < today)
			.sort(
				(a, b) =>
					(parseLocalDate(b.event_date)?.getTime() ?? 0) -
					(parseLocalDate(a.event_date)?.getTime() ?? 0)
			);
	}

	// One flat list of sections keeps the markup to a single loop.
	$: sections = [
		{ key: 'live', label: 'Upcoming', accent: true, items: liveEvents },
		{ key: 'past', label: 'Past Events', accent: false, items: pastEvents }
	].filter((s) => {
		if (s.items.length === 0) return false;
		if (timeFilter === 'LIVE') return s.key === 'live';
		if (timeFilter === 'PAST') return s.key === 'past';
		return true;
	});

	$: isEmpty = !loading && sections.length === 0;
</script>

<div class="absolute inset-0 flex flex-col bg-navbar">
	<div class="z-10 flex-shrink-0 space-y-2 border-b border-gray1 bg-gray1/30 p-2.5">
		<div class="flex items-center justify-between">
			<h2 class="text-[13px] font-bold text-white">Select Event</h2>
			{#if mode === 'EVENT' && selectedEventId}
				<button
					class="cursor-pointer text-[10px] font-bold text-gray2 transition-colors hover:text-white"
					on:click={() => dispatch('select', null)}
				>
					Clear
				</button>
			{/if}
		</div>

		<div class="flex gap-1 rounded-full bg-gray1 p-0.5">
			{#each timeFilterOptions as t}
				<button
					class="flex-1 cursor-pointer rounded-full py-1 text-[10px] font-bold uppercase tracking-wider transition-colors
					{timeFilter === t ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}"
					on:click={() => dispatch('filterChange', t)}
				>
					{t}
				</button>
			{/each}
		</div>

		<div class="relative">
			<svg
				class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray2"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				viewBox="0 0 24 24"
			>
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</svg>
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Search events..."
				class="w-full rounded-full bg-gray1 py-1.5 pl-8 pr-3 text-[11px] font-medium text-white placeholder-gray2 transition-all focus:outline-none focus:ring-1 focus:ring-lime"
			/>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-1.5" bind:this={listContainer}>
		{#if loading}
			<div class="p-6 text-center">
				<div class="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-lime border-t-transparent"></div>
			</div>
		{:else if isEmpty}
			<div class="p-6 text-center text-[11px] text-gray2">No events found</div>
		{:else}
			{#each sections as section (section.key)}
				{#if timeFilter === 'ALL'}
					<div
						class="px-1.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest {section.accent
							? 'text-lime'
							: 'text-gray2'}"
					>
						{section.label}
					</div>
				{/if}

				{#each section.items as event (event.event_id)}
					<button
						id={`event-item-${event.event_id}`}
						class="event-row group {selectedEventId === event.event_id
							? 'border-lime bg-lime/10'
							: 'border-transparent hover:border-white/10 hover:bg-white/5'}"
						on:click={() => dispatch('select', event)}
					>
						<span class="event-thumb">
							{#if event.event_flyer}
								<img src={event.event_flyer} alt="" loading="lazy" decoding="async" />
							{/if}
						</span>
						<span class="min-w-0 flex-1">
							<span class="event-name text-white group-hover:text-lime">{event.event_name}</span>
							<span class="event-date text-white/50">{formatShortDate(event.event_date)}</span>
						</span>
					</button>
				{/each}
			{/each}
		{/if}
	</div>
</div>

<style>
	/* Geometry only — border colour and text colour come from the Tailwind
	   `lime` token in the markup so accents always match the rest of the app. */
	.event-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 44px; /* fixed => the list never reflows while flyers load */
		padding: 0 8px;
		margin-bottom: 2px;
		border-width: 1px;
		border-style: solid;
		border-radius: 10px;
		background-color: transparent;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease;
		contain: layout paint;
	}

	.event-thumb {
		position: relative;
		display: block;
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		overflow: hidden;
		border-radius: 8px;
		background: rgb(255 255 255 / 0.06);
	}

	.event-thumb img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.event-name {
		display: block;
		font-size: 12px;
		font-weight: 700;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.event-date {
		display: block;
		margin-top: 1px;
		font-size: 10px;
		font-weight: 600;
	}
</style>