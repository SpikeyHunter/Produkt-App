<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { app } from '$lib/stores/app.svelte';
  import LayoutEditor from '$lib/components/LayoutEditor.svelte';
  import ElementPanel from '$lib/components/ElementPanel.svelte';
  import Preview3D from '$lib/components/Preview3D.svelte';
  import { clone, isGuestVisible, isPastCutoff, makeElement, money, PRESET_TAGS } from '$lib/layout';

  const te = $derived(app.tablesEvent(page.params.id));
  const ev = $derived(te ? app.eventRow(te.event_id) : null);
  const venue = $derived(te ? app.venue(te.venue_id) : null);
  const taken = $derived(te ? app.takenIds(te.id) : new Set<string>());
  const resList = $derived(te ? app.reservations.filter((r) => r.tables_event_id === te.id) : []);

  let selectedId = $state<string | null>(null);
  let view3d = $state(false);
  let drawMode = $state(false);
  let customTag = $state('');
  let saveMsg = $state('');
  let counter = $state(1);

  const cutoffNow = $derived(te && ev ? isPastCutoff(ev.event_date, te.booking_cutoff_hour) : false);

  function patch(p: Partial<NonNullable<typeof te>>) {
    if (!te) return;
    app.saveTablesEvent({ ...te, ...p });
  }
  async function save() {
    if (!te) return;
    const err = await app.saveTablesEvent(te);
    saveMsg = err ? 'Save failed — check console' : 'Saved';
    setTimeout(() => (saveMsg = ''), 2500);
  }
  function toggleTag(t: string) {
    if (!te) return;
    patch({ tags: te.tags.includes(t) ? te.tags.filter((x) => x !== t) : [...te.tags, t] });
  }
  function addCustomTag() {
    const t = customTag.trim().toUpperCase();
    if (t && te && !te.tags.includes(t)) patch({ tags: [...te.tags, t] });
    customTag = '';
  }
  function reloadTemplate(id: string) {
    const tpl = app.template(id);
    if (!tpl || !te) return;
    if (!confirm('Replace this event\'s layout with the template? Event-specific edits are lost.')) return;
    patch({ template_id: tpl.id, elements: clone(tpl.elements) });
  }
  function disableSection(name: string, disabled: boolean) {
    if (!te) return;
    patch({ elements: te.elements.map((e) => (e.section === name ? { ...e, disabled } : e)) });
  }
  const sections = $derived.by(() => {
    if (!te) return [];
    const m = new Map<string, { total: number; off: number }>();
    for (const e of te.elements) {
      if (!e.bookable) continue;
      const s = m.get(e.section) ?? { total: 0, off: 0 };
      s.total++; if (e.disabled) s.off++;
      m.set(e.section, s);
    }
    return [...m.entries()];
  });
  function addEl(kind: Parameters<typeof makeElement>[0]) {
    if (!te) return;
    const el = makeElement(kind, counter++);
    patch({ elements: [...te.elements, el] });
    selectedId = el.id;
  }
</script>

{#if !te}
  <p class="text-dim">Not found. <a href="/events" class="text-lime underline">Back to events</a></p>
{:else}
  <div class="space-y-5">
    <!-- Header -->
    <div class="flex items-start gap-4 flex-wrap">
      {#if ev?.event_flyer}
        <img src={ev.event_flyer} alt="" class="w-24 h-24 rounded-xl object-cover border border-edge" />
      {/if}
      <div>
        <a href="/events" class="text-dim text-xs hover:text-fog">‹ Events</a>
        <h1 class="text-xl font-semibold tracking-tight">{ev?.event_name ?? `Event #${te.event_id}`}</h1>
        <div class="text-dim text-sm mt-0.5">
          {ev?.event_date ?? '—'} · {venue?.name} ·
          {#if (ev?.event_status ?? '').toUpperCase() === 'PAST'}
            <span class="text-sold">PAST — auto-hidden from guests</span>
          {:else if isGuestVisible(te, ev)}
            <span class="text-ok">visible to guests</span>
            · <a class="underline text-lime" href="/book/{te.id}" target="_blank">preview ↗</a>
          {:else}
            <span class="text-hold">not visible to guests</span>
          {/if}
          {#if cutoffNow}<span class="text-sold"> · booking window closed (cutoff {te.booking_cutoff_hour}:00 ET)</span>{/if}
        </div>
      </div>
      <div class="ml-auto flex items-center gap-2">
        {#if saveMsg}<span class="text-sm text-dim">{saveMsg}</span>{/if}
        <button class="btn" onclick={() => { if (confirm('Delete this reservation setup?')) { app.deleteTablesEvent(te.id); goto('/events'); } }}>Delete</button>
        <button class="btn btn-accent" onclick={save}>Save</button>
      </div>
    </div>

    <!-- Settings -->
    <div class="grid lg:grid-cols-3 gap-4">
      <div class="rounded-xl border border-edge bg-panel p-4 space-y-3">
        <h3 class="font-semibold text-sm">Visibility</h3>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" class="accent-lime" checked={te.is_public}
            onchange={(e) => patch({ is_public: e.currentTarget.checked })} />
          Public — guests can view & book
        </label>
        <div>
          <span class="label">Scheduled publish (optional)</span>
          <input class="input mt-1" type="datetime-local" value={te.publish_at ? te.publish_at.slice(0, 16) : ''}
            onchange={(e) => patch({ publish_at: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })} />
          <p class="text-[11px] text-dim mt-1">Stays hidden until this local date/time, even if Public is on.</p>
        </div>
        <div>
          <span class="label">Booking cutoff hour (ET, event day)</span>
          <select class="input mt-1" value={String(te.booking_cutoff_hour ?? '')}
            onchange={(e) => patch({ booking_cutoff_hour: e.currentTarget.value === '' ? null : Number(e.currentTarget.value) })}>
            <option value="">No cutoff</option>
            {#each Array.from({ length: 24 }, (_, i) => i) as h}
              <option value={String(h)}>{String(h).padStart(2, '0')}:00</option>
            {/each}
          </select>
          <p class="text-[11px] text-dim mt-1">After this hour Montréal time on event day, tables gray out.</p>
        </div>
      </div>

      <div class="rounded-xl border border-edge bg-panel p-4 space-y-3">
        <h3 class="font-semibold text-sm">Booking mode & template</h3>
        <div>
          <span class="label">Guest selection</span>
          <div class="flex gap-1 rounded-lg border border-edge p-1 mt-1">
            {#each [['table', 'Precise tables'], ['section', 'By section']] as [v, l]}
              <button class="flex-1 px-3 py-1.5 rounded-md text-sm cursor-pointer {te.selection_mode === v ? 'bg-lime text-ink font-medium' : 'text-dim'}"
                onclick={() => patch({ selection_mode: v as 'table' | 'section' })}>{l}</button>
            {/each}
          </div>
        </div>
        <div>
          <span class="label">Load template</span>
          <div class="flex gap-2 mt-1">
            <select class="input" id="tplsel">
              {#each app.templates.filter((t) => t.venue_id === te.venue_id) as t}
                <option value={t.id} selected={t.id === te.template_id}>{t.name}</option>
              {/each}
            </select>
            <button class="btn text-xs whitespace-nowrap"
              onclick={() => reloadTemplate((document.getElementById('tplsel') as HTMLSelectElement).value)}>Load</button>
          </div>
        </div>
        <div>
          <span class="label">Sections</span>
          <div class="space-y-1.5 mt-1">
            {#each sections as [name, s]}
              <div class="flex items-center justify-between text-sm">
                <span>{name} <span class="text-dim text-xs">({s.total - s.off}/{s.total} on)</span></span>
                <button class="btn text-xs py-0.5" onclick={() => disableSection(name, s.off < s.total)}>
                  {s.off < s.total ? 'Disable all' : 'Enable all'}
                </button>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-edge bg-panel p-4 space-y-3">
        <h3 class="font-semibold text-sm">Tags</h3>
        <div class="flex flex-wrap gap-1.5">
          {#each PRESET_TAGS as t}
            <button class="text-xs rounded-full px-3 py-1 border cursor-pointer
              {te.tags.includes(t) ? 'border-lime text-lime' : 'border-edge text-dim hover:text-fog'}"
              onclick={() => toggleTag(t)}>{t}</button>
          {/each}
          {#each te.tags.filter((t) => !PRESET_TAGS.includes(t)) as t}
            <button class="text-xs rounded-full px-3 py-1 border border-lime text-lime cursor-pointer"
              onclick={() => toggleTag(t)} title="Remove">{t} ×</button>
          {/each}
        </div>
        <div class="flex gap-2">
          <input class="input" placeholder="Custom tag…" bind:value={customTag}
            onkeydown={(e) => e.key === 'Enter' && addCustomTag()} />
          <button class="btn text-xs" onclick={addCustomTag}>Add</button>
        </div>
        <p class="text-[11px] text-dim">Tags show on the guest event card. "SOLD OUT" also closes bookings visually.</p>
      </div>
    </div>

    <!-- Layout customization -->
    <div class="flex items-center gap-2 flex-wrap">
      <h3 class="font-semibold">Floor plan for this event</h3>
      <span class="text-dim text-xs">edits here only affect this event · reserved tables outlined red</span>
      <div class="ml-auto flex gap-2">
        <button class="btn text-xs" onclick={() => addEl('banquette')}>+ Banquette</button>
        <button class="btn text-xs" onclick={() => addEl('standup')}>+ Standup</button>
        <button class="btn text-xs" onclick={() => addEl('bar')}>+ Bar</button>
        <button class="btn text-xs {drawMode ? 'border-lime text-lime' : ''}" onclick={() => (drawMode = !drawMode)}>✎ Draw shape</button>
        <button class="btn text-xs {view3d ? 'border-lime text-lime' : ''}" onclick={() => (view3d = !view3d)}>{view3d ? '2D' : '3D'}</button>
      </div>
    </div>

    {#if venue}
      <div class="flex gap-4 items-start">
        <div class="flex-1 min-w-0">
          {#if view3d}
            <Preview3D room={venue} architecture={venue.geometry} bind:selectedId elements={te.elements} takenIds={taken} height="62vh" />
          {:else}
            <LayoutEditor bind:elements={te.elements} bind:selectedId bind:drawMode
              room={venue} backdrop={venue.geometry} takenIds={taken} />
          {/if}
        </div>
        <ElementPanel bind:elements={te.elements} bind:selectedId mode="event" />
      </div>
    {/if}

    <!-- Reservations for this event -->
    <div class="rounded-xl border border-edge bg-panel overflow-x-auto">
      <div class="px-4 py-3 border-b border-edge font-semibold text-sm">Reservations ({resList.length})</div>
      {#if resList.length === 0}
        <div class="px-4 py-5 text-sm text-dim">No reservations yet.</div>
      {:else}
        <table class="w-full text-sm">
          <thead><tr class="text-left border-b border-edge">
            {#each ['Guest', 'Table', 'Party', 'Deposit', 'Total', 'Status', ''] as h}<th class="label px-4 py-2.5">{h}</th>{/each}
          </tr></thead>
          <tbody>
            {#each resList as r (r.id)}
              <tr class="border-b border-edge/50">
                <td class="px-4 py-2.5">{r.guest_name}<div class="text-dim text-xs">{r.guest_email}</div></td>
                <td class="px-4 py-2.5">{r.element_name}</td>
                <td class="px-4 py-2.5">{r.party_size}</td>
                <td class="px-4 py-2.5">{money(r.deposit_amount)}</td>
                <td class="px-4 py-2.5">{money(r.total_amount)}</td>
                <td class="px-4 py-2.5">
                  <select class="input py-1 text-xs w-32" value={r.status}
                    onchange={(e) => app.setReservationStatus(r.id, e.currentTarget.value as typeof r.status)}>
                    {#each ['pending', 'deposit_paid', 'confirmed', 'cancelled', 'no_show'] as s}
                      <option value={s}>{s.replace('_', ' ')}</option>
                    {/each}
                  </select>
                </td>
                <td></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
{/if}
