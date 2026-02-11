<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase';

	export let events: any[] = [];
	export let loading = false;

	const dispatch = createEventDispatcher();

	let searchTerm = '';
	let viewMode: 'LIVE' | 'PAST' = 'LIVE';
    let advancedEventIds: Set<number> = new Set();
    let checkingAdvance = true;
    let selectedEventId: number | null = null;
    let realtimeChannel: any = null;

    onMount(async () => {
        await fetchAdvancedEvents();
        subscribeToEvents();
    });

    onDestroy(() => {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }
    });

    async function fetchAdvancedEvents() {
        checkingAdvance = true;
        const { data, error } = await supabase.from('events_advance').select('event_id');
        if (!error && data) {
            advancedEventIds = new Set(data.map(d => d.event_id));
        }
        checkingAdvance = false;
    }

    function subscribeToEvents() {
        realtimeChannel = supabase
            .channel('events_selector_list')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'events' },
                () => {
                    // If an event is updated (e.g. status changes), we emit an event 
                    // or ideally re-fetch the parent list. 
                    // Since 'events' prop is passed from parent, strictly speaking the parent should fetch.
                    // But if we want local reactivity we can emit a 'refresh' event.
                    // For now, we assume parent handles main data, but we can re-fetch advances.
                    fetchAdvancedEvents();
                }
            )
            .subscribe();
    }

	const excludeKeywords = ['test', 'réservations', 'pass', 'event', 'template', 'produktworld', 'piknic', 'oktoberfest'];

	$: filteredEvents = events
		.filter((event) => {
            if (!event.event_name) return false;
            // 1. Check strict advance requirement
            if (!checkingAdvance && !advancedEventIds.has(event.event_id)) {
               // Optional: Uncomment below to hide events without advance
               // return false; 
            }
			
            const nameLower = event.event_name.toLowerCase();
			if (excludeKeywords.some((keyword) => nameLower.includes(keyword))) return false;

            const isLive = event.event_status === 'LIVE'; 
            if (viewMode === 'LIVE' && !isLive) return false;
            if (viewMode === 'PAST' && isLive) return false;

			if (searchTerm) {
				return (
					nameLower.includes(searchTerm.toLowerCase()) ||
					(event.event_venue && event.event_venue.toLowerCase().includes(searchTerm.toLowerCase()))
				);
			}
			return true;
		})
		.sort((a, b) => {
            const timeA = new Date(a.event_date).getTime();
            const timeB = new Date(b.event_date).getTime();
            // LIVE: Ascending (Closest first)
            // PAST: Descending (Closest past first)
            return viewMode === 'LIVE' ? timeA - timeB : timeB - timeA;
        });

	function handleEventClick(event: any) {
        selectedEventId = event.event_id;
		dispatch('select', event);
	}

	function formatDate(dateString: string): string {
		if (!dateString) return 'TBD';
		return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<div class="absolute inset-0 flex flex-col bg-navbar">
    <div class="p-3 border-b border-gray1 space-y-2 bg-gray1/30 flex-shrink-0 z-10">
        <div class="flex items-center justify-between">
            <h2 class="text-white font-bold text-base">Select Event</h2>
        </div>
        
        <div class="bg-gray1 p-1 rounded-lg flex gap-1">
            <button 
                class="flex-1 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-wide {viewMode === 'LIVE' ? 'bg-lime text-black shadow-md' : 'text-gray2 hover:text-white'}"
                on:click={() => viewMode = 'LIVE'}
            >
                Live
            </button>
            <button 
                class="flex-1 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-wide {viewMode === 'PAST' ? 'bg-lime text-black shadow-md' : 'text-gray2 hover:text-white'}"
                on:click={() => viewMode = 'PAST'}
            >
                Past
            </button>
        </div>

        <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input
                type="text"
                bind:value={searchTerm}
                placeholder="Search events..."
                class="w-full bg-gray1 text-white rounded-lg pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-lime placeholder-gray2 transition-all"
            />
        </div>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-1">
        {#if loading || checkingAdvance}
            <div class="p-8 text-center"><div class="animate-spin w-6 h-6 border-2 border-lime border-t-transparent rounded-full mx-auto"></div></div>
        {:else if filteredEvents.length > 0}
            {#each filteredEvents as event (event.id || event.event_id)}
                <button
                    class="w-full text-left p-2.5 rounded-xl flex items-center gap-3 group transition-all duration-200 border cursor-pointer
                    {selectedEventId === event.event_id ? 'bg-gray1/80 border-lime shadow-[0_0_10px_rgba(132,204,22,0.1)]' : 'border-transparent hover:bg-gray1/50 hover:border-gray2/50'}"
                    on:click={() => handleEventClick(event)}
                >
                    <div class="w-10 h-10 rounded-lg bg-gray1 flex-shrink-0 overflow-hidden relative">
                        {#if event.event_flyer}
                            <img src={event.event_flyer} alt="" class="w-full h-full object-cover" />
                        {:else}
                            <div class="w-full h-full flex items-center justify-center text-gray2 text-[9px] font-bold">IMG</div>
                        {/if}
                    </div>
                    
                    <div class="flex-1 min-w-0">
                        <div class="text-white text-xs font-bold truncate group-hover:text-lime transition-colors">
                            {event.event_name}
                        </div>
                        <div class="text-gray2 text-[10px] font-medium mt-0.5">
                            {formatDate(event.event_date)} • {event.event_venue || 'NCG'}
                        </div>
                    </div>
                </button>
            {/each}
        {:else}
            <div class="p-8 text-center text-gray2 text-xs">No events found</div>
        {/if}
    </div>
</div>