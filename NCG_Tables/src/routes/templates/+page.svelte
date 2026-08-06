<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import LayoutEditor from '$lib/components/LayoutEditor.svelte';
  import ElementPanel from '$lib/components/ElementPanel.svelte';
  import Preview3D from '$lib/components/Preview3D.svelte';
  import { makeElement } from '$lib/layout';

  let venueId = $state('main_room');
  let templateId = $state<string | null>(null);
  let selectedId = $state<string | null>(null);
  let view3d = $state(false);
  let drawMode = $state(false);
  let saveMsg = $state('');
  let n = $state(1);

  const venue = $derived(app.venue(venueId));
  const venueTemplates = $derived(app.templates.filter((t) => t.venue_id === venueId));
  const tpl = $derived(app.template(templateId) ?? venueTemplates[0] ?? null);

  $effect(() => {
    if (tpl && templateId !== tpl.id) templateId = tpl.id;
  });

  function addEl(kind: Parameters<typeof makeElement>[0]) {
    if (!tpl) return;
    const el = makeElement(kind, n++);
    app.saveTemplate({ ...tpl, elements: [...tpl.elements, el] });
    selectedId = el.id;
  }
  async function save() {
    if (!tpl) return;
    const err = await app.saveTemplate(tpl);
    saveMsg = err ? 'Save failed' : 'Saved';
    setTimeout(() => (saveMsg = ''), 2500);
  }
  async function newTemplate(duplicate: boolean) {
    const name = prompt(duplicate ? 'Name for the copy?' : 'Template name?');
    if (!name) return;
    const t = await app.addTemplate(venueId, name, duplicate && tpl ? tpl : undefined);
    templateId = t.id;
  }
</script>

<div class="space-y-4">
  <div class="flex items-center gap-3 flex-wrap">
    <div>
      <h1 class="text-xl font-semibold tracking-tight">Table layout templates</h1>
      <p class="text-dim text-sm">Banquettes, standup tables, bars + pricing — reusable per venue.</p>
    </div>
    <div class="ml-auto flex items-center gap-2 flex-wrap">
      <select class="input w-40" bind:value={venueId} onchange={() => (templateId = null)}>
        {#each app.venues as v}<option value={v.id}>{v.name}</option>{/each}
      </select>
      <select class="input w-48" bind:value={templateId}>
        {#each venueTemplates as t}<option value={t.id}>{t.name}</option>{/each}
      </select>
      <button class="btn text-xs" onclick={() => newTemplate(false)}>+ New</button>
      <button class="btn text-xs" onclick={() => newTemplate(true)} disabled={!tpl}>Duplicate</button>
      {#if saveMsg}<span class="text-sm text-dim">{saveMsg}</span>{/if}
      <button class="btn btn-accent" onclick={save} disabled={!tpl}>Save template</button>
    </div>
  </div>

  {#if venue && tpl}
    <div class="flex items-center gap-2 flex-wrap rounded-xl border border-edge bg-panel px-4 py-3">
      <span class="label">Add</span>
      <button class="btn text-xs" onclick={() => addEl('banquette')}>+ Banquette</button>
      <button class="btn text-xs" onclick={() => addEl('standup')}>+ Standup table</button>
      <button class="btn text-xs" onclick={() => addEl('bar')}>+ Bar</button>
      <button class="btn text-xs" onclick={() => addEl('dj')}>+ DJ</button>
      <button class="btn text-xs {drawMode ? 'border-lime text-lime' : ''}" onclick={() => (drawMode = !drawMode)}>✎ Draw shape</button>
      <span class="text-dim text-xs ml-2">Banquettes support L-shape in the panel · sections group tables for section-mode booking</span>
      <button class="btn text-xs ml-auto {view3d ? 'border-lime text-lime' : ''}" onclick={() => (view3d = !view3d)}>{view3d ? '2D' : '3D'}</button>
    </div>

    <div class="flex gap-4 items-start">
      <div class="flex-1 min-w-0">
        {#if view3d}
          <Preview3D room={venue} architecture={venue.geometry} bind:selectedId elements={tpl.elements} height="64vh" />
        {:else}
          <LayoutEditor bind:elements={tpl.elements} bind:selectedId bind:drawMode room={venue} backdrop={venue.geometry} />
        {/if}
      </div>
      <ElementPanel bind:elements={tpl.elements} bind:selectedId mode="furniture" />
    </div>
  {:else if venue}
    <div class="rounded-xl border border-edge bg-panel p-8 text-center text-sm text-dim">
      No templates for {venue.name} yet.
      <button class="text-lime underline underline-offset-4 cursor-pointer" onclick={() => newTemplate(false)}>Create one</button>
    </div>
  {/if}
</div>
