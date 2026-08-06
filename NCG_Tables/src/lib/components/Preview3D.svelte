<script lang="ts">
  import { Canvas } from '@threlte/core';
  import SceneElements from './SceneElements.svelte';
  import type { LayoutElement } from '$lib/layout';

  let {
    room,
    architecture = [] as LayoutElement[],
    elements = [] as LayoutElement[],
    selectedId = $bindable(null as string | null),
    takenIds = new Set<string>(),
    height = '60vh'
  } = $props();
</script>

<div class="rounded-xl border border-edge bg-panel overflow-hidden" style="height:{height}">
  <Canvas>
    <SceneElements {room} {architecture} bind:selectedId {takenIds} elements={elements} />
  </Canvas>
</div>
