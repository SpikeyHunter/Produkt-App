<script lang="ts">
	import { formatLongDate } from '$lib/components/booking/talentpayments/paymentStatus';

	export let event: any | null = null;

	function isHeadliner(entry: any): boolean {
		return entry?.notes === 'Headliner';
	}
</script>

<div class="flex h-full flex-col overflow-hidden rounded-2xl border border-gray1 bg-navbar">
	{#if event}
		<div class="flex-shrink-0 border-b border-gray1 px-3 py-2.5">
			<div class="flex items-baseline gap-1.5 text-[12px] font-bold">
				<span class="whitespace-nowrap text-lime">{formatLongDate(event.event_date)}</span>
				<span class="text-gray2">•</span>
				<span class="truncate text-white">{event.event_venue || 'NCG'}</span>
			</div>
			<div class="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-gray2">
				<span class="opacity-60">Event ID:</span>
				<span class="text-white opacity-90">{event.event_id}</span>
			</div>
		</div>

		<div class="no-scrollbar flex-1 overflow-y-auto px-3 py-2.5">
			{#if event.timetable && event.timetable.length > 0}
				<h3 class="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray2 opacity-80">
					Set Times
				</h3>
				<div class="flex flex-col">
					{#each event.timetable as entry}
						{@const headliner = isHeadliner(entry)}
						<div class="flex items-baseline gap-3 py-[3px]">
							<span
								class="w-[62px] flex-shrink-0 text-right text-[11px] font-bold tabular-nums {headliner
									? 'text-lime'
									: 'text-gray2'}"
							>
								{entry.time}
							</span>
							<span
								class="min-w-0 flex-1 truncate text-[12px] {headliner
									? 'font-extrabold text-lime'
									: 'font-bold text-white'}"
							>
								{entry.artist}
							</span>
						</div>
					{/each}
				</div>
			{:else}
				<div class="mt-6 text-center text-[11px] italic text-gray2 opacity-50">
					<p>No set times published</p>
				</div>
			{/if}
		</div>
	{:else}
		<div class="flex h-full flex-col items-center justify-center gap-1.5 text-gray2 opacity-50">
			<svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<span class="text-[11px] font-bold">Select an event</span>
		</div>
	{/if}
</div>

<style>
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>