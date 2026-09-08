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
  let viewMode: 'LIVE' | 'PAST' = 'LIVE';

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
      'todo': { label: 'To Do', color: '#FCA5A5' },       
      'in_progress': { label: 'In Progress', color: '#FDBA74' }, 
      'to_send': { label: 'To Send', color: '#c4b5fd' },  
      'done': { label: 'Done', color: '#86EFAC' }         
  };

  function getStatusDetails(evt: EmailTechEvent) {
      const statusKey = evt.email_data?.tech_status || evt.email_data?.vj_status || 'todo';
      return STATUS_CONFIG[statusKey] || STATUS_CONFIG['todo'];
  }

  $: uniqueEvents = events.reduce((acc: EmailTechEvent[], current: EmailTechEvent) => {
    if (!acc.find((item: EmailTechEvent) => item.event_id === current.event_id)) {
      acc.push(current);
    }
    return acc;
  }, [] as EmailTechEvent[]);

  // Filter and Sort Logic based on ViewMode
  $: filteredEvents = uniqueEvents
    .filter((event: EmailTechEvent) => {
        // Filter by Status: LIVE vs PAST (Not LIVE)
        if (viewMode === 'LIVE') {
            return event.event_status === 'LIVE';
        } else {
            return event.event_status !== 'LIVE';
        }
    })
    .sort((a: EmailTechEvent, b: EmailTechEvent) => {
        if (!a.event_date) return 1;
        if (!b.event_date) return -1;
        
        const timeA = new Date(a.event_date).getTime();
        const timeB = new Date(b.event_date).getTime();

        return viewMode === 'LIVE' ? timeA - timeB : timeB - timeA;
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

  // Clicking a row always selects THAT event only — two shows on the same day
  // stay separate emails unless they're linked on purpose.
  function handleEventClick(clickedEvent: EmailTechEvent) {
    const isOnlySelection =
      selectedEvents.length === 1 && selectedEvents[0].id === clickedEvent.id;

    selectedEvents = isOnlySelection ? [] : [clickedEvent];
    showDropdown = false;
    dispatch('select', selectedEvents);
  }

  /** Can this row be linked to (or unlinked from) the current selection? */
  function canLink(event: EmailTechEvent): boolean {
    const first = selectedEvents[0];
    if (!first || first.id === event.id) return false;
    return !!event.event_date && event.event_date === first.event_date;
  }

  // Explicit link/unlink — keeps the dropdown open so several can be combined.
  function toggleLink(event: EmailTechEvent) {
    const isLinked = selectedEvents.some(e => e.id === event.id);
    selectedEvents = isLinked
      ? selectedEvents.filter(e => e.id !== event.id)
      : [...selectedEvents, event];
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
      class="w-full bg-gray1 text-white rounded-2xl px-4 py-2.5 text-sm font-bold flex items-center justify-between hover:bg-gray2 hover:cursor-pointer hover:text-black transition-colors focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div class="p-2 border-b border-gray1 space-y-2">
            <div class="flex gap-1 bg-gray1 p-1 rounded-lg">
                <button 
                    class="flex-1 text-xs font-bold py-1.5 rounded-md transition-all {viewMode === 'LIVE' ? 'bg-lime text-black shadow-sm' : 'text-gray-400 hover:text-white'}"
                    on:click={() => viewMode = 'LIVE'}
                >
                    LIVE
                </button>
                <button 
                    class="flex-1 text-xs font-bold py-1.5 rounded-md transition-all {viewMode === 'PAST' ? 'bg-lime text-black shadow-sm' : 'text-gray-400 hover:text-white'}"
                    on:click={() => viewMode = 'PAST'}
                >
                    PAST
                </button>
            </div>

            <input type="text" bind:value={searchTerm} placeholder="Search for an event..." class="w-full bg-gray1 text-white rounded-md px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime" />
        </div>
        <div class="max-h-72 overflow-y-auto">
            {#if loading}
              <div class="p-4 text-center text-gray2 text-sm">
                <div class="animate-spin w-5 h-5 border-2 border-lime border-t-transparent rounded-full mx-auto"></div>
              </div>
  
            {:else if filteredEvents.length > 0}
                {#each filteredEvents as event (event.id)}
                    {@const isCurrentlySelected = selectedEvents.some(e => e.id === event.id)}
                    {@const isPrimary = selectedEvents[0]?.id === event.id}
                    {@const linkable = canLink(event)}
                    {@const statusInfo = getStatusDetails(event)}
                    <div class="group relative flex items-center gap-4 p-3 hover:bg-gray1 transition-colors border-b border-gray1 last:border-b-0">
                    <button
                    type="button"
                    on:click={() => handleEventClick(event)}
                    class="absolute inset-0 w-full h-full cursor-pointer bg-transparent border-none outline-none"
                    aria-label={`Select ${event.event_name}`}
                    ></button>
                    <div class="pointer-events-none relative flex items-center gap-4 w-full">
                        {#if event.event_flyer}
                        <img src={event.event_flyer} alt={event.event_name} class="w-12 h-15 object-cover rounded flex-shrink-0" />
                        {:else}
                        <div class="w-12 h-15 bg-gray1 rounded flex items-center justify-center flex-shrink-0">
                            <svg class="w-6 h-6 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                            </svg>
                        </div>
                        {/if}
        
                        <div class="flex-1 min-w-0">
                        <div class="text-white text-sm font-bold truncate transition-colors group-hover:text-lime">{event.event_name}</div>
                        <div class="text-gray2 text-xs">{event.event_venue || 'No Venue'} • {formatDate(event.event_date)}</div>
                        
                        <div class="mt-1">
                            <span 
                                class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-black"
                                style="background-color: {statusInfo.color};"
                            >
                                {statusInfo.label}
                            </span>
                        </div>
                        </div>
                        <!-- Linking is opt-in: same-day shows are separate emails by default -->
                        {#if isCurrentlySelected && !isPrimary}
                        <button
                            type="button"
                            on:click|stopPropagation={() => toggleLink(event)}
                            class="pointer-events-auto relative z-10 flex-shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-lime text-black hover:opacity-80 transition-opacity cursor-pointer outline-none"
                            title="Unlink from this email"
                        >
                            Linked
                        </button>
                        {:else if linkable}
                        <button
                            type="button"
                            on:click|stopPropagation={() => toggleLink(event)}
                            class="pointer-events-auto relative z-10 flex-shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border border-lime/50 text-lime hover:bg-lime hover:text-black transition-colors cursor-pointer outline-none"
                            title="Link to the selected event (one combined email)"
                        >
                            + Link
                        </button>
                        {/if}
                        {#if isCurrentlySelected}
                        <svg class="w-5 h-5 text-lime flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {/if}
                    </div>
                    </div>
                {/each}
            {:else}
                <div class="p-4 text-center text-gray2 text-sm">
                    {searchTerm ? 'No matching events found' : `No ${viewMode.toLowerCase()} events available`}
                </div>
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