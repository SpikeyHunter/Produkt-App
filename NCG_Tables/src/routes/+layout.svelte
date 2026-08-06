<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { app } from '$lib/stores/app.svelte';

  let { children } = $props();

  onMount(() => app.load());

  const isGuest = $derived(page.url.pathname.startsWith('/book'));

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/events', label: 'Events' },
    { href: '/venues', label: 'Venues' },
    { href: '/templates', label: 'Templates' },
    { href: '/reservations', label: 'Reservations' },
    { href: '/settings', label: 'Settings' },
    { href: '/book', label: 'Guest ↗' }
  ];
</script>

{#if isGuest}
  {@render children()}
{:else}
  <div class="min-h-screen flex flex-col">
    <header class="border-b border-edge bg-panel/60 backdrop-blur sticky top-0 z-10">
      <div class="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-6">
        <a href="/" class="font-semibold tracking-tight whitespace-nowrap">NCG<span class="text-lime">·</span>Tables</a>
        <nav class="flex items-center gap-1 text-sm">
          {#each links as l}
            <a href={l.href}
              class="px-3 py-1.5 rounded-lg transition-colors
                {page.url.pathname === l.href || (l.href !== '/' && page.url.pathname.startsWith(l.href)) ? 'bg-lime text-ink font-medium' : 'text-dim hover:text-fog'}">
              {l.label}
            </a>
          {/each}
        </nav>
        {#if app.usingMock}
          <span class="ml-auto text-[11px] text-hold border border-hold/40 rounded-full px-2 py-0.5 whitespace-nowrap">mock data</span>
        {/if}
      </div>
    </header>
    <main class="flex-1 max-w-[1400px] w-full mx-auto px-4 py-6">
      {@render children()}
    </main>
  </div>
{/if}
