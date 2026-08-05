<!--
	BudgetSimpleCategory — flat item list (Artist Fee).
	Now uses the shared BudgetItemRow (flag / Budgeted / Actual / hide / delete).
  -->
  <script lang="ts">
	  import { createEventDispatcher, onMount } from 'svelte';
	  import { supabase } from '$lib/supabase.js';
	  import { formatMoney, itemsBudgetedTotal, itemsActualTotal, itemsHaveActuals } from '$lib/utils/budgetUtils';
	  import type { Preset, BudgetItem } from '$lib/types/budget';
	  import BudgetItemRow from './BudgetItemRow.svelte';
  
	  export let title: string;
	  export let categoryKey: string;
	  export let items: BudgetItem[] = [];
	  export let presetRefreshTrigger = 0;
  
	  const dispatch = createEventDispatcher();
  
	  let availablePresets: Preset[] = [];
  
	  onMount(() => {
		  loadPresets();
	  });
  
	  $: if (presetRefreshTrigger >= 0) {
		  loadPresets();
	  }
  
	  async function loadPresets() {
		  const { data, error } = await supabase
			  .from('show_expenses')
			  .select('*')
			  .eq('category', categoryKey)
			  .order('name');
		  if (error) console.error('Error loading presets:', error);
		  else availablePresets = (data as Preset[]) || [];
	  }
  
	  function notifyUpdate() {
		  dispatch('update');
	  }
	  function notifySave() {
		  dispatch('save');
	  }
  
	  function addItem() {
		  items = [
			  ...items,
			  {
				  id: crypto.randomUUID(),
				  name: '',
				  price: null,
				  actual: null,
				  quantity: 1,
				  unit: '',
				  hidden: false,
				  flagged: false
			  }
		  ];
		  notifyUpdate();
		  notifySave();
	  }
  
	  function deleteItem(id: string) {
		  items = items.filter((item) => item.id !== id);
		  notifyUpdate();
		  notifySave();
	  }
  
	  $: categoryBudgeted = itemsBudgetedTotal(items);
	  $: categoryActual = itemsActualTotal(items);
	  $: hasActuals = itemsHaveActuals(items);
  </script>
  
  <div class="py-3 border-t border-gray1 first:pt-0 first:border-t-0">
	  <!-- Category Header -->
	  <div class="flex justify-between items-center mb-2">
		  <div class="flex items-baseline">
			  <h4 class="text-lime font-bold text-sm uppercase">{title}</h4>
			  <span class="text-sm ml-1 font-bold text-white">- {formatMoney(categoryBudgeted)}</span>
			  {#if hasActuals}
				  <span class="ml-2 text-xs font-bold text-confirmed">act. {formatMoney(categoryActual)}</span>
			  {/if}
		  </div>
		  <div class="flex items-center gap-2">
			  <button
				  type="button"
				  on:click={addItem}
				  class="px-2 py-0.5 bg-lime text-black text-xs font-bold rounded-2xl hover:bg-lime/90 cursor-pointer"
			  >
				  + Add Fee
			  </button>
		  </div>
	  </div>
  
	  <!-- Item List -->
	  <div class="space-y-1">
		  {#if items.length > 0}
			  <div class="header-grid text-gray2 text-[10px] uppercase tracking-wider px-0.5">
				  <div></div>
				  <div>Item</div>
				  <div>Budgeted $</div>
				  <div>Actual $</div>
				  <div class="text-center">Qty</div>
				  <div>Unit</div>
				  <div class="text-right">Total</div>
				  <div></div>
			  </div>
			  {#each items as item (item.id)}
				  <BudgetItemRow
					  bind:item
					  {availablePresets}
					  on:update={notifyUpdate}
					  on:save={notifySave}
					  on:delete={() => deleteItem(item.id)}
				  />
			  {/each}
		  {/if}
	  </div>
  </div>
  
  <style>
	  .header-grid {
		  display: grid;
		  grid-template-columns: 18px minmax(0, 1fr) minmax(64px, 84px) minmax(64px, 84px) 34px minmax(40px, 54px) minmax(74px, 92px) 40px;
		  gap: 4px;
	  }
  </style>