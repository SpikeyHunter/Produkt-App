<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { DEFAULT_THEME, type GuestTheme } from '$lib/layout';

  let saveMsg = $state('');

  const fields: { key: keyof GuestTheme; label: string }[] = [
    { key: 'bg1', label: 'Background' },
    { key: 'bg2', label: 'Background glow' },
    { key: 'panel', label: 'Panels' },
    { key: 'accent', label: 'Accent' },
    { key: 'glow', label: 'Glow / highlight' },
    { key: 'text', label: 'Text' },
    { key: 'dim', label: 'Muted text' }
  ];

  function set(key: keyof GuestTheme, value: string) {
    app.theme = { ...app.theme, [key]: value } as GuestTheme;
  }
  async function save() {
    await app.saveTheme(app.theme);
    saveMsg = 'Saved';
    setTimeout(() => (saveMsg = ''), 2500);
  }
</script>

<div class="space-y-5 max-w-3xl">
  <div class="flex items-center gap-3">
    <div>
      <h1 class="text-xl font-semibold tracking-tight">Guest site appearance</h1>
      <p class="text-dim text-sm">Colors, gradient and typography of everything under /book.</p>
    </div>
    <div class="ml-auto flex items-center gap-2">
      {#if saveMsg}<span class="text-sm text-dim">{saveMsg}</span>{/if}
      <button class="btn" onclick={() => (app.theme = { ...DEFAULT_THEME })}>Reset</button>
      <button class="btn btn-accent" onclick={save}>Save theme</button>
    </div>
  </div>

  <div class="grid sm:grid-cols-2 gap-4">
    <div class="rounded-xl border border-edge bg-panel p-4 space-y-3">
      {#each fields as f}
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm">{f.label}</span>
          <div class="flex items-center gap-2">
            <input type="color" class="w-9 h-8 rounded cursor-pointer bg-ink border border-edge"
              value={app.theme[f.key]} oninput={(e) => set(f.key, e.currentTarget.value)} />
            <input class="input w-24 font-mono text-xs" value={app.theme[f.key]}
              onchange={(e) => set(f.key, e.currentTarget.value)} />
          </div>
        </div>
      {/each}
      <div class="flex items-center justify-between gap-3 pt-1">
        <span class="text-sm">Display font</span>
        <select class="input w-40" value={app.theme.font}
          onchange={(e) => set('font', e.currentTarget.value)}>
          <option value="marcellus">Marcellus (elegant)</option>
          <option value="inter">Inter (modern)</option>
          <option value="mono">Mono (technical)</option>
        </select>
      </div>
    </div>

    <!-- Live preview -->
    <div class="rounded-xl border border-edge overflow-hidden"
      style="background: radial-gradient(600px 300px at 50% -10%, {app.theme.bg2} 0%, transparent 60%), {app.theme.bg1}; color:{app.theme.text}">
      <div class="p-6">
        <div style="font-family:{app.theme.font === 'marcellus' ? 'Marcellus, serif' : app.theme.font === 'mono' ? 'monospace' : 'Inter, sans-serif'};
          letter-spacing:0.2em" class="text-xl text-center">NEW CITY GAS</div>
        <div class="text-[10px] text-center tracking-[0.5em] mt-1" style="color:{app.theme.dim}">TABLE RESERVATIONS</div>
        <div class="mt-5 rounded-2xl border-2 p-4" style="border-color:{app.theme.accent}; background:{app.theme.panel}">
          <div class="text-sm font-semibold tracking-widest uppercase">Event Name</div>
          <div class="text-xs mt-1" style="color:{app.theme.dim}">FRI, SEP 26 · Main Room</div>
          <button class="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold"
            style="background:{app.theme.accent}; color:{app.theme.bg1}">Book for $2,200</button>
        </div>
        <div class="mt-3 text-center text-[11px]" style="color:{app.theme.glow}">❖ BOOK YOUR TABLE</div>
      </div>
    </div>
  </div>
  <p class="text-xs text-dim">Per-event overrides come later via each event's <code class="text-fog">theme</code> field — this is the global default.</p>
</div>
