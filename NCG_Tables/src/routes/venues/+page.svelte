<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import LayoutEditor from '$lib/components/LayoutEditor.svelte';
  import ElementPanel from '$lib/components/ElementPanel.svelte';
  import Preview3D from '$lib/components/Preview3D.svelte';
  import { makeElement } from '$lib/layout';

  let venueId = $state('main_room');
  let selectedId = $state<string | null>(null);
  let view3d = $state(false);
  let drawMode = $state(false);
  let saveMsg = $state('');
  let n = $state(1);

  const venue = $derived(app.venue(venueId));

  function setDim(k: 'width' | 'depth' | 'height', v: number) {
    if (!venue || !v) return;
    app.saveVenue({ ...venue, [k]: v });
  }
  function addEl(kind: Parameters<typeof makeElement>[0]) {
    if (!venue) return;
    const el = makeElement(kind, n++);
    app.saveVenue({ ...venue, geometry: [...venue.geometry, el] });
    selectedId = el.id;
  }
  async function save() {
    if (!venue) return;
    const err = await app.saveVenue(venue);
    saveMsg = err ? 'Save failed' : 'Saved';
    setTimeout(() => (saveMsg = ''), 2500);
  }
  async function newVenue() {
    const name = prompt('Venue name?');
    if (!name) return;
    const v = await app.addVenue(name);
    venueId = v.id;
  }
</script>

<div class="space-y-4">
  <div class="flex items-center gap-3 flex-wrap">
    <div>
      <h1 class="text-xl font-semibold tracking-tight">Venue architect</h1>
      <p class="text-dim text-sm">Rooms only — walls, mezzanines, risers, cavities, custom extrusions. No tables here.</p>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <select class="input w-44" bind:value={venueId}>
        {#each app.venues as v}<option value={v.id}>{v.name}</option>{/each}
      </select>
      <button class="btn text-xs" onclick={newVenue}>+ New venue</button>
      {#if saveMsg}<span class="text-sm text-dim">{saveMsg}</span>{/if}
      <button class="btn btn-accent" onclick={save}>Save venue</button>
    </div>
  </div>

  {#if venue}
    <div class="flex items-center gap-3 flex-wrap rounded-xl border border-edge bg-panel px-4 py-3">
      <span class="label">Room dimensions</span>
      {#each [['width', venue.width], ['depth', venue.depth], ['height', venue.height]] as [k, v]}
        <label class="flex items-center gap-1.5 text-sm">
          <span class="text-dim text-xs">{k}</span>
          <input class="input w-20 py-1" type="number" step="0.5" min="2" value={v}
            onchange={(e) => setDim(k as 'width', Number(e.currentTarget.value))} />
          <span class="text-dim text-xs">m</span>
        </label>
      {/each}
      <div class="ml-auto flex gap-2 flex-wrap">
        <button class="btn text-xs" onclick={() => addEl('wall')}>+ Wall</button>
        <button class="btn text-xs" onclick={() => addEl('mezzanine')}>+ Mezzanine</button>
        <button class="btn text-xs" onclick={() => addEl('riser')}>+ Riser</button>
        <button class="btn text-xs" onclick={() => addEl('cavity')}>+ Cavity</button>
        <button class="btn text-xs" onclick={() => addEl('stage')}>+ Stage</button>
        <button class="btn text-xs" onclick={() => addEl('bar')}>+ Bar</button>
        <button class="btn text-xs {drawMode ? 'border-lime text-lime' : ''}" onclick={() => (drawMode = !drawMode)}>✎ Draw shape</button>
        <button class="btn text-xs {view3d ? 'border-lime text-lime' : ''}" onclick={() => (view3d = !view3d)}>{view3d ? '2D' : '3D'}</button>
      </div>
    </div>

    <div class="flex gap-4 items-start">
      <div class="flex-1 min-w-0">
        {#if view3d}
          <Preview3D room={venue} architecture={[]} bind:selectedId elements={venue.geometry} height="64vh" />
        {:else}
          <LayoutEditor bind:elements={venue.geometry} bind:selectedId bind:drawMode room={venue} showPricing={false} />
        {/if}
        <p class="text-dim text-xs mt-2">
          Draw shape: click points on the plan, Finish, then set extrusion height + elevation in the panel.
          Cavities use negative elevation to sink below floor level.
        </p>
      </div>
      <ElementPanel bind:elements={venue.geometry} bind:selectedId mode="architecture" />
    </div>
  {/if}
</div>
