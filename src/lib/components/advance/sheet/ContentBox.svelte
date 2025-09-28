<script lang="ts">
  // This setup allows you to pass a 'class' attribute to this component
  let extraClasses = '';
  export { extraClasses as class };
</script>

<div class="bg-black/30 rounded-xl p-4 {extraClasses}">
  <slot />
</div>