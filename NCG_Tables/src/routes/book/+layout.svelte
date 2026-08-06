<script lang="ts">
  import { app } from '$lib/stores/app.svelte';

  let { children } = $props();

  const fontFamily = $derived(
    app.theme.font === 'marcellus' ? "'Marcellus', serif"
    : app.theme.font === 'mono' ? "'JetBrains Mono', monospace"
    : "'Inter', sans-serif"
  );
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link href="https://fonts.googleapis.com/css2?family=Marcellus&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
</svelte:head>

<div class="guest min-h-screen"
  style="--g-bg:{app.theme.bg1};--g-bg2:{app.theme.bg2};--g-panel:{app.theme.panel};
         --g-accent:{app.theme.accent};--g-glow:{app.theme.glow};
         --g-text:{app.theme.text};--g-dim:{app.theme.dim};--g-display:{fontFamily};">
  {@render children()}
</div>

<style>
  .guest {
    background:
      radial-gradient(1200px 600px at 50% -10%, var(--g-bg2) 0%, transparent 60%),
      var(--g-bg);
    color: var(--g-text);
    font-family: 'Inter', system-ui, sans-serif;
  }
  .guest :global(.display) {
    font-family: var(--g-display);
    letter-spacing: 0.14em;
  }
</style>
