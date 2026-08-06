<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { money, isGuestVisible, tierOf } from '$lib/layout';

  let filter = $state<'LIVE' | 'PAST'>('LIVE');

  const rows = $derived(
    app.tablesEvents
      .map((te) => ({ te, ev: app.eventRow(te.event_id), stats: app.stats(te) }))
      .filter(({ ev }) => {
        const st = (ev?.event_status ?? 'LIVE').toUpperCase();
        return filter === 'PAST' ? st === 'PAST' : st !== 'PAST';
      })
      .sort((a, b) => (a.ev?.event_date ?? '').localeCompare(b.ev?.event_date ?? ''))
  );

  const totals = $derived({
    events: rows.length,
    booked: rows.reduce((s, r) => s + r.stats.booked, 0),
    revenue: rows.reduce((s, r) => s + r.stats.revenue, 0),
    deposits: rows.reduce((s, r) => s + r.stats.deposits, 0)
  });

  function badge(pct: number, tags: string[]) {
    if (pct >= 1 || tags.includes('SOLD OUT')) return { label: 'SOLD OUT', cls: 'text-sold border-sold/50' };
    if (pct >= 0.8 || tags.includes('FEW TABLES LEFT')) return { label: 'ALMOST SOLD OUT', cls: 'text-hold border-hold/50' };
    return null;
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-4 flex-wrap">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Table reservations</h1>
      <p class="text-dim text-sm mt-1">Every event with a reservation setup, at a glance.</p>
    </div>
    <div class="ml-auto flex gap-1 rounded-lg border border-edge p-1">
      {#each ['LIVE', 'PAST'] as f}
        <button class="px-3 py-1 rounded-md text-sm cursor-pointer {filter === f ? 'bg-lime text-ink font-medium' : 'text-dim'}"
          onclick={() => (filter = f as 'LIVE' | 'PAST')}>{f}</button>
      {/each}
    </div>
  </div>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
    {#each [
      ['Active setups', totals.events, ''],
      ['Tables booked', totals.booked, 'text-lime'],
      ['Booked value', money(totals.revenue), 'text-lime'],
      ['Deposits', money(totals.deposits), '']
    ] as [label, value, cls]}
      <div class="rounded-xl border border-edge bg-panel p-4">
        <div class="label">{label}</div>
        <div class="text-2xl font-semibold mt-1 {cls}">{value}</div>
      </div>
    {/each}
  </div>

  {#if rows.length === 0}
    <div class="rounded-xl border border-edge bg-panel p-8 text-center text-dim text-sm">
      No {filter.toLowerCase()} reservation setups yet.
      <a href="/events" class="text-lime underline underline-offset-4 ml-1">Create one from your events →</a>
    </div>
  {/if}

  <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
    {#each rows as { te, ev, stats } (te.id)}
      {@const b = badge(stats.pct, te.tags)}
      <a href="/events/{te.id}" class="rounded-xl border border-edge bg-panel overflow-hidden hover:border-lime/60 transition-colors">
        <div class="h-32 bg-ink relative">
          {#if ev?.event_flyer}
            <img src={ev.event_flyer} alt="" class="w-full h-full object-cover opacity-80" />
          {:else}
            <div class="w-full h-full grid place-items-center text-dim text-xs">no flyer</div>
          {/if}
          <div class="absolute top-2 right-2 flex gap-1.5 flex-wrap justify-end">
            {#if b}<span class="text-[10px] font-bold border rounded-full px-2 py-0.5 bg-ink/85 {b.cls}">{b.label}</span>{/if}
            {#each te.tags.filter((t) => t !== 'SOLD OUT' && t !== 'FEW TABLES LEFT') as t}
              <span class="text-[10px] font-bold border border-edge rounded-full px-2 py-0.5 bg-ink/85 text-fog">{t}</span>
            {/each}
          </div>
          {#if !te.is_public || !isGuestVisible(te, ev)}
            <span class="absolute bottom-2 left-2 text-[10px] border border-edge rounded-full px-2 py-0.5 bg-ink/85 text-dim">hidden from guests</span>
          {:else}
            <span class="absolute bottom-2 left-2 text-[10px] border border-ok/50 rounded-full px-2 py-0.5 bg-ink/85 text-ok">public</span>
          {/if}
        </div>
        <div class="p-4">
          <div class="font-semibold truncate">{ev?.event_name ?? `Event #${te.event_id}`}</div>
          <div class="text-dim text-xs mt-0.5">{ev?.event_date ?? '—'} · {app.venue(te.venue_id)?.name ?? te.venue_id}</div>
          <div class="mt-3">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-dim">{stats.booked}/{stats.total} tables</span>
              <span class="{stats.pct >= 0.8 ? 'text-hold' : 'text-lime'}">{Math.round(stats.pct * 100)}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-ink overflow-hidden">
              <div class="h-full rounded-full {stats.pct >= 1 ? 'bg-sold' : stats.pct >= 0.8 ? 'bg-hold' : 'bg-lime'}"
                style="width:{Math.min(stats.pct * 100, 100)}%"></div>
            </div>
          </div>
          <div class="flex justify-between text-xs mt-3">
            <span class="text-dim">Booked value</span><span class="font-medium">{money(stats.revenue)}</span>
          </div>
          <div class="flex justify-between text-xs mt-1">
            <span class="text-dim">Deposits</span><span>{money(stats.deposits)}</span>
          </div>
        </div>
      </a>
    {/each}
  </div>
</div>
