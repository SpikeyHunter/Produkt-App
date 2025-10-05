<!-- src/lib/components/booking/customers/CustomerList.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Customer } from '$lib/services/customersService';
  import Button from '$lib/components/buttons/Button.svelte';
  
  export let customers: Customer[] = [];
  export let totalCount: number = 0;
  export let currentPage: number = 1;
  export let totalPages: number = 1;
  export let pageSize: number = 50;
  export let isLoading: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  function formatDate(dateString?: string): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '-';
    }
  }
  
  function formatCurrency(amount?: number): string {
    if (amount === undefined || amount === null) return '$0';
    return `$${amount.toFixed(2)}`;
  }
  
  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    dispatch('pageChange', page);
  }
  
  function handleExport() {
    dispatch('export');
  }
</script>

<div class="bg-navbar border border-gray1 rounded-xl h-full flex flex-col">
  <!-- Header -->
  <div class="p-4 border-b border-gray1">
    <div class="flex items-center justify-between mb-3">
      <div>
        <h3 class="text-white text-lg font-bold">Customer Database</h3>
        <p class="text-gray2 text-xs mt-1">
          {#if totalCount > 0}
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} customers
          {:else}
            No customers found
          {/if}
        </p>
      </div>
      
      <div class="flex gap-2">
        <Button 
          variant="gray" 
          on:click={handleExport}
          disabled={true}
        >
          <span class="flex items-center gap-2">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </span>
        </Button>
      </div>
    </div>
  </div>
  
  <!-- Table Container -->
  <div class="flex-1 overflow-auto">
    {#if isLoading}
      <div class="flex items-center justify-center h-64">
        <div class="animate-spin w-8 h-8">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-lime">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
        </div>
      </div>
    {:else if customers.length > 0}
      <table class="w-full">
        <thead class="sticky top-0 bg-navbar border-b border-gray1">
          <tr>
            <th class="text-left px-4 py-3 text-gray2 text-xs font-bold">ID</th>
            <th class="text-left px-4 py-3 text-gray2 text-xs font-bold">First Name</th>
            <th class="text-left px-4 py-3 text-gray2 text-xs font-bold">Last Name</th>
            <th class="text-left px-4 py-3 text-gray2 text-xs font-bold">Email</th>
            <th class="text-left px-4 py-3 text-gray2 text-xs font-bold">Age</th>
            <th class="text-left px-4 py-3 text-gray2 text-xs font-bold">Gender</th>
            <th class="text-left px-4 py-3 text-gray2 text-xs font-bold">Spend</th>
            <th class="text-left px-4 py-3 text-gray2 text-xs font-bold">Tickets</th>
            <th class="text-left px-4 py-3 text-gray2 text-xs font-bold">Last Purchase</th>
          </tr>
        </thead>
        <tbody>
          {#each customers as customer, i}
            <tr class="border-b border-gray1 hover:bg-gray1 transition-colors">
              <td class="px-4 py-2 text-white text-xs font-mono">{customer.user_id}</td>
              <td class="px-4 py-2 text-white text-xs">{customer.user_first_name || '-'}</td>
              <td class="px-4 py-2 text-white text-xs">{customer.user_last_name || '-'}</td>
              <td class="px-4 py-2 text-lime text-xs truncate max-w-xs">{customer.user_mail || '-'}</td>
              <td class="px-4 py-2 text-white text-xs">{customer.user_age || '-'}</td>
              <td class="px-4 py-2 text-white text-xs">
                {#if customer.user_gender}
                  <span class="px-2 py-0.5 rounded-full text-xs
                              {customer.user_gender === 'MALE' ? 'bg-blue-500/20 text-blue-400' :
                               customer.user_gender === 'FEMALE' ? 'bg-pink-500/20 text-pink-400' :
                               'bg-gray2/20 text-gray2'}">
                    {customer.user_gender}
                  </span>
                {:else}
                  -
                {/if}
              </td>
              <td class="px-4 py-2 text-white text-xs font-bold">{formatCurrency(customer.user_total_spend)}</td>
              <td class="px-4 py-2 text-white text-xs">{customer.user_tickets_purchased || 0}</td>
              <td class="px-4 py-2 text-gray2 text-xs">{formatDate(customer.user_last_purchase)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <div class="flex flex-col items-center justify-center h-64 text-center">
        <svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <p class="text-gray2 text-sm">No customers found</p>
        <p class="text-gray2 text-xs mt-1">Try adjusting your filters</p>
      </div>
    {/if}
  </div>
  
  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="p-4 border-t border-gray1">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button
            on:click={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Go to previous page"
            title="Previous page"
            class="p-2 rounded-lg transition-colors {currentPage === 1
              ? 'bg-gray1 text-gray2 cursor-not-allowed'
              : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          
          <div class="flex items-center gap-1">
            {#if totalPages <= 7}
              {#each Array(totalPages) as _, i}
                <button
                  on:click={() => goToPage(i + 1)}
                  aria-label="Go to page {i + 1}"
                  class="w-8 h-8 rounded-lg text-xs font-bold transition-colors
                        {currentPage === i + 1
                          ? 'bg-lime text-black'
                          : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
                >
                  {i + 1}
                </button>
              {/each}
            {:else}
              <!-- Smart pagination for many pages -->
              <button
                on:click={() => goToPage(1)}
                aria-label="Go to page 1"
                class="w-8 h-8 rounded-lg text-xs font-bold transition-colors
                      {currentPage === 1 ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
              >
                1
              </button>
              
              {#if currentPage > 3}
                <span class="text-gray2 px-1">...</span>
              {/if}
              
              {#each Array(3) as _, i}
                {@const page = currentPage - 1 + i}
                {#if page > 1 && page < totalPages}
                  <button
                    on:click={() => goToPage(page)}
                    aria-label="Go to page {page}"
                    class="w-8 h-8 rounded-lg text-xs font-bold transition-colors
                          {currentPage === page ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
                  >
                    {page}
                  </button>
                {/if}
              {/each}
              
              {#if currentPage < totalPages - 2}
                <span class="text-gray2 px-1">...</span>
              {/if}
              
              <button
                on:click={() => goToPage(totalPages)}
                aria-label="Go to page {totalPages}"
                class="w-8 h-8 rounded-lg text-xs font-bold transition-colors
                      {currentPage === totalPages ? 'bg-lime text-black' : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
              >
                {totalPages}
              </button>
            {/if}
          </div>
          
          <button
            on:click={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Go to next page"
            title="Next page"
            class="p-2 rounded-lg transition-colors {currentPage === totalPages
              ? 'bg-gray1 text-gray2 cursor-not-allowed'
              : 'bg-gray1 text-white hover:bg-gray2 hover:text-black'}"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>
        
        <div class="text-xs text-gray2">
          Page {currentPage} of {totalPages}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: var(--color-navbar);
  }
  
  ::-webkit-scrollbar-thumb {
    background: var(--color-gray1);
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: var(--color-gray2);
  }
</style>