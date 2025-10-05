<!-- src/lib/components/booking/customers/CustomerFilters.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { VENUES, GENDER_OPTIONS } from '$lib/components/settings/CustomersSettings';
  import type { EventOption } from '$lib/services/customersService';
  import { fetchAvailableEvents } from '$lib/services/customersService';
  
  export let filters: any = {};
  
  const dispatch = createEventDispatcher();
  
  let availableEvents: EventOption[] = [];
  let eventSearchTerm = '';
  let showEventDropdown = false;
  let eventSortType: 'a-z' | 'z-a' | 'date-asc' | 'date-desc' = 'date-desc';
  
  // Local filter state
  let venues: string[] = filters.venues || [];
  let ageRange = filters.ageRange || { min: 18, max: 80 };
  let spendRange = filters.spendRange || { min: 0, max: 2000 };
  let ticketsRange = filters.ticketsRange || { min: 0, max: 100 };
  let genders: string[] = filters.genders || [];
  let selectedEvents: number[] = filters.selectedEvents || [];
  
  onMount(async () => {
    availableEvents = await fetchAvailableEvents();
  });
  
  function updateFilters() {
    const newFilters = {
      venues,
      ageRange: ageRange.min !== 18 || ageRange.max !== 80 ? ageRange : undefined,
      spendRange: spendRange.min !== 0 || spendRange.max !== 2000 ? spendRange : undefined,
      ticketsRange: ticketsRange.min !== 0 || ticketsRange.max !== 100 ? ticketsRange : undefined,
      genders,
      selectedEvents
    };
    dispatch('filtersChange', newFilters);
  }
  
  function toggleVenue(venue: string) {
    if (venues.includes(venue)) {
      venues = venues.filter(v => v !== venue);
    } else {
      venues = [...venues, venue];
    }
    updateFilters();
  }
  
  function toggleGender(gender: string) {
    if (genders.includes(gender)) {
      genders = genders.filter(g => g !== gender);
    } else {
      genders = [...genders, gender];
    }
    updateFilters();
  }
  
  function addEvent(event: EventOption) {
    if (!selectedEvents.includes(event.event_id)) {
      selectedEvents = [...selectedEvents, event.event_id];
      updateFilters();
    }
    showEventDropdown = false;
    eventSearchTerm = '';
  }
  
  function removeEvent(eventId: number) {
    selectedEvents = selectedEvents.filter(id => id !== eventId);
    updateFilters();
  }
  
  function clearFilters() {
    venues = [];
    ageRange = { min: 18, max: 80 };
    spendRange = { min: 0, max: 2000 };
    ticketsRange = { min: 0, max: 100 };
    genders = [];
    selectedEvents = [];
    updateFilters();
  }
  
  function sortEvents(events: EventOption[]): EventOption[] {
    const sorted = [...events];
    switch (eventSortType) {
      case 'a-z':
        return sorted.sort((a, b) => a.event_name.localeCompare(b.event_name));
      case 'z-a':
        return sorted.sort((a, b) => b.event_name.localeCompare(a.event_name));
      case 'date-asc':
        return sorted.sort((a, b) => a.event_date.localeCompare(b.event_date));
      case 'date-desc':
        return sorted.sort((a, b) => b.event_date.localeCompare(a.event_date));
      default:
        return sorted;
    }
  }
  
  $: filteredEvents = sortEvents(
    availableEvents.filter(event =>
      event.event_name.toLowerCase().includes(eventSearchTerm.toLowerCase()) &&
      !selectedEvents.includes(event.event_id)
    )
  ).slice(0, 20); // Limit to 20 results
  
  $: selectedEventDetails = availableEvents.filter(e => selectedEvents.includes(e.event_id));
  
  function formatCurrency(amount: number): string {
    if (amount >= 2000) return '$2000+';
    return `$${amount}`;
  }
  
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.event-selector')) {
      showEventDropdown = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="bg-navbar border border-gray1 rounded-xl p-4 h-full overflow-y-auto">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-white text-lg font-bold">Filters</h3>
    <button
      on:click={clearFilters}
      class="text-gray2 hover:text-lime transition-colors text-xs"
    >
      Clear All
    </button>
  </div>
  
  <div class="space-y-4">
    <!-- Venue Filter -->
    <div>
      <div class="text-gray2 text-xs font-bold block mb-2">Venues</div>
      <div class="flex flex-wrap gap-2">
        {#each Object.entries(VENUES) as [key, venue]}
          <button
            on:click={() => toggleVenue(venue)}
            class="px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200
                   {venues.includes(venue)
                     ? 'bg-lime text-black'
                     : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
          >
            {venue}
          </button>
        {/each}
      </div>
    </div>
    
    <!-- Event Selector -->
    <div>
      <div class="text-gray2 text-xs font-bold block mb-2">Events Attended</div>
      
      <!-- Selected Events -->
      {#if selectedEvents.length > 0}
        <div class="flex flex-wrap gap-1 mb-2">
          {#each selectedEventDetails as event}
            <div class="bg-lime/20 border border-lime text-lime px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <span class="truncate max-w-[150px]">{event.event_name}</span>
              <button
                on:click={() => removeEvent(event.event_id)}
                aria-label="Remove {event.event_name}"
                class="hover:text-white transition-colors"
              >
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}
      
      <!-- Event Search -->
      <div class="relative event-selector">
        <input
          type="text"
          bind:value={eventSearchTerm}
          on:focus={() => showEventDropdown = true}
          placeholder="Search events..."
          aria-label="Search events"
          class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 
                 focus:outline-none focus:ring-1 focus:ring-lime"
        />
        
        {#if showEventDropdown}
          <div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
            <!-- Sort Options -->
            <div class="sticky top-0 bg-navbar p-2 border-b border-gray1 flex gap-1">
              <button
                on:click={() => eventSortType = 'a-z'}
                class="px-2 py-1 rounded text-xs font-bold transition-colors
                       {eventSortType === 'a-z' ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
              >
                A-Z
              </button>
              <button
                on:click={() => eventSortType = 'z-a'}
                class="px-2 py-1 rounded text-xs font-bold transition-colors
                       {eventSortType === 'z-a' ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
              >
                Z-A
              </button>
              <button
                on:click={() => eventSortType = 'date-asc'}
                class="px-2 py-1 rounded text-xs font-bold transition-colors
                       {eventSortType === 'date-asc' ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
              >
                Date ↑
              </button>
              <button
                on:click={() => eventSortType = 'date-desc'}
                class="px-2 py-1 rounded text-xs font-bold transition-colors
                       {eventSortType === 'date-desc' ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
              >
                Date ↓
              </button>
            </div>
            
            <!-- Event List -->
            {#if filteredEvents.length > 0}
              {#each filteredEvents as event}
                <button
                  on:click={() => addEvent(event)}
                  class="w-full text-left px-3 py-2 hover:bg-gray1 transition-colors"
                >
                  <div class="text-white text-xs font-bold">{event.event_name}</div>
                  <div class="text-gray2 text-xs">
                    {new Date(event.event_date).toLocaleDateString()} • {event.event_venue || 'No venue'}
                  </div>
                </button>
              {/each}
            {:else}
              <div class="p-3 text-center text-gray2 text-xs">No events found</div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Age Range -->
    <div>
      <div class="text-gray2 text-xs font-bold block mb-2">
        Age Range: {ageRange.min} - {ageRange.max}
      </div>
      <div class="space-y-2">
        <input
          type="range"
          bind:value={ageRange.min}
          min="18"
          max={ageRange.max - 1}
          on:change={updateFilters}
          aria-label="Minimum age"
          class="w-full slider"
        />
        <input
          type="range"
          bind:value={ageRange.max}
          min={ageRange.min + 1}
          max="80"
          on:change={updateFilters}
          aria-label="Maximum age"
          class="w-full slider"
        />
      </div>
    </div>
    
    <!-- Money Spent Range -->
    <div>
      <div class="text-gray2 text-xs font-bold block mb-2">
        Money Spent: {formatCurrency(spendRange.min)} - {formatCurrency(spendRange.max)}
      </div>
      <div class="space-y-2">
        <input
          type="range"
          bind:value={spendRange.min}
          min="0"
          max={spendRange.max - 1}
          step="50"
          on:change={updateFilters}
          aria-label="Minimum spend"
          class="w-full slider"
        />
        <input
          type="range"
          bind:value={spendRange.max}
          min={spendRange.min + 1}
          max="2000"
          step="50"
          on:change={updateFilters}
          aria-label="Maximum spend"
          class="w-full slider"
        />
      </div>
    </div>
    
    <!-- Tickets Purchased Range -->
    <div>
      <div class="text-gray2 text-xs font-bold block mb-2">
        Tickets Purchased: {ticketsRange.min} - {ticketsRange.max}
      </div>
      <div class="space-y-2">
        <input
          type="range"
          bind:value={ticketsRange.min}
          min="0"
          max={ticketsRange.max - 1}
          on:change={updateFilters}
          aria-label="Minimum tickets"
          class="w-full slider"
        />
        <input
          type="range"
          bind:value={ticketsRange.max}
          min={ticketsRange.min + 1}
          max="100"
          on:change={updateFilters}
          aria-label="Maximum tickets"
          class="w-full slider"
        />
      </div>
    </div>
    
    <!-- Gender Filter -->
    <div>
      <div class="text-gray2 text-xs font-bold block mb-2">Gender</div>
      <div class="flex flex-wrap gap-2">
        {#each Object.entries(GENDER_OPTIONS) as [key, label]}
          <button
            on:click={() => toggleGender(key)}
            class="px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200
                   {genders.includes(key)
                     ? 'bg-lime text-black'
                     : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
          >
            {label}
          </button>
        {/each}
      </div>
    </div>
    
    <!-- Country Filter (Disabled) -->
    <div class="opacity-50 pointer-events-none">
      <label for="country-filter" class="text-gray2 text-xs font-bold block mb-2">Country (Coming Soon)</label>
      <input
        id="country-filter"
        type="text"
        placeholder="Filter by country..."
        disabled
        class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2"
      />
    </div>
  </div>
</div>

<style>
  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: var(--color-navbar);
  }
  
  ::-webkit-scrollbar-thumb {
    background: var(--color-gray1);
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: var(--color-gray2);
  }
  
  /* Slider styling */
  .slider {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: var(--color-gray1);
    border-radius: 2px;
    outline: none;
  }
  
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: var(--color-lime);
    border-radius: 50%;
    cursor: pointer;
  }
  
  .slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: var(--color-lime);
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
</style>