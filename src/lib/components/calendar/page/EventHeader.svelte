<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { CalendarEvent, VenueSettings } from '$lib/types/calendar-types';
	import DateSelector from './DateSelector.svelte';
	import VenueSelector from './VenueSelector.svelte';

	// 🚨 Fix for TypeScript "Property 'calendar' does not exist"
	type ExtendedEvent = CalendarEvent & { 
		calendar?: { title?: string },
		short_id?: number 
	};

	export let event: ExtendedEvent;
	export let groupEvents: CalendarEvent[];
	export let venues: VenueSettings[];
	export let tabs: string[];
	export let activeTab: string;

	const dispatch = createEventDispatcher();

	let isEditingTitle = false;
	let editTitle = event.calendar?.title || 'Unnamed Event';
	let showStatusDrop = false;

	const statuses = [
		{ value: 'HOLD', label: 'Hold', color: 'bg-tentatif' },
		{ value: 'CONFIRMED', label: 'Confirmed', color: 'bg-confirmed' },
		{ value: 'IN SETTLEMENT', label: 'In Settlement', color: 'bg-info' },
		{ value: 'SETTLED', label: 'Settled', color: 'bg-gray2' }
	];

	$: currentStatusObj = statuses.find(s => s.value === event.status) || statuses[0];

	async function saveTitle() {
		isEditingTitle = false;
		if (editTitle.trim() === '' || editTitle === event.calendar?.title) return;
		
		await supabase.from('calendar').update({ title: editTitle.trim() }).eq('id', event.group_id);
		invalidateAll();
	}

	async function setStatus(newStatus: string) {
		showStatusDrop = false;
		if (newStatus === event.status) return;
		
		const oldStatus = event.status;
		
		if (newStatus === 'CONFIRMED' && oldStatus === 'HOLD') {
			await supabase.from('calendar_events').update({ status: 'CONFIRMED', hold_level: null }).eq('id', event.id);
			await supabase.from('calendar_events').update({ status: 'HIDDEN' }).eq('group_id', event.group_id).in('status', ['HOLD', 'PENDING']).neq('id', event.id);
		} else if (newStatus === 'HOLD' && oldStatus === 'CONFIRMED') {
			await supabase.from('calendar_events').update({ status: 'HOLD' }).eq('id', event.id);
			await supabase.from('calendar_events').update({ status: 'HOLD' }).eq('group_id', event.group_id).eq('status', 'HIDDEN');
		} else {
			await supabase.from('calendar_events').update({ status: newStatus }).eq('id', event.id);
		}
		invalidateAll();
	}

	// 🚨 Fix for Svelte a11y_autofocus warning
	function focusInput(node: HTMLInputElement) {
		node.focus();
	}
</script>

<svelte:window on:click={(e) => {
	if (showStatusDrop && e.target instanceof Element && !e.target.closest('.status-dropdown-container')) {
		showStatusDrop = false;
	}
}}/>

<div class="bg-gray1 flex flex-col shrink-0 relative z-20 border-b border-gray2/10">
	
	<div class="px-6 py-4 flex justify-between items-center border-b border-gray2/10">
		<div class="group relative flex items-center">
			{#if isEditingTitle}
				<input 
					type="text" 
					bind:value={editTitle} 
					on:blur={saveTitle} 
					on:keydown={e => e.key === 'Enter' && saveTitle()} 
					class="text-2xl font-black text-white border-b-2 border-lime focus:outline-none bg-transparent px-1 min-w-[300px]" 
					use:focusInput 
				/>
			{:else}
				<button 
					class="text-2xl font-black text-white cursor-pointer hover:text-lime transition-colors px-1 text-left" 
					on:click={() => isEditingTitle = true}
					aria-label="Edit event title"
				>
					{event.calendar?.title || 'Unnamed Event'}
				</button>
				<span class="opacity-0 group-hover:opacity-100 absolute -right-20 text-[10px] font-bold uppercase tracking-wider bg-navbar border border-gray2/20 text-white px-2 py-1 rounded transition-opacity pointer-events-none shadow-sm">
					Rename
				</span>
			{/if}
		</div>

		<div class="flex items-center gap-4">
			<div class="relative status-dropdown-container">
				<button 
					class="flex items-center gap-2.5 px-3 py-1.5 border border-gray2/20 rounded-lg bg-navbar shadow-sm hover:bg-white/5 transition-colors cursor-pointer"
					on:click={() => showStatusDrop = !showStatusDrop}
					aria-label="Change event status"
				>
					<div class="w-2 h-2 rounded-full {currentStatusObj.color}"></div>
					<span class="text-sm font-bold text-white">{currentStatusObj.label}</span>
					<svg class="w-4 h-4 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
				</button>
				
				{#if showStatusDrop}
					<div class="absolute right-0 top-[calc(100%+4px)] w-48 bg-navbar border border-gray2/20 rounded-xl shadow-xl overflow-hidden py-1 z-50">
						{#each statuses as status}
							<button 
								class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/5 cursor-pointer text-left transition-colors"
								on:click={() => setStatus(status.value)}
							>
								<div class="w-2 h-2 rounded-full {status.color}"></div>
								<span class="text-sm font-bold text-white">{status.label}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<button class="text-gray2 hover:text-white transition-colors cursor-pointer" aria-label="Copy to clipboard"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg></button>
			<button class="text-gray2 hover:text-white transition-colors cursor-pointer" aria-label="Settings"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button>
			<button class="text-gray2 hover:text-white transition-colors cursor-pointer" aria-label="More options"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg></button>
		</div>
	</div>

	<div class="px-6 py-3 flex items-center gap-3 border-b border-gray2/10">
		<DateSelector {event} {groupEvents} />
		<VenueSelector {event} {venues} />
		
		<button class="flex items-center gap-1.5 px-3 py-1.5 bg-navbar border border-gray2/20 rounded-full text-gray2 hover:bg-white/5 hover:text-white transition-colors cursor-pointer" aria-label="Add tags">
			<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
			<span class="text-xs font-bold italic">Add tags...</span>
		</button>
	</div>

	<div class="px-6 pt-2 bg-navbar flex items-end gap-6 overflow-x-auto custom-scrollbar">
		{#each tabs as tab}
			<button 
				class="pb-3 text-sm font-bold uppercase tracking-wider transition-colors whitespace-nowrap relative cursor-pointer {activeTab === tab ? 'text-lime' : 'text-gray2 hover:text-white'}"
				on:click={() => dispatch('tabChange', tab)}
			>
				{tab}
				{#if activeTab === tab}
					<div class="absolute bottom-0 left-0 w-full h-[3px] bg-lime rounded-t-full"></div>
				{/if}
			</button>
		{/each}
	</div>
</div>