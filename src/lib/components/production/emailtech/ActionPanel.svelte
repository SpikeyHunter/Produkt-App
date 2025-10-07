<!-- src/lib/components/production/emailtech/ActionPanel.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let emailContent = '';
  export let selectedRecipients: any[] = [];
  // Removed isSaving since it's not used in this simplified version
  
  const dispatch = createEventDispatcher();

  function sendEmail() {
    if (!emailContent || selectedRecipients.length === 0) return;
    dispatch('send', { content: emailContent, recipients: selectedRecipients });
  }

  $: hasContent = emailContent && emailContent.trim().length > 0;
</script>

<div class="h-full flex flex-col bg-navbar border border-gray1 rounded-xl">
  <!-- Email Actions -->
  <div class="p-4">
    <h3 class="text-white text-sm font-bold mb-3">Email Actions</h3>
    
    <!-- Send Email Button -->
    <button
      type="button"
      on:click={sendEmail}
      disabled={!hasContent || selectedRecipients.length === 0}
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

    <!-- Status Info -->
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