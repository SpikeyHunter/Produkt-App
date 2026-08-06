<script lang="ts">
  import { ARCHITECTURE, FURNITURE, type ElementKind, type LayoutElement } from '$lib/layout';

  let {
    elements = $bindable([] as LayoutElement[]),
    selectedId = $bindable(null as string | null),
    mode = 'furniture' as 'architecture' | 'furniture' | 'event'
  } = $props();

  const el = $derived(elements.find((e) => e.id === selectedId) ?? null);
  const kinds: ElementKind[] = $derived(
    mode === 'architecture' ? [...ARCHITECTURE, 'stage', 'bar', 'dj'] : [...FURNITURE, 'custom']
  );

  function set(patch: Partial<LayoutElement>) {
    if (!el) return;
    elements = elements.map((e) => (e.id === el.id ? { ...e, ...patch } : e));
  }
  function remove() {
    if (!el) return;
    elements = elements.filter((e) => e.id !== el.id);
    selectedId = null;
  }
  function num(v: string) { return Number(v) || 0; }
</script>

<aside class="w-72 shrink-0 rounded-xl border border-edge bg-panel p-4 space-y-3 h-fit max-h-[75vh] overflow-y-auto">
  {#if el}
    <div class="flex items-center justify-between">
      <h3 class="font-semibold">{el.name}</h3>
      <button class="text-dim hover:text-sold text-sm cursor-pointer" onclick={remove}>Delete</button>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <span class="label">Name</span>
        <input class="input mt-1" value={el.name} oninput={(e) => set({ name: e.currentTarget.value })} />
      </div>
      <div>
        <span class="label">Type</span>
        <select class="input mt-1" value={el.kind} onchange={(e) => set({ kind: e.currentTarget.value as ElementKind })}>
          {#each kinds as k}<option value={k}>{k}</option>{/each}
        </select>
      </div>
    </div>

    <div>
      <span class="label">Section</span>
      <input class="input mt-1" value={el.section} oninput={(e) => set({ section: e.currentTarget.value })} />
    </div>

    <div class="grid grid-cols-4 gap-2">
      {#each [['x', el.x], ['y', el.y], ['w', el.w], ['d', el.d]] as [k, v]}
        <div>
          <span class="label">{k} (m)</span>
          <input class="input mt-1 px-1.5" type="number" step="0.25" value={v}
            oninput={(e) => set({ [k]: num(e.currentTarget.value) } as Partial<LayoutElement>)} />
        </div>
      {/each}
    </div>

    <div class="grid grid-cols-3 gap-2">
      <div>
        <span class="label">Height</span>
        <input class="input mt-1 px-1.5" type="number" step="0.05" value={el.h}
          oninput={(e) => set({ h: num(e.currentTarget.value) })} />
      </div>
      <div>
        <span class="label">Elev.</span>
        <input class="input mt-1 px-1.5" type="number" step="0.1" value={el.elevation}
          oninput={(e) => set({ elevation: num(e.currentTarget.value) })} />
      </div>
      <div>
        <span class="label">Rot °</span>
        <input class="input mt-1 px-1.5" type="number" step="15" value={el.rotation}
          oninput={(e) => set({ rotation: num(e.currentTarget.value) })} />
      </div>
    </div>

    {#if el.kind === 'banquette'}
      <div class="rounded-lg border border-edge p-2.5 space-y-2">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" class="accent-lime" checked={!!el.l}
            onchange={(e) => set({ l: e.currentTarget.checked ? { w: Math.min(1, el.w / 2), d: Math.min(0.8, el.d / 2) } : undefined })} />
          L-shape (corner cut)
        </label>
        {#if el.l}
          <div class="grid grid-cols-2 gap-2">
            <div>
              <span class="label">Cut W</span>
              <input class="input mt-1" type="number" step="0.1" min="0.2" max={el.w - 0.2} value={el.l.w}
                oninput={(e) => set({ l: { ...el.l!, w: num(e.currentTarget.value) } })} />
            </div>
            <div>
              <span class="label">Cut D</span>
              <input class="input mt-1" type="number" step="0.1" min="0.2" max={el.d - 0.2} value={el.l.d}
                oninput={(e) => set({ l: { ...el.l!, d: num(e.currentTarget.value) } })} />
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if el.points}
      <p class="text-xs text-dim">Custom shape · {el.points.length} points · extruded {el.h}m at {el.elevation}m</p>
    {/if}

    {#if mode !== 'architecture'}
      <div class="rounded-lg border border-edge p-2.5 space-y-2">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" class="accent-lime" checked={el.bookable}
            onchange={(e) => set({ bookable: e.currentTarget.checked })} />
          Bookable by guests
        </label>
        {#if el.bookable}
          <div class="grid grid-cols-3 gap-2">
            <div>
              <span class="label">Seats</span>
              <input class="input mt-1 px-1.5" type="number" min="1" value={el.capacity}
                oninput={(e) => set({ capacity: num(e.currentTarget.value) })} />
            </div>
            <div>
              <span class="label">Price</span>
              <input class="input mt-1 px-1.5" type="number" min="0" step="50" value={el.price}
                oninput={(e) => set({ price: num(e.currentTarget.value) })} />
            </div>
            <div>
              <span class="label">Deposit</span>
              <input class="input mt-1 px-1.5" type="number" min="0" step="50" value={el.deposit}
                oninput={(e) => set({ deposit: num(e.currentTarget.value) })} />
            </div>
          </div>
        {/if}
      </div>
    {/if}

    {#if mode === 'event'}
      <button class="btn w-full justify-center {el.disabled ? 'border-lime text-lime' : ''}"
        onclick={() => set({ disabled: !el.disabled })}>
        {el.disabled ? 'Enable for this event' : 'Disable for this event'}
      </button>
    {/if}

    <div>
      <span class="label">Color override</span>
      <input class="mt-1 w-full h-8 rounded cursor-pointer bg-ink border border-edge" type="color"
        value={el.color ?? '#8b909c'} oninput={(e) => set({ color: e.currentTarget.value })} />
    </div>
  {:else}
    <p class="text-dim text-sm leading-relaxed">
      Select an element to edit it. Drag to move, corner handle to resize.
      Use Draw Shape to click out a custom polygon, then set its extrusion height.
    </p>
  {/if}
</aside>
