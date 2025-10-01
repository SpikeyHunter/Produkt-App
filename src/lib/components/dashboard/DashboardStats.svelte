<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import DashboardTemplate from '$lib/components/dashboard/DashboardTemplate.svelte';

	interface Stats {
		totalEvents: number;
		liveEvents: number;
		bazartShows: number;
		ncgShows: number;
	}

	let stats: Stats = {
		totalEvents: 0,
		liveEvents: 0,
		bazartShows: 0,
		ncgShows: 0
	};

	let isLoading = true;

	function shouldExcludeEvent(eventName: string): boolean {
		const excludedWords = [
			'test',
			'réservations',
			'pass',
			'event',
			'template',
			'produktworld',
			'piknic',
			'oktoberfest'
		];
		const eventNameLower = eventName.toLowerCase();
		return excludedWords.some((word) => eventNameLower.includes(word));
	}

	async function fetchStats() {
		try {
			const currentYear = new Date().getFullYear();
			const today = new Date();
			today.setHours(0, 0, 0, 0); // Set to start of day for comparison

			// Fetch all events to filter them
			const { data: allEvents } = await supabase
				.from('events')
				.select('event_name, event_status, event_venue, event_date');

			if (allEvents) {
				// Filter out excluded events
				const validEvents = allEvents.filter((event) => !shouldExcludeEvent(event.event_name));

				// Total events
				stats.totalEvents = validEvents.length;

				// Live events
				stats.liveEvents = validEvents.filter((event) => event.event_status === 'LIVE').length;

				// Bazart shows this year up to today
				stats.bazartShows = validEvents.filter((event) => {
					if (!event.event_date) return false;
					const eventDate = new Date(event.event_date);
					const eventYear = eventDate.getFullYear();
					return event.event_venue === 'Bazart' && eventYear === currentYear && eventDate <= today;
				}).length;

				// NCG shows this year up to today
				stats.ncgShows = validEvents.filter((event) => {
					if (!event.event_date) return false;
					const eventDate = new Date(event.event_date);
					const eventYear = eventDate.getFullYear();
					return (
						event.event_venue === 'New City Gas' && eventYear === currentYear && eventDate <= today
					);
				}).length;
			}
		} catch (error) {
			console.error('Error fetching stats:', error);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchStats();
	});

	const statItems = [
		{
			key: 'totalEvents',
			label: 'All Time Events',
			icon: 'calendar',
			color: 'text-white',
			showIcon: true
		},
		{
			key: 'liveEvents',
			label: 'Live Events',
			icon: 'activity',
			color: 'text-lime',
			showIcon: true
		},
		{
			key: 'ncgShows',
			label: 'NCG',
			sublabel: 'shows completed',
			color: 'text-lime',
			showIcon: false
		},
		{
			key: 'bazartShows',
			label: 'Bazart',
			sublabel: 'shows completed',
			color: 'text-lime',
			showIcon: false
		}
	];
</script>

<DashboardTemplate title="Performances" width={300} height={242}>
	<div slot="icon">
		<svg
			class="w-5 h-5 text-lime"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M12 20V10"></path>
			<path d="M18 20V4"></path>
			<path d="M6 20V14"></path>
		</svg>
	</div>

	{#if isLoading}
		<div class="grid grid-cols-2 gap-3">
			{#each Array(4) as _}
				<div class="animate-pulse">
					<div class="h-8 bg-gray1 rounded mb-1"></div>
					<div class="h-4 bg-gray1 rounded w-3/4"></div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-2.5">
			{#each statItems as item}
				<div
					class="stat-item p-3 rounded-lg bg-gray1/30 hover:bg-gray1/50 !hover:cursor-pointer transition-colors"
				>
					{#if item.showIcon}
						<div class="flex items-center justify-between mb-1">
							<span class="text-3xl font-bold {item.color}">
								{stats[item.key as keyof Stats]}
							</span>
							<svg
								class="w-4 h-4 {item.color} opacity-50 flex-shrink-0"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								{#if item.icon === 'calendar'}
									<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
									<line x1="16" y1="2" x2="16" y2="6"></line>
									<line x1="8" y1="2" x2="8" y2="6"></line>
									<line x1="3" y1="10" x2="21" y2="10"></line>
								{:else if item.icon === 'activity'}
									<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
								{/if}
							</svg>
						</div>
						<p class="text-gray3 text-[12px] leading-tight">{item.label}</p>
					{:else}
						<div class="flex items-baseline gap-1.5 mb-1">
							<span class="text-3xl font-bold {item.color}">
								{stats[item.key as keyof Stats]}
							</span>
							<span class="text-xl font-bold {item.color}">
								{item.label}
							</span>
						</div>
						<p class="text-gray3 text-[12px] leading-tight">{item.sublabel}</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</DashboardTemplate>

<style>
	.stat-item {
		cursor: default;
	}
</style>
