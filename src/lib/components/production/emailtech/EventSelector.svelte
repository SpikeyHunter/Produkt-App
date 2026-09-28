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

  // Linked events (email_data.linked_event_ids, saved on the owner) show as
  // ONE merged row: the owner carries chips for its partners and the partner
  // rows are hidden from the list.
  $: linkedOf = (evt: EmailTechEvent): EmailTechEvent[] => {
    const ids: number[] = Array.isArray(evt.email_data?.linked_event_ids) ? evt.email_data.linked_event_ids : [];
    return ids
      .map((id) => uniqueEvents.find((e) => e.event_id === id))
      .filter((e): e is EmailTechEvent => !!e && e.event_id !== evt.event_id);
  };
  $: hiddenIds = new Set<number>(
    uniqueEvents.flatMap((e) => linkedOf(e).map((p) => p.event_id))
  );

  // Filter and Sort Logic based on ViewMode
  $: filteredEvents = uniqueEvents
    .filter((event: EmailTechEvent) => !hiddenIds.has(event.event_id) || selectedEvents[0]?.event_id === event.event_id)
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
      const partners = linkedOf(event);
      return (
        event.event_name?.toLowerCase().includes(searchLower) ||
        event.artist_name.toLowerCase().includes(searchLower) ||
        event.event_venue?.toLowerCase().includes(searchLower) ||
        partners.some((p) => p.event_name?.toLowerCase().includes(searchLower))
      );
    });

  // Clicking a row selects that event plus whatever is linked to it — one
  // combined email. Nothing links by itself: same-day shows stay separate
  // until "+ Link" is used.
  function handleEventClick(clickedEvent: EmailTechEvent) {
    const isOnlySelection =
      selectedEvents.length >= 1 && selectedEvents[0].id === clickedEvent.id;

    selectedEvents = isOnlySelection ? [] : [clickedEvent, ...linkedOf(clickedEvent)];
    showDropdown = false;
    dispatch('select', selectedEvents);
  }

  /** Any other event can be linked to the selected one. */
  function canLink(event: EmailTechEvent): boolean {
    const first = selectedEvents[0];
    return !!first && first.id !== event.id && first.event_id !== event.event_id;
  }

  // Explicit link/unlink — keeps the dropdown open so several can be combined.
  // The page persists the ids on the owner (email_data.linked_event_ids).
  function toggleLink(event: EmailTechEvent) {
    const isLinked = selectedEvents.some(e => e.id === event.id);
    selectedEvents = isLinked
      ? selectedEvents.filter(e => e.id !== event.id)
      : [...selectedEvents, event];
    dispatch('link', { primary: selectedEvents[0], ids: selectedEvents.slice(1).map((e) => e.event_id) });
    dispatch('select', selectedEvents);
  }

  /** × on a chip: drop that partner from the owner's links. */
  function unlink(owner: EmailTechEvent, partner: EmailTechEvent) {
    const ids = linkedOf(owner).map((p) => p.event_id).filter((id) => id !== partner.event_id);
    if (selectedEvents[0]?.event_id === owner.event_id) {
      selectedEvents = selectedEvents.filter((e) => e.event_id !== partner.event_id);
      dispatch('select', selectedEvents);
    } else {
      // not the open event: update the owner's data locally so the row splits now
      owner.email_data = { ...(owner.email_data || {}), linked_event_ids: ids };
      events = [...events];
    }
    dispatch('link', { primary: owner, ids });
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
    ? selectedEvents.map(e => e.event_name).join(' + ') 
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
                    {@const partners = linkedOf(event)}
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
                        {#if partners.length}
                        <div class="mt-1 flex flex-wrap gap-1">
                            {#each partners as p (p.id)}
                                <span class="pointer-events-auto relative z-10 inline-flex items-center gap-1 text-[10px] font-bold pl-1.5 pr-1 py-0.5 rounded-full border border-lime/50 text-lime max-w-full">
                                    <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                    <span class="truncate">{p.event_name}</span>
                                    <button type="button" on:click|stopPropagation={() => unlink(event, p)}
                                        class="ml-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-lime hover:text-black transition-colors cursor-pointer"
                                        title="Unlink {p.event_name}" aria-label="Unlink {p.event_name}">
                                        <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    </button>
                                </span>
                            {/each}
                        </div>
                        {/if}
                        
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