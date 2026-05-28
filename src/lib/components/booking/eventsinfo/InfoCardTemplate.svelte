<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  // Props for customization
  export let title: string = 'Info Card';
  
  // Display configurations
  export let showHeader: boolean = true;
  export let showFooter: boolean = true;

  // New prop to customize the padding of the content slot
  export let contentPadding: string = 'px-6 py-4';
  
  // Optional custom content
  export let headerContent: string = '';
  export let footerContent: string = '';
  
  const dispatch = createEventDispatcher();
</script>

<div 
  class="info-card flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300 w-full h-full"
>
  <!-- Header Section -->
  {#if showHeader}
    <div class="header-section border-b border-gray1">
      <div class="flex items-center justify-between px-6 py-3">
        <h2 class="text-xl font-normal text-white truncate">
          {title}
        </h2>
      </div>
      
      {#if headerContent}
        <div class="px-6 pb-3 text-sm text-gray2">
          {headerContent}
        </div>
      {/if}
    </div>
  {/if}
  
  <!-- Main Content Area -->
  <div class="flex-1 {contentPadding} overflow-auto">
    <slot />
  </div>
  
  <!-- Footer Section -->
  {#if showFooter && footerContent}
    <div class="footer-section border-t border-gray1">
      <div class="px-6 py-3">
        <div class="text-sm text-gray2">
          {footerContent}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .info-card {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }
  
  .header-section,
  .footer-section {
    background: bg-navbar;
  }
</style>