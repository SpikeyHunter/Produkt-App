<script lang="ts">
  export let label: string;
</script>

<div class="flex items-baseline">
  <span class="text-gray2 text-sm uppercase tracking-wider w-24">{label}:</span>
  <span class="text-white text-sm">
    <slot />
  </span>
</div>