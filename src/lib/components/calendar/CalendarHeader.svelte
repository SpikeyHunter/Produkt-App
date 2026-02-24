<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';

	export let headerText: string;
	export let currentViewDate: Date;
	export let viewType: 'month' | 'week' | 'list';
	export let listLayoutMode: 'list' | 'grid' = 'list';
	export let listFilterMode: 'past' | 'all' | 'upcoming' = 'all';

	const dispatch = createEventDispatcher();

	let showDropdown = false;
	let dropdownRef: HTMLDivElement;

	const months = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	$: currentYear = currentViewDate.getFullYear();
	$: currentMonth = currentViewDate.getMonth();

	const realCurrentYear = new Date().getFullYear();
	const years = Array.from({ length: 11 }, (_, i) => realCurrentYear - 5 + i);

	// --- Mini Calendar for Week view ---
	$: miniCalDays = generateMiniCalendar(currentYear, currentMonth);

	function generateMiniCalendar(y: number, m: number) {
		const startDate = new Date(y, m, 1);
		startDate.setDate(startDate.getDate() - startDate.getDay());
		const days = [];

		let current = new Date(startDate);
		for (let i = 0; i < 42; i++) {
			days.push({
				date: new Date(current),
				dayNumber: current.getDate(),
				isCurrentMonth: current.getMonth() === m
			});
			current.setDate(current.getDate() + 1);
		}

		const weeks = [];
		for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
		return weeks;
	}

	function isCurrentWeek(weekDays: any[]) {
		const checkTime = currentViewDate.getTime();
		const start = weekDays[0].date.getTime();
		const end = weekDays[6].date.getTime();
		return checkTime >= start && checkTime <= end;
	}

	function handleWeekSelect(weekDays: any[]) {
		dispatch('jumpToDate', new Date(weekDays[0].date));
	}
	// -----------------------------------

	function handleMonthSelect(monthIndex: number) {
		const newDate = new Date(currentViewDate);
		newDate.setMonth(monthIndex);
		dispatch('jumpToDate', newDate);
	}

	function handleYearSelect(year: number) {
		const newDate = new Date(currentViewDate);
		newDate.setFullYear(year);
		dispatch('jumpToDate', newDate);
	}

	function handleWindowClick(e: MouseEvent) {
		if (showDropdown && dropdownRef && !dropdownRef.contains(e.target as Node)) {
			showDropdown = false;
		}
	}

	function cycleListFilter() {
		if (listFilterMode === 'past') {
			listFilterMode = 'all';
		} else if (listFilterMode === 'all') {
			listFilterMode = 'upcoming';
		} else {
			listFilterMode = 'past';
		}
	}

	function handleTodayClick() {
		if (viewType === 'list') {
			listFilterMode = 'all';
		}
		dispatch('today');
	}

	function cycleBackward() {
		if (listFilterMode === 'upcoming') {
			listFilterMode = 'all';
		} else if (listFilterMode === 'all') {
			listFilterMode = 'past';
		} else {
			listFilterMode = 'upcoming';
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div
	class="flex items-center justify-between p-4 border-b border-[var(--color-border)]/10 shrink-0"
>
	<div class="flex items-center gap-3">
		<button
			class="px-6 py-2.5 text-sm text-[var(--color-gray2)] border border-[var(--color-border)]/30 rounded-3xl font-bold transition-all hover:bg-[var(--color-white)] hover:text-[var(--color-black)] cursor-pointer"
			on:click={handleTodayClick}>Today</button
		>

		{#if viewType === 'list'}
			<div
				class="flex items-center gap-1 bg-[var(--color-gray1)] rounded-3xl border border-[var(--color-border)]/10"
			>
				<button
					class="px-6 py-2.5 rounded-3xl text-sm font-bold transition-all cursor-pointer {listLayoutMode ===
					'list'
						? 'bg-[var(--color-lime)] text-[var(--color-black)]'
						: 'text-[var(--color-gray2)] hover:text-[var(--color-white)]'}"
					on:click={() => (listLayoutMode = 'list')}>List</button
				>
				<button
					class="px-6 py-2.5 rounded-3xl text-sm font-bold transition-all cursor-pointer {listLayoutMode ===
					'grid'
						? 'bg-[var(--color-lime)] text-[var(--color-black)]'
						: 'text-[var(--color-gray2)] hover:text-[var(--color-white)]'}"
					on:click={() => (listLayoutMode = 'grid')}>Grid</button
				>
			</div>
		{/if}
	</div>

	<div class="flex items-center gap-4">
		{#if viewType !== 'list'}
			<button
				class="p-2 text-[var(--color-gray2)] hover:text-[var(--color-white)] transition-all cursor-pointer rounded-full hover:bg-[var(--color-gray1)]"
				on:click={() => dispatch('previous')}
				aria-label="Previous"
			>
				<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><polyline points="15 18 9 12 15 6"></polyline></svg
				>
			</button>
		{/if}

		<div class="relative flex items-center justify-center min-w-[260px]" bind:this={dropdownRef}>
			{#if viewType === 'list'}
				<div
					class="flex items-center justify-center gap-2 text-2xl font-bold select-none text-[var(--color-white)]"
				>
					<button
						class="text-[var(--color-gray2)] hover:text-[var(--color-lime)] transition-all cursor-pointer p-2 flex items-center justify-center rounded-full hover:bg-[var(--color-gray1)]"
						on:click={cycleBackward}
						aria-label="Previous Filter"
					>
						<svg
							class="w-6 h-6"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"><polyline points="15 18 9 12 15 6"></polyline></svg
						>
					</button>

					<button
						class="w-[210px] text-center transition-colors hover:text-[var(--color-lime)] cursor-pointer"
						on:click={cycleListFilter}
					>
						{#if listFilterMode === 'past'}
							Past Events
						{:else if listFilterMode === 'all'}
							All Events
						{:else}
							Upcoming Events
						{/if}
					</button>

					<button
						class="text-[var(--color-gray2)] hover:text-[var(--color-lime)] transition-all cursor-pointer p-2 flex items-center justify-center rounded-full hover:bg-[var(--color-gray1)]"
						on:click={cycleListFilter}
						aria-label="Next Filter"
					>
						<svg
							class="w-6 h-6"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"><polyline points="9 18 15 12 9 6"></polyline></svg
						>
					</button>
				</div>
			{:else}
				<button
					class="text-2xl font-bold transition-colors flex items-center gap-2 cursor-pointer text-[var(--color-white)] hover:text-[var(--color-lime)]"
					on:click={() => (showDropdown = !showDropdown)}
				>
					{headerText}
					<svg
						class="w-5 h-5 transition-transform duration-200 {showDropdown
							? 'rotate-180 text-[var(--color-lime)]'
							: ''}"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="3"><polyline points="6 9 12 15 18 9"></polyline></svg
					>
				</button>

				{#if showDropdown}
					<div
						class="absolute top-full mt-3 {viewType === 'week'
							? 'w-[520px]'
							: 'w-[420px]'} bg-[var(--color-navbar)] border border-[var(--color-border)]/20 rounded-2xl shadow-2xl z-50 p-4 flex flex-col gap-4 cursor-default"
						transition:fly={{ y: -15, duration: 200 }}
					>
						<div class="flex gap-4">
							{#if viewType === 'week'}
								<div class="w-48 flex flex-col pr-4 border-r border-[var(--color-border)]/10">
									<div
										class="text-[10px] font-bold text-white uppercase mb-4 text-center tracking-widest"
									>
										Select Week
									</div>
									<div
										class="grid grid-cols-7 text-center text-[10px] text-[var(--color-gray2)] mb-2 font-bold"
									>
										<span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span
											>F</span
										><span>S</span>
									</div>
									<div class="flex flex-col gap-1">
										{#each miniCalDays as week}
											<button
												type="button"
												class="grid grid-cols-7 text-center text-xs py-1 rounded-md font-bold cursor-pointer transition-colors {isCurrentWeek(
													week
												)
													? 'bg-[var(--color-lime)] text-black'
													: 'hover:bg-white/10 text-[var(--color-gray2)]'}"
												on:click={() => handleWeekSelect(week)}
											>
												{#each week as day}
													<span
														class={!day.isCurrentMonth && !isCurrentWeek(week) ? 'opacity-30' : ''}
														>{day.dayNumber}</span
													>
												{/each}
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<div
								class="flex-1 flex flex-col {viewType === 'week'
									? 'pr-4 border-r border-[var(--color-border)]/10'
									: ''}"
							>
								<div class="grid grid-cols-2 gap-y-2 gap-x-4">
									{#each months as month, idx}
										<button
											type="button"
											class="px-2 py-2 text-sm rounded-xl text-center transition-all cursor-pointer {currentMonth ===
											idx
												? 'bg-[var(--color-lime)] text-[var(--color-black)] font-black'
												: 'text-[var(--color-gray2)] hover:bg-[var(--color-gray1)] hover:text-[var(--color-white)] font-bold'}"
											on:click={() => handleMonthSelect(idx)}
										>
											{month}
										</button>
									{/each}
								</div>
							</div>

							<div
								class="w-20 flex flex-col gap-1 overflow-y-auto max-h-[260px] custom-scrollbar pr-2 pb-2"
							>
								{#each years as year}
									<button
										type="button"
										class="px-1 py-2 text-sm rounded-xl text-center transition-all cursor-pointer {currentYear ===
										year
											? 'bg-[var(--color-lime)] text-[var(--color-black)] font-black'
											: 'text-[var(--color-gray2)] hover:bg-[var(--color-gray1)] hover:text-[var(--color-white)] font-bold'}"
										on:click={() => handleYearSelect(year)}
									>
										{year}
									</button>
								{/each}
							</div>
						</div>

						<div class="h-px w-full bg-[var(--color-border)]/10 rounded-full"></div>

						<button
							class="w-full py-2.5 text-sm rounded-3xl text-center transition-all cursor-pointer bg-[var(--color-gray1)] text-[var(--color-white)] hover:text-[var(--color-lime)] font-bold"
							on:click={() => {
								dispatch('today');
								showDropdown = false;
							}}
						>
							Go to Today
						</button>
					</div>
				{/if}
			{/if}
		</div>

		{#if viewType !== 'list'}
			<button
				class="p-2 text-[var(--color-gray2)] hover:text-[var(--color-white)] transition-all cursor-pointer rounded-full hover:bg-[var(--color-gray1)]"
				on:click={() => dispatch('next')}
				aria-label="Next"
			>
				<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><polyline points="9 18 15 12 9 6"></polyline></svg
				>
			</button>
		{/if}
	</div>

	<div class="flex items-center gap-3">
		<button
			class="px-6 py-2.5 bg-[var(--color-lime)] text-[var(--color-black)] rounded-3xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-sm cursor-pointer"
			on:click={() => dispatch('addEvent')}
		>
			<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
				><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"
				></line></svg
			>
			Add Event
		</button>
	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(189, 189, 187, 0.15);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--color-lime);
	}
</style>
