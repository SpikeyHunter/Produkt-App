<script context="module" lang="ts">
  // Move this to context="module" so it can be imported by +page.svelte
  export type FilterType = 'none' | 'a-z' | 'z-a' | 'date-asc' | 'date-desc';
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let currentFilter: FilterType = 'none';

  const dispatch = createEventDispatcher<{
    filterChange: { filter: FilterType };
  }>();

  // Define options explicitly to satisfy TypeScript in the #each loop
  const filterOptions: FilterType[] = ['a-z', 'z-a', 'date-asc', 'date-desc'];

  let isFilterExpanded = false;
  let filterContainer: HTMLDivElement;

  onMount(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterContainer && !filterContainer.contains(event.target as Node) && isFilterExpanded) {
        isFilterExpanded = false;
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  function toggleFilterExpansion(event: Event) {
    event.stopPropagation();
    isFilterExpanded = !isFilterExpanded;
  }

  function selectFilter(filter: FilterType, event: Event) {
    event.stopPropagation();
    currentFilter = filter;
    dispatch('filterChange', { filter });
    // isFilterExpanded = false; // Uncomment if you want it to close on select
  }

  function clearFilter(event: Event) {
    event.stopPropagation();
    currentFilter = 'none';
    isFilterExpanded = false;
    dispatch('filterChange', { filter: 'none' });
  }

  function getFilterDisplayText(filter: FilterType): string {
    switch (filter) {
      case 'a-z': return 'A-Z';
      case 'z-a': return 'Z-A';
      case 'date-asc': return 'Date ↑';
      case 'date-desc': return 'Date ↓';
      default: return 'Filter Events';
    }
  }
</script>

<div class="filter-container relative z-20" bind:this={filterContainer}>
  {#if currentFilter !== 'none' && !isFilterExpanded}
    <button 
      on:click={clearFilter}
      class="h-7.5 pl-4 pr-8 flex items-center justify-start rounded-full font-bold text-sm bg-lime text-black border border-lime cursor-pointer transition-all duration-200 min-w-[100px] relative whitespace-nowrap"
    >
      <span>{getFilterDisplayText(currentFilter)}</span>
      <svg class="w-4 h-4 absolute right-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  {:else}
    <div class="flex items-center">
      <button 
        on:click={toggleFilterExpansion}
        class="h-7.5 pl-4 pr-8 flex items-center justify-start rounded-full font-bold text-sm border cursor-pointer transition-all duration-200 min-w-[120px] relative whitespace-nowrap gap-2 {isFilterExpanded ? 'bg-lime text-black border-lime' : 'bg-transparent text-gray2 border-gray2 hover:border-lime hover:text-lime'}"
      >
        <span>Filter Events</span>
        
        {#if isFilterExpanded}
          <div class="flex gap-2 ml-2 animate-slide-in overflow-hidden">
            {#each filterOptions as option}
              <div 
                class="px-3 py-0.5 rounded-full text-xs font-bold border cursor-pointer transition-colors whitespace-nowrap {currentFilter === option ? 'bg-black text-lime border-black' : 'bg-black/20 text-black border-black/20 hover:bg-black hover:text-lime'}"
                on:click={(e) => selectFilter(option, e)}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && selectFilter(option, e)}
              >
                {getFilterDisplayText(option)}
              </div>
            {/each}
          </div>
        {/if}

        <svg 
          class="w-4 h-4 absolute right-3 transition-transform duration-200 {isFilterExpanded ? 'rotate-180' : ''}" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
        >
          <polyline points="9,18 15,12 9,6"/>
        </svg>
      </button>
    </div>
  {/if}
</div>

<style>
  .animate-slide-in {
    animation: slideIn 0.2s ease-out forwards;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }
</style>