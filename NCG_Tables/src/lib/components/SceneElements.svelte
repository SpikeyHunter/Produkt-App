<script lang="ts">
  import { T } from '@threlte/core';
  import { OrbitControls, interactivity, HTML } from '@threlte/extras';
  import * as THREE from 'three';
  import { tierOf, isPlatform, type LayoutElement } from '$lib/layout';

  let {
    room,
    architecture = [] as LayoutElement[],
    elements = [] as LayoutElement[],
    selectedId = $bindable(null as string | null),
    takenIds = new Set<string>(),
    guest = false,
    selectionMode = 'table' as 'table' | 'section',
    cutoff = false,
    accent = '#ff9e4f'
  } = $props();

  interactivity();

  const KIND_COLOR: Record<string, string> = guest
    ? { banquette: '#e4dccd', standup: '#8c5a3c', bar: '#5b4632', stage: '#4a3323',
        dj: '#54402d', wall: '#241609', cavity: '#120904', riser: '#332417', mezzanine: '#332417', custom: '#7a5f45' }
    : { banquette: '#d9d2c4', standup: '#c98a4d', bar: '#8a5a2c', stage: '#3a3f4c',
        dj: '#7c6bc4', wall: '#3a3d44', cavity: '#14171c', riser: '#2b2e35', mezzanine: '#2b2e35', custom: '#3aa89e' };

  const floorColor = guest ? '#7a5a3e' : '#15171b';
  const wallColor = guest ? '#241609' : '#1c1f24';

  const center = (el: LayoutElement): [number, number, number] => [
    el.x + el.w / 2 - room.width / 2,
    el.elevation,
    el.y + el.d / 2 - room.depth / 2
  ];

  function extrudeGeo(el: LayoutElement): THREE.ExtrudeGeometry {
    const s = new THREE.Shape();
    let pts: [number, number][];
    if (el.points?.length) {
      pts = el.points;
    } else {
      // L-shaped banquette outline (cut at SE corner)
      const { w, d } = el;
      const lw = el.l?.w ?? 0, ld = el.l?.d ?? 0;
      pts = [[0, 0], [w, 0], [w, d - ld], [w - lw, d - ld], [w - lw, d], [0, d]];
    }
    s.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], -pts[i][1]);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: el.h, bevelEnabled: false });
  }

  const soldish = (el: LayoutElement) => takenIds.has(el.id);
  const selectable = (el: LayoutElement) =>
    el.bookable && !el.disabled && !soldish(el) && !cutoff;

  function pick(el: LayoutElement) {
    if (guest) {
      if (!selectable(el)) return;
      selectedId = selectionMode === 'section' ? `sec:${el.section}` : el.id;
    } else {
      selectedId = el.id;
    }
  }

  const isSelected = (el: LayoutElement) =>
    selectedId === el.id || (selectionMode === 'section' && selectedId === `sec:${el.section}`);

  function colorOf(el: LayoutElement): string {
    if (isSelected(el) && guest) return '#ffb877';
    return el.color ?? KIND_COLOR[el.kind] ?? '#8b909c';
  }

  // Sections: centroid + availability + min price (for section-mode chips)
  const sections = $derived.by(() => {
    if (!guest || selectionMode !== 'section') return [];
    const map = new Map<string, { els: LayoutElement[] }>();
    for (const el of elements) {
      if (!el.bookable || el.disabled) continue;
      if (!map.has(el.section)) map.set(el.section, { els: [] });
      map.get(el.section)!.els.push(el);
    }
    return [...map.entries()].map(([name, { els }]) => {
      const free = els.filter((e) => !soldish(e));
      const cx = els.reduce((s, e) => s + e.x + e.w / 2, 0) / els.length - room.width / 2;
      const cz = els.reduce((s, e) => s + e.y + e.d / 2, 0) / els.length - room.depth / 2;
      const top = Math.max(...els.map((e) => e.elevation + e.h));
      return {
        name, cx, cz, top,
        free: free.length,
        minPrice: free.length ? Math.min(...free.map((e) => e.price)) : 0
      };
    });
  });

  const visible = $derived(elements.filter((el) => !(guest && el.disabled)));
  let hovered = $state<string | null>(null);
</script>

<T.PerspectiveCamera makeDefault position={[room.width * 0.15, room.width * 0.55, room.depth * 1.25]} fov={42}>
  <OrbitControls enableDamping maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={room.width * 1.5} target={[0, 0, 0]} />
</T.PerspectiveCamera>

{#if guest}
  <T.AmbientLight intensity={0.45} color="#ffdcb0" />
  <T.DirectionalLight position={[8, 18, 6]} intensity={0.9} color="#ffe6c4" castShadow />
  <T.PointLight position={[room.width / 2 - 5, 5, 0]} intensity={60} color={accent} distance={24} />
  <T.PointLight position={[-room.width / 2 + 4, 4, 0]} intensity={25} color="#ffb877" distance={18} />
{:else}
  <T.AmbientLight intensity={0.55} />
  <T.DirectionalLight position={[10, 20, 10]} intensity={1.1} castShadow />
  <T.PointLight position={[0, 7, 0]} intensity={25} color="#c8f04d" />
{/if}

<!-- Floor -->
<T.Mesh rotation.x={-Math.PI / 2} receiveShadow>
  <T.PlaneGeometry args={[room.width, room.depth]} />
  <T.MeshStandardMaterial color={floorColor} roughness={0.85} />
</T.Mesh>

<!-- Perimeter walls -->
{#each [
  { p: [0, 1.4, -room.depth / 2], s: [room.width, 2.8, 0.18] },
  { p: [-room.width / 2, 1.4, 0], s: [0.18, 2.8, room.depth] },
  { p: [room.width / 2, 1.4, 0], s: [0.18, 2.8, room.depth] }
] as w}
  <T.Mesh position={w.p as [number, number, number]}>
    <T.BoxGeometry args={w.s as [number, number, number]} />
    <T.MeshStandardMaterial color={wallColor} roughness={1} />
  </T.Mesh>
{/each}

<!-- Architecture + elements -->
{#each [...architecture, ...visible] as el (el.id)}
  {@const editable = elements.includes(el)}
  {@const sel = editable && isSelected(el)}
  {@const needsExtrude = !!el.points || (el.kind === 'banquette' && !!el.l)}
  <T.Group
    position={center(el)}
    rotation.y={(-el.rotation * Math.PI) / 180}
    onclick={(e: any) => { e.stopPropagation(); if (editable) pick(el); }}
    onpointerenter={() => { hovered = el.id; }}
    onpointerleave={() => { hovered = null; }}
  >
    {#if needsExtrude}
      <T.Mesh geometry={extrudeGeo(el)} rotation.x={-Math.PI / 2}
        position={[-el.w / 2, 0, -el.d / 2]} castShadow receiveShadow>
        <T.MeshStandardMaterial color={colorOf(el)} roughness={0.7}
          emissive={sel && guest ? accent : '#000000'} emissiveIntensity={sel && guest ? 0.5 : 0}
          transparent={!guest && el.disabled} opacity={!guest && el.disabled ? 0.3 : 1} />
      </T.Mesh>
    {:else}
      <T.Mesh position={[0, el.h / 2, 0]} castShadow receiveShadow
        scale={guest && hovered === el.id && selectable(el) ? 1.05 : 1}>
        {#if el.kind === 'standup'}
          <T.CylinderGeometry args={[el.w / 2, el.w / 2 * 0.35, el.h, 24]} />
        {:else}
          <T.BoxGeometry args={[el.w, el.h, el.d]} />
        {/if}
        <T.MeshStandardMaterial color={colorOf(el)}
          roughness={isPlatform(el.kind) ? 0.95 : 0.55}
          emissive={sel ? (guest ? accent : '#c8f04d') : '#000000'}
          emissiveIntensity={sel ? 0.45 : 0}
          transparent={!guest && el.disabled} opacity={!guest && el.disabled ? 0.3 : 1} />
      </T.Mesh>
    {/if}

    {#if guest && el.bookable && !el.disabled}
      <T.PointLight position={[0, el.h + 0.35, 0]} intensity={soldish(el) || cutoff ? 0.4 : 2} color="#ffb45e" distance={2.5} />
    {/if}

    <!-- per-table chip -->
    {#if guest && selectionMode === 'table' && el.bookable && !el.disabled}
      {@const tier = tierOf(el.price)}
      {@const closed = soldish(el) || cutoff}
      <HTML position={[0, el.h + 0.9, 0]} center pointerEvents="auto">
        <button onclick={() => pick(el)}
          style="cursor:{closed ? 'default' : 'pointer'};font-family:Inter,sans-serif;white-space:nowrap;text-align:center;
            background:rgba(12,8,5,0.85);backdrop-filter:blur(4px);border-radius:10px;padding:5px 10px;
            border:1.5px solid {closed ? '#6b5a4a' : sel ? accent : tier.color};
            box-shadow:0 2px 14px rgba(0,0,0,0.5);transform:scale({sel ? 1.1 : 1});">
          {#if soldish(el)}
            <div style="color:#e08a8a;font-weight:700;font-size:12px;letter-spacing:0.08em;">SOLD</div>
          {:else if cutoff}
            <div style="color:#9c8a76;font-weight:700;font-size:12px;letter-spacing:0.08em;">CLOSED</div>
          {:else}
            <div style="color:{tier.color};font-weight:700;font-size:12px;letter-spacing:0.08em;">{tier.name}</div>
            <div style="color:#f0e6d8;font-size:11px;">FROM ${el.price.toLocaleString()}</div>
          {/if}
        </button>
      </HTML>
    {/if}
  </T.Group>
{/each}

<!-- section chips -->
{#if guest && selectionMode === 'section'}
  {#each sections as s (s.name)}
    {@const closed = s.free === 0 || cutoff}
    {@const sel = selectedId === `sec:${s.name}`}
    <HTML position={[s.cx, s.top + 1.1, s.cz]} center pointerEvents="auto">
      <button onclick={() => { if (!closed) selectedId = `sec:${s.name}`; }}
        style="cursor:{closed ? 'default' : 'pointer'};font-family:Inter,sans-serif;white-space:nowrap;text-align:center;
          background:rgba(12,8,5,0.88);backdrop-filter:blur(4px);border-radius:12px;padding:7px 14px;
          border:1.5px solid {closed ? '#6b5a4a' : sel ? accent : '#e0c9a8'};
          box-shadow:0 2px 16px rgba(0,0,0,0.55);transform:scale({sel ? 1.08 : 1});">
        <div style="color:#f0e6d8;font-weight:700;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;">{s.name}</div>
        {#if closed}
          <div style="color:#e08a8a;font-size:11px;font-weight:600;">{cutoff ? 'CLOSED' : 'SOLD OUT'}</div>
        {:else}
          <div style="color:#c9b8a0;font-size:11px;">{s.free} left · FROM ${s.minPrice.toLocaleString()}</div>
        {/if}
      </button>
    </HTML>
  {/each}
{/if}
