<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { CompareEventData } from '$lib/types/compare';
	import DatePickerCompact from '$lib/components/buttons/DatePickerCompact.svelte';

	export let events: CompareEventData[] = [];
	export let currentFilter: 'LIVE' | 'PAST' = 'LIVE';
	export let searchQuery: string = '';
	export let formatEventDate: (dateString: string) => string;

	// Reference Date State
	export let referenceDateValue: string = ''; 
	export let useCustomDate: boolean = false;

	const dispatch = createEventDispatcher();
	
	let displayedEvents: CompareEventData[] = [];
	let suggestions: CompareEventData[] = [];
	let isFuzzySearch = false;

	const excludeKeywords = [
		'test', 'réservations', 'pass', 'event', 'template', 
		'produktworld', 'piknic', 'oktoberfest'
	];

	const MONTH_NAMES = [
		'january', 'february', 'march', 'april', 'may', 'june', 
		'july', 'august', 'september', 'october', 'november', 'december'
	];

	// --- HELPERS ---

	/**
	 * Robust Date Parsing Logic
	 * Handles: "31 Dec", "Dec 31", "31Dec", "31 decem", "2025-12-31"
	 */
	function parseSearchQuery(query: string) {
		const q = query.toLowerCase();
		
		// 1. Regex Match: Separates numbers (\d+) from letters ([a-z]+)
		// This handles "31Dec" (splits into 31, Dec) and "Dec 31" (splits into Dec, 31)
		const tokens = q.match(/[a-z]+|\d+/g) || [];

		let textMonth: number | null = null;
		let year: number | null = null;
		const numbers: number[] = [];

		tokens.forEach(token => {
			if (/^\d+$/.test(token)) {
				const num = parseInt(token);
				if (num > 1900 && num < 2100) year = num;
				else numbers.push(num);
			} else {
				// Text Month Matching (Partial "startsWith")
				// "decem" matches "december" (index 11 -> month 12)
				// Min length 3 to avoid false positives with short noise
				if (token.length >= 3) {
					const idx = MONTH_NAMES.findIndex(m => m.startsWith(token));
					if (idx !== -1) textMonth = idx + 1;
				}
			}
		});

		// Determine Day/Month from remaining numbers
		let day: number | null = null;
		let numericMonth: number | null = null;
		let ambiguousNumbers: number[] | null = null;

		if (textMonth) {
			// If we have "December", the other small number is likely the day
			if (numbers.length > 0) day = numbers[0];
		} else {
			// No text month, rely on number logic
			if (numbers.length === 2) {
				const [n1, n2] = numbers;
				// 31 12 -> Day 31, Month 12
				if (n1 > 12) { day = n1; numericMonth = n2; }
				// 12 31 -> Month 12, Day 31
				else if (n2 > 12) { numericMonth = n1; day = n2; }
				// 5 10 -> Ambiguous (May 10 OR Oct 5)
				else { ambiguousNumbers = [n1, n2]; }
			} else if (numbers.length === 1) {
				// "25" -> Likely searching for Day 25
				day = numbers[0];
			}
		}

		return { year, textMonth, numericMonth, day, ambiguousNumbers };
	}

	// Levenshtein Similarity
	function getSimilarity(s1: string, s2: string): number {
		let longer = s1, shorter = s2;
		if (s1.length < s2.length) { longer = s2; shorter = s1; }
		const longerLength = longer.length;
		if (longerLength === 0) return 1.0;
		return (longerLength - editDistance(longer, shorter)) / longerLength;
	}
	function editDistance(s1: string, s2: string): number {
		s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
		const costs = new Array();
		for (let i = 0; i <= s1.length; i++) {
			let lastValue = i;
			for (let j = 0; j <= s2.length; j++) {
				if (i == 0) costs[j] = j;
				else if (j > 0) {
					let newValue = costs[j - 1];
					if (s1.charAt(i - 1) != s2.charAt(j - 1))
						newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
					costs[j - 1] = lastValue;
					lastValue = newValue;
				}
			}
			if (i > 0) costs[s2.length] = lastValue;
		}
		return costs[s2.length];
	}

	// --- REACTIVE LOGIC ---

	$: {
		// A. Base Filter
		let baseList = events.filter(e => {
			if (e.status !== currentFilter) return false;
			const nameLower = (e.name || '').toLowerCase();
			return !excludeKeywords.some(k => nameLower.includes(k));
		});

		const rawQuery = searchQuery.trim();
		const queryLower = rawQuery.toLowerCase();
		let strictMatches = [];

		if (!rawQuery) {
			strictMatches = baseList;
		} else {
			// Parse Query
			const qDate = parseSearchQuery(rawQuery);

			strictMatches = baseList.filter(e => {
				// 1. Text Search (Name / ID)
				const nameLower = (e.name || '').toLowerCase();
				const idStr = e.event_id.toString();
				if (nameLower.includes(queryLower) || idStr.includes(queryLower)) return true;

				// 2. Date Search
				// Check if we have ANY date components to match against
				if (qDate.year || qDate.textMonth || qDate.numericMonth || qDate.day || qDate.ambiguousNumbers) {
					const [eYStr, eMStr, eDStr] = e.event_date.split('-');
					const eYear = parseInt(eYStr);
					const eMonth = parseInt(eMStr);
					const eDay = parseInt(eDStr);

					// Strict checks
					if (qDate.year && qDate.year !== eYear) return false;
					
					// Text Month Match (e.g. "Dec")
					if (qDate.textMonth && qDate.textMonth !== eMonth) return false;

					// Numeric Month Match (e.g. "12" in "12/31")
					if (qDate.numericMonth && qDate.numericMonth !== eMonth) return false;

					// Day Match (e.g. "31")
					if (qDate.day && qDate.day !== eDay) return false;

					// Ambiguous Swap (e.g. "5 10")
					if (qDate.ambiguousNumbers) {
						const [n1, n2] = qDate.ambiguousNumbers;
						// Match if (Month=n1 AND Day=n2) OR (Month=n2 AND Day=n1)
						const match1 = (eMonth === n1 && eDay === n2);
						const match2 = (eMonth === n2 && eDay === n1);
						if (!match1 && !match2) return false;
					}

					return true;
				}
				return false;
			});
		}

		// Sort
		strictMatches.sort((a, b) => {
			const dateA = new Date(a.event_date).getTime();
			const dateB = new Date(b.event_date).getTime();
			return currentFilter === 'LIVE' ? dateA - dateB : dateB - dateA;
		});

		// Fuzzy / Suggestions
		suggestions = [];
		isFuzzySearch = false;

		if (rawQuery && strictMatches.length === 0) {
			isFuzzySearch = true;
			const scored = baseList.map(e => {
				const nameScore = getSimilarity(e.name, rawQuery);
				// Score against formatted date string for visual similarity
				const dateStr = formatEventDate(e.event_date); 
				const dateScore = getSimilarity(dateStr, rawQuery);
				
				return { event: e, score: Math.max(nameScore, dateScore) };
			});

			suggestions = scored
				.filter(item => item.score > 0.4)
				.sort((a, b) => b.score - a.score)
				.map(item => item.event)
				.slice(0, 5);
		}

		displayedEvents = strictMatches;
	}

	function handleDragStart(e: DragEvent, event: CompareEventData): void {
		if (e.dataTransfer) {
			e.dataTransfer.setData('application/json', JSON.stringify(event));
			e.dataTransfer.effectAllowed = 'copy';
		}
		if (e.target instanceof HTMLElement) {
			e.target.classList.add('opacity-50');
		}
	}

	function handleDragEnd(e: DragEvent): void {
		if (e.target instanceof HTMLElement) {
			e.target.classList.remove('opacity-50');
		}
	}

	function handleDateModeChange(custom: boolean) {
		useCustomDate = custom;
		dispatch('dateModeChange', { useCustomDate: custom });
		if (!custom) {
			const today = new Date();
			const offset = today.getTimezoneOffset(); 
			const localDate = new Date(today.getTime() - (offset*60*1000));
			referenceDateValue = localDate.toISOString().split('T')[0];
			dispatch('dateChange', referenceDateValue);
		}
	}

	function handleCustomDateChange(e: CustomEvent) {
		referenceDateValue = e.detail;
		dispatch('dateChange', referenceDateValue);
	}
	
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { }
	}
</script>

<aside class="w-[340px] bg-navbar rounded-3xl p-5 flex flex-col h-[810px] shadow-lg border border-gray1">
	
	<div class="flex items-center justify-between mb-4">
		<span class="text-xl font-bold text-white tracking-tight">Events</span>
		<div class="flex bg-gray1 rounded-lg p-1 border border-gray2/20">
			<button
				class="px-4 py-1 text-xs rounded-md font-bold transition-all duration-200 {currentFilter === 'LIVE' ? 'bg-lime text-black shadow-sm' : 'text-gray2 hover:text-white'}"
				on:click={() => (currentFilter = 'LIVE')}
			>
				Live
			</button>
			<button
				class="px-4 py-1 text-xs rounded-md font-bold transition-all duration-200 {currentFilter === 'PAST' ? 'bg-lime text-black shadow-sm' : 'text-gray2 hover:text-white'}"
				on:click={() => (currentFilter = 'PAST')}
			>
				Past
			</button>
		</div>
	</div>

	<div class="mb-4 relative group">
		<input
			type="text"
			placeholder="Search events (e.g. 31 Dec)..."
			bind:value={searchQuery}
			class="w-full bg-gray1 border border-gray2/30 text-white font-bold rounded-xl px-4 py-2 text-sm outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all placeholder-gray2/50"
		/>
		<svg class="w-4 h-4 text-gray2 absolute right-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
		</svg>
	</div>

	<div class="mb-4 bg-gray1/50 rounded-xl p-3 border border-gray2/10">
		<div class="text-[10px] uppercase text-gray2 font-bold mb-2 tracking-wider">Compare Logic</div>
		
		<div class="flex flex-col gap-2">
			<label class="flex items-center gap-2 cursor-pointer group">
				<input 
					type="radio" 
					name="dateMode" 
					checked={!useCustomDate} 
					on:change={() => handleDateModeChange(false)}
					class="custom-checkbox w-4 h-4 rounded-full border-gray2 checked:bg-lime checked:border-lime focus:ring-0 cursor-pointer appearance-none border-2 relative"
				/>
				<span class="text-sm font-bold { !useCustomDate ? 'text-white' : 'text-gray2 group-hover:text-white'}">Today</span>
			</label>

			<div class="flex items-center gap-2">
				<label class="flex items-center gap-2 cursor-pointer group">
					<input 
						type="radio" 
						name="dateMode" 
						checked={useCustomDate}
						on:change={() => handleDateModeChange(true)} 
						class="custom-checkbox w-4 h-4 rounded-full border-gray2 checked:bg-lime checked:border-lime focus:ring-0 cursor-pointer appearance-none border-2 relative"
					/>
					<span class="text-sm font-bold { useCustomDate ? 'text-white' : 'text-gray2 group-hover:text-white'}">Specific Date</span>
				</label>
			</div>

			{#if useCustomDate}
				<div class="mt-1 ml-6">
					<DatePickerCompact 
						placeholder="Select date"
						bind:value={referenceDateValue}
						on:change={handleCustomDateChange}
						variant="outline"
						width="w-full"
					/>
				</div>
			{/if}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-gray2/20 scrollbar-track-transparent">
		{#if isFuzzySearch}
			<div class="px-2 pt-2 pb-4">
				<div class="text-gray2 font-bold text-sm mb-1">No exact results found.</div>
				
				{#if suggestions.length > 0}
					<div class="text-gray2/60 text-xs italic mb-4">Are you looking for this?</div>
					{#each suggestions as event (event.event_id)}
						<div
							class="flex items-center gap-3 p-2 rounded-xl hover:bg-gray1 transition-colors cursor-grab active:cursor-grabbing border border-lime/20 mb-2 group"
							draggable="true"
							on:dragstart={(e) => handleDragStart(e, event)}
							on:dragend={handleDragEnd}
							on:keydown={handleKeydown}
							role="button"
							tabindex="0"
						>
							<div class="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray1 border border-gray2/10 flex items-center justify-center">
								{#if event.flyer_url}
									<img class="w-full h-full object-cover" src={event.flyer_url} alt={event.name} />
								{:else}
									<div class="w-full h-full bg-navbar/50"></div>
								{/if}
							</div>
							<div class="flex flex-col min-w-0">
								<div class="text-white font-bold text-xs leading-tight truncate group-hover:text-lime transition-colors">
									{event.name}
								</div>
								<div class="text-gray2 text-[10px] font-bold mt-0.5">
									{formatEventDate(event.event_date)}
								</div>
							</div>
						</div>
					{/each}
				{:else}
					<div class="text-gray2/40 text-xs text-center py-4">No similar events found.</div>
				{/if}
			</div>

		{:else if displayedEvents.length === 0}
			<div class="text-center py-8 text-gray2 text-sm font-bold">No events found</div>
		
		{:else}
			{#each displayedEvents as event (event.event_id)}
				<div
					class="flex items-center gap-3 p-2 rounded-xl hover:bg-gray1 transition-colors cursor-grab active:cursor-grabbing border border-transparent hover:border-gray2/10 group"
					draggable="true"
					on:dragstart={(e) => handleDragStart(e, event)}
					on:dragend={handleDragEnd}
					on:keydown={handleKeydown}
					role="button"
					tabindex="0"
					aria-label="Drag event {event.name}"
				>
					<div class="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray1 border border-gray2/10 flex items-center justify-center">
						{#if event.flyer_url}
							<img class="w-full h-full object-cover" src={event.flyer_url} alt={event.name} />
						{:else}
							<div class="w-full h-full bg-navbar/50"></div>
						{/if}
					</div>
					<div class="flex flex-col min-w-0">
						<div class="text-white font-bold text-xs leading-tight truncate group-hover:text-lime transition-colors">
							{event.name}
						</div>
						<div class="text-gray2 text-[10px] font-bold mt-0.5">
							{formatEventDate(event.event_date)}
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</aside>

<style>
	::-webkit-scrollbar { width: 4px; }
	::-webkit-scrollbar-thumb { background: var(--color-gray2); opacity: 0.3; border-radius: 4px; }
    input[type="radio"]:checked::after {
        content: '';
        position: absolute; width: 6px; height: 6px; background: black; border-radius: 50%; top: 50%; left: 50%; transform: translate(-50%, -50%);
    }
</style>