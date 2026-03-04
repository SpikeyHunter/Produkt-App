<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent } from '$lib/types/calendar-types';

	export let event: CalendarEvent;

	let showPopover = false;
	let popupRef: HTMLElement;

	let draftStart = '';
	let draftEnd = '';
	let isAllDay = false;

	// Formats "14:30" into "2:30PM" or "14:00" into "2PM"
	function format12Hour(time24: string | null | undefined): string {
		if (!time24) return '';
		const [h, m] = time24.split(':');
		let hours = parseInt(h, 10);
		const minutes = parseInt(m, 10);
		
		const ampm = hours >= 12 ? 'PM' : 'AM';
		hours = hours % 12 || 12; // 0 becomes 12, 12 stays 12
		const minStr = minutes > 0 ? `:${m}` : '';
		
		return `${hours}${minStr}${ampm}`;
	}

	$: displayText = (() => {
		const s = event.time?.start;
		const e = event.time?.end;
		
		// If the DB has our all-day values, show "All Day"
		if (s === '00:00' && e === '23:59') return 'All Day';
		
		if (s && e) return `From: ${format12Hour(s)} - To: ${format12Hour(e)}`;
		if (s) return `From: ${format12Hour(s)}`;
		if (e) return `To: ${format12Hour(e)}`;
		return 'Set Time';
	})();

	$: isValid = draftStart && draftEnd;

	function openPopover() {
		draftStart = event.time?.start || '';
		draftEnd = event.time?.end || '';
		isAllDay = draftStart === '00:00' && draftEnd === '23:59';
		showPopover = true;
	}

	function closePopover() {
		showPopover = false;
	}

	async function saveTime() {
		// Prevent saving if not all day and missing times
		if (!isAllDay && !isValid) return;

		const newTime = isAllDay 
			? { start: '00:00', end: '23:59' } 
			: { start: draftStart || null, end: draftEnd || null };

		const { error } = await supabase
			.from('calendar_events')
			.update({ time: newTime })
			.eq('id', event.id);

		if (!error) {
			invalidateAll();
		} else {
			console.error('Failed to update time:', error);
		}
		
		closePopover();
	}

	async function clearTime() {
		const { error } = await supabase
			.from('calendar_events')
			.update({ time: { start: null, end: null } })
			.eq('id', event.id);

		if (!error) {
			invalidateAll();
		} else {
			console.error('Failed to clear time:', error);
		}
		
		closePopover();
	}

	function handleWindowClick(e: MouseEvent) {
		if (showPopover && popupRef && !popupRef.contains(e.target as Node)) {
			closePopover();
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="relative" bind:this={popupRef}>
	<button 
		class="flex items-center gap-2 px-3.5 py-2.5 bg-navbar rounded-3xl hover:bg-white/5 transition-colors shadow-sm cursor-pointer" 
		on:click={() => showPopover ? closePopover() : openPopover()}
	>
		<svg class="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="12" cy="12" r="10"></circle>
			<polyline points="12 6 12 12 16 14"></polyline>
		</svg>
		<span class="text-xs font-black text-white">{displayText}</span>
	</button>

	{#if showPopover}
		<div class="absolute left-0 top-[calc(100%+8px)] w-[320px] bg-navbar rounded-3xl shadow-2xl border border-gray2/20 p-5 z-50">
			
			<div class="flex justify-between items-center mb-4">
				<h4 class="text-sm font-bold text-white">Set Event Time</h4>
				<button 
					class="text-[10px] font-bold text-problem hover:text-problem/80 hover:underline uppercase tracking-wider cursor-pointer transition-colors"
					on:click={clearTime}
				>
					Clear
				</button>
			</div>
			
			<label class="flex items-center gap-3 w-full py-2 px-3 mb-4 rounded-xl transition-colors border {isAllDay ? 'bg-white/5 border-white/10' : 'border-transparent hover:bg-white/5'} cursor-pointer">
				<input type="checkbox" class="hidden" bind:checked={isAllDay} />
				<div class="flex items-center justify-center w-4 h-4 rounded border {isAllDay ? 'bg-lime border-lime' : 'border-gray2/40 bg-transparent'} transition-colors shrink-0">
					{#if isAllDay}
						<svg class="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
					{/if}
				</div>
				<span class="text-xs font-bold {isAllDay ? 'text-white' : 'text-gray2'} transition-colors">All Day</span>
			</label>
			
			<div class="flex items-center gap-3 mb-6">
				<div class="flex-1 flex flex-col gap-1.5">
					<label class="text-[10px] font-bold text-gray2 uppercase tracking-wider" for="start-time">From</label>
					{#if isAllDay}
						<input 
							type="text" 
							disabled 
							value="00:00 AM" 
							class="bg-gray1 border border-gray2/10 rounded-xl px-3 py-2 text-gray2/50 text-sm font-medium outline-none w-full opacity-60 cursor-not-allowed" 
						/>
					{:else}
						<input 
							id="start-time" 
							type="time" 
							bind:value={draftStart} 
							class="bg-gray1 border border-gray2/20 rounded-xl px-3 py-2 text-white text-sm font-medium focus:border-lime transition-colors outline-none w-full [color-scheme:dark]" 
						/>
					{/if}
				</div>
				
				<div class="flex-1 flex flex-col gap-1.5">
					<label class="text-[10px] font-bold text-gray2 uppercase tracking-wider" for="end-time">To</label>
					{#if isAllDay}
						<input 
							type="text" 
							disabled 
							value="00:00 PM" 
							class="bg-gray1 border border-gray2/10 rounded-xl px-3 py-2 text-gray2/50 text-sm font-medium outline-none w-full opacity-60 cursor-not-allowed" 
						/>
					{:else}
						<input 
							id="end-time" 
							type="time" 
							bind:value={draftEnd} 
							class="bg-gray1 border border-gray2/20 rounded-xl px-3 py-2 text-white text-sm font-medium focus:border-lime transition-colors outline-none w-full [color-scheme:dark]" 
						/>
					{/if}
				</div>
			</div>

			<div class="flex gap-3 border-t border-gray2/10 pt-4">
				<button 
					class="flex-1 py-2 rounded-xl bg-transparent border border-gray2/20 text-gray2 hover:text-white hover:bg-white/5 text-sm font-bold transition-colors cursor-pointer" 
					on:click={closePopover}
				>
					Cancel
				</button>
				<button 
					class="flex-1 py-2 rounded-xl text-sm font-bold transition-colors {isAllDay || isValid ? 'bg-lime text-black hover:bg-lime/90 cursor-pointer' : 'bg-gray2/10 text-gray2/50 cursor-not-allowed'}" 
					on:click={saveTime}
					disabled={!isAllDay && !isValid}
				>
					Save
				</button>
			</div>
		</div>
	{/if}
</div>