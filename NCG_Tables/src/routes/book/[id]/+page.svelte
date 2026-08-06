<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { Canvas } from '@threlte/core';
  import SceneElements from '$lib/components/SceneElements.svelte';
  import { app } from '$lib/stores/app.svelte';
  import { isGuestVisible, isPastCutoff, money, tierOf } from '$lib/layout';

  const te = $derived(app.tablesEvent(page.params.id));
  const ev = $derived(te ? app.eventRow(te.event_id) : null);
  const venue = $derived(te ? app.venue(te.venue_id) : null);
  const visible = $derived(te ? isGuestVisible(te, ev) : false);
  const cutoff = $derived(te && ev ? isPastCutoff(ev.event_date, te.booking_cutoff_hour) : false);
  const taken = $derived(te ? app.takenIds(te.id) : new Set<string>());

  let selectedId = $state<string | null>(null);
  let guests = $state(6);

  // Selection resolution: element, or cheapest available element in the section
  const selection = $derived.by(() => {
    if (!te || !selectedId) return null;
    if (selectedId.startsWith('sec:')) {
      const name = selectedId.slice(4);
      const free = te.elements
        .filter((el) => el.bookable && !el.disabled && el.section === name && !taken.has(el.id))
        .sort((a, b) => a.price - b.price);
      return free[0] ? { el: free[0], label: name, isSection: true } : null;
    }
    const el = te.elements.find((el) => el.id === selectedId);
    return el ? { el, label: el.name, isSection: false } : null;
  });

  $effect(() => {
    if (selection) guests = Math.min(Math.max(guests, 1), selection.el.capacity);
  });

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase() : '';

  function book() {
    if (!te || !selection) return;
    const target = selection.isSection ? `sec:${selection.label}` : selection.el.id;
    goto(`/book/${te.id}/checkout?sel=${encodeURIComponent(target)}&guests=${guests}`);
  }
</script>

{#if !te || !venue || !visible}
  <div class="min-h-screen grid place-items-center">
    <div class="text-center">
      <p style="color:var(--g-dim)">This event isn't open for reservations.</p>
      <a href="/book" class="underline underline-offset-4" style="color:var(--g-glow)">Back to events</a>
    </div>
  </div>
{:else}
  <div class="h-screen flex flex-col relative">
    <!-- Header pill -->
    <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 w-full px-4 pointer-events-none">
      <div class="pointer-events-auto flex items-center gap-4 rounded-full border bg-black/70 backdrop-blur px-6 py-2.5 max-w-full"
        style="border-color:color-mix(in srgb, var(--g-accent) 60%, transparent)">
        <a href="/book" style="color:var(--g-dim)" class="hover:opacity-80">‹</a>
        <span class="display tracking-[0.12em] uppercase text-sm md:text-base truncate">{ev?.event_name}</span>
        <span style="color:var(--g-glow)">❖</span>
        <span class="text-sm whitespace-nowrap" style="color:color-mix(in srgb, var(--g-text) 80%, transparent)">{fmt(ev?.event_date)}</span>
      </div>
      {#if cutoff}
        <div class="pointer-events-auto rounded-full border px-4 py-1.5 text-xs bg-black/70 backdrop-blur"
          style="border-color:#e08a8a; color:#e08a8a">
          Table reservations are closed for this event
        </div>
      {/if}
    </div>

    <div class="flex-1">
      <Canvas>
        <SceneElements
          room={venue}
          architecture={venue.geometry}
          elements={te.elements}
          bind:selectedId
          takenIds={taken}
          guest
          selectionMode={te.selection_mode}
          {cutoff}
          accent={app.theme.glow}
        />
      </Canvas>
    </div>

    {#if selection && !cutoff}
      {@const tier = tierOf(selection.el.price)}
      <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-[min(560px,92vw)]
                  rounded-2xl border backdrop-blur p-5 shadow-[0_10px_60px_-10px_rgba(0,0,0,0.9)]"
        style="border-color:color-mix(in srgb, var(--g-accent) 60%, transparent); background:color-mix(in srgb, var(--g-panel) 95%, transparent)">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" style="background:{tier.color}"></span>
              <span class="font-bold tracking-wide">{tier.name}</span>
              <span style="color:var(--g-dim)">
                {selection.isSection ? `${selection.label} section` : `(${selection.label})`}
              </span>
            </div>
            <div class="text-[11px] uppercase tracking-wider mt-1" style="color:var(--g-dim)">
              Max capacity: {selection.el.capacity}
              {#if selection.isSection}· best available: {selection.el.name}{/if}
            </div>
          </div>
          <div class="text-right">
            <div class="text-[11px] uppercase tracking-wider" style="color:var(--g-dim)">Number of guests</div>
            <div class="flex items-center gap-2 mt-1 justify-end">
              <button class="w-8 h-8 rounded-full bg-black/60 border cursor-pointer"
                style="border-color:color-mix(in srgb, var(--g-accent) 40%, transparent)"
                onclick={() => (guests = Math.max(1, guests - 1))}>−</button>
              <span class="w-10 text-center font-semibold">{guests}</span>
              <button class="w-8 h-8 rounded-full bg-black/60 border cursor-pointer"
                style="border-color:color-mix(in srgb, var(--g-accent) 40%, transparent)"
                onclick={() => (guests = Math.min(selection.el.capacity, guests + 1))}>+</button>
            </div>
          </div>
        </div>
        <button class="mt-4 w-full rounded-xl font-semibold py-3 transition-colors cursor-pointer"
          style="background:var(--g-accent); color:var(--g-bg)" onclick={book}>
          Book for {money(selection.el.price)} — {money(selection.el.deposit)} deposit
        </button>
      </div>
    {:else if !cutoff}
      <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-sm rounded-full bg-black/60 border px-5 py-2 backdrop-blur"
        style="color:var(--g-dim); border-color:color-mix(in srgb, var(--g-accent) 30%, transparent)">
        {te.selection_mode === 'section' ? 'Tap a section to see pricing' : 'Tap a table to see pricing'} — drag to orbit, scroll to zoom
      </div>
    {/if}
  </div>
{/if}
