<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;

  const dispatch = createEventDispatcher();

  function closeSidebar() {
    dispatch('close');
  }

  // Handle keyboard interaction for the backdrop (Accessibility fix)
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      closeSidebar();
    }
  }
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 bg-black/50 z-40 cursor-pointer" 
    transition:fade={{ duration: 200 }} 
    on:click={closeSidebar} 
    on:keydown={handleKeydown}
    role="button"
    tabindex="0"
    aria-label="Close sidebar backdrop"
  ></div>
  
  <aside 
    class="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col" 
    transition:fly={{ x: '100%', duration: 300 }}
  >
    <div class="p-4 flex justify-between items-center border-b">
      <h2 class="text-lg font-semibold">Settings</h2>
      
      <button 
        on:click={closeSidebar} 
        class="p-2 hover:bg-gray-100 rounded-full text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Close sidebar"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
    
    <div class="p-4 flex-1 overflow-y-auto">
      <slot />
    </div>
  </aside>
{/if}