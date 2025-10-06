<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Customer } from '$lib/services/customersService';
  import Button from '$lib/components/buttons/Button.svelte';
  import { EXCLUDED_USERS } from '$lib/components/settings/CustomersSettings';

  export let customers: Customer[] = [];
  export let totalCount: number = 0;
  export let currentPage: number = 1;
  export let totalPages: number = 1;
  export let pageSize: number = 50;
  export let isLoading: boolean = false;
  export let activeFiltersString: string = 'All_Customers';
  export let isExporting: boolean = false;

  let ticketCount: number = 1;

  const columnWidths = {
    firstName: 'min-width: 80px;', 
    lastName: 'min-width: 80px;',
    email: 'min-width: 180px;', 
    age: 'min-width: 50px;', 
    gender: 'min-width: 70px;',
    spend: 'min-width: 70px;', 
    shows: 'min-width: 60px;', 
    tickets: 'min-width: 60px;', 
    lastPurchase: 'min-width: 90px;',
  };
  let sortField: string | null = 'lastPurchase';
  let sortDirection: 'asc' | 'desc' = 'desc';
  const dispatch = createEventDispatcher();
  $: sortedAndFilteredCustomers = [...customers]
    .filter(customer => customer.user_mail && !EXCLUDED_USERS.includes(customer.user_mail.toLowerCase()))
    .sort((a, b) => {
      if (!sortField) return 0;

      let comparison = 0;

      if (sortField === 'shows') {
        const valA = a.event_ids?.length || 0;
        const valB = b.event_ids?.length || 0;
        comparison = valA - valB;
      } else {
        
        const keyMap: { [key: string]: keyof Customer } = {
          firstName: 'user_first_name',
          lastName: 'user_last_name',
          age: 'user_age',
          gender: 'user_gender',
          spend: 'user_total_spend',
          tickets: 'user_tickets_purchased',
          lastPurchase: 'user_last_purchase'
        };
      
        
        const key = keyMap[sortField];
        if (!key) return 0;

        const valA = a[key];
        const valB = b[key];

        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        if (sortField === 'lastPurchase') {
           comparison = new Date(valA as string).getTime() - new Date(valB as string).getTime();
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        } else {
          comparison = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase());
        }
      }
      
      return sortDirection === 'asc' ?
        comparison : -comparison;
    });

  function handleSort(field: string) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
    dispatch('sortChange', { sortField, sortDirection });
  }

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    dispatch('pageChange', page);
  }
  
  function handleExport() {
    if (totalCount === 0) return;
    dispatch('export', { ticketCount, activeFiltersString });
  }

  function formatDate(dateString?: string): string {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    } catch {
      return '-';
    }
  }
  
  function formatCurrency(amount?: number): string {
    if (amount === undefined || amount === null) return '$0';
    return `$${Math.round(amount)}`;
  }

  const SortArrow = (myField: string, currentSortField: string | null, direction: 'asc' | 'desc') => {
    const active = myField === currentSortField;
    const colorClass = active ? 'text-lime' : 'text-gray2 opacity-30 group-hover:opacity-100 transition-opacity';
    const arrowDirection = active ? direction : 'asc';
    if (arrowDirection === 'asc') {
      return `<svg class="w-3.5 h-3.5 ml-1 ${colorClass}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-8 8h16z"/></svg>`;
    }
    return `<svg class="w-3.5 h-3.5 ml-1 ${colorClass}" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20l8-8H4z"/></svg>`;
  }
</script>

<div class="bg-navbar border border-gray1 rounded-xl h-full flex flex-col">
  <div class="p-4 border-b border-gray1">
    <div class="flex items-center justify-between mb-3">
      <div>
        <h3 class="text-white text-lg font-bold">Customer Database</h3>
        <p class="text-gray2 text-xs mt-1">
          {#if isLoading}
            Loading customers...
          {:else if totalCount > 0}
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} customers
          {:else}
            No customers found
          {/if}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <label for="ticket-count" class="text-gray2 text-xs font-bold">Qty:</label>
        <div class="flex items-center gap-1.5">
          <button
            on:click={() => ticketCount = Math.max(1, ticketCount - 1)}
            class="text-white hover:bg-lime hover:text-black transition-colors font-bold text-base leading-none px-2 py-1 rounded cursor-pointer"
            aria-label="Decrease ticket count"
          >
            −
          </button>
          <input
            id="ticket-count"
            type="number"
            min="1"
            bind:value={ticketCount}
            class="bg-transparent text-white w-8 text-center text-sm font-bold focus:outline-none"
          />
          <button
            on:click={() => ticketCount = ticketCount + 1}
            class="text-white hover:bg-lime hover:text-black transition-colors font-bold text-base leading-none px-2 py-1 rounded cursor-pointer"
            aria-label="Increase ticket count"
          >
            +
          </button>
        </div>
        <Button variant="gray" on:click={handleExport} disabled={totalCount === 0 || isExporting}>
          <span class="flex items-center gap-2">
            {#if isExporting}
              <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
            {:else}
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {/if}
            Export {isExporting ? '...' : ''}
          </span>
        </Button>
      </div>
    </div>
  </div>
  
  <div class="flex-1 overflow-auto">
    {#if isLoading}
      <div class="flex items-center justify-center h-64">
        <div class="animate-spin w-8 h-8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-lime"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg></div>
      </div>
    {:else if sortedAndFilteredCustomers.length > 0}
      <table class="w-full">
        <thead class="sticky top-0 bg-navbar border-b border-gray1 z-10">
           <tr>
            <th class="text-left pl-4 pr-2 py-3 text-gray2 text-xs font-bold" style={columnWidths.firstName}><button type="button" on:click={() => handleSort('firstName')} class="group flex items-center gap-0.5">First<span>{@html SortArrow('firstName', sortField, sortDirection)}</span></button></th>
            <th class="text-left px-2 py-3 text-gray2 text-xs font-bold" style={columnWidths.lastName}><button type="button" on:click={() => handleSort('lastName')} class="group flex items-center gap-0.5">Last<span>{@html SortArrow('lastName', sortField, sortDirection)}</span></button></th>
            <th class="text-left px-2 py-3 text-gray2 text-xs font-bold" style={columnWidths.email}>Email</th>
            <th class="text-left px-2 py-3 text-gray2 text-xs font-bold" style={columnWidths.age}><button type="button" on:click={() => handleSort('age')} class="group flex items-center gap-0.5">Age<span>{@html SortArrow('age', sortField, sortDirection)}</span></button></th>
            <th class="text-left px-2 py-3 text-gray2 text-xs font-bold" style={columnWidths.gender}><button type="button" on:click={() => handleSort('gender')} class="group flex items-center gap-0.5">Gender<span>{@html SortArrow('gender', sortField, sortDirection)}</span></button></th>
            <th class="text-left px-2 py-3 text-gray2 text-xs font-bold" style={columnWidths.spend}><button type="button" on:click={() => handleSort('spend')} class="group flex items-center gap-0.5">Spend<span>{@html SortArrow('spend', sortField, sortDirection)}</span></button></th>
            <th class="text-left px-2 py-3 text-gray2 text-xs font-bold" style={columnWidths.shows}><button type="button" on:click={() => handleSort('shows')} class="group flex items-center gap-0.5">Shows<span>{@html SortArrow('shows', sortField, sortDirection)}</span></button></th>
            <th class="text-left px-2 py-3 text-gray2 text-xs font-bold" style={columnWidths.tickets}><button type="button" on:click={() => handleSort('tickets')} class="group flex items-center gap-0.5">Tix<span>{@html SortArrow('tickets', sortField, sortDirection)}</span></button></th>
            <th class="text-left px-2 py-3 text-gray2 text-xs font-bold" style={columnWidths.lastPurchase}><button type="button" on:click={() => handleSort('lastPurchase')} class="group flex items-center gap-0.5">Last<span>{@html SortArrow('lastPurchase', sortField, sortDirection)}</span></button></th>
          </tr>
        </thead>
        <tbody>
          {#each sortedAndFilteredCustomers as customer (customer.user_id)}
            <tr class="border-b border-gray1 hover:bg-gray1 transition-colors">
              <td class="pl-4 pr-2 py-2 text-white text-xs truncate" style="max-width: 100px;" title={customer.user_first_name}>{customer.user_first_name || '-'}</td>
              <td class="px-2 py-2 text-white text-xs truncate" style="max-width: 100px;" title={customer.user_last_name}>{customer.user_last_name || '-'}</td>
              <td class="px-2 py-2 text-lime text-xs truncate" style="max-width: 200px;" title={customer.user_mail}>{customer.user_mail || '-'}</td>
              <td class="px-2 py-2 text-white text-xs">{customer.user_age || '-'}</td>
              <td class="px-2 py-2 text-white text-xs">
                {#if customer.user_gender}
                  <span class="px-1.5 py-0.5 rounded text-xs font-semibold {customer.user_gender === 'MALE' ? 'bg-blue-500/20 text-blue-400' : customer.user_gender === 'FEMALE' ? 'bg-pink-500/20 text-pink-400' : 'bg-gray2/20 text-gray2'}">
                    {customer.user_gender === 'PREFER_NOT_TO_SAY' ? 'N/A' : customer.user_gender.charAt(0)}
                  </span>
                {:else}
                  -
                {/if}
              </td>
              <td class="px-2 py-2 text-white text-xs font-bold">{formatCurrency(customer.user_total_spend)}</td>
              <td class="px-2 py-2 text-white text-xs">{customer.event_ids?.length || 0}</td>
              <td class="px-2 py-2 text-white text-xs">{customer.user_tickets_purchased || 0}</td>
              <td class="px-2 py-2 text-gray2 text-xs">{formatDate(customer.user_last_purchase)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <div class="flex flex-col items-center justify-center h-64 text-center">
        <svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <p class="text-gray2 text-sm">No customers found</p>
        <p class="text-gray2 text-xs mt-1">Try adjusting your filters</p>
      </div>
    {/if}
  </div>
  
  {#if totalPages > 1}
    <div class="p-4 border-t border-gray1">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
           <button on:click={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Go to previous page" title="Previous page" class="p-2 rounded-lg transition-colors {currentPage === 1 ? 'bg-gray1 text-gray2 cursor-not-allowed' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button>
          <div class="flex items-center gap-1">
            {#if totalPages <= 7}
              {#each Array(totalPages) as _, i}
                <button on:click={() => goToPage(i + 1)} aria-label="Go to page {i + 1}" class="w-8 h-8 rounded-lg text-xs font-bold transition-colors {currentPage === i + 1 ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}">{i + 1}</button>
              {/each}
            {:else}
              <button on:click={() => goToPage(1)} aria-label="Go to page 1" class="w-8 h-8 rounded-lg text-xs font-bold transition-colors {currentPage === 1 ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}">1</button>
              {#if currentPage > 3}<span class="text-gray2 px-1">...</span>{/if}
              {#each Array(3) as _, i}
                {@const page = currentPage - 1 + i}
                {#if page > 1 && page < totalPages}
                  <button on:click={() => goToPage(page)} aria-label="Go to page {page}" class="w-8 h-8 rounded-lg text-xs font-bold transition-colors {currentPage === page ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}">{page}</button>
                {/if}
              {/each}
              {#if currentPage < totalPages - 2}<span class="text-gray2 px-1">...</span>{/if}
              <button on:click={() => goToPage(totalPages)} aria-label="Go to page {totalPages}" class="w-8 h-8 rounded-lg text-xs font-bold transition-colors {currentPage === totalPages ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}">{totalPages}</button>
            {/if}
          </div>
          <button on:click={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Go to next page" title="Next page" class="p-2 rounded-lg transition-colors {currentPage === totalPages ? 'bg-gray1 text-gray2 cursor-not-allowed' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>
        </div>
        <div class="text-xs text-gray2">Page {currentPage} of {totalPages}</div>
      </div>
    </div>
  {/if}
</div>

<style>
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--color-navbar); }
  ::-webkit-scrollbar-thumb { background: var(--color-lime); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background-color: var(--color-lime); }
  th button { font-family: inherit; font-size: inherit; font-weight: inherit; color: inherit; background: none; border: none; padding: 0; cursor: pointer; }
  
  /* Style for the number input to remove arrows */
  input[type=number]::-webkit-inner-spin-button, 
  input[type=number]::-webkit-outer-spin-button { 
    -webkit-appearance: none; 
    appearance: none;
    margin: 0; 
  }
  input[type=number] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
</style>