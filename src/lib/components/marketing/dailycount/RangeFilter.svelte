<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	export let startDate = '';
	export let endDate = '';
	export let minDateStr = '';
	export let maxDateStr = '';
	export let placeholder = 'Select a range';
	
	const dispatch = createEventDispatcher();

	let showDatePicker = false;
	let currentCalendarDate = new Date();
	let containerElement: HTMLDivElement;

	let tempStartDate = '';
	let tempEndDate = '';

	$: monthYearDisplay = currentCalendarDate.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long'
	});

	function handleClickOutside(event: MouseEvent) {
		if (event.target && (event.target as Element).closest) {
			if (!(event.target as Element).closest('.range-filter-container')) {
				cancel();
			}
		}
	}

	function formatDisplayDate(dateString: string): string {
		if (!dateString) return '';
		try {
			const date = new Date(dateString + 'T00:00:00');
			if (isNaN(date.getTime())) return '';
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		} catch (error) {
			return '';
		}
	}

	function formatDateForInput(date: Date): string {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function isDateDisabled(date: Date) {
		if (!minDateStr || !maxDateStr) return true;
		const dateStr = formatDateForInput(date);
		return dateStr < minDateStr || dateStr > maxDateStr;
	}

	function openPicker() {
		tempStartDate = startDate;
		tempEndDate = endDate;
		showDatePicker = true;

		// Default calendar view to the start date, or min available date
		if (tempStartDate) {
			currentCalendarDate = new Date(tempStartDate + 'T00:00:00');
		} else if (minDateStr) {
			currentCalendarDate = new Date(minDateStr + 'T00:00:00');
		}
	}

	function cancel() {
		showDatePicker = false;
	}

	function confirm() {
		startDate = tempStartDate;
		endDate = tempEndDate;
		dispatch('change', { startDate, endDate });
		showDatePicker = false;
	}

	function clearFilter() {
		startDate = '';
		endDate = '';
		tempStartDate = '';
		tempEndDate = '';
		dispatch('change', { startDate: '', endDate: '' });
		showDatePicker = false;
	}

	function selectDate(date: Date) {
		if (isDateDisabled(date)) return;
		
		const dateStr = formatDateForInput(date);
		
		if (!tempStartDate || (tempStartDate && tempEndDate)) {
			// Start a new selection range
			tempStartDate = dateStr;
			tempEndDate = '';
		} else {
			// Cannot select 1 day only, must be different days
			if (dateStr === tempStartDate) {
				return; 
			} else if (dateStr < tempStartDate) {
				tempStartDate = dateStr;
			} else {
				tempEndDate = dateStr;
			}
		}
	}

	function changeMonth(amount: number) {
		currentCalendarDate = new Date(
			currentCalendarDate.getFullYear(),
			currentCalendarDate.getMonth() + amount,
			1
		);
	}

	$: calendarDays = (() => {
		const year = currentCalendarDate.getFullYear();
		const month = currentCalendarDate.getMonth();
		const firstDayOfMonth = new Date(year, month, 1);
		const lastDayOfMonth = new Date(year, month + 1, 0);
		const startDayOfWeek = firstDayOfMonth.getDay();

		const days = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		for (let i = 0; i < startDayOfWeek; i++) {
			const date = new Date(year, month, i - startDayOfWeek + 1);
			days.push({ day: date.getDate(), date: date, isCurrentMonth: false, isToday: false });
		}

		for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
			const date = new Date(year, month, i);
			date.setHours(0, 0, 0, 0);
			days.push({
				day: i,
				date: date,
				isCurrentMonth: true,
				isToday: date.getTime() === today.getTime()
			});
		}

		const remainingCells = 42 - days.length;
		for (let i = 1; i <= remainingCells; i++) {
			const date = new Date(year, month + 1, i);
			days.push({ day: date.getDate(), date: date, isCurrentMonth: false, isToday: false });
		}
		return days;
	})();

	function getDayClasses(day: any, start: string, end: string) {
		if (!day.isCurrentMonth) return 'text-gray2 opacity-30 cursor-not-allowed';
		if (isDateDisabled(day.date)) return 'text-gray2 opacity-20 cursor-not-allowed';

		const dateStr = formatDateForInput(day.date);
		const isStart = dateStr === start;
		const isEnd = dateStr === end;
		const inRange = start && end && dateStr > start && dateStr < end;

		if (isStart || isEnd) return 'bg-lime text-black font-bold border-lime shadow-sm';
		if (inRange) return 'bg-lime/20 text-lime font-medium rounded-3xl scale-95';
		if (day.isToday) return 'bg-gray1 text-lime border border-lime';
		
		return 'text-white hover:bg-gray2/20';
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="relative range-filter-container w-full" bind:this={containerElement}>
	<div
		class="w-full bg-gray1 border border-gray2/20 rounded-xl px-4 py-3 text-white outline-none focus-within:border-lime transition-all cursor-pointer flex items-center justify-between"
		on:click={() => (showDatePicker ? cancel() : openPicker())}
		role="button"
		tabindex="0"
		on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showDatePicker ? cancel() : openPicker())}
	>
		<div class="flex items-center gap-2 text-sm pointer-events-none">
			{#if !startDate || !endDate}
				<span class="text-gray2 font-bold">{placeholder}</span>
			{:else}
				<span class="text-white font-bold text-xs">{formatDisplayDate(startDate)}</span>
				<span class="text-gray2 text-xs font-bold">—</span>
				<span class="text-white font-bold text-xs">{formatDisplayDate(endDate)}</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if startDate && endDate}
				<button
					type="button"
					aria-label="Clear date filter"
					class="text-gray2 hover:text-red-400 transition-colors bg-transparent border-none cursor-pointer outline-none p-1 flex items-center justify-center shrink-0"
					on:click|stopPropagation={clearFilter}
				>
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
				</button>
			{:else}
				<svg class="w-4 h-4 text-gray2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
					<line x1="16" y1="2" x2="16" y2="6" />
					<line x1="8" y1="2" x2="8" y2="6" />
					<line x1="3" y1="10" x2="21" y2="10" />
				</svg>
			{/if}
		</div>
	</div>

	{#if showDatePicker}
		<div
			transition:fly={{ y: -10, duration: 200 }}
			class="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-navbar border border-gray2/20 rounded-3xl shadow-2xl z-[9999] p-4 w-72 origin-top"
		>
			<div class="flex items-center justify-between mb-4">
				<button type="button" aria-label="Previous month" on:click|stopPropagation={() => changeMonth(-1)} class="h-8 w-8 flex items-center justify-center text-gray2 hover:text-white hover:bg-black/30 rounded-full cursor-pointer">
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" /></svg>
				</button>
				<div class="text-sm text-white font-bold text-center tracking-wide">
					{monthYearDisplay}
				</div>
				<button type="button" aria-label="Next month" on:click|stopPropagation={() => changeMonth(1)} class="h-8 w-8 flex items-center justify-center text-gray2 hover:text-white hover:bg-black/30 rounded-full cursor-pointer">
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" /></svg>
				</button>
			</div>

			<div class="grid grid-cols-7 gap-y-2 gap-x-1 mb-2">
				{#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as day}
					<div class="text-center text-[10px] text-gray2 font-bold uppercase tracking-wider">{day}</div>
				{/each}
			</div>

			<div class="grid grid-cols-7 gap-y-1 gap-x-0">
				{#each calendarDays as day}
					<div class="relative flex items-center justify-center h-9">
						<button
							type="button"
							class="w-full h-full text-xs transition-all cursor-pointer rounded-3xl flex items-center justify-center {getDayClasses(day, tempStartDate, tempEndDate)}"
							on:click|stopPropagation={() => day.isCurrentMonth && selectDate(day.date)}
							disabled={!day.isCurrentMonth || isDateDisabled(day.date)}
						>
							{day.day}
						</button>
					</div>
				{/each}
			</div>

			<div class="mt-4 flex gap-2 justify-end border-t border-gray2/10 pt-4">
				<button type="button" class="px-4 py-2 text-xs font-bold text-gray2 hover:text-white transition-colors cursor-pointer" on:click={cancel}>Cancel</button>
				<button type="button" class="px-4 py-2 text-xs font-bold bg-lime text-black rounded-full hover:bg-lime/90 transition-colors cursor-pointer" on:click={confirm}>Confirm</button>
			</div>
		</div>
	{/if}
</div>