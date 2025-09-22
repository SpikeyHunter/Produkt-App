<script context="module" lang="ts">
  export type FilterType = 'none' | 'a-z' | 'z-a' | 'date-asc' | 'date-desc';
</script>

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let currentFilter: FilterType = 'none';

  const dispatch = createEventDispatcher<{
    filterChange: { filter: FilterType };
  }>();

  let isFilterExpanded = false;
  let filterContainer: HTMLDivElement;

  onMount(() => {
    // Click outside handler
    function handleClickOutside(event: MouseEvent) {
      if (filterContainer && !filterContainer.contains(event.target as Node) && isFilterExpanded) {
        isFilterExpanded = false;
      }
    }

    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  function toggleFilterExpansion(event: Event) {
    event.stopPropagation();
    isFilterExpanded = !isFilterExpanded;
  }

  function selectFilter(filter: FilterType, event: Event) {
    event.stopPropagation();
    currentFilter = filter;
    // Don't collapse automatically - let click outside handle it
    dispatch('filterChange', { filter });
  }

  function clearFilter(event: Event) {
    event.stopPropagation();
    currentFilter = 'none';
    isFilterExpanded = false;
    dispatch('filterChange', { filter: 'none' });
  }

  function handleButtonClick(event: Event) {
    // Check if the click target is the clear icon or its children
    const target = event.target as Element;
    if (target.closest('.filter-clear-icon')) {
      clearFilter(event);
    } else {
      toggleFilterExpansion(event);
    }
  }

  // Get display text for current filter
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

<div class="filter-container" bind:this={filterContainer}>
  {#if currentFilter !== 'none' && !isFilterExpanded}
    <!-- Clear Filter Button (when filter is active and collapsed) -->
    <button 
      on:click={handleButtonClick}
      class="filter-events-btn active-saved"
    >
      <span class="filter-main-text">
        {getFilterDisplayText(currentFilter)}
      </span>
      <svg 
        class="filter-clear-icon" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2"
      >
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  {:else}
    <!-- Regular Filter Button -->
    <div class="filter-button-wrapper">
      <button 
        on:click={toggleFilterExpansion}
        class="filter-events-btn {isFilterExpanded ? 'expanded' : ''}"
      >
        <span class="filter-main-text">
          Filter Events
        </span>
        
        <!-- Filter Options - shown when expanded -->
        {#if isFilterExpanded}
          <div class="filter-options">
            <div 
              class="filter-option {currentFilter === 'a-z' ? 'selected' : ''}"
              on:click={(e) => selectFilter('a-z', e)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && selectFilter('a-z', e)}
            >
              A-Z
            </div>
            <div 
              class="filter-option {currentFilter === 'z-a' ? 'selected' : ''}"
              on:click={(e) => selectFilter('z-a', e)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && selectFilter('z-a', e)}
            >
              Z-A
            </div>
            <div 
              class="filter-option {currentFilter === 'date-asc' ? 'selected' : ''}"
              on:click={(e) => selectFilter('date-asc', e)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && selectFilter('date-asc', e)}
            >
              Date ↑
            </div>
            <div 
              class="filter-option {currentFilter === 'date-desc' ? 'selected' : ''}"
              on:click={(e) => selectFilter('date-desc', e)}
              role="button"
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && selectFilter('date-desc', e)}
            >
              Date ↓
            </div>
          </div>
        {/if}
        
        <svg 
          class="filter-arrow {isFilterExpanded ? 'rotated' : ''}" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
          role="button"
          tabindex="0"
          aria-label="Toggle filter options"
        >
          <polyline points="9,18 15,12 9,6"/>
        </svg>
      </button>
    </div>
  {/if}
</div>

<style>
  /* Filter Container */
  .filter-container {
    position: relative;
  }

  /* Filter Button Wrapper */
  .filter-button-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  /* Expandable Filter Button */
  .filter-events-btn {
    height: 28px;
    padding-left: 12px;
    padding-right: 32px;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    border-radius: 14px;
    font-family: var(--font-helvetica);
    font-size: 14px;
    line-height: 22px;
    font-weight: 700;
    background: var(--color-gray3);
    color: var(--color-black);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    width: auto;
    min-width: 120px;
    gap: 8px;
    overflow: visible;
    position: relative;
  }

  .filter-events-btn.expanded {
    background: var(--color-lime);
    color: var(--color-black);
    gap: 8px;
  }

  .filter-events-btn:hover {
    background: var(--color-lime);
    color: var(--color-black);
  }

  .filter-arrow {
    width: 16px;
    height: 16px;
    transition: transform 0.25s ease;
    flex-shrink: 0;
    position: absolute;
    right: 8px;
    cursor: pointer;
  }

  .filter-arrow.rotated {
    transform: rotate(180deg);
  }

  .filter-main-text {
    flex-shrink: 0;
  }

  /* Filter Options - Inline when expanded */
  .filter-options {
    display: flex;
    gap: 6px;
    opacity: 0;
    transform: translateX(-5px);
    transition: all 0.25s ease;
    animation: slideIn 0.25s ease-out 0.1s forwards;
    margin-left: 12px;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-5px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .filter-option {
    padding: 2px 8px;
    background: var(--color-navbar);
    color: var(--color-lime);
    border: 1px solid var(--color-lime);
    border-radius: 20px;
    cursor: pointer;
    font-family: var(--font-helvetica);
    font-size: 12px;
    font-weight: 700;
    transition: all 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .filter-option:hover {
    background: var(--color-lime);
    color: var(--color-black);
  }

  .filter-option.selected {
    background: var(--color-lime);
    color: var(--color-black);
  }

  /* Active Saved Filter Button */
  .filter-events-btn.active-saved {
    background: var(--color-lime);
    color: var(--color-black);
    border: 1px solid var(--color-lime);
    width: auto;
    min-width: 80px;
    padding-right: 32px;
  }

  .filter-events-btn.active-saved:hover {
    background: var(--color-lime);
    opacity: 0.9;
  }

  .filter-clear-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    position: absolute;
    right: 8px;
    cursor: pointer;
  }
</style>