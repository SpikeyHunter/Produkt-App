<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { VENUES, GENDER_OPTIONS, SPEND_RANGE, TICKETS_RANGE, AGE_RANGE } from '$lib/components/settings/CustomersSettings';
  import { GENRE_OPTIONS } from '$lib/services/constants';
  import type { EventOption } from '$lib/services/customersService';
  import { fetchAvailableEvents } from '$lib/services/customersService';
  
  export let filters: any = {};
  export let activePreset: string = '';
  const dispatch = createEventDispatcher();
  
  let availableEvents: EventOption[] = [];
  let availableGenres: string[] = [];
  let applicableGenres: Set<string> = new Set();
  let eventSearchTerm = '';
  let showEventDropdown = false;

  let earliestEventDate = '';
  let latestEventDate = '';
  
  let venues: string[] = [];
  let genres: string[] = [];
  let genders: string[] = [];
  let selectedEvents: number[] = [];
  let ageRange = { min: AGE_RANGE.MIN, max: AGE_RANGE.MAX };
  let spendRange = { min: SPEND_RANGE.MIN, max: SPEND_RANGE.MAX };
  let ticketsRange = { min: TICKETS_RANGE.MIN, max: TICKETS_RANGE.MAX };
  let dateRange = { start: '', end: '' };
  
  $: if (filters) {
    venues = filters.venues || [];
    genres = filters.genres || [];
    genders = filters.genders || [];
    selectedEvents = filters.selectedEvents || [];
    ageRange = filters.ageRange || { min: AGE_RANGE.MIN, max: AGE_RANGE.MAX };
    spendRange = filters.spendRange || { min: SPEND_RANGE.MIN, max: SPEND_RANGE.MAX };
    ticketsRange = filters.ticketsRange || { min: TICKETS_RANGE.MIN, max: TICKETS_RANGE.MAX };
    dateRange = filters.dateRange || { 
      start: earliestEventDate, 
      end: latestEventDate
    };
  }

  onMount(async () => {
    availableEvents = await fetchAvailableEvents();
    
    if (availableEvents.length > 0) {
      const dates = availableEvents.map(e => new Date(e.event_date).getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));

      earliestEventDate = minDate.toISOString().split('T')[0];
      latestEventDate = maxDate.toISOString().split('T')[0];
      
      resetDateRange();
    }
    
    const genreSet = new Set<string>();
    availableEvents.forEach(event => {
      if (event.event_genre && GENRE_OPTIONS.includes(event.event_genre)) {
        genreSet.add(event.event_genre);
      }
    });
    availableGenres = Array.from(genreSet).sort((a, b) => 
      GENRE_OPTIONS.indexOf(a) - GENRE_OPTIONS.indexOf(b)
    );
    
    applicableGenres = new Set(availableGenres);
  });
  
  $: {
    const filteredEvents = availableEvents.filter(event => {
      if (venues.length > 0 && !venues.includes(event.event_venue || '')) {
        return false;
      }
      return true;
    });
    const newApplicableGenres = new Set<string>();
    filteredEvents.forEach(event => {
      if (event.event_genre && GENRE_OPTIONS.includes(event.event_genre)) {
        newApplicableGenres.add(event.event_genre);
      }
    });
    applicableGenres = newApplicableGenres;
    genres = genres.filter(g => applicableGenres.has(g));
  }
  
  function updateFilters() {
    if (activePreset) {
      dispatch('clearPreset');
    }
    const newFilters: any = {
      venues,
      genres,
      ageRange: ageRange.min !== AGE_RANGE.MIN || ageRange.max !== AGE_RANGE.MAX ? ageRange : undefined,
      spendRange: spendRange.min !== SPEND_RANGE.MIN || spendRange.max !== SPEND_RANGE.MAX ? spendRange : undefined,
      ticketsRange: ticketsRange.min !== TICKETS_RANGE.MIN || ticketsRange.max !== TICKETS_RANGE.MAX ? ticketsRange : undefined,
      genders,
      selectedEvents,
      dateRange: dateRange.start && dateRange.end && (dateRange.start !== earliestEventDate || dateRange.end !== latestEventDate) ? dateRange : undefined
    };
    dispatch('filtersChange', newFilters);
  }
  
  function toggleVenue(venue: string) { venues = venues.includes(venue) ? venues.filter(v => v !== venue) : [...venues, venue]; updateFilters(); }
  function toggleGenre(genre: string) { if (!applicableGenres.has(genre)) return; genres = genres.includes(genre) ? genres.filter(g => g !== genre) : [...genres, genre]; updateFilters(); }
  function toggleGender(gender: string) { genders = genders.includes(gender) ? genders.filter(g => g !== gender) : [...genders, gender]; updateFilters(); }
  
  function addEvent(event: EventOption) {
    if (!selectedEvents.includes(event.event_id)) {
      selectedEvents = [...selectedEvents, event.event_id];
      updateFilters();
    }
    showEventDropdown = false;
    eventSearchTerm = '';
  }
  
  function removeEvent(eventId: number) { selectedEvents = selectedEvents.filter(id => id !== eventId); updateFilters(); }
  
  function clearFilters() {
    venues = [];
    genres = [];
    genders = [];
    selectedEvents = [];
    resetAgeRange();
    resetSpendRange();
    resetTicketsRange();
    resetDateRange();
    updateFilters();
  }
  
  function resetAgeRange() { ageRange = { min: AGE_RANGE.MIN, max: AGE_RANGE.MAX }; updateFilters(); }
  function resetSpendRange() { spendRange = { min: SPEND_RANGE.MIN, max: SPEND_RANGE.MAX }; updateFilters(); }
  function resetTicketsRange() { ticketsRange = { min: TICKETS_RANGE.MIN, max: TICKETS_RANGE.MAX }; updateFilters(); }

  function resetDateRange() {
    dateRange = { start: earliestEventDate, end: latestEventDate };
    updateFilters();
  }

  $: sortedEvents = [...availableEvents].filter(event => event.event_name.toLowerCase().includes(eventSearchTerm.toLowerCase()));
  $: filteredEvents = sortedEvents.filter(event => !selectedEvents.includes(event.event_id));
  $: selectedEventDetails = availableEvents.filter(e => selectedEvents.includes(e.event_id));
  
  function formatCurrency(amount: number): string {
    const roundedAmount = Math.round(amount);
    if (roundedAmount >= SPEND_RANGE.MAX) return `$${SPEND_RANGE.MAX}+`;
    return `$${roundedAmount}`;
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
    <button on:click={clearFilters} class="text-gray2 hover:text-lime transition-colors text-xs cursor-pointer">
      Clear All
    </button>
  </div>
  
  <div class="space-y-6">
    <div>
      <div class="text-gray2 text-xs font-bold block mb-2">Events Attended</div>
      {#if selectedEvents.length > 0}
       <div class="flex flex-wrap gap-1 mb-2">
          {#each selectedEventDetails as event}
            <div class="bg-lime/20 border border-lime text-lime px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <span class="truncate max-w-[150px]">{event.event_name}</span>
              <button on:click={() => removeEvent(event.event_id)} aria-label="Remove {event.event_name}" class="hover:text-white transition-colors cursor-pointer">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}
      <div class="relative event-selector">
        <input type="text" bind:value={eventSearchTerm} on:focus={() => showEventDropdown = true} placeholder="Search events..." aria-label="Search events" class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime cursor-text" />
        {#if showEventDropdown}
          <div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
            {#if filteredEvents.length > 0}
              {#each filteredEvents as event}
                <button on:click={() => addEvent(event)} class="w-full text-left px-3 py-2 hover:bg-gray1 transition-colors cursor-pointer flex items-center gap-3">
                  {#if event.event_flyer}
                    <img src={event.event_flyer} alt={event.event_name} class="w-8 h-8 object-cover rounded flex-shrink-0" />
                  {:else}
                    <div class="w-8 h-8 bg-gray1 rounded flex items-center justify-center flex-shrink-0">
                      <svg class="w-4 h-4 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                      </svg>
                    </div>
                  {/if}
                  <div class="flex-1 min-w-0">
                    <div class="text-white text-xs font-bold truncate">{event.event_name}</div>
                    <div class="text-gray2 text-xs">{new Date(event.event_date).toLocaleDateString()} • {event.event_venue || 'No venue'}</div>
                  </div>
                </button>
              {/each}
            {:else}
              <div class="p-3 text-center text-gray2 text-xs">{eventSearchTerm ? 'No events found' : 'No more events'}</div>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <div>
      <div class="text-gray2 text-xs font-bold block mb-2">Venues</div>
      <div class="flex flex-wrap gap-2">
        {#each Object.entries(VENUES) as [key, venue]}
          <button on:click={() => toggleVenue(venue)} class="px-2 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer {venues.includes(venue) ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}">{venue}</button>
        {/each}
      </div>
    </div>
    
    <div>
      <div class="text-gray2 text-xs font-bold flex items-center justify-between mb-2">
        <span>Date Range</span>
        <button on:click={resetDateRange} class="text-gray2 hover:text-lime transition-colors cursor-pointer" aria-label="Reset date range" title="Reset date range">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
        </button>
      </div>
      <div class="flex gap-2">
        <input type="date" bind:value={dateRange.start} on:change={updateFilters} max={dateRange.end || ''} class="w-full bg-gray1 text-white rounded-lg px-2 py-1.5 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime" />
        <input type="date" bind:value={dateRange.end} on:change={updateFilters} min={dateRange.start || ''} class="w-full bg-gray1 text-white rounded-lg px-2 py-1.5 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime" />
      </div>
    </div>
    
    {#if availableGenres.length > 0}
    <div>
      <div class="text-gray2 text-xs font-bold block mb-2">Genres</div>
      <div class="flex flex-wrap gap-2">
        {#each availableGenres as genre}
          {@const isApplicable = applicableGenres.has(genre)}
          {@const isSelected = genres.includes(genre)}
          <button on:click={() => toggleGenre(genre)} disabled={!isApplicable} class="px-2 py-1 rounded-lg text-xs font-bold transition-all duration-200 {!isApplicable ? 'bg-gray1/50 text-gray2 cursor-not-allowed opacity-50' : isSelected ? 'bg-lime text-black cursor-pointer' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black cursor-pointer'}">{genre}</button>
        {/each}
      </div>
    </div>
    {/if}

    <div>
      <div class="text-gray2 text-xs font-bold flex items-center justify-between mb-2">
         <span>Age: {ageRange.min}-{ageRange.max}</span>
        <button on:click={resetAgeRange} class="text-gray2 hover:text-lime transition-colors cursor-pointer" aria-label="Reset age range" title="Reset age range"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg></button>
      </div>
       <div class="relative h-2"><div class="absolute inset-0 bg-gray1 rounded-full"></div><div class="absolute h-full bg-lime rounded-full" style="left: {((ageRange.min - AGE_RANGE.MIN) / (AGE_RANGE.MAX - AGE_RANGE.MIN)) * 100}%; right: {((AGE_RANGE.MAX - ageRange.max) / (AGE_RANGE.MAX - AGE_RANGE.MIN)) * 100}%;"></div><input type="range" bind:value={ageRange.min} min={AGE_RANGE.MIN} max={ageRange.max} on:change={updateFilters} aria-label="Minimum age" class="absolute w-full cursor-pointer range-slider" /><input type="range" bind:value={ageRange.max} min={ageRange.min} max={AGE_RANGE.MAX} on:change={updateFilters} aria-label="Maximum age" class="absolute w-full cursor-pointer range-slider" /></div>
    </div>
    
    <div>
      <div class="text-gray2 text-xs font-bold flex items-center justify-between mb-2">
        <span>Spend: {formatCurrency(spendRange.min)}-{formatCurrency(spendRange.max)}</span>
         <button on:click={resetSpendRange} class="text-gray2 hover:text-lime transition-colors cursor-pointer" aria-label="Reset spend range" title="Reset spend range"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg></button>
      </div>
      <div class="relative h-2"><div class="absolute inset-0 bg-gray1 rounded-full"></div><div class="absolute h-full bg-lime rounded-full" style="left: {(spendRange.min / SPEND_RANGE.MAX) * 100}%; right: {((SPEND_RANGE.MAX - spendRange.max) / SPEND_RANGE.MAX) * 100}%;"></div><input type="range" bind:value={spendRange.min} min={SPEND_RANGE.MIN} max={spendRange.max} step="1" on:change={updateFilters} aria-label="Minimum spend" class="absolute w-full cursor-pointer range-slider" /><input type="range" bind:value={spendRange.max} min={spendRange.min} max={SPEND_RANGE.MAX} step="1" on:change={updateFilters} aria-label="Maximum spend" class="absolute w-full cursor-pointer range-slider" /></div>
    </div>
    
    <div>
      <div class="text-gray2 text-xs font-bold flex items-center justify-between mb-2">
         <span>Tickets: {ticketsRange.min}-{ticketsRange.max === TICKETS_RANGE.MAX ? `${TICKETS_RANGE.MAX - 1}+` : ticketsRange.max}</span>
        <button on:click={resetTicketsRange} class="text-gray2 hover:text-lime transition-colors cursor-pointer" aria-label="Reset tickets range" title="Reset tickets range"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg></button>
      </div>
      <div class="relative h-2"><div class="absolute inset-0 bg-gray1 rounded-full"></div><div class="absolute h-full bg-lime rounded-full" style="left: {((ticketsRange.min - TICKETS_RANGE.MIN) / (TICKETS_RANGE.MAX - TICKETS_RANGE.MIN)) * 100}%; right: {((TICKETS_RANGE.MAX - ticketsRange.max) / (TICKETS_RANGE.MAX - TICKETS_RANGE.MIN)) * 100}%;"></div><input type="range" bind:value={ticketsRange.min} min={TICKETS_RANGE.MIN} max={ticketsRange.max} on:change={updateFilters} aria-label="Minimum tickets" class="absolute w-full cursor-pointer range-slider" /><input type="range" bind:value={ticketsRange.max} min={ticketsRange.min} max={TICKETS_RANGE.MAX} on:change={updateFilters} aria-label="Maximum tickets" class="absolute w-full cursor-pointer range-slider" /></div>
    </div>
    
    <div>
      <div class="text-gray2 text-xs font-bold block mb-2">Gender</div>
      <div class="flex flex-wrap gap-2">
         {#each Object.entries(GENDER_OPTIONS) as [key, label]}
          <button on:click={() => toggleGender(key)} class="px-2 py-1 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer {genders.includes(key) ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}">{label}</button>
        {/each}
      </div>
    </div>
    
    <div class="opacity-50 pointer-events-none">
      <label for="country-filter" class="text-gray2 text-xs font-bold block mb-2">Country (Coming Soon)</label>
      <input id="country-filter" type="text" placeholder="Filter by country..." disabled class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-xs placeholder-gray2" />
    </div>
  </div>
</div>

<style>
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: var(--color-navbar); }
  ::-webkit-scrollbar-thumb { background: var(--color-gray1); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--color-gray2); }
  .range-slider { -webkit-appearance: none; appearance: none; height: 8px; background: transparent; pointer-events: none; }
  .range-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; background: var(--color-lime); border-radius: 50%; cursor: pointer; pointer-events: all; position: relative; z-index: 3; transition: transform 0.1s ease-in-out; }
  .range-slider::-webkit-slider-thumb:hover { transform: scale(1.1); }
  .range-slider::-moz-range-thumb { width: 16px; height: 16px; background: var(--color-lime); border-radius: 50%; cursor: pointer; border: none; pointer-events: all; transition: transform 0.1s ease-in-out; }
  .range-slider::-moz-range-thumb:hover { transform: scale(1.1); }
  input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.8) brightness(100%) sepia(100%) hue-rotate(50deg) saturate(500%); cursor: pointer; }
</style>