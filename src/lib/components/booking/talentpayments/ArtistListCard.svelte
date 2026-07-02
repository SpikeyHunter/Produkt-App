<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	export let artist: any;
	export let selected = false;
	export let showEventName = false;

	const dispatch = createEventDispatcher();

	// NEW COLOR MAPPING FROM APP.CSS
	function getStatusColor(status: string) {
		if (!status) return 'text-gray2 bg-gray1';
		switch (status.toLowerCase()) {
			case 'draft':
				return 'text-gray2 bg-gray1 border border-gray2/30';
			case 'confirmed':
				return 'text-tentatif bg-tentatif/10 border border-tentatif/30';
			case 'invoiced':
				return 'text-proposed bg-proposed/10 border border-proposed/30';
			case 'approved':
				return 'text-question bg-question/10 border border-question/30';
			case 'submitted':
				return 'text-info bg-info/10 border border-info/30';
			case 'paid':
				return 'text-confirmed bg-confirmed/10 border border-confirmed/30';
			default:
				return 'text-gray2 bg-gray1 border border-gray2/30';
		}
	}

	const formatter = new Intl.NumberFormat('en-CA', {
		style: 'currency',
		currency: 'CAD',
		maximumFractionDigits: 0
	});

	// Helper to format date like "Feb 13th 2025"
	// Helper to format date matching EventSelectorPayment
	function getFormattedDate(dateStr: string) {
		if (!dateStr) return '';

		// Using local timezone trick to prevent off-by-one-day errors
		const cleanDateStr = dateStr.split('T')[0].replace(/-/g, '/');
		const date = new Date(cleanDateStr);

		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<button
	class="artist-card relative w-full min-w-0 min-h-0 hover:cursor-pointer rounded-2xl overflow-hidden border transition-all duration-200 group flex flex-col text-left
    {selected
		? 'border-lime shadow-[0_0_0_2px_rgba(132,204,22,1)]'
		: 'border-gray1 hover:border-gray2 hover:shadow-lg'}"
	on:click={() => dispatch('click', artist)}
>
	<div class="absolute inset-0 bg-gray1 z-0">
		{#if artist.event_flyer}
			<img
				src={artist.event_flyer}
				alt=""
				loading="lazy"
				decoding="async"
				class="w-full h-full object-cover opacity-30 group-hover:opacity-20 transition-opacity"
			/>
			<div class="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30"></div>
		{:else}
			<div class="w-full h-full bg-gray1/50 flex items-center justify-center">
				<span class="text-gray2 font-bold text-xs opacity-20">NO IMAGE</span>
			</div>
			<div class="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
		{/if}
	</div>

	<div class="relative z-10 flex flex-col h-full p-4 justify-between">
		<div class="space-y-1.5">
			<h3
				class="font-bold text-white text-lg leading-tight drop-shadow-md group-hover:text-lime transition-colors"
			>
				{artist.artist_name}
			</h3>

			{#if artist.eventDateDisplay}
				<div class="text-[12px] text-gray3 font-bold uppercase tracking-wide flex flex-col gap-0.5">
					<span class="text-lime">
						{getFormattedDate(artist.eventDateDisplay)}
					</span>
					{#if showEventName && artist.eventNameDisplay}
						<span class="text-white text-left text-[11px] normal-case font-medium"
							>{artist.eventNameDisplay}</span
						>
					{/if}

					<div
						class="mt-1.5 flex items-center gap-1 text-[10px] text-gray2 normal-case font-medium tracking-normal"
					>
						<span>Delivery:</span>
						<span class="text-white font-bold"
							>{artist.paymentData?.delivery_method || 'Pick Up'}</span
						>
					</div>
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-3">
			<div class="flex items-center justify-between">
				<span
					class="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold {getStatusColor(
						artist.paymentData?.status || 'Draft'
					)}"
				>
					{artist.paymentData?.status || 'Draft'}
				</span>

				<span class="text-lg font-bold text-lime drop-shadow-sm">
					{formatter.format(artist.paymentData?.amount ?? 150)}
				</span>
			</div>

			<div class="pt-2 border-t border-white/10">
				{#if artist.paymentData?.approved_by}
					<div class="flex items-center gap-1.5 text-[11px] text-lime font-bold tracking-wide">
						Approved by {artist.paymentData.approved_by}
					</div>
				{:else}
					<div
						class="flex items-center gap-1.5 text-[11px] text-gray3 font-bold tracking-wide opacity-70"
					>
						Not Approved
					</div>
				{/if}
			</div>
		</div>
	</div>
</button>

<style>
	/* Explicit aspect-ratio defined in CSS (not as a Tailwind arbitrary class) so it
	   is guaranteed to be present in the stylesheet from the very first paint and
	   can never be skipped/late due to JIT/purge timing. This, combined with
	   min-width: 0 / min-height: 0 above, stops the grid item from ever sizing
	   itself off the <img>'s natural (intrinsic) pixel dimensions before layout
	   settles - which is what causes a card to "zoom" to near full size on a
	   first/cold render and only look right after a refresh. */
	.artist-card {
		aspect-ratio: 3 / 4;
	}
</style>