<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { isGuestVisible } from '$lib/layout';

  const visible = $derived(
    app.tablesEvents
      .map((te) => ({ te, ev: app.eventRow(te.event_id), stats: app.stats(te) }))
      .filter(({ te, ev }) => isGuestVisible(te, ev))
      .sort((a, b) => (a.ev?.event_date ?? '').localeCompare(b.ev?.event_date ?? ''))
  );

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase() : '';
</script>

<div class="max-w-6xl mx-auto px-6 py-14">
  <div class="text-center mb-14">
    <div class="display text-4xl md:text-5xl tracking-[0.25em]">NEW CITY GAS</div>
    <div class="display text-sm tracking-[0.6em] mt-3" style="color:var(--g-dim)">TABLE RESERVATIONS</div>
  </div>

  {#if visible.length === 0}
    <p class="text-center" style="color:var(--g-dim)">No events open for reservations right now — check back soon.</p>
  {/if}

  <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
    {#each visible as { te, ev, stats } (te.id)}
      {@const soldout = stats.pct >= 1 || te.tags.includes('SOLD OUT')}
      <a href="/book/{te.id}"
        class="group relative rounded-[28px] border-2 overflow-hidden transition-transform duration-300 hover:-translate-y-1"
        style="border-color:color-mix(in srgb, var(--g-accent) 70%, transparent); background:var(--g-panel)">
        <div class="relative h-72 overflow-hidden">
          {#if ev?.event_flyer}
            <img src={ev.event_flyer} alt="" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            <div class="absolute inset-0" style="background:linear-gradient(to top, var(--g-panel) 0%, transparent 45%)"></div>
          {:else}
            <div class="absolute inset-[-40%] opacity-70"
              style="background:repeating-radial-gradient(circle at 50% 45%, transparent 0 10px, color-mix(in srgb, var(--g-glow) 8%, transparent) 11px 12px)"></div>
            <div class="absolute inset-0 grid place-items-center">
              <div class="w-40 h-40 rounded-full grid place-items-center ring-2"
                style="--tw-ring-color:color-mix(in srgb, var(--g-glow) 60%, transparent); box-shadow:0 0 45px -5px var(--g-glow);
                       background:radial-gradient(circle at 35% 30%, var(--g-bg2), var(--g-bg) 70%)">
                <span class="display text-5xl">{(ev?.event_name ?? '?').charAt(0)}</span>
              </div>
            </div>
          {/if}
          <div class="absolute top-3 right-3 flex gap-1.5 flex-wrap justify-end">
            {#each te.tags as t}
              <span class="text-[10px] font-bold rounded-full px-2.5 py-1 backdrop-blur"
                style="background:rgba(0,0,0,0.6); color:{t === 'SOLD OUT' ? '#e08a8a' : 'var(--g-glow)'};
                       border:1px solid {t === 'SOLD OUT' ? '#e08a8a' : 'var(--g-glow)'}">{t}</span>
            {/each}
          </div>
        </div>
        <div class="p-6 border-t" style="border-color:color-mix(in srgb, var(--g-accent) 30%, transparent)">
          <div class="display text-lg tracking-[0.1em] uppercase leading-snug">{ev?.event_name}</div>
          <div class="text-sm mt-2" style="color:color-mix(in srgb, var(--g-text) 80%, transparent)">
            {fmt(ev?.event_date)}
          </div>
          <div class="display mt-4 text-sm tracking-[0.2em] underline underline-offset-8"
            style="color:{soldout ? 'var(--g-dim)' : 'var(--g-glow)'}; text-decoration-color:color-mix(in srgb, var(--g-accent) 50%, transparent)">
            {soldout ? 'SOLD OUT' : '❖ BOOK YOUR TABLE'}
          </div>
        </div>
      </a>
    {/each}
  </div>

  <p class="text-center text-xs mt-14" style="color:var(--g-dim)">
    Deposits are non-refundable · 18+ · Dress code enforced
  </p>
</div>
