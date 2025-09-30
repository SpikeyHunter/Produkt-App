<script lang="ts">
  export let title: string;
  export let titleClass: string = 'text-lime'; // Default to lime
  
  // This allows passing a 'class' attribute, like 'h-full'
  let extraClasses = '';
  export { extraClasses as class };
</script>

<section class="bg-navbar/60 rounded-2xl overflow-hidden backdrop-blur {extraClasses}">
  <div class="bg-navbar px-6 py-3">
    <h2 class="{titleClass} text-lg font-bold tracking-tight">{title}</h2>
  </div>
  <div class="p-5 h-full">
    <slot />
  </div>
</section>