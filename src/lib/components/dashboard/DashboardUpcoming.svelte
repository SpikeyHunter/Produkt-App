<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import DashboardTemplate from '$lib/components/dashboard/DashboardTemplate.svelte';

	interface UpcomingEvent {
		event_id: number;
		event_name: string;
		event_date: string;
		event_flyer: string | null;
		event_venue: string | null;
	}

	let upcomingEvents: UpcomingEvent[] = [];
	let isLoading = true;

	async function fetchUpcomingEvents() {
		try {
			const today = new Date().toISOString().split('T')[0];

			const { data, error } = await supabase
				.from('events')
				.select('event_id, event_name, event_date, event_flyer, event_venue')
				.gte('event_date', today)
				.order('event_date', { ascending: true });

			if (error) throw error;

			// Filter out events with excluded words in event_name
			const excludedWords = ['test', 'réservations', 'pass', 'event', 'template', 'produktworld', 'piknic', 'oktoberfest'];
			const filteredData = (data || []).filter(event => {
				const eventNameLower = event.event_name.toLowerCase();
				return !excludedWords.some(word => eventNameLower.includes(word));
			});

			upcomingEvents = filteredData;
		} catch (error) {
			console.error('Error fetching upcoming events:', error);
			upcomingEvents = [];
		} finally {
			isLoading = false;
		}
	}

	function formatDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1); // Adjust for timezone
			
			const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
			const month = date.toLocaleDateString('en-US', { month: 'long' });
			const day = date.getDate();
			const year = date.getFullYear();
			
			// Add ordinal suffix (st, nd, rd, th)
			const suffix = (day: number) => {
				if (day > 3 && day < 21) return 'th';
				switch (day % 10) {
					case 1: return 'st';
					case 2: return 'nd';
					case 3: return 'rd';
					default: return 'th';
				}
			};
			
			return `${dayOfWeek} ${month} ${day}${suffix(day)}, ${year}`;
		} catch {
			return 'TBD';
		}
	}

	onMount(() => {
		fetchUpcomingEvents();
	});
</script>

<DashboardTemplate title="Upcoming Events" width={300} height={500}>
	<div slot="icon">
		<svg class="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
			<line x1="16" y1="2" x2="16" y2="6"></line>
			<line x1="8" y1="2" x2="8" y2="6"></line>
			<line x1="3" y1="10" x2="21" y2="10"></line>
		</svg>
	</div>

	<div class="h-full overflow-y-auto hide-scrollbar">
		{#if isLoading}
			<div class="space-y-3">
				{#each Array(5) as _}
					<div class="animate-pulse flex gap-4">
						<div class="w-16 h-20 bg-gray1 rounded-lg flex-shrink-0"></div>
						<div class="flex-1 space-y-2 py-2">
							<div class="h-4 bg-gray1 rounded w-3/4"></div>
							<div class="h-3 bg-gray1 rounded w-1/2"></div>
						</div>
					</div>
				{/each}
			</div>
		{:else if upcomingEvents.length > 0}
			<div class="space-y-3">
				{#each upcomingEvents as event}
					<div class="w-full flex gap-2 items-center">
						<div class="w-16 flex-shrink-0">
							<div
								class="w-full h-[85px] rounded-lg bg-gradient-to-br from-lime/20 to-lime/10 overflow-hidden"
							>
								{#if event.event_flyer}
									<img
										src={event.event_flyer}
										alt={event.event_name}
										class="w-full h-full object-cover"
									/>
								{:else}
									<div class="w-full h-full flex items-center justify-center">
										<svg class="w-6 h-6 text-lime/40" viewBox="0 0 24 24" fill="currentColor">
											<path
												d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
											/>
										</svg>
									</div>
								{/if}
							</div>
						</div>

						<div class="flex-1 text-left min-w-0">
							<h3 class="text-white text-sm font-bold whitespace-normal leading-tight">
								{event.event_name}
							</h3>
							<p class="text-lime text-xs mt-1">
								{formatDate(event.event_date)}
							</p>
							<p class="text-gray2 text-xs mt-0.5">
								Event ID: <span class="text-white">{event.event_id}</span>
							</p>
							<p class="text-gray2 text-xs">
								Venue: <span class="text-white">{event.event_venue || 'TBD'}</span>
							</p>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg
					class="w-12 h-12 text-gray3 mb-3"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
					<line x1="16" y1="2" x2="16" y2="6"></line>
					<line x1="8" y1="2" x2="8" y2="6"></line>
					<line x1="3" y1="10" x2="21" y2="10"></line>
				</svg>
				<p class="text-gray2 text-sm">No upcoming events</p>
			</div>
		{/if}
	</div>
</DashboardTemplate>

<style>
	.hide-scrollbar {
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.hide-scrollbar::-webkit-scrollbar {
		display: none;
	}
</style>