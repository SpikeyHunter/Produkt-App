<script lang="ts">
  import { goto } from '$app/navigation';
  import { app } from '$lib/stores/app.svelte';
  import { isExcludedEvent, isTixrLinked, venueForEvent } from '$lib/layout';

  let filter = $state<'LIVE' | 'PAST'>('LIVE');
  let showExcluded = $state(false);
  let creating = $state<number | null>(null);

  const rows = $derived(
    app.events
      .filter((e) => (showExcluded ? true : !isExcludedEvent(e.event_name)))
      .filter((e) => {
        const st = (e.event_status ?? 'LIVE').toUpperCase();
        return filter === 'PAST' ? st === 'PAST' : st !== 'PAST';
      })
      .sort((a, b) => (filter === 'PAST' ? -1 : 1) * (a.event_date ?? '').localeCompare(b.event_date ?? ''))
  );

  async function create(e: (typeof app.events)[number]) {
    creating = e.event_id;
    const venue_id = venueForEvent(e);
    const tpl = app.templates.find((t) => t.venue_id === venue_id) ?? null;
    const te = await app.createTablesEvent(e, tpl?.id ?? null);
    creating = null;
    goto(`/events/${te.id}`);
  }
</script>

<div class="space-y-5">
  <div class="flex items-center gap-4 flex-wrap">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Events</h1>
      <p class="text-dim text-sm mt-1">From your <code class="text-fog">events</code> table. Pick one to set up table reservations.</p>
    </div>
    <div class="ml-auto flex items-center gap-3">
      <label class="flex items-center gap-2 text-xs text-dim">
        <input type="checkbox" class="accent-lime" bind:checked={showExcluded} /> show excluded
      </label>
      <div class="flex gap-1 rounded-lg border border-edge p-1">
        {#each ['LIVE', 'PAST'] as f}
          <button class="px-3 py-1 rounded-md text-sm cursor-pointer {filter === f ? 'bg-lime text-ink font-medium' : 'text-dim'}"
            onclick={() => (filter = f as 'LIVE' | 'PAST')}>{f}</button>
        {/each}
      </div>
    </div>
  </div>

  <div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {#each rows as e (e.event_id)}
      {@const existing = app.tablesEventFor(e.event_id)}
      {@const linked = isTixrLinked(e)}
      <div class="rounded-xl border border-edge bg-panel overflow-hidden flex flex-col">
        <div class="h-36 bg-ink relative">
          {#if e.event_flyer}
            <img src={e.event_flyer} alt="" class="w-full h-full object-cover" loading="lazy" />
          {:else}
            <div class="w-full h-full grid place-items-center text-dim text-xs">no flyer</div>
          {/if}
          {#if !linked}
            <span class="absolute top-2 left-2 text-[10px] font-bold border border-hold/60 text-hold rounded-full px-2 py-0.5 bg-ink/85">⚠ Tixr not linked</span>
          {/if}
          {#if e.color}
            <span class="absolute bottom-0 left-0 right-0 h-1" style="background:{e.color}"></span>
          {/if}
        </div>
        <div class="p-4 flex-1 flex flex-col">
          <div class="font-semibold text-sm leading-snug">{e.event_name}</div>
          <div class="text-dim text-xs mt-1">{e.event_date ?? '—'} · {e.event_venue ?? '?'} → {app.venue(venueForEvent(e))?.name}</div>
          <div class="mt-auto pt-3">
            {#if existing}
              <a href="/events/{existing.id}" class="btn w-full justify-center text-xs">Manage reservations</a>
            {:else}
              <button class="btn btn-accent w-full justify-center text-xs" disabled={creating === e.event_id}
                onclick={() => create(e)}>
                {creating === e.event_id ? 'Creating…' : '+ Create table reservations'}
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>
