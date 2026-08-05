<!--
    BudgetItemRow — one budget line.
    Columns: [flag] [item name] [Budgeted $] [Actual $] [qty] [unit] [total] [hide] [delete]
    - Flag (circle icon): marks the line "to be revised" -> whole row in problem color.
    - Eye: hides the line (greyed out, excluded from totals + PDF).
    - `price` = Budgeted $ (legacy field, old budgets untouched). `actual` = Actual $.
  -->
  <script lang="ts">
      import { createEventDispatcher } from 'svelte';
      import { fade } from 'svelte/transition';
      import { formatMoney, itemBudgetedTotal, itemActualTotal } from '$lib/utils/budgetUtils';
      import type { BudgetItem, Preset } from '$lib/types/budget';
      import BudgetCurrencyInput from './BudgetCurrencyInput.svelte';
  
      export let item: BudgetItem;
      export let availablePresets: Preset[] = [];
  
      const dispatch = createEventDispatcher();
      const unitOptions = ['Item', 'Hour', 'Day'];
  
      let showPresets = false;
      let showUnits = false;
      let nameSearch = '';
  
      function notifyUpdate() {
          dispatch('update');
      }
      function notifySave() {
          dispatch('save');
      }
      function change() {
          notifyUpdate();
          notifySave();
      }
  
      function handleNameFocus() {
          showPresets = true;
          showUnits = false;
          nameSearch = item.name;
      }
      function handleNameBlur() {
          setTimeout(() => (showPresets = false), 150);
          notifySave();
      }
      function selectPreset(preset: Preset) {
          item.name = preset.name;
          item.price = preset.price;
          item.quantity = preset.quantity ?? 1;
          item.unit = preset.unit ?? '';
          showPresets = false;
          nameSearch = '';
          change();
      }
  
      function handleUnitFocus() {
          showUnits = true;
          showPresets = false;
      }
      function handleUnitBlur() {
          setTimeout(() => (showUnits = false), 150);
          notifySave();
      }
      function selectUnit(unit: string) {
          item.unit = unit;
          showUnits = false;
          change();
      }
  
      function toggleFlag() {
          item.flagged = !item.flagged;
          change();
      }
      function toggleHidden() {
          item.hidden = !item.hidden;
          change();
      }
  
      $: groupedFilteredPresetArray = Object.entries(
          (availablePresets || [])
              .filter((p) => p.name.toLowerCase().includes(nameSearch.toLowerCase()))
              .reduce(
                  (acc, preset) => {
                      const type = preset.type || 'Uncategorized';
                      if (!acc[type]) acc[type] = [];
                      acc[type].push(preset);
                      return acc;
                  },
                  {} as { [type: string]: Preset[] }
              )
      );
  
      $: budgTotal = itemBudgetedTotal(item);
      $: actTotal = itemActualTotal(item);
      $: hasActual = item.actual !== null && item.actual !== undefined;
      $: rowText = item.flagged ? 'text-problem' : 'text-white';
      // Flagged: inputs get the problem tint (not the whole row)
      $: inputBg = item.flagged ? 'bg-problem/15' : 'bg-gray1';
  </script>
  
  <div
      class="row-grid items-center rounded-lg px-0.5 {item.hidden ? 'opacity-40' : ''}"
      in:fade|local={{ duration: 150 }}
  >
      <!-- Flag -->
      <button
          type="button"
          on:click={toggleFlag}
          class="flex items-center justify-center rounded-full cursor-pointer transition-colors
          {item.flagged ? 'text-problem' : 'text-gray2/50 hover:text-gray2'}"
          title={item.flagged ? 'Unflag line' : 'Flag line to be revised'}
          aria-label="Flag line"
      >
          <!-- warning triangle with exclamation mark -->
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill={item.flagged ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-linejoin="round" />
              <line x1="12" y1="9" x2="12" y2="13" stroke-linecap="round" stroke={item.flagged ? '#1a1a1a' : 'currentColor'} />
              <circle cx="12" cy="16.5" r="0.5" fill={item.flagged ? '#1a1a1a' : 'currentColor'} stroke={item.flagged ? '#1a1a1a' : 'currentColor'} stroke-width="1.5" />
          </svg>
      </button>
  
      <!-- Name + preset autocomplete -->
      <div class="relative min-w-0">
          <input
              type="text"
              bind:value={item.name}
              disabled={item.hidden}
              on:focus={handleNameFocus}
              on:input={(e) => {
                  nameSearch = e.currentTarget.value;
                  change();
              }}
              on:blur={handleNameBlur}
              placeholder="Type or select preset"
              class="w-full {inputBg} {rowText} rounded-lg px-2 py-1 text-[12px] placeholder-gray2"
          />
          {#if showPresets && groupedFilteredPresetArray.length > 0}
              <div class="absolute top-full left-0 right-0 mt-1 bg-gray1 border border-white/10 rounded-lg shadow-xl z-20 max-h-32 overflow-y-auto custom-scroll">
                  {#each groupedFilteredPresetArray as [type, presets]}
                      <div class="px-3 py-1 text-lime text-xs font-bold uppercase tracking-wider">{type}</div>
                      {#each presets as preset}
                          <button
                              type="button"
                              class="w-full text-left px-3 py-1 text-white hover:bg-lime hover:text-black cursor-pointer text-[12px]"
                              on:mousedown={() => selectPreset(preset)}
                          >
                              {preset.name}
                          </button>
                      {/each}
                  {/each}
              </div>
          {/if}
      </div>
  
      <!-- Budgeted $ -->
      <BudgetCurrencyInput
          bind:value={item.price}
          disabled={item.hidden}
          on:input={change}
          on:blur={notifySave}
          class="w-full {inputBg} {rowText} rounded-lg px-2 py-1 text-[12px] placeholder-gray2"
      />
  
      <!-- Actual $ -->
      <BudgetCurrencyInput
          bind:value={item.actual}
          disabled={item.hidden}
          on:input={change}
          on:blur={notifySave}
          class="w-full {inputBg} {hasActual ? 'text-confirmed' : rowText} rounded-lg px-2 py-1 text-[12px] placeholder-gray2/60"
      />
  
      <!-- Qty -->
      <input
          type="number"
          bind:value={item.quantity}
          disabled={item.hidden}
          on:input={change}
          on:blur={notifySave}
          placeholder="1"
          class="w-full {inputBg} {rowText} rounded-lg px-2 py-1 text-[12px] placeholder-gray2 text-center"
      />
  
      <!-- Unit -->
      <div class="relative">
          <input
              type="text"
              bind:value={item.unit}
              disabled={item.hidden}
              on:focus={handleUnitFocus}
              on:input={change}
              on:blur={handleUnitBlur}
              placeholder="Item"
              class="w-full {inputBg} {rowText} rounded-lg px-2 py-1 text-[12px] placeholder-gray2"
          />
          {#if showUnits}
              <div class="absolute top-full left-0 right-0 mt-1 bg-gray1 border border-white/10 rounded-lg shadow-xl z-20 max-h-32 overflow-y-auto custom-scroll">
                  {#each unitOptions as unit}
                      <button
                          type="button"
                          class="w-full text-left px-3 py-1 text-white hover:bg-lime hover:text-black cursor-pointer text-[12px]"
                          on:mousedown={() => selectUnit(unit)}
                      >
                          {unit}
                      </button>
                  {/each}
              </div>
          {/if}
      </div>
  
      <!-- Totals: budgeted (and actual underneath when set) -->
      <div class="text-right leading-tight pr-0.5">
          <div class="{rowText} text-[12px] font-medium whitespace-nowrap">{formatMoney(budgTotal)}</div>
          {#if hasActual}
              <div class="text-confirmed text-[10px] font-medium whitespace-nowrap">{formatMoney(actTotal)}</div>
          {/if}
      </div>
  
      <!-- Actions: hide + delete -->
      <div class="flex items-center justify-end gap-0.5">
          <button
              type="button"
              on:click={toggleHidden}
              class="w-5 h-5 flex items-center justify-center rounded cursor-pointer flex-shrink-0 transition-colors {item.hidden ? 'text-lime' : 'text-gray2 hover:text-white'}"
              title={item.hidden ? 'Show line (include in totals)' : 'Hide line (exclude from totals)'}
              aria-label="Toggle line visibility"
          >
              {#if item.hidden}
                  <!-- eye-off -->
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
              {:else}
                  <!-- eye -->
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                  </svg>
              {/if}
          </button>
          <button
              type="button"
              on:click={() => dispatch('delete')}
              class="w-5 h-5 flex items-center justify-center rounded text-gray2 hover:text-problem cursor-pointer flex-shrink-0 transition-colors"
              title="Delete line"
              aria-label="Delete line"
          >
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" />
                  <line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" />
              </svg>
          </button>
      </div>
  </div>
  
  <style>
      .row-grid {
          display: grid;
          grid-template-columns: 18px minmax(0, 1fr) minmax(64px, 84px) minmax(64px, 84px) 34px minmax(40px, 54px) minmax(74px, 92px) 40px;
          gap: 4px;
      }
      input[type='number']::-webkit-inner-spin-button,
      input[type='number']::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
      }
      input[type='number'] {
          -moz-appearance: textfield;
          appearance: textfield;
      }
      .custom-scroll { scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.16) transparent; }
      .custom-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
      .custom-scroll::-webkit-scrollbar-track { background: transparent; }
      .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 9999px; }
      .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
  </style>