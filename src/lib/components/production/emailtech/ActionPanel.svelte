<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { EmailTechEvent } from '$lib/types/emailtech';
  
  export let emailContent = '';
  export let selectedRecipients: any[] = [];
  // UPDATED: Accept the array directly to ensure state stays in sync
  export let selectedEvents: EmailTechEvent[] = [];
  
  const dispatch = createEventDispatcher();

  // Reactive check: Enabled only if we have at least one event
  $: isEventSelected = selectedEvents && selectedEvents.length > 0;
  $: hasContent = emailContent && emailContent.trim().length > 0;

  function sendEmail() {
    if (!emailContent || selectedRecipients.length === 0 || !isEventSelected) return;
    dispatch('send', { content: emailContent, recipients: selectedRecipients });
  }
</script>

<div class="h-full flex flex-col bg-navbar border border-gray1 rounded-xl transition-all duration-300 
    {!isEventSelected ? 'opacity-50 grayscale cursor-not-allowed' : ''}">
  
  <div class="h-full flex flex-col {!isEventSelected ? 'pointer-events-none' : ''}">
    <div class="p-4">
      <h3 class="text-white text-sm font-bold mb-3">Email Actions</h3>
      
      <button
        type="button"
        on:click={sendEmail}
        disabled={!hasContent || selectedRecipients.length === 0 || !isEventSelected}
        class="w-full bg-lime text-black rounded-lg px-4 py-3 text-sm font-bold
               flex items-center justify-center gap-2 hover:bg-white 
               transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
        Send Email
      </button>
  
      <div class="mt-4 space-y-2 text-xs">
        <div class="flex items-center justify-between py-2 border-b border-gray1">
          <span class="text-gray2">Content:</span>
          <span class="text-white font-bold">
            {#if hasContent}
              <span class="text-lime">Ready</span>
            {:else}
              <span class="text-gray2">Empty</span>
            {/if}
          </span>
        </div>
        
        <div class="flex items-center justify-between py-2">
          <span class="text-gray2">Recipients:</span>
          <span class="text-white font-bold">
            {selectedRecipients.length} selected
          </span>
        </div>
      </div>
    </div>
  </div>
</div>