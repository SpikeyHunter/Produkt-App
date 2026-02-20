<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent } from '$lib/types/calendar-types';

	export let event: CalendarEvent;
	export let groupEvents: CalendarEvent[];

	let showPopover = false;
	let popupRef: HTMLElement;

	$: activeHolds = groupEvents.filter(e => e.status !== 'HIDDEN').sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	$: holdCount = activeHolds.length;
	
	$: dateRangeText = (() => {
		if (holdCount === 0) return 'No dates';
		if (holdCount === 1) return new Date(activeHolds[0].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		
		const first = new Date(activeHolds[0].date + 'T00:00:00');
		const last = new Date(activeHolds[activeHolds.length - 1].date + 'T00:00:00');
		if (first.getMonth() === last.getMonth()) return `${first.toLocaleString('en-US', {month: 'short'})} ${first.getDate()} - ${last.getDate()}, ${first.getFullYear()}`;
		return `${first.toLocaleString('en-US', {month: 'short', day:'numeric'})} - ${last.toLocaleString('en-US', {month: 'short', day:'numeric', year:'numeric'})}`;
	})();

	const today = new Date();
	let viewMonth = new Date(event.date + 'T00:00:00');
	$: daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
	$: firstDayIndex = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
	
	async function toggleDate(dayNum: number) {
		const targetDate = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
		const existing = activeHolds.find(e => e.date === targetDate);
		
		if (existing) {
			if (existing.id === event.id) return; 
			await supabase.from('calendar_events').delete().eq('id', existing.id);
		} else {
			await supabase.from('calendar_events').insert({
				group_id: event.group_id,
				date: targetDate,
				status: event.status === 'CONFIRMED' ? 'CONFIRMED' : 'HOLD',
				hold_level: event.status === 'CONFIRMED' ? null : 'P',
				venue: event.venue,
				time: event.time
			});
		}
		invalidateAll();
	}

	function handleWindowClick(e: MouseEvent) {
		if (showPopover && popupRef && !popupRef.contains(e.target as Node)) {
			showPopover = false;
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="relative" bind:this={popupRef}>
	<button 
		class="flex items-center gap-2 px-3 py-1.5 bg-navbar border border-gray2/20 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
		on:click={() => showPopover = !showPopover}
	>
		<svg class="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
		<span class="text-xs font-black text-white">{holdCount} {event.status === 'CONFIRMED' ? 'Confirmed' : 'Holds'}</span>
		<span class="text-xs font-medium text-gray2">{dateRangeText}</span>
	</button>

	{#if showPopover}
		<div class="absolute left-0 top-[calc(100%+8px)] w-72 bg-navbar rounded-2xl shadow-2xl border border-gray2/20 p-4 z-50">
			<div class="flex justify-between items-center mb-4">
				<button aria-label="Previous month" class="p-1 hover:bg-white/5 rounded cursor-pointer" on:click={() => viewMonth = new Date(viewMonth.setMonth(viewMonth.getMonth() - 1))}><svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
				<span class="text-sm font-bold text-white">{viewMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</span>
				<button aria-label="Next month" class="p-1 hover:bg-white/5 rounded cursor-pointer" on:click={() => viewMonth = new Date(viewMonth.setMonth(viewMonth.getMonth() + 1))}><svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
			</div>
			
			<div class="grid grid-cols-7 gap-1 text-center mb-2">
				{#each ['Su','Mo','Tu','We','Th','Fr','Sa'] as d}
					<div class="text-[10px] font-bold text-gray2">{d}</div>
				{/each}
			</div>
			<div class="grid grid-cols-7 gap-1 text-center">
				{#each Array(firstDayIndex) as _}<div></div>{/each}
				
				{#each Array(daysInMonth) as _, i}
					{@const dayNum = i + 1}
					{@const targetDate = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`}
					{@const isSelected = activeHolds.some(e => e.date === targetDate)}
					{@const isCurrentEvent = event.date === targetDate}
					
					<button 
						class="w-8 h-8 mx-auto rounded-full flex flex-col items-center justify-center text-xs font-bold transition-all relative cursor-pointer {isSelected ? 'border-2 border-lime text-white' : 'text-gray2 hover:bg-white/5'} {isCurrentEvent ? 'bg-lime/10' : ''}"
						on:click={() => toggleDate(dayNum)}
					>
						{dayNum}
						{#if isSelected}
							<div class="w-1 h-1 rounded-full {event.status === 'CONFIRMED' ? 'bg-confirmed' : 'bg-lime'} absolute bottom-1"></div>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>