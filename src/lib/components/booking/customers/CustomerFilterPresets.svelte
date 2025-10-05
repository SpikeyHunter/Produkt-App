<!-- src/lib/components/booking/customers/CustomerFilterPresets.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/buttons/Button.svelte';
  
  export let activePreset: string = '';
  
  const dispatch = createEventDispatcher();
  
  interface FilterPreset {
    id: string;
    name: string;
    description: string;
    filters: any;
  }
  
  const presets: FilterPreset[] = [
    {
      id: 'high-value',
      name: 'High Value',
      description: 'Customers who spent $500+',
      filters: {
        spendRange: { min: 500, max: 10000 }
      }
    },
    {
      id: 'frequent',
      name: 'Frequent Buyers',
      description: '10+ tickets purchased',
      filters: {
        ticketsRange: { min: 10, max: 1000 }
      }
    },
    {
      id: 'ncg-regulars',
      name: 'NCG Regulars',
      description: 'New City Gas attendees',
      filters: {
        venues: ['New City Gas']
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
      id: 'recent-active',
      name: 'Recently Active',
      description: 'Purchased in last 30 days',
      filters: {
        recentDays: 30
      }
    }
  ];
  
  function selectPreset(preset: FilterPreset) {
    activePreset = preset.id;
    dispatch('selectPreset', preset.filters);
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
        class="text-gray2 hover:text-lime transition-colors text-xs"
      >
        Clear
      </button>
    {/if}
  </div>
  
  <div class="flex flex-wrap gap-2">
    {#each presets as preset}
      <button
        on:click={() => selectPreset(preset)}
        class="group relative"
      >
        <div
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200
                 {activePreset === preset.id
                   ? 'bg-lime text-black'
                   : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
        >
          {preset.name}
        </div>
        
        <!-- Tooltip -->
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none
                    opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div class="bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            {preset.description}
          </div>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  /* Add any custom styles here */
</style>