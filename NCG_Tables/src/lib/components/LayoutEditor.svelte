<script lang="ts">
  import { PX_PER_M, tierOf, type LayoutElement } from '$lib/layout';

  let {
    elements = $bindable([] as LayoutElement[]),
    room,
    backdrop = [] as LayoutElement[],
    selectedId = $bindable(null as string | null),
    drawMode = $bindable(false),
    takenIds = null as Set<string> | null,
    showPricing = true,
    snap = 0.25
  }: {
    elements?: LayoutElement[];
    room: { width: number; depth: number };
    backdrop?: LayoutElement[];
    selectedId?: string | null;
    drawMode?: boolean;
    takenIds?: Set<string> | null;
    showPricing?: boolean;
    snap?: number;
  } = $props();

  let svgEl: SVGSVGElement;
  let dragging: { id: string; ox: number; oy: number } | null = $state(null);
  let resizing: string | null = $state(null);
  let draft = $state<[number, number][]>([]);

  const W = $derived(room.width * PX_PER_M);
  const H = $derived(room.depth * PX_PER_M);

  const KIND_COLOR: Record<string, string> = {
    banquette: '#e4dccd', standup: '#c98a4d', bar: '#b06a30', stage: '#8b8f9c',
    dj: '#a78bfa', wall: '#565b66', cavity: '#3d4450', riser: '#6b7280',
    mezzanine: '#6b7280', custom: '#4dd0c4'
  };

  const snapV = (v: number) => Math.round(v / snap) * snap;

  function pt(e: PointerEvent | MouseEvent) {
    const r = svgEl.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * (W / r.width)) / PX_PER_M,
      y: ((e.clientY - r.top) * (H / r.height)) / PX_PER_M
    };
  }

  function startDrag(e: PointerEvent, el: LayoutElement) {
    if (drawMode) return;
    e.preventDefault();
    selectedId = el.id;
    const p = pt(e);
    dragging = { id: el.id, ox: p.x - el.x, oy: p.y - el.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function startResize(e: PointerEvent, el: LayoutElement) {
    e.stopPropagation();
    e.preventDefault();
    resizing = el.id;
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (resizing) {
      const el = elements.find((x) => x.id === resizing);
      if (!el) return;
      const p = pt(e);
      const w = Math.max(0.5, snapV(p.x - el.x));
      const d = Math.max(0.25, snapV(p.y - el.y));
      elements = elements.map((x) => (x.id === el.id ? { ...x, w, d } : x));
      return;
    }
    if (!dragging) return;
    const el = elements.find((x) => x.id === dragging!.id);
    if (!el) return;
    const p = pt(e);
    const x = Math.min(Math.max(snapV(p.x - dragging.ox), 0), room.width - el.w);
    const y = Math.min(Math.max(snapV(p.y - dragging.oy), 0), room.depth - el.d);
    elements = elements.map((q) => (q.id === el.id ? { ...q, x, y } : q));
  }

  function up() {
    dragging = null;
    resizing = null;
  }

  function canvasDown(e: PointerEvent) {
    if (drawMode) {
      const p = pt(e);
      draft = [...draft, [snapV(p.x), snapV(p.y)]];
      return;
    }
    if (e.target === svgEl || (e.target as Element).id === 'floor') selectedId = null;
  }

  export function finishShape(): LayoutElement | null {
    if (draft.length < 3) { draft = []; drawMode = false; return null; }
    const xs = draft.map((p) => p[0]);
    const ys = draft.map((p) => p[1]);
    const minx = Math.min(...xs), miny = Math.min(...ys);
    const el: LayoutElement = {
      id: crypto.randomUUID(), kind: 'custom', name: 'Shape',
      x: minx, y: miny,
      w: Math.max(...xs) - minx || 1, d: Math.max(...ys) - miny || 1,
      h: 1, elevation: 0, rotation: 0,
      points: draft.map((p) => [p[0] - minx, p[1] - miny]),
      section: 'Floor', bookable: false, capacity: 0, price: 0, deposit: 0
    };
    elements = [...elements, el];
    selectedId = el.id;
    draft = [];
    drawMode = false;
    return el;
  }
  export function cancelShape() { draft = []; drawMode = false; }

  function lPath(el: LayoutElement): string {
    const x = el.x * PX_PER_M, y = el.y * PX_PER_M;
    const w = el.w * PX_PER_M, d = el.d * PX_PER_M;
    const lw = (el.l?.w ?? 0) * PX_PER_M, ld = (el.l?.d ?? 0) * PX_PER_M;
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + d - ld} L ${x + w - lw} ${y + d - ld} L ${x + w - lw} ${y + d} L ${x} ${y + d} Z`;
  }
  function polyPath(el: LayoutElement): string {
    return (el.points ?? [])
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(el.x + p[0]) * PX_PER_M} ${(el.y + p[1]) * PX_PER_M}`)
      .join(' ') + ' Z';
  }
</script>

<div class="rounded-xl border border-edge bg-panel p-3 overflow-auto relative">
  {#if drawMode}
    <div class="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-lg bg-ink/90 border border-lime/50 px-3 py-1.5 text-xs">
      <span class="text-lime font-medium">Draw mode</span>
      <span class="text-dim">click to add points ({draft.length})</span>
      <button class="btn text-xs py-0.5" onclick={() => finishShape()}>Finish</button>
      <button class="btn text-xs py-0.5" onclick={cancelShape}>Cancel</button>
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg bind:this={svgEl} viewBox="0 0 {W} {H}" class="w-full max-h-[68vh] touch-none select-none"
    class:cursor-crosshair={drawMode}
    role="application" aria-label="Layout editor"
    onpointermove={move} onpointerup={up} onpointerdown={canvasDown}>

    <defs>
      <pattern id="grid" width={PX_PER_M} height={PX_PER_M} patternUnits="userSpaceOnUse">
        <path d="M {PX_PER_M} 0 L 0 0 0 {PX_PER_M}" fill="none" stroke="#1d2025" stroke-width="1" />
      </pattern>
      <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#3a3f48" stroke-width="1.5" />
      </pattern>
    </defs>
    <rect id="floor" width={W} height={H} fill="#101216" rx="6" />
    <rect width={W} height={H} fill="url(#grid)" pointer-events="none" rx="6" />
    <rect width={W} height={H} fill="none" stroke="#33363e" stroke-width="2" rx="6" pointer-events="none" />

    <!-- backdrop architecture (not editable here) -->
    {#each backdrop as b (b.id)}
      {@const px = b.x * PX_PER_M} {@const py = b.y * PX_PER_M}
      {@const pw = b.w * PX_PER_M} {@const pd = b.d * PX_PER_M}
      <g opacity="0.55" pointer-events="none"
        transform="rotate({b.rotation} {px + pw / 2} {py + pd / 2})">
        {#if b.points}
          <path d={polyPath(b)} fill="#1a1d22" stroke="#3a3f48" stroke-width="1.5" />
        {:else}
          <rect x={px} y={py} width={pw} height={pd} rx="3"
            fill={b.kind === 'stage' ? 'url(#hatch)' : b.kind === 'wall' ? '#33363e' : '#1a1d22'}
            stroke="#3a3f48" stroke-width="1.5"
            stroke-dasharray={b.kind === 'cavity' || b.kind === 'mezzanine' || b.kind === 'riser' ? '7 5' : 'none'} />
        {/if}
        <text x={px + 6} y={py + 14} fill="#565b66" font-size="10" font-weight="600">{b.name}</text>
      </g>
    {/each}

    <!-- editable elements -->
    {#each elements as el (el.id)}
      {@const px = el.x * PX_PER_M} {@const py = el.y * PX_PER_M}
      {@const pw = el.w * PX_PER_M} {@const pd = el.d * PX_PER_M}
      {@const cx = px + pw / 2} {@const cy = py + pd / 2}
      {@const sel = selectedId === el.id}
      {@const c = el.color ?? KIND_COLOR[el.kind] ?? '#8b909c'}
      {@const taken = takenIds?.has(el.id) ?? false}
      <g transform="rotate({el.rotation} {cx} {cy})"
        opacity={el.disabled ? 0.3 : 1}
        class="cursor-grab active:cursor-grabbing"
        onpointerdown={(e) => startDrag(e, el)}
        role="button" tabindex="0" aria-label={el.name}>

        {#if el.points}
          <path d={polyPath(el)} fill={c} fill-opacity="0.2" stroke={taken ? '#f87171' : c} stroke-width={sel ? 3 : 1.5} />
        {:else if el.l && el.kind === 'banquette'}
          <path d={lPath(el)} fill={c} fill-opacity="0.25" stroke={taken ? '#f87171' : c} stroke-width={sel ? 3 : 1.5} />
        {:else}
          <rect x={px} y={py} width={pw} height={pd}
            rx={el.kind === 'banquette' ? 8 : el.kind === 'standup' ? pw / 2 : 3}
            fill={el.kind === 'stage' ? 'url(#hatch)' : c}
            fill-opacity={el.kind === 'wall' ? 0.9 : 0.25}
            stroke={taken ? '#f87171' : c} stroke-width={sel ? 3 : 1.5}
            stroke-dasharray={el.kind === 'cavity' ? '7 5' : 'none'} />
        {/if}

        {#if sel}
          <rect x={px - 4} y={py - 4} width={pw + 8} height={pd + 8} rx="6" fill="none"
            stroke="#c8f04d" stroke-width="1.5" stroke-dasharray="6 4" pointer-events="none" />
          {#if !el.points && el.rotation === 0}
            <rect x={px + pw - 5} y={py + pd - 5} width="10" height="10" fill="#c8f04d" rx="2"
              class="cursor-nwse-resize" onpointerdown={(e) => startResize(e, el)}
              role="button" tabindex="0" aria-label="resize" />
          {/if}
        {/if}

        <text x={cx} y={cy + 3} text-anchor="middle" fill="#e7e9ee" font-size="11" font-weight="600" pointer-events="none">
          {el.name}
        </text>
        {#if el.bookable && showPricing}
          <text x={cx} y={cy + 16} text-anchor="middle" fill={tierOf(el.price).color} font-size="8.5" pointer-events="none">
            {el.capacity}pp · ${el.price}
          </text>
        {/if}
        {#if el.disabled}
          <text x={cx} y={py - 4} text-anchor="middle" fill="#f87171" font-size="8" pointer-events="none">OFF</text>
        {/if}
      </g>
    {/each}

    <!-- polygon draft -->
    {#if draft.length}
      <path d={draft.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0] * PX_PER_M} ${p[1] * PX_PER_M}`).join(' ')}
        fill="none" stroke="#c8f04d" stroke-width="2" stroke-dasharray="5 4" pointer-events="none" />
      {#each draft as p}
        <circle cx={p[0] * PX_PER_M} cy={p[1] * PX_PER_M} r="4" fill="#c8f04d" pointer-events="none" />
      {/each}
    {/if}
  </svg>
</div>
