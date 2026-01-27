<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import type { EmailTechEvent } from '$lib/types/emailtech';

  export let events: EmailTechEvent[] = [];
  export let selectedEvents: EmailTechEvent[] = [];
  export let loading = false;

  const dispatch = createEventDispatcher();
  
  let searchTerm = '';
  let showDropdown = false;

  $: multiSelectEnabledDates = (() => {
    const datesWithVenues = events.reduce((acc, event) => {
        if (!event.event_date) return acc;
        if (!acc.has(event.event_date)) {
            acc.set(event.event_date, new Set<string>());
        }
        if(event.event_venue) acc.get(event.event_date)?.add(event.event_venue);
        return acc;
    }, new Map<string, Set<string>>());

    const enabledDates = new Set<string>();
    for (const [date, venues] of datesWithVenues.entries()) {
        if (venues.has('New City Gas') && venues.size > 1) {
            enabledDates.add(date);
        }
    }
    return enabledDates;
  })();

  $: uniqueEvents = events.reduce((acc: EmailTechEvent[], current: EmailTechEvent) => {
    if (!acc.find((item: EmailTechEvent) => item.event_id === current.event_id)) {
      acc.push(current);
    }
    return acc;
  }, [] as EmailTechEvent[]);

  $: filteredEvents = uniqueEvents
    .filter((event: EmailTechEvent) => event.event_status === 'LIVE')
    .sort((a: EmailTechEvent, b: EmailTechEvent) => {
        if (!a.event_date) return 1;
        if (!b.event_date) return -1;
        return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
    })
    .filter((event: EmailTechEvent) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        event.event_name?.toLowerCase().includes(searchLower) ||
        event.artist_name.toLowerCase().includes(searchLower) ||
        event.event_venue?.toLowerCase().includes(searchLower)
      );
    });

  function handleEventClick(clickedEvent: EmailTechEvent) {
    const date = clickedEvent.event_date;
    const isSpecialPair = date && 
                         events.some(e => e.event_date === date && e.event_venue === 'New City Gas') &&
                         events.some(e => e.event_date === date && e.event_venue === 'Bazart');

    if (isSpecialPair) {
      const ncgEvent = events.find(e => e.event_date === date && e.event_venue === 'New City Gas');
      const bazartEvent = events.find(e => e.event_date === date && e.event_venue === 'Bazart');
      
      if (ncgEvent && bazartEvent) {
        selectedEvents = [ncgEvent, bazartEvent];
        showDropdown = false;
        dispatch('select', selectedEvents);
        return;
      }
    }
    
    selectEvent(clickedEvent);
  }

  function selectEvent(eventToAdd: EmailTechEvent) {
    const isSelected = selectedEvents.some(e => e.id === eventToAdd.id);
    
    if (isSelected) {
      selectedEvents = selectedEvents.filter(e => e.id !== eventToAdd.id);
    } else {
      const firstSelected = selectedEvents[0];
      const isMultiSelectDate = firstSelected?.event_date && multiSelectEnabledDates.has(firstSelected.event_date);
      
      if (isMultiSelectDate && firstSelected.event_date === eventToAdd.event_date && selectedEvents.length < 2) {
        selectedEvents = [...selectedEvents, eventToAdd];
      } else {
        selectedEvents = [eventToAdd];
      }
    }
    
    showDropdown = false;
    dispatch('select', selectedEvents);
  }
  
  function handleClickOutside(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('.event-selector-container')) {
      showDropdown = false;
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Date TBD';
    try {
      const parts = dateString.split('-').map(Number);
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      const day = date.getDate();
      const month = date.toLocaleString('en-US', { month: 'long' });
      const year = date.getFullYear();

      const getSuffix = (d: number) => {
        if (d > 3 && d < 21) return 'th';
        switch (d % 10) {
          case 1: return "st";
          case 2: return "nd";
          case 3: return "rd";
          default: return "th";
        }
      };

      return `${month} ${day}${getSuffix(day)}, ${year}`;
    } catch {
      return dateString;
    }
  }

  $: selectionText = selectedEvents.length > 0 
    ? selectedEvents.map(e => e.event_name).join(' & ') 
    : 'Select Event';
</script>

<svelte:window on:click={handleClickOutside} />

<div class="event-selector-container relative w-full">
    <button
      type="button"
      on:click={() => (showDropdown = !showDropdown)}
      disabled={loading}
      class="w-full bg-gray1 text-white rounded-lg px-4 py-2.5 text-sm font-bold flex items-center justify-between hover:bg-gray2 hover:cursor-pointer hover:text-black transition-colors focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span class="flex items-center gap-2 truncate">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span class="truncate">{selectionText}</span>
      </span>
      <svg class="w-4 h-4 transition-transform flex-shrink-0 {showDropdown ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    
    {#if showDropdown}
      <div transition:fly={{ y: -5, duration: 150 }} class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
        <div class="p-2 border-b border-gray1">
            <input type="text" bind:value={searchTerm} placeholder="Search for a LIVE event..." class="w-full bg-gray1 text-white rounded-md px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime" />
        </div>
        <div class="max-h-72 overflow-y-auto">
            {#if loading}
              <div class="p-4 text-center text-gray2 text-sm">
                <div class="animate-spin w-5 h-5 border-2 border-lime border-t-transparent rounded-full mx-auto"></div>
              </div>
            {:else if filteredEvents.length > 0}
                {#each filteredEvents as event (event.id)}
                {@const isCurrentlySelected = selectedEvents.some(e => e.id === event.id)}
                <button 
                  on:click={() => handleEventClick(event)} 
                  class="group w-full text-left p-3 hover:bg-gray1 transition-colors flex items-center gap-4 border-b border-gray1 last:border-b-0 cursor-pointer"
                >
                    {#if event.event_flyer}
                      <img src={event.event_flyer} alt={event.event_name} class="w-12 h-12 object-cover rounded flex-shrink-0" />
                    {:else}
                      <div class="w-12 h-12 bg-gray1 rounded flex items-center justify-center flex-shrink-0">
                        <svg class="w-6 h-6 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                           <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                        </svg>
                      </div>
                    {/if}
                    <div class="flex-1 min-w-0">
                      <div class="text-white text-sm font-bold truncate transition-colors group-hover:text-lime">{event.event_name}</div>
                      <div class="text-gray2 text-xs">{event.event_venue || 'No Venue'} • {formatDate(event.event_date)}</div>
                    </div>
                    {#if isCurrentlySelected}
                      <svg class="w-5 h-5 text-lime flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    {/if}
                </button>
                {/each}
            {:else}
              <div class="p-4 text-center text-gray2 text-sm">{searchTerm ? 'No matching live events found' : 'No live events available'}</div>
            {/if}
        </div>
      </div>
    {/if}
</div>

<style>
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--color-navbar); }
  ::-webkit-scrollbar-thumb { background: var(--color-gray1); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--color-gray2); }
</style>