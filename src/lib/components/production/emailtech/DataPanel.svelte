<!-- src/lib/components/production/emailtech/DataPanel.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { EmailTechEvent, CrewAssignments } from '$lib/types/emailtech';
  import { techTemplateSections } from '$lib/services/techTemplateService';
  import { updateEventEmailData } from '$lib/services/emailtechService'; // CHANGE: Added import

  export let events: EmailTechEvent[] = [];
  export let crewAssignments: CrewAssignments = {};
  export let templateType: 'tech' | 'vj' = 'tech';
  export let eventId: number | null = null;

  const dispatch = createEventDispatcher();

  let sections = techTemplateSections.map(s => ({
    id: s.id,
    label: s.label,
    included: false
  }));

  // CHANGE: Load saved sections from database when event or template type changes
  $: if (eventId !== null && templateType === 'tech') {
    loadSavedSections();
  }

  // VJ template doesn't use sections, so hide them
  $: showSections = templateType === 'tech';

  // CHANGE: Now loads from events[0].email_data instead of localStorage
  function loadSavedSections() {
    if (!eventId || events.length === 0) return;
    
    const mainEvent = events[0];
    const emailData = mainEvent.email_data || {};
    const savedIds = emailData[`${templateType}_sections`] || [];
    
    sections = sections.map(s => ({
      ...s,
      included: savedIds.includes(s.id)
    }));
    
    dispatch('sectionsChange', sections);
  }

  // NEW FUNCTION: Saves sections to database instead of localStorage
  async function saveSectionsToDatabase() {
    if (!eventId) return;
    
    const includedIds = sections.filter(s => s.included).map(s => s.id);
    await updateEventEmailData(eventId, templateType, includedIds);
    
    // Update local event data
    if (events.length > 0) {
      const mainEvent = events[0];
      const emailData = mainEvent.email_data || {};
      mainEvent.email_data = {
        ...emailData,
        [`${templateType}_sections`]: includedIds
      };
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'TBD';
    try {
      const utcDate = new Date(dateString);
      if (isNaN(utcDate.getTime())) return dateString;
      const date = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
      const day = date.getDate();
      const month = date.toLocaleString('en-US', { month: 'long' });
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    } catch {
      return dateString;
    }
  }

  // CHANGE: Now calls saveSectionsToDatabase() instead of saveSectionsToStorage()
  function toggleSection(sectionId: string) {
    sections = sections.map(s => 
      s.id === sectionId ? { ...s, included: !s.included } : s
    );
    dispatch('sectionsChange', sections);
    saveSectionsToDatabase();
  }

  function selectAllSections() {
    sections = sections.map(s => ({ ...s, included: true }));
    dispatch('sectionsChange', sections);
    saveSectionsToDatabase();
  }

  function clearAllSections() {
    sections = sections.map(s => ({ ...s, included: false }));
    dispatch('sectionsChange', sections);
    saveSectionsToDatabase();
  }
</script>

{#if events.length > 0}
  <div class="p-3 border-b border-t border-gray1">
    <div class="flex gap-3 items-center">
      <div class="w-1/4 flex-shrink-0">
        {#if events.length === 2}
          <div class="flex flex-col gap-1">
            {#each events as evt}
              <div class="bg-gray1 rounded-md overflow-hidden aspect-square relative">
                {#if evt.event_flyer}
                  <img src={evt.event_flyer} alt={evt.event_name} class="w-full h-full object-cover" />
                {:else}
                  <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray1 to-gray2">
                    <svg class="w-6 h-6 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                {/if}
                {#if evt.event_status}
                  <div class="absolute top-0.5 right-0.5 px-1.5 py-0 rounded-full text-[9px] font-bold
                    {evt.event_status.toLowerCase() === 'live' ? 'bg-lime text-black' : 'bg-gray-600 text-white'}">
                    {evt.event_status.toUpperCase()}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="bg-gray1 rounded-lg overflow-hidden relative">
            {#if events[0].event_flyer}
              <img src={events[0].event_flyer} alt={events[0].event_name} class="w-full h-auto object-cover block" />
            {:else}
              <div class="w-full aspect-[4/5] flex flex-col items-center justify-center bg-gradient-to-br from-gray1 to-gray2">
                <svg class="w-8 h-8 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            {/if}
            {#if events[0].event_status}
              <div class="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                {events[0].event_status.toLowerCase() === 'live' ? 'bg-lime text-black' : 'bg-gray-600 text-white'}">
                {events[0].event_status.toUpperCase()}
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex-1 flex flex-col">
        <h2 class="text-sm font-bold text-white leading-tight mb-1">
          {events.map(e => e.event_name).join(' & ')}
        </h2>
        {#if events.length === 1}
          <div class="w-full border-t border-gray1 mb-1"></div>
        {/if}
        
        {#each events as evt, i}
          {#if events.length > 1}
             <div class="text-[11px] font-bold text-gray3">{evt.event_venue}</div>
          {/if}
          <div class="text-[11px] flex gap-2 items-center leading-normal">
            <span class="text-gray3 min-w-[45px]">Event ID:</span>
            <span class="text-white">{evt.event_id || 'N/A'}</span>
          </div>
          <div class="text-[11px] flex gap-2 items-center leading-normal">
            <span class="text-gray3 min-w-[45px]">Date:</span>
            <span class="text-white">{formatDate(evt.event_date)}</span>
          </div>
          {#if events.length === 1}
            <div class="text-[11px] flex gap-2 items-center leading-normal">
              <span class="text-gray3 min-w-[45px]">Venue:</span>
              <span class="text-white">{evt.event_venue || 'N/A'}</span>
            </div>
          {/if}
          {#if i < events.length - 1}
            <div class="w-full border-t border-gray1 my-1"></div>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  <!-- Crew Assignments Display -->
  {#if Object.keys(crewAssignments).length > 0}
    <div class="p-3 border-b border-gray1">
      <h4 class="text-white text-xs font-bold mb-2">Crew Assignments</h4>
      <div class="space-y-1">
        {#each Object.entries(crewAssignments) as [role, name]}
          <div class="flex items-center gap-2 text-[11px]">
            <span class="text-gray3 w-20">{role}:</span>
            <span class="text-white">{name}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="border-t border-gray1 mx-4"></div>
{/if}

{#if showSections}
  <div class="p-3 border-b border-gray1 flex-shrink-0">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-white text-sm font-bold">Template Sections</h3>
      <div class="flex gap-2">
        <button 
          type="button" 
          on:click={selectAllSections} 
          class="text-xs text-lime hover:text-white hover:cursor-pointer transition-colors cursor-pointer"
        >
          Auto-Fill
        </button>
        <button 
          type="button" 
          on:click={clearAllSections} 
          class="text-xs text-gray2 hover:text-problem hover:cursor-pointer transition-colors cursor-pointer"
        >
          Clear
        </button>
      </div>
    </div>
    <div class="text-gray2 text-xs">
      {#if events.length === 0}
        Select an event to view sections
      {:else}
        Click sections to include in template
      {/if}
    </div>
  </div>

  <div class="flex-1 overflow-y-auto p-3">
    {#if events.length > 0}
      <div class="space-y-0">
        {#each sections as section (section.id)}
          <button
            type="button"
            on:click={() => toggleSection(section.id)}
            class="w-full text-left px-2.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer mb-1.5
                   {section.included ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="font-bold text-xs">{section.label}</div>
              </div>
              <div class="flex-shrink-0 mt-0.5">
                {#if section.included}
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                {:else}
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      </div>
    {:else}
      <div class="flex flex-col items-center justify-center h-full text-center">
        <svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
        </svg>
        <p class="text-gray2 text-sm">No event selected</p>
      </div>
    {/if}
  </div>
{:else}
  <div class="flex-1 overflow-y-auto p-3">
    <div class="flex flex-col items-center justify-center h-full text-center">
      <svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
      </svg>
      <p class="text-gray2 text-sm font-bold mb-1">VJ Template Mode</p>
      <p class="text-gray2 text-xs">VJ templates use a simpler format</p>
    </div>
  </div>
{/if}

<style>
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--color-navbar); }
  ::-webkit-scrollbar-thumb { background: var(--color-gray1); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--color-gray2); }
</style>