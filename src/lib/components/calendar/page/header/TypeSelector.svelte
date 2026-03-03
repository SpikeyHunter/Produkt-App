<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent } from '$lib/types/calendar-types';

	type ExtendedEvent = CalendarEvent & {
		calendar?: {
			title?: string;
			details?: any;
		};
		short_id?: number;
		details?: any;
	};

	export let event: ExtendedEvent;
	export let parsedDetails: any;

	let showTypeDrop = false;

	const typeColors: Record<string, string> = {
		Corpo: '#d7b8e8',
		'Bazart Nuits': '#ffe089',
		'Moet City': '#f1e5cb',
		'NCG Show': '#c4ef9b',
		'NCG 360': '#fa7a90',
		DSTRKT: '#afd3e9',
		'Tour Prod': '#aec5d5',
		Other: '#828282'
	};

	$: currentType = parsedDetails?.type || 'Select Type';
	$: currentTypeColor = typeColors[currentType] || typeColors['Other'];

	async function setType(newType: string) {
		showTypeDrop = false;
		if (currentType === newType) return;

		// 1. Update the local parsed object
		parsedDetails.type = newType;

		// 2. Assign it back to both possible locations for optimistic UI
		if (event.calendar) event.calendar.details = parsedDetails;
		event.details = parsedDetails;

		// 3. Save to the database 'calendar' table
		await supabase.from('calendar').update({ details: parsedDetails }).eq('id', event.group_id);

		// 4. Trigger server refetch
		invalidateAll();
	}

	function handleWindowClick(e: MouseEvent) {
		if (
			showTypeDrop &&
			e.target instanceof Element &&
			!e.target.closest('.type-dropdown-container')
		) {
			showTypeDrop = false;
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="relative type-dropdown-container ml-2">
	<button
		class="flex items-center gap-2 px-3 py-2 rounded-3xl bg-navbar hover:bg-white/5 transition-colors cursor-pointer"
		on:click={() => (showTypeDrop = !showTypeDrop)}
		aria-label="Change event type"
	>
		<div class="w-3 h-3 rounded-full" style="background-color: {currentTypeColor}"></div>
		<span class="text-sm font-bold text-white whitespace-nowrap">
			{currentType}
		</span>
		<svg
			class="w-4 h-4 text-gray2 ml-1"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
		>
	</button>

	{#if showTypeDrop}
		<div
			class="absolute left-0 top-[calc(100%+8px)] w-52 bg-navbar rounded-3xl shadow-xl overflow-hidden py-2 z-[60] border border-gray2/10"
		>
			{#each Object.entries(typeColors) as [typeName, colorHex]}
				<button
					class="w-full px-5 py-3 flex items-center gap-3 hover:bg-white/5 cursor-pointer text-left transition-colors"
					on:click={() => setType(typeName)}
				>
					<div class="w-3 h-3 rounded-full" style="background-color: {colorHex}"></div>
					<span class="text-sm font-bold text-white">{typeName}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>