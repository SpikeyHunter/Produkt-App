<script>
  // @ts-nocheck
  export let variant = 'filled'; 
  export let width = 'w-auto';
  export let height = 'h-auto'; // Add height parameter
  export let type = 'button';
  export let disabled = false;
  
  $: classes = [
    
    variant === 'slim' 
      ? 'font-bold text-center rounded-xl px-3 py-1 text-xs transition-all duration-200'
    : variant === 'invisible' 
      ? 'font-bold text-center  text-m transition-all duration-200'
      : variant === 'gray'
      ? 'font-bold text-center rounded-xl px-3 py-1 text-xs transition-all duration-200'
      : 'font-bold text-center rounded-3xl px-6 py-3 transition-all duration-200',

    variant === 'filled' && 'bg-gray3 text-black hover:bg-lime hover:text-black cursor-pointer',
    variant === 'outline' && 'bg-transparent border-2 border-lime text-lime hover:bg-lime hover:!text-black cursor-pointer',
    variant === 'slim' && 'bg-transparent border border-lime text-lime hover:!text-black hover:!bg-lime cursor-pointer',
    variant === 'invisible' && 'bg-transparent border border-transparent text-lime cursor-pointer',
    variant === 'gray' && 'bg-gray2 text-black hover:bg-lime hover:text-black cursor-pointer',  
    variant === 'blocked' && 'bg-gray3 text-black cursor-not-allowed',
    variant === 'loading' && 'bg-lime text-black cursor-not-allowed',   
    width,  
    height, // Add height to classes

    disabled && 'opacity-50 cursor-not-allowed hover:bg-gray2 hover:text-black'
  ].filter(Boolean).join(' ');
</script>

<style>
  .spinner {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>

<button 
  type={type} 
  class={classes} 
  {disabled}
  on:click
>
  {#if variant === 'loading'}
    <div class="flex items-center justify-center gap-2">
      <!-- Spinning circle -->
      <div class="spinner w-4 h-4 border-2 border-black border-t-transparent rounded-full"></div>
      <slot />
    </div>
  {:else}
    <slot />
  {/if}
</button>