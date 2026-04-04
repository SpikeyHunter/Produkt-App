<script context="module" lang="ts">
    export type SortType = 'none' | 'a-z' | 'z-a' | 'price-asc' | 'price-desc';
  </script>
  
  <script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    
    export let currentSort: SortType = 'none';
    export let currentType: string = 'none';
    export let availableTypes: string[] = [];
  
    const dispatch = createEventDispatcher<{
      sortChange: { sort: SortType };
      typeChange: { type: string };
    }>();
  
    let isSortExpanded = false;
    let isTypeExpanded = false;
    let filterContainer: HTMLDivElement;
    let typeContainer: HTMLDivElement;
  
    const typeColors: Record<string, string> = {
      'white wine': '#f8ebc0',
      'red wine': '#e05959',
      'rosé': '#f7a3b1',
      'natural wines': '#bcce7c',
      'orange wines': '#fd9c5c',
      'dessert wines': '#e097c4',
      'scotch': '#f17127',
      'whiskey': '#f17127',
      'liqueur': '#e6b294',
      'cream': '#e6b294',
      'gin': '#8ab5ee',
      'rum': '#c79357',
      'vodka': '#dfe4e7',
      'tequila': '#eec84d',
      'cognac': '#e49217',
      'brandy': '#e49217',
      'champagne': '#f5d3a0',
      'sparkling wine': '#f5d3a0',
      'proseco': '#f5d3a0'
    };
  
    function getColorForType(typeRaw: string): string {
      if (!typeRaw) return 'var(--color-gray3)';
      const cleanType = typeRaw.toLowerCase().trim();
      if (typeColors[cleanType]) return typeColors[cleanType];
      for (const [key, color] of Object.entries(typeColors)) {
          if (cleanType.includes(key) || key.includes(cleanType.replace('vin ', '').replace(' wine', ''))) {
              return color;
          }
      }
      return 'var(--color-gray3)';
    }
  
    onMount(() => {
      function handleClickOutside(event: MouseEvent) {
        if (filterContainer && !filterContainer.contains(event.target as Node)) {
          isSortExpanded = false;
        }
        if (typeContainer && !typeContainer.contains(event.target as Node)) {
          isTypeExpanded = false;
        }
      }
      document.addEventListener('click', handleClickOutside);
  
      return () => document.removeEventListener('click', handleClickOutside);
    });
  
    // Custom action to stop propagation without triggering a11y warnings
    function stopProp(node: HTMLElement) {
      const handle = (e: Event) => e.stopPropagation();
      node.addEventListener('click', handle);
      return {
        destroy() {
          node.removeEventListener('click', handle);
        }
      };
    }
  
    function toggleSortExpansion(event: Event) {
      event.stopPropagation();
      isSortExpanded = !isSortExpanded;
      isTypeExpanded = false;
    }
  
    function selectSort(sort: SortType, event: Event) {
      event.stopPropagation();
      currentSort = sort;
      dispatch('sortChange', { sort });
      isSortExpanded = false;
    }
  
    function clearSort(event: Event) {
      event.stopPropagation();
      currentSort = 'none';
      isSortExpanded = false;
      dispatch('sortChange', { sort: 'none' });
    }
  
    function handleSortClick(event: Event) {
      const target = event.target as Element;
      if (target.closest('.filter-clear-icon')) {
        clearSort(event);
      } else {
        toggleSortExpansion(event);
      }
    }
  
    function getSortDisplayText(sort: SortType): string {
      switch (sort) {
        case 'a-z': return 'A-Z';
        case 'z-a': return 'Z-A';
        case 'price-asc': return '$ > $$$';
        case 'price-desc': return '$$$ > $';
        default: return 'Sort By';
      }
    }
  
    function toggleTypeExpansion(event: Event) {
      event.stopPropagation();
      isTypeExpanded = !isTypeExpanded;
      isSortExpanded = false;
    }
  
    function selectType(type: string, event: Event) {
      event.stopPropagation();
      currentType = type;
      dispatch('typeChange', { type });
      isTypeExpanded = false;
    }
  
    function clearType(event: Event) {
      event.stopPropagation();
      currentType = 'none';
      isTypeExpanded = false;
      dispatch('typeChange', { type: 'none' });
    }
  
    function handleTypeClick(event: Event) {
      const target = event.target as Element;
      if (target.closest('.filter-clear-icon')) {
        clearType(event);
      } else {
        toggleTypeExpansion(event);
      }
    }
  
    function getTypeDisplayText(type: string): string {
        if (type === 'none') return 'Filter by Type';
        return type;
    }
  </script>
  
  <div class="flex gap-2 flex-wrap">
    
    <div class="filter-container" bind:this={filterContainer}>
      {#if currentSort !== 'none' && !isSortExpanded}
        <button type="button" on:click={handleSortClick} class="filter-events-btn active-saved">
          <span class="filter-main-text">{getSortDisplayText(currentSort)}</span>
          <svg class="filter-clear-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      {:else}
        <div class="filter-button-wrapper">
          <div 
            role="button" 
            tabindex="0"
            on:click={toggleSortExpansion} 
            on:keydown={(e) => e.key === 'Enter' && toggleSortExpansion(e)}
            class="filter-events-btn {isSortExpanded ? 'expanded' : ''}"
            style={isSortExpanded ? 'padding-right: 12px;' : ''}
          >
            <span class="filter-main-text">Sort By</span>
            
            {#if !isSortExpanded}
              <svg class="filter-arrow {isSortExpanded ? 'rotated' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            {/if}
            
            {#if isSortExpanded}
              <div class="filter-options" use:stopProp>
                <button type="button" class="filter-option {currentSort === 'a-z' ? 'selected' : ''}" on:click={(e) => selectSort('a-z', e)}>A-Z</button>
                <button type="button" class="filter-option {currentSort === 'z-a' ? 'selected' : ''}" on:click={(e) => selectSort('z-a', e)}>Z-A</button>
                <button type="button" class="filter-option {currentSort === 'price-asc' ? 'selected' : ''}" on:click={(e) => selectSort('price-asc', e)}>$</button>
                <button type="button" class="filter-option {currentSort === 'price-desc' ? 'selected' : ''}" on:click={(e) => selectSort('price-desc', e)}>$$$</button>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  
    {#if availableTypes.length > 0}
    <div class="filter-container" bind:this={typeContainer}>
      {#if currentType !== 'none' && !isTypeExpanded}
        <button type="button" on:click={handleTypeClick} class="filter-events-btn active-saved">
          <span class="flex items-center gap-2">
             <span class="w-3 h-3 rounded-full shrink-0" style="background-color: {getColorForType(currentType)};"></span>
             <span class="filter-main-text">{getTypeDisplayText(currentType)}</span>
          </span>
          <svg class="filter-clear-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      {:else}
        <div class="filter-button-wrapper">
          <button type="button" on:click={toggleTypeExpansion} class="filter-events-btn {isTypeExpanded ? 'expanded' : ''}">
            <span class="filter-main-text">Filter by Type</span>
            <svg class="filter-arrow {isTypeExpanded ? 'rotated' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </button>
  
          {#if isTypeExpanded}
            <div class="absolute top-[36px] right-0 sm:left-0 w-max min-w-[12rem] bg-navbar border border-gray2/20 rounded-xl shadow-2xl py-2 z-50 overflow-hidden max-h-[300px] overflow-y-auto">
              {#each availableTypes as type}
                 <button 
                    type="button"
                    class="w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer flex items-center gap-3 {currentType === type ? 'bg-lime/10 text-lime font-bold' : 'text-gray3 hover:bg-white/5 hover:text-white font-medium'}"
                    on:click={(e) => selectType(type, e)}
                 >
                    <span class="w-3 h-3 rounded-full shrink-0" style="background-color: {getColorForType(type)};"></span>
                    <span class="whitespace-nowrap">{type}</span>
                  </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
    {/if}
  
  </div>
  
  <style>
    .filter-container { position: relative; }
    .filter-button-wrapper { position: relative; display: flex; align-items: center; }
   
    .filter-events-btn {
      height: 28px; padding-left: 12px; padding-right: 32px; display: flex; align-items: center; justify-content: flex-start;
      border-radius: 14px; font-family: var(--font-helvetica, sans-serif); font-size: 14px; line-height: 22px; font-weight: 700;
      background: var(--color-gray3, #333); color: var(--color-black, #fff); border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.2s ease; white-space: nowrap; width: max-content; gap: 8px; overflow: visible; position: relative;
    }
    .filter-events-btn.expanded { background: var(--color-lime, #a3e635); color: var(--color-black, #000); }
    .filter-events-btn:hover { background: var(--color-lime, #a3e635); color: var(--color-black, #000); }
    .filter-arrow { width: 16px; height: 16px; transition: transform 0.25s ease; flex-shrink: 0; position: absolute; right: 8px; cursor: pointer; }
    .filter-arrow.rotated { transform: rotate(180deg); }
    .filter-main-text { flex-shrink: 0; }
    
    .filter-options {
      display: flex; gap: 6px; opacity: 0; transform: translateX(-5px);
      transition: all 0.25s ease;
      animation: slideIn 0.25s ease-out 0.1s forwards; margin-left: 8px;
    }
    @keyframes slideIn { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }
    
    .filter-option {
      padding: 2px 8px; background: var(--color-navbar, #1a1a1a);
      color: var(--color-lime, #a3e635); border: 1px solid var(--color-lime, #a3e635);
      border-radius: 20px; cursor: pointer; font-family: var(--font-helvetica, sans-serif); font-size: 12px; font-weight: 700;
      transition: all 0.2s ease; white-space: nowrap; flex-shrink: 0;
    }
    .filter-option:hover { background: var(--color-lime, #a3e635); color: var(--color-black, #000); }
    .filter-option.selected { background: var(--color-lime, #a3e635); color: var(--color-black, #000); }
    
    .filter-events-btn.active-saved { background: var(--color-lime, #a3e635); color: var(--color-black, #000); border: 1px solid var(--color-lime, #a3e635); width: max-content; padding-right: 32px; }
    .filter-events-btn.active-saved:hover { opacity: 0.9; }
    .filter-clear-icon { width: 16px; height: 16px; flex-shrink: 0; position: absolute; right: 8px; cursor: pointer; }
  </style>