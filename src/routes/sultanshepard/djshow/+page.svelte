<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import MainLayout from '$lib/components/MainLayout.svelte';
    import SearchBar from '$lib/components/inputs/SearchBar.svelte';
    import SSShowCard from '$lib/components/sultanshepard/SSShowCard.svelte';
    import SSShowAddModal from '$lib/components/sultanshepard/SSShowAddModal.svelte';
    import SSShowEditModal from '$lib/components/sultanshepard/SSShowEditModal.svelte';
    import SSFilter, { type FilterType } from '$lib/components/sultanshepard/SSFilter.svelte';
    import { fetchSSShows, type SSShow } from '$lib/services/ssShowService';
    import Button from '$lib/components/buttons/Button.svelte'; // Used for error retry button

    let mounted = false;
    let loading = true;
    let searchValue = '';
    let error: string | null = null;
    
    // Filters & Sorting
    let showLive = true;
    let sortOption: FilterType = 'none';

    // Data State
    let allShows: SSShow[] = [];
    let showAddModal = false;
    let showEditModal = false;
    let selectedShow: SSShow | null = null;

    onMount(async () => {
        // 1. Read filters from URL params FIRST
        const params = $page.url.searchParams;

        if (params.has('live')) {
            showLive = params.get('live') === 'true';
        }
        if (params.has('filter')) {
            sortOption = params.get('filter') as FilterType;
        }
        if (params.has('search')) {
            searchValue = params.get('search') || '';
        }

        // 2. Load Data
        await loadShows();

        // 3. Trigger animation
        setTimeout(() => (mounted = true), 150);
    });

    function updateUrlParams() {
        if (!mounted) return;

        const params = new URLSearchParams();

        if (!showLive) {
            params.set('live', 'false');
        }
        if (sortOption !== 'none') {
            params.set('filter', sortOption);
        }
        if (searchValue) {
            params.set('search', searchValue);
        }

        const newUrl = params.toString()
            ? `/sultanshepard/djshow?${params.toString()}`
            : '/sultanshepard/djshow';
        
        window.history.replaceState({}, '', newUrl);
    }

    async function loadShows() {
        try {
            loading = true;
            error = null;
            allShows = await fetchSSShows();
        } catch (e) {
            console.error(e);
            error = 'Failed to load shows.';
        } finally {
            loading = false;
        }
    }

    // Handlers
    function handleSearch(event: CustomEvent<{ value: string }>) {
        searchValue = event.detail.value;
        updateUrlParams();
    }

    function handleFilterChange(event: CustomEvent<{ filter: FilterType }>) {
        sortOption = event.detail.filter;
        updateUrlParams();
    }

    function handleToggle() {
        showLive = !showLive;
        updateUrlParams();
    }

    function handleCardClick(event: CustomEvent) {
        const show = event.detail.show;
        goto(`/sultanshepard/djshow/${show.id}`);
    }

    function handleEdit(event: CustomEvent) {
        selectedShow = event.detail.show;
        showEditModal = true;
    }

    function handleEditClose() {
        showEditModal = false;
        selectedShow = null;
    }

    function handleSaveSuccess() {
        loadShows();
    }

    // Reactive Filtering & Sorting
    $: filteredShows = allShows
        .filter(show => {
            // Search Filter
            const query = searchValue.toLowerCase();
            const matchesSearch = (
                (show.show_venue?.toLowerCase().includes(query)) ||
                (show.show_city?.toLowerCase().includes(query)) ||
                (show.show_country?.toLowerCase().includes(query))
            );

            if (!matchesSearch) return false;

            // Date Filter (Live vs Past)
            const showDateStr = show.show_date; 
            const todayStr = new Date().toISOString().split('T')[0];

            if (showLive) {
                return showDateStr >= todayStr;
            } else {
                return showDateStr < todayStr;
            }
        })
        .sort((a, b) => {
            switch (sortOption) {
                case 'a-z':
                    return (a.show_venue || '').localeCompare(b.show_venue || '');
                case 'z-a':
                    return (b.show_venue || '').localeCompare(a.show_venue || '');
                case 'date-desc':
                    return new Date(b.show_date).getTime() - new Date(a.show_date).getTime();
                case 'date-asc':
                default:
                    return new Date(a.show_date).getTime() - new Date(b.show_date).getTime();
            }
        });
</script>

<svelte:head>
    <title>Sultan + Shepard | Shows</title>
</svelte:head>

<MainLayout pageTitle="Sultan + Shepard Shows">
    <div class="h-full overflow-auto">
        <div class="page-container">
            
            <div class="fade-in {mounted ? 'mounted' : ''} mb-8" style="transition-delay: 0.1s;">
                <div class="controls-container">
                    <div class="search-container">
                        <SearchBar
                            placeholder="Search venue or city..."
                            bind:value={searchValue}
                            on:input={handleSearch}
                        />
                    </div>

                    <div class="buttons-container">
                        <div class="buttons-left">
                            <SSFilter 
                                currentFilter={sortOption} 
                                on:filterChange={handleFilterChange} 
                            />

                            <button
                                class="h-7 px-4 flex items-center justify-center rounded-[14px] cursor-pointer transition-all duration-200 ease-in-out font-bold text-sm leading-[22px] {showLive
                                    ? 'bg-transparent border border-lime text-lime hover:!bg-lime hover:text-black'
                                    : 'bg-transparent border border-gray3 text-gray3 hover:!bg-gray3 hover:text-black'}"
                                on:click={handleToggle}
                                disabled={loading}
                                aria-label="Toggle between live and past events"
                            >
                                {showLive ? 'Live' : 'Past'}
                            </button>
                        </div>

                        <div class="buttons-right">
                            <button 
                                class="add-event-btn" 
                                on:click={() => showAddModal = true}
                            >
                                <span class="flex items-center gap-2">
                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Add Show
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {#if loading}
                <div class="flex justify-center py-20">
                    <div class="animate-spin w-8 h-8 text-lime">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                        </svg>
                    </div>
                </div>
            {:else if error}
                <div class="flex flex-col items-center justify-center py-16 text-center">
                    <div class="w-16 h-16 mb-4 text-red-500">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">Error Loading Shows</h3>
                    <p class="text-gray2 text-base mb-6">{error}</p>
                    <Button variant="filled" on:click={loadShows}>Retry</Button>
                </div>
            {:else}
                <div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.2s;">
                    {#if filteredShows.length > 0}
                        <div class="events-grid">
                            {#each filteredShows as show, i (show.id)}
                                <div 
                                    class="event-card-wrapper fade-in {mounted ? 'mounted' : ''}"
                                    style="transition-delay: {0.3 + i * 0.05}s;"
                                >
                                    <SSShowCard 
                                        {show} 
                                        on:click={handleCardClick}
                                        on:edit={handleEdit}
                                    />
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="text-center py-20 text-gray2">
                            <div class="w-16 h-16 mx-auto mb-4 text-gray2 opacity-50">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="M21 21L16.5 16.5" />
                                </svg>
                            </div>
                            <h3 class="text-xl font-bold text-white mb-2">No shows found</h3>
                            <p class="text-gray2 text-base mb-6">
                                {#if searchValue}
                                    No shows match "{searchValue}"
                                {:else if showLive}
                                    No upcoming shows scheduled
                                {:else}
                                    No past shows found
                                {/if}
                            </p>
                            {#if searchValue}
                                <Button variant="outline" on:click={() => { searchValue = ''; updateUrlParams(); }}>Clear Search</Button>
                            {:else}
                                <Button variant="filled" on:click={() => showAddModal = true}>
                                    <span class="flex items-center gap-2">
                                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        Add Your First Show
                                    </span>
                                </Button>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</MainLayout>

<SSShowAddModal 
    bind:isOpen={showAddModal} 
    on:close={() => showAddModal = false}
    on:success={handleSaveSuccess}
/>

<SSShowEditModal
    bind:isOpen={showEditModal}
    show={selectedShow}
    on:close={handleEditClose}
    on:save={handleSaveSuccess}
    on:delete={handleSaveSuccess}
/>

<style>
    .page-container {
        padding: 24px;
        min-height: 100%;
        max-width: none;
        transition: all 0.3s ease;
    }

    .fade-in {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s ease-out, transform 0.6s ease-out;
    }
    .fade-in.mounted {
        opacity: 1;
        transform: translateY(0);
    }

    /* Layout matching reference */
    .controls-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        width: 100%;
        max-width: 400px;
        margin: 0 auto;
    }

    .search-container {
        flex: 1;
    }

    .buttons-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
    }

    .buttons-left {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .buttons-right {
        display: flex;
        align-items: center;
    }

    .events-grid {
        display: grid;
        gap: 24px;
        justify-content: center;
        grid-template-columns: repeat(1, 400px);
    }

    .event-card-wrapper {
        width: 400px;
        height: auto;
        cursor: pointer;
    }

    /* Button Styles */
    .add-event-btn {
        height: 28px;
        padding: 0 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        font-family: var(--font-helvetica);
        font-size: 14px;
        line-height: 22px;
        font-weight: 700;
        background: var(--color-lime);
        color: var(--color-black);
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .add-event-btn:hover {
        opacity: 0.9;
    }

    /* Responsive Breakpoints */
    @media (min-width: 900px) {
        .events-grid {
            grid-template-columns: repeat(2, 400px);
        }
        .controls-container {
            max-width: 824px;
        }
    }

    @media (min-width: 1350px) {
        .events-grid {
            grid-template-columns: repeat(3, 400px);
        }
        .controls-container {
            max-width: 1248px;
        }
    }

    @media (min-width: 1800px) {
        .events-grid {
            grid-template-columns: repeat(4, 400px);
        }
        .controls-container {
            max-width: 1672px;
        }
    }

    @media (max-width: 899px) {
        .controls-container {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
            max-width: 400px;
        }

        .search-container {
            width: 100%;
        }

        .buttons-container {
            justify-content: space-between;
            width: 100%;
        }

        .buttons-left {
            justify-content: flex-start;
        }

        .buttons-right {
            justify-content: flex-end;
        }
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .animate-spin {
        animation: spin 0.2s linear infinite;
    }
</style>