<!-- src/routes/booking/customers/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import MainLayout from '$lib/components/MainLayout.svelte';
  import CustomerFilterPresets from '$lib/components/booking/customers/CustomerFilterPresets.svelte';
  import CustomerList from '$lib/components/booking/customers/CustomerList.svelte';
  import CustomerFilters from '$lib/components/booking/customers/CustomerFilters.svelte';
  import { fetchFilteredCustomers, exportCustomers } from '$lib/services/customersService';
  import { exportCustomersToCSV } from '$lib/utils/csvExport';
  import { DEFAULT_PAGE_SIZE } from '$lib/components/settings/CustomersSettings';
  import type { Customer, CustomerFilters as FilterType } from '$lib/services/customersService';
  
  let customers: Customer[] = [];
  let totalCount = 0;
  let totalPages = 1;
  let currentPage = 1;
  let isLoading = false;
  let isExporting = false;
  let mounted = false;
  
  let filters: FilterType = {
    venues: [],
    ageRange: undefined,
    spendRange: undefined,
    ticketsRange: undefined,
    genders: [],
    selectedEvents: [],
    searchTerm: '',
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sortField: null,
    sortDirection: null
  };
  
  let searchTimeout: NodeJS.Timeout;
  let searchTerm = '';
  let activeFiltersString = 'All_Customers';
  
  onMount(() => {
    setTimeout(() => {
      mounted = true;
    }, 100);
    // Don't load all customers on mount - wait for filters
  });
  
  // Generate a descriptive string for the active filters
  function generateFiltersString(): string {
    const parts: string[] = [];
    
    if (filters.venues?.length) {
      parts.push(`Venues_${filters.venues.join('_')}`);
    }
    if (filters.genres?.length) {
      parts.push(`Genres_${filters.genres.join('_')}`);
    }
    if (filters.selectedEvents?.length) {
      parts.push(`Events_${filters.selectedEvents.length}`);
    }
    if (filters.genders?.length) {
      parts.push(`Genders_${filters.genders.join('_')}`);
    }
    if (filters.ageRange) {
      parts.push(`Age_${filters.ageRange.min}-${filters.ageRange.max}`);
    }
    if (filters.spendRange) {
      parts.push(`Spend_${filters.spendRange.min}-${filters.spendRange.max}`);
    }
    if (filters.ticketsRange) {
      parts.push(`Tickets_${filters.ticketsRange.min}-${filters.ticketsRange.max}`);
    }
    if (searchTerm.trim()) {
      parts.push(`Search_${searchTerm.trim().replace(/\s+/g, '_')}`);
    }
    
    return parts.length > 0 ? parts.join('_') : 'All_Customers';
  }
  
  async function loadCustomers() {
    // Only load if we have some filters applied
    const hasFilters = 
      (filters.venues && filters.venues.length > 0) ||
      (filters.genres && filters.genres.length > 0) ||
      (filters.genders && filters.genders.length > 0) ||
      (filters.selectedEvents && filters.selectedEvents.length > 0) ||
      filters.ageRange ||
      filters.spendRange ||
      filters.ticketsRange ||
      searchTerm.trim();
    
    if (!hasFilters) {
      customers = [];
      totalCount = 0;
      totalPages = 1;
      activeFiltersString = 'All_Customers';
      return;
    }
    
    isLoading = true;
    try {
      const result = await fetchFilteredCustomers({
        ...filters,
        searchTerm,
        page: currentPage
      });
      
      customers = result.customers;
      totalCount = result.totalCount;
      totalPages = result.totalPages;
      activeFiltersString = generateFiltersString();
    } catch (error) {
      console.error('Error loading customers:', error);
      customers = [];
      totalCount = 0;
      totalPages = 1;
    } finally {
      isLoading = false;
    }
  }
  
  function handleFiltersChange(event: CustomEvent) {
    filters = {
      ...filters,
      ...event.detail,
      page: 1
    };
    currentPage = 1;
    loadCustomers();
  }
  
  function handlePresetSelect(event: CustomEvent) {
    filters = {
      ...filters,
      ...event.detail,
      page: 1
    };
    currentPage = 1;
    loadCustomers();
  }
  
  function handlePresetClear() {
    filters = {
      venues: [],
      ageRange: undefined,
      spendRange: undefined,
      ticketsRange: undefined,
      genders: [],
      selectedEvents: [],
      searchTerm: '',
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sortField: null,
      sortDirection: null
    };
    currentPage = 1;
    searchTerm = '';
    loadCustomers();
  }
  
  function handlePageChange(event: CustomEvent) {
    currentPage = event.detail;
    filters.page = currentPage;
    loadCustomers();
  }
  
  function handleSortChange(event: CustomEvent) {
    const { sortField, sortDirection } = event.detail;
    filters = {
      ...filters,
      sortField,
      sortDirection,
      page: 1
    };
    currentPage = 1;
    loadCustomers();
  }
  
  function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      filters.page = 1;
      loadCustomers();
    }, 300);
  }
  
  async function handleExport(event: CustomEvent) {
    const { ticketCount, activeFiltersString: filtersString } = event.detail;
    
    isExporting = true;
    
    try {
      // Fetch ALL customers with current filters (no pagination)
      const allCustomers = await exportCustomers({
        venues: filters.venues,
        genres: filters.genres,
        ageRange: filters.ageRange,
        dateRange: filters.dateRange,
        spendRange: filters.spendRange,
        ticketsRange: filters.ticketsRange,
        genders: filters.genders,
        selectedEvents: filters.selectedEvents,
        searchTerm: searchTerm,
        sortField: filters.sortField,
        sortDirection: filters.sortDirection
      });
      
      // Export to CSV
      exportCustomersToCSV(allCustomers, ticketCount, filtersString || activeFiltersString);
      
      console.log(`Exported ${allCustomers.length} customers`);
    } catch (error) {
      console.error('Export failed:', error);
      // Optionally show an error toast/notification here
    } finally {
      isExporting = false;
    }
  }
</script>

<svelte:head>
  <title>Customers Database</title>
</svelte:head>

<MainLayout pageTitle="Customers Database">
  <div class="h-full overflow-hidden p-4">
    <div class="h-full flex gap-4">
      <!-- Left Column (2/3 width) -->
      <div class="flex-1 min-w-[600px] flex flex-col gap-4">
        <!-- Search Bar -->
        <div class="bg-navbar border border-gray1 rounded-xl p-4">
          <div class="flex gap-3">
            <div class="flex-1 relative">
              <input
                type="text"
                bind:value={searchTerm}
                on:input={handleSearchInput}
                placeholder="Search by name or email..."
                class="w-full bg-gray1 text-white rounded-lg px-4 py-2 pl-10 text-sm placeholder-gray2 
                       focus:outline-none focus:ring-1 focus:ring-lime"
              />
              <svg 
                class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray2"
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            
            {#if searchTerm}
              <button
                on:click={() => {
                  searchTerm = '';
                  handleSearchInput();
                }}
                class="px-4 py-2 bg-gray1 text-white rounded-lg hover:bg-gray2 hover:text-black 
                       transition-colors text-sm font-bold"
              >
                Clear
              </button>
            {/if}
          </div>
        </div>
        
        <!-- Quick Filters -->
        <div class="fade-in {mounted ? 'mounted' : ''}">
          <CustomerFilterPresets
            on:selectPreset={handlePresetSelect}
            on:clearPreset={handlePresetClear}
          />
        </div>
        
        <!-- Customer List -->
        <div class="flex-1 min-h-0 fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.1s;">
          <CustomerList
            {customers}
            {totalCount}
            {currentPage}
            {totalPages}
            pageSize={filters.pageSize}
            {isLoading}
            {isExporting}
            {activeFiltersString}
            on:pageChange={handlePageChange}
            on:sortChange={handleSortChange}
            on:export={handleExport}
          />
        </div>
      </div>
      
      <!-- Right Column (1/3 width) -->
      <div class="w-[350px] min-w-[300px] fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.2s;">
        <CustomerFilters
          {filters}
          on:filtersChange={handleFiltersChange}
        />
      </div>
    </div>
  </div>
</MainLayout>

<style>
  .fade-in {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.5s ease-out, transform 0.5s ease-out;
  }
  
  .fade-in.mounted {
    opacity: 1;
    transform: translateY(0);
  }
  
  @media (max-width: 1024px) {
    /* Stack columns on smaller screens */
    :global(.h-full.flex.gap-4) {
      flex-direction: column;
    }
    
    /* Adjust widths for responsive layout */
    :global(.flex-1) {
      min-width: 100% !important;
      width: 100%;
    }
    
    :global(.w-\[350px\]) {
      width: 100% !important;
      min-width: 100% !important;
    }
  }
</style>