<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let x: number;
  export let y: number;
  export let hasHistory: boolean = true; 
  export let checkingHistory: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  const actions = [
    { label: 'Add Row Above', action: 'addAbove' },
    { label: 'Add Row Below', action: 'addBelow' },
    { label: 'Duplicate Row', action: 'duplicate' },
    { type: 'separator' },
    { label: 'Cut', action: 'cut', shortcut: '⌘X' },
    { label: 'Copy', action: 'copy', shortcut: '⌘C' },
    { label: 'Paste', action: 'paste', shortcut: '⌘V' },
    { label: 'Show Cell History', action: 'showHistory', icon: 'clock' },
    { type: 'separator' },
    { label: 'Clear Contents', action: 'clear' },
    { label: 'Delete Row', action: 'delete', danger: true },
  ];
</script>

<div 
  class="fixed z-50 min-w-[180px] bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl py-1 text-sm text-gray-200"
  style="top: {y}px; left: {x}px;"
  role="menu"
  tabindex="-1"
  on:click|stopPropagation
  on:keydown
>
  {#each actions as item}
    {#if item.type === 'separator'}
      <div class="h-px bg-[#333] my-1 mx-2"></div>
    {:else}
        {@const isDisabled = item.action === 'showHistory' && (!hasHistory || checkingHistory)}
      <button 
        type="button"
        disabled={isDisabled}
        class="w-full text-left px-3 py-1.5 hover:bg-[#333] cursor-pointer flex items-center justify-between group
               {item.danger ? 'text-red-400 hover:text-red-300' : ''} 
               {isDisabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}"
        on:click={() => !isDisabled && dispatch('action', item.action)}
      >
        <span class="flex items-center gap-2">
            {item.label}
            {#if item.action === 'showHistory' && checkingHistory}
                <span class="w-2 h-2 border-2 border-gray-500 border-t-lime rounded-full animate-spin"></span>
            {/if}
        </span>
        {#if item.shortcut}
            <span class="text-[10px] text-gray-500 font-mono ml-4">{item.shortcut}</span>
        {/if}
      </button>
    {/if}
  {/each}
</div>