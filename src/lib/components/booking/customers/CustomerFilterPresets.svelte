<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let activePreset: string = '';
  
  const dispatch = createEventDispatcher();

  type FilterPreset = {
    id: string;
    name: string;
    description: string;
    filters: any;
  };
  
  const presets: FilterPreset[] = [
    {
      id: 'high-spenders',
      name: 'High Spenders',
      description: 'Customers who spent +$500',
      filters: {
        spendRange: { min: 500, max: 2000 }
      }
    },
    {
      id: 'frequent-buyers',
      name: 'Frequent Buyers',
      description: '10+ tickets purchased',
      filters: {
        ticketsRange: { min: 10, max: 101 } // Use 101 for 100+
      }
    },
    {
      id: 'young-adults',
      name: 'Young Adults',
      description: 'Ages 18-25',
      filters: {
        ageRange: { min: 18, max: 25 }
      }
    },
    {
      id: 'older-adults',
      name: 'Older Adults',
      description: 'Ages 40+',
      filters: {
        ageRange: { min: 40, max: 80 }
      }
    },
    {
      id: 'recent-active',
      name: 'Recently Active',
      description: 'Purchased in last 30 days',
      filters: {
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        }
      }
    }
  ];

  function selectPreset(preset: FilterPreset) {
    if (activePreset === preset.id) {
      clearPreset();
    } else {
      activePreset = preset.id;
      // Create a complete filter object with all defaults, then override with preset values
      const completeFilters = {
        venues: [],
        genres: [],
        genders: [],
        selectedEvents: [],
        ageRange: { min: 18, max: 80 },
        spendRange: { min: 0, max: 2000 },
        // FIX: Default ticketsRange max is now 101
        ticketsRange: { min: 0, max: 101 },
        dateRange: { start: '', end: '' },
        ...preset.filters
      };
      dispatch('selectPreset', completeFilters);
    }
  }
  
  function clearPreset() {
    activePreset = '';
    dispatch('clearPreset');
  }
</script>

<div class="bg-navbar border border-gray1 rounded-xl p-4">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-white text-sm font-bold">Quick Filters</h3>
    {#if activePreset}
      <button
        on:click={clearPreset}
        class="text-gray2 hover:text-lime transition-colors text-xs cursor-pointer"
      >
        Clear
      </button>
    {/if}
  </div>
  
  <div class="flex flex-wrap gap-2">
    {#each presets as preset}
      <button
        on:click={() => selectPreset(preset)}
        class="group relative cursor-pointer"
        aria-label="Apply preset: {preset.name}"
      >
        <div
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200
                 {activePreset === preset.id
                   ? 'bg-lime text-black'
                   : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
        >
          {preset.name}
        </div>
        
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs
                    pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
          <div class="bg-black text-white text-xs px-2 py-1 rounded shadow-lg">
            {preset.description}
          </div>
        </div>
      </button>
    {/each}
  </div>
</div>