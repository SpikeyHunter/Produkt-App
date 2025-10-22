<!-- /src/lib/components/booking/artistavailability/BookingCard.svelte -->
<script lang="ts">
	import type { BookingEvent } from '$lib/types/booking';

	export let data: BookingEvent;

	$: locationString = [data.venue, data.city, data.country].filter(Boolean).join(', ');
	$: isClickable = !!(data.flyer_image_url && data.url);

	function formatDate(dateString: string | null | undefined): string {
		if (!dateString) return 'TBA';

		// Extract just the date part (YYYY-MM-DD)
		const datePart = dateString.split('T')[0];
		const [year, month, day] = datePart.split('-');

		// Create date object for formatting only
		const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

		return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
	}

	function handleCardClick() {
		if (isClickable && data.url) {
			window.open(data.url, '_blank');
		}
	}

	function getSourceColor(source: string | undefined): string {
		if (!source) return '#BDBDBB';
		const normalizedSource = source.toLowerCase().replace(/\s+/g, '');
		switch (normalizedSource) {
			case 'tixr':
				return '#FCA5A5';
			case 'ticketmaster':
				return '#93c5fd';
			case 'evenko':
				return '#c4b5fd';
			case 'raguide':
				return '#FDBA74';
			case 'piknicelectronik':
				return '#86EFAC';
			default:
				return '#BDBDBB';
		}
	}

	const limeGradients = ['from-lime/80 to-lime/40', 'from-lime/70 to-lime/30'];
	const randomGradient = limeGradients[Math.floor(Math.random() * limeGradients.length)];
</script>

<button
	on:click={handleCardClick}
	class="bg-navbar rounded-2xl p-2.5 transition-all duration-200 group border border-gray1 w-[320px] h-[200px] text-left hover:border-lime hover:scale-[1.02] hover:shadow-xl cursor-pointer"
>
	<div class="flex gap-4 h-full">
		<!-- Left side: Poster and Date -->
		<div class="w-[100px] flex flex-col flex-shrink-0 gap-2">
			<div
				class="w-[100px] flex-1 rounded-xl {data.flyer_image_url
					? 'bg-gray-900'
					: `bg-gradient-to-br ${randomGradient}`} 
                   flex items-center justify-center relative overflow-hidden"
			>
				{#if data.flyer_image_url}
					<img
						src={data.flyer_image_url}
						alt={data.name || 'Event Flyer'}
						class="w-full h-full object-cover rounded-xl"
					/>
				{:else}
					<div class="text-white text-center p-2">
						<svg class="w-8 h-8 mx-auto mb-2 opacity-40" viewBox="0 0 24 24" fill="currentColor">
							<path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" fill="none" />
							<rect
								x="3"
								y="3"
								width="18"
								height="18"
								rx="2"
								stroke="currentColor"
								stroke-width="2"
								fill="none"
							/>
							<circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
						</svg>
						<div class="text-xs opacity-60 font-bold">Flyer</div>
					</div>
				{/if}
			</div>
			<div
				class="bg-gray2 text-black px-2 py-1 rounded-lg text-center font-bold text-xs flex-shrink-0"
			>
				{formatDate(data.date)}
			</div>
		</div>

		<!-- Right side: Details -->
		<div class="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
			<div class="flex-1 min-w-0 pr-2 overflow-hidden">
				{#if data.source}
					<div class="mb-2">
						<span
							class="px-2 py-1 rounded-2xl text-xs font-bold inline-block"
							style="background-color: {getSourceColor(data.source)}; color: #000000;"
						>
							{data.source}
						</span>
					</div>
				{/if}

				<h3
					class="text-white font-bold text-lg leading-tight line-clamp-2 transition-colors mb-1 group-hover:text-lime"
				>
					{data.artists[0]?.name || 'Artist Name TBD'}
				</h3>
				<p class="text-gray2 text-sm line-clamp-2">{data.name}</p>
			</div>

			<div class="mt-auto flex-shrink-0 min-h-[36px]">
				<p class="text-gray2 text-xs line-clamp-2">{locationString}</p>
			</div>
		</div>
	</div>
</button>
