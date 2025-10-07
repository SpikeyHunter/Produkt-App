<!-- src/lib/components/production/emailtech/SectionSettings.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let sectionId: string;
  export let settings: Record<string, any> = {};
  
  const dispatch = createEventDispatcher();

  function updateSetting(key: string, value: any) {
    settings = { ...settings, [key]: value };
    dispatch('update', { sectionId, settings });
  }

  function resetToTemplate() {
    dispatch('reset', { sectionId });
  }
</script>

<div class="bg-gray2 rounded-lg p-3 mt-2 space-y-3">
  <div class="flex items-center justify-between">
    <h4 class="text-xs font-bold text-white">Section Settings</h4>
    <button
      type="button"
      onclick={resetToTemplate}
      class="text-xs text-gray3 hover:text-lime transition-colors cursor-pointer"
      title="Reset to template"
    >
      Reset
    </button>
  </div>

  {#if sectionId === 'crew_call'}
    <div class="space-y-2">
      <div>
        <label for="mainCrewTime-{sectionId}" class="text-xs text-gray3 block mb-1">
          Main Crew Call Time
        </label>
        <input
          id="mainCrewTime-{sectionId}"
          type="time"
          value={settings.mainCrewTime || '19:00'}
          oninput={(e) => updateSetting('mainCrewTime', e.currentTarget.value)}
          class="w-full bg-navbar border border-gray1 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-lime"
        />
      </div>
      <div>
        <label for="vjTime-{sectionId}" class="text-xs text-gray3 block mb-1">
          VJ Arrival Time
        </label>
        <input
          id="vjTime-{sectionId}"
          type="time"
          value={settings.vjTime || '20:30'}
          oninput={(e) => updateSetting('vjTime', e.currentTarget.value)}
          class="w-full bg-navbar border border-gray1 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-lime"
        />
      </div>
    </div>
  {/if}

  {#if sectionId === 'header'}
    <div class="space-y-2">
      <div>
        <label for="greeting-{sectionId}" class="text-xs text-gray3 block mb-1">
          Custom Greeting
        </label>
        <input
          id="greeting-{sectionId}"
          type="text"
          value={settings.greeting || 'Hello everyone'}
          oninput={(e) => updateSetting('greeting', e.currentTarget.value)}
          class="w-full bg-navbar border border-gray1 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-lime"
        />
      </div>
    </div>
  {/if}

  {#if sectionId === 'projects'}
    <div class="space-y-2">
      <div>
        <label for="exteriorTime-{sectionId}" class="text-xs text-gray3 block mb-1">
          Exterior Projector Time
        </label>
        <input
          id="exteriorTime-{sectionId}"
          type="time"
          value={settings.exteriorTime || '21:30'}
          oninput={(e) => updateSetting('exteriorTime', e.currentTarget.value)}
          class="w-full bg-navbar border border-gray1 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-lime"
        />
      </div>
    </div>
  {/if}
</div>

<style>
  input[type="time"]::-webkit-calendar-picker-indicator {
    filter: invert(1);
    cursor: pointer;
  }
</style>