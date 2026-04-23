<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fly, fade } from 'svelte/transition';

    export let events: any[] = [];
    export let selectedEvent: any = null;
    export let isBookingUser = false;
    export let currentUser: any;
    export let loading = false;
    export let isViewingAllEvents = false;

    const dispatch = createEventDispatcher();

    let viewMode: 'LIVE' | 'PAST' = 'LIVE';
    let searchTerm = '';
    let showDropdown = false;
    let showApproveModal = false;

    let resetStep = 0;
    let resetTimeout: any;

    // Keywords to exclude from event list (case-insensitive)
    const excludeKeywords = [
        'test',
        'réservations',
        'pass',
        'event',
        'template',
        'produktworld',
        'piknic',
        'oktoberfest'
    ];

    // Exact color palette from EventActions.svelte
    const COLORS = {
        problem:   '#FCA5A5',  // To Do
        proposed:  '#FDBA74',  // In Progress
        question:  '#c4b5fd',  // Done
        confirmed: '#86EFAC',  // Approved
    };

    const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
        'todo':        { label: 'To Do',      color: COLORS.problem   },
        'in_progress': { label: 'In Progress', color: COLORS.proposed  },
        'done':        { label: 'Done',        color: COLORS.question  },
        'approved':    { label: 'Approved',    color: COLORS.confirmed },
    };

    // All 4 statuses in the 2×2 grid — Approved is the 4th slot
    const STATUS_OPTIONS = ['todo', 'in_progress', 'done', 'approved'];

    // ─── Derived ─────────────────────────────────────────────────────────────
    $: filteredEvents = events
        .filter((e: any) => {
            // Requirement 1: Exclude custom events and events with no venue
            if (e.is_custom === true) return false;
            if (!e.event_venue) return false;

            // Exclude events whose name contains any banned keyword
            const nameLower = (e.event_name ?? '').toLowerCase();
            if (excludeKeywords.some(kw => nameLower.includes(kw))) return false;

            // LIVE / PAST split
            const isPast = new Date(e.event_date) < new Date();
            if (viewMode === 'LIVE' ? isPast : !isPast) return false;

            // Search filter
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                return (
                    nameLower.includes(s) ||
                    (e.artist_name ?? '').toLowerCase().includes(s) ||
                    (e.event_venue ?? '').toLowerCase().includes(s)
                );
            }
            
            return true;
        })
        .sort((a: any, b: any) => {
            if (!a.event_date) return 1;
            if (!b.event_date) return -1;
            const tA = new Date(a.event_date).getTime();
            const tB = new Date(b.event_date).getTime();
            return viewMode === 'LIVE' ? tA - tB : tB - tA;
        });

    $: currentStatusKey = (() => {
        const rep = selectedEvent?.box_office_reports;
        if (!rep) return 'todo';
        return (Array.isArray(rep) ? rep[0]?.status : rep.status) || 'todo';
    })();

    // ─── Helpers ─────────────────────────────────────────────────────────────
    function getStatusDetails(evt: any) {
        const rep = evt?.box_office_reports;
        const key = rep ? (Array.isArray(rep) ? rep[0]?.status : rep.status) : 'todo';
        return STATUS_CONFIG[key] ?? STATUS_CONFIG['todo'];
    }

    function formatDate(dateStr: string | null): string {
        if (!dateStr) return 'Date TBD';
        try {
            const parts = dateStr.split('-').map(Number);
            const date  = new Date(parts[0], parts[1] - 1, parts[2]);
            const day   = date.getDate();
            const month = date.toLocaleString('en-US', { month: 'long' });
            const year  = date.getFullYear();

            const getSuffix = (d: number) => {
                if (d > 3 && d < 21) return 'th';
                switch (d % 10) {
                    case 1: return 'st';
                    case 2: return 'nd';
                    case 3: return 'rd';
                    default: return 'th';
                }
            };
            return `${month} ${day}${getSuffix(day)}, ${year}`;
        } catch {
            return dateStr;
        }
    }

    function formatDateLong(dateStr: string | null): string {
        if (!dateStr) return 'TBD';
        try {
            const parts = dateStr.split('-').map(Number);
            const date  = new Date(parts[0], parts[1] - 1, parts[2]);
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year:    'numeric',
                month:   'long',
                day:     'numeric',
            });
        } catch {
            return dateStr;
        }
    }

    function getStatusStyle(isActive: boolean, color: string): string {
        if (!isActive) {
            return `border-width: 2px; border-color: #333333; color: #333333; background-color: transparent;`;
        }
        return `background-color: ${color}; color: black; border-color: ${color}; border-width: 1px;`;
    }

    // ─── Handlers ────────────────────────────────────────────────────────────
    function handleSelect(event: any) {
        dispatch('select', event);
        showDropdown = false;
    }

    function handleApprove() {
        const approverName = `${currentUser?.first_name} ${currentUser?.last_name}`;
        dispatch('approve', {
            status:      'approved',
            approved_by: approverName,
            approved_at: new Date().toISOString(),
        });
        showApproveModal = false;
    }

    function handleStatusClick(statusId: string) {
        if (statusId === 'approved') {
            if (isBookingUser) showApproveModal = true;
        } else {
            dispatch('statusChange', statusId);
        }
    }

    function handleResetClick() {
        if (resetTimeout) clearTimeout(resetTimeout);
        
        if (resetStep === 0) {
            resetStep = 1;
            resetTimeout = setTimeout(() => { resetStep = 0; }, 3000);
        } else if (resetStep === 1) {
            resetStep = 2;
            resetTimeout = setTimeout(() => { resetStep = 0; }, 3000);
        } else if (resetStep === 2) {
            resetStep = 0;
            dispatch('resetReport');
        }
    }

    function handleClickOutside(e: MouseEvent) {
        if (!(e.target as HTMLElement).closest('.event-selector-container')) {
            showDropdown = false;
        }
    }

    function handleToggleAllEvents() {
        console.log('--- ALL EVENTS TOGGLE CLICKED ---');
        console.log('Total Events Received by Selector:', events.length);
        
        const statusCounts: Record<string, number> = { todo: 0, in_progress: 0, done: 0, approved: 0, missing_report: 0 };
        let eventsWithReports = 0;

        events.forEach(e => {
            const rep = e.box_office_reports;
            if (rep) {
                const isArr = Array.isArray(rep);
                if ((isArr && rep.length > 0) || !isArr) {
                    eventsWithReports++;
                    const s = String(isArr ? rep[0].status : rep.status);
                    if (statusCounts[s] !== undefined) {
                        statusCounts[s]++;
                    } else {
                        statusCounts[s] = 1;
                    }
                } else {
                    statusCounts.missing_report++;
                }
            } else {
                statusCounts.missing_report++;
            }
        });

        console.log('Events containing a Box Office Report:', eventsWithReports);
        console.log('Status Breakdown:', JSON.stringify(statusCounts));
        
        dispatch('toggleAllEvents');
    }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="event-selector-container flex flex-col gap-4 w-full h-full">

    <div class="relative w-full">
       <h1 class="ml-2 mt-2 text-2xl uppercase text-gray2">Box Office</h1>
       <h2 class="ml-2 mb-2 text-gray2/70">Scan Reports</h2>
       <button
            type="button"
            on:click={() => (showDropdown = !showDropdown)}
            disabled={loading}
            class="w-full bg-navbar text-white rounded-2xl px-4 py-2.5 text-sm font-bold flex items-center justify-between border-2 border-navbar hover:border-gray3/50 hover:cursor-pointer hover:text-gray3 transition-colors focus:outline-none focus:ring-1 focus:ring-lime disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <span class="flex items-center gap-2 truncate">
                <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8"  y1="2" x2="8"  y2="6" />
                    <line x1="3"  y1="10" x2="21" y2="10" />
                </svg>
                <span class="truncate">{selectedEvent ? selectedEvent.event_name : 'Select Event'}</span>
            </span>
            <svg
                class="w-4 h-4 transition-transform flex-shrink-0 {showDropdown ? 'rotate-180' : ''}"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            >
                <polyline points="6 9 12 15 18 9" />
            </svg>
        </button>

        {#if showDropdown}
            <div
                transition:fly={{ y: -5, duration: 150 }}
                class="absolute top-full left-0 right-0 mt-1 bg-navbar rounded-3xl shadow-xl z-50 overflow-hidden flex flex-col"
            >
                <div class="p-2 border-b border-gray1 space-y-2">
                    <div class="flex gap-1 bg-gray1 p-1 rounded-3xl">
                        <button
                            class="flex-1 text-xs font-bold py-1.5 cursor-pointer rounded-3xl transition-all {viewMode === 'LIVE' ? 'bg-lime text-black shadow-sm' : 'text-gray-400 hover:text-white'}"
                            on:click={() => (viewMode = 'LIVE')}
                        >LIVE</button>
                        <button
                            class="flex-1 text-xs font-bold py-1.5 cursor-pointer rounded-3xl transition-all {viewMode === 'PAST' ? 'bg-lime text-black shadow-sm' : 'text-gray-400 hover:text-white'}"
                            on:click={() => (viewMode = 'PAST')}
                        >PAST</button>
                    </div>
                   
                    <input
                        type="text"
                        bind:value={searchTerm}
                        placeholder="Search for an event"
                        class="w-full bg-gray1 text-white rounded-3xl px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime"
                    />
                </div>

                <div class="max-h-72 overflow-y-auto custom-scrollbar">
                
                    {#if loading}
                        <div class="p-4 flex justify-center">
                            <div class="animate-spin w-5 h-5 border-2 border-lime border-t-transparent rounded-full"></div>
                        </div>

                    {:else if filteredEvents.length > 0}
                        {#each filteredEvents as event (event.event_id)}
                            {@const isSelected = selectedEvent?.event_id === event.event_id}
                            {@const statusInfo = getStatusDetails(event)}
                            <button
                                on:click={() => handleSelect(event)}
                                class="group w-full text-left p-3 hover:bg-gray1 transition-colors flex items-center gap-4 border-b border-gray1 last:border-b-0 cursor-pointer"
                            >
                                {#if event.event_flyer}
                                    <img src={event.event_flyer} alt={event.event_name} class="w-12 h-16 object-cover rounded flex-shrink-0" />
                                {:else}
                                    <div class="w-12 h-16 bg-gray1 rounded flex items-center justify-center flex-shrink-0">
                                        <svg class="w-6 h-6 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                                            <circle cx="8.5" cy="8.5" r="1.5"/>
                                            <path d="M21 15l-5-5L5 21"/>
                                        </svg>
                                    </div>
                                 {/if}

                                <div class="flex-1 min-w-0">
                                    <div class="text-white text-sm font-bold truncate transition-colors group-hover:text-lime">
                                         {event.event_name}
                                    </div>
                                    <div class="text-gray2 text-xs">
                                        {event.event_venue || 'No Venue'} • {formatDate(event.event_date)}
                                    </div>
                                    <div class="mt-1">
                                        <span
                                            class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-black"
                                            style="background-color: {statusInfo.color};"
                                        >{statusInfo.label}</span>
                                    </div>
                                </div>

                                {#if isSelected}
                                    <svg class="w-5 h-5 text-lime flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                        <polyline points="20 6 9 17 4 12" />
                                     </svg>
                                {/if}
                            </button>
                         {/each}

                    {:else}
                        <div class="p-4 text-center text-gray2 text-sm">
                            {searchTerm ? 'No matching events found' : `No ${viewMode.toLowerCase()} events available`}
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>

    {#if selectedEvent}
         <div class="w-full bg-navbar border border-gray1 rounded-xl p-3 flex items-start gap-4">
            <div class="flex-shrink-0 w-24 rounded-lg overflow-hidden border border-gray1 relative self-start bg-black">
                {#if selectedEvent.event_flyer}
                    <img
                        src={selectedEvent.event_flyer}
                        alt={selectedEvent.event_name}
                        class="w-full h-auto block"
                    />
                {:else}
                    <div class="w-full aspect-[3/4] flex items-center justify-center text-gray2 bg-gray1">
                        <span class="text-[10px]">No Flyer</span>
                    </div>
                {/if}
                {#if selectedEvent.event_status === 'LIVE'}
                    <div class="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-lime text-black shadow-sm">
                        LIVE
                    </div>
                {/if}
            </div>

            <div class="flex flex-col justify-center min-w-0 py-1 space-y-1">
                <div class="text-white font-bold text-sm leading-snug break-words">
                    {selectedEvent.event_name || selectedEvent.artist_name}
                </div>
                <div class="text-gray3 text-xs leading-snug break-words">
                    {formatDateLong(selectedEvent.event_date)}
                </div>
                <div class="text-lime text-xs font-bold leading-snug break-words">
                     {selectedEvent.event_venue || 'No Venue'}
                </div>
                <div class="text-gray2 text-xs font-mono pt-1">
                    Event ID: {selectedEvent.event_id}
                </div>
            </div>
        </div>

    {:else}
         <div class="w-full bg-navbar border border-gray1 rounded-xl p-6 flex flex-col items-center justify-center text-gray2 gap-2">
            <svg class="w-8 h-8 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8"  y1="2" x2="8"  y2="6"/>
                <line x1="3"  y1="10" x2="21" y2="10"/>
            </svg>
            <span class="text-xs italic">Select an event</span>
        </div>
    {/if}

    <div class="bg-navbar border border-gray1 rounded-xl p-3 transition-all duration-300 {selectedEvent ? '' : 'opacity-50 grayscale pointer-events-none'}">
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-xs font-bold text-gray3 uppercase tracking-wider m-0">Status</h3>
            <button
                type="button"
                on:click={handleResetClick}
                class="text-[10px] font-bold px-2 py-1 rounded-3xl transition-colors text-problem border border-problem/30 hover:bg-problem hover:text-black cursor-pointer"
            >
                {#if resetStep === 0}
                    Reset
                {:else if resetStep === 1}
                    Are you sure?
                {:else}
                    Report will be reset
                {/if}
            </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
            {#each STATUS_OPTIONS as statusId}
                {@const statConfig = STATUS_CONFIG[statusId]}
                {@const isActive   = currentStatusKey === statusId}
                {@const isReportApproved = currentStatusKey === 'approved'}
                {@const isApprove  = statusId === 'approved'}
                
                {@const isDisabled = (!isBookingUser && isReportApproved) || (!isBookingUser && isApprove)}
                
                <button
                    type="button"
                    on:click={() => handleStatusClick(statusId)}
                    disabled={isDisabled}
                    class="py-2.5 px-2 rounded-lg text-xs font-bold transition-all 
                           {isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-90 hover:border-gray3 hover:text-white'}"
                    style={getStatusStyle(isActive, statConfig.color)}
                >
                    {statConfig.label}
                </button>
            {/each}
        </div>
    </div>

    <button
        type="button"
        on:click={handleToggleAllEvents}
        class="w-full py-2.5 rounded-3xl font-bold text-sm tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2 
        {isViewingAllEvents ? 'bg-transparent border-2 border-lime text-lime hover:bg-lime hover:text-black' : 'bg-transparent border-2 border-gray2 text-gray2 hover:bg-gray2 hover:text-black'}"
    >
        {isViewingAllEvents ? 'Close All Events' : 'View All Events'}
    </button>

</div>

{#if showApproveModal}
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" transition:fade={{ duration: 150 }}>
        <div
            class="absolute inset-0 bg-black/70 backdrop-blur-md"
            role="button"
            tabindex="-1"
            aria-label="Close modal"
            on:click={() => (showApproveModal = false)}
            on:keypress={(e) => e.key === 'Escape' && (showApproveModal = false)}
        ></div>

        <div
            class="relative bg-navbar border border-gray2/20 rounded-3xl w-full max-w-sm shadow-2xl p-6"
            in:fly={{ y: 20, duration: 200 }}
        >
            <h3 class="text-xl font-bold text-white mb-2 border-b border-gray1 py-3">Approve Report</h3>
             <p class="text-gray2 mb-6 mt-2">
                Are you sure you want to approve this report? This will lock it and mark it as approved by
                <strong class="text-white">{currentUser?.first_name} {currentUser?.last_name}</strong>.
            </p>
            <div class="flex gap-3 justify-end">
                <button
                    type="button"
                    class="px-6 py-2.5 bg-gray3 text-black font-bold rounded-full hover:bg-gray2 transition-colors cursor-pointer"
                    on:click={() => (showApproveModal = false)}
                >Cancel</button>
                <button
                    type="button"
                    class="px-6 py-2.5 font-bold rounded-full hover:bg-white transition-colors cursor-pointer text-black"
                    style="background-color: {COLORS.confirmed};"
                    on:click={handleApprove}
                >Confirm</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar       { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: var(--color-navbar); }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-gray1); border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-gray2); }
</style>