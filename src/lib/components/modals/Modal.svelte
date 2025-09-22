<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let isOpen = false;
  export let title = '';
  export let maxWidth = 'max-w-lg'; // 'max-w-sm', 'max-w-md', 'max-w-lg', 'max-w-xl', 'max-w-2xl', etc.
  export let showHeader = true;
  export let showCloseButton = true;
  export let closeOnBackdropClick = true;
  export let hasFooter = false; // New prop to control footer visibility
  
  const dispatch = createEventDispatcher();
  let isClosing = false;
  
  function closeModal() {
    isClosing = true;
    setTimeout(() => {
      dispatch('close');
      isClosing = false;
    }, 200); // Match animation duration
  }
  
  function handleBackdropClick(event: MouseEvent) {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      closeModal();
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      closeModal();
    }
  }
</script>

<style>
 .modal-backdrop {
   backdrop-filter: blur(6px) !important;
   background: rgba(0, 0, 0, 0.75) !important;
   position: fixed !important;
   top: 0 !important;
   left: 0 !important;
   right: 0 !important;
   bottom: 0 !important;
   z-index: 99999 !important;
 }
 
.modal-enter {
  animation: modalEnter 0.3s ease-out forwards;
 }
.modal-exit {
  animation: modalExit 0.2s ease-in forwards;
 }
.backdrop-enter {
  animation: backdropEnter 0.3s ease-out forwards;
 }
.backdrop-exit {
  animation: backdropExit 0.2s ease-in forwards;
 }
@keyframes modalEnter {
 from {
   opacity: 0;
   transform: translateY(20px);
 }
 to {
   opacity: 1;
   transform: translateY(0);
 }
 }
@keyframes modalExit {
 from {
   opacity: 1;
   transform: translateY(0);
 }
 to {
   opacity: 0;
   transform: translateY(20px);
 }
 }
@keyframes backdropEnter {
 from {
   opacity: 0;
 }
 to {
   opacity: 1;
 }
 }
@keyframes backdropExit {
 from {
   opacity: 1;
 }
 to {
   opacity: 0;
 }
 }
</style>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <!-- Backdrop -->
  <div 
    class="modal-backdrop {isClosing ? 'backdrop-exit' : 'backdrop-enter'} flex items-center justify-center p-4 overflow-y-auto"
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'modal-title' : undefined}
    tabindex="-1"
  >
    <!-- Modal Container -->
    <div class="bg-navbar rounded-2xl shadow-2xl {maxWidth} w-full flex flex-col {isClosing ? 'modal-exit' : 'modal-enter'} border border-gray1 my-auto">
      
      <!-- Header -->
      {#if showHeader && (title || showCloseButton)}
        <div class="flex items-center justify-between p-6 border-b border-gray1 flex-shrink-0">
          {#if title}
            <h2 id="modal-title" class="text-xl font-bold text-white">{title}</h2>
          {:else}
            <div></div>
          {/if}
          
          {#if showCloseButton}
            <button
              on:click={closeModal}
              class="p-2 text-gray2 hover:text-white hover:bg-gray1 rounded-lg transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          {/if}
        </div>
      {/if}
      
      <!-- Content -->
      <div class="p-6">
        <slot />
      </div>
      
      <!-- Footer slot (optional) -->
      {#if hasFooter}
        <div class="px-6 pb-6 border-t border-gray1 pt-4">
          <slot name="footer" />
        </div>
      {/if}
      
    </div>
  </div>
{/if}