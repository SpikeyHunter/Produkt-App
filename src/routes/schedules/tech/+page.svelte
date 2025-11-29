<script lang="ts">
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase';
    import type { User } from '@supabase/supabase-js';
    import TechScheduleBoard from '$lib/components/schedules/tech/TechScheduleBoard.svelte';
    import MainLayout from '$lib/components/MainLayout.svelte';
    import { goto } from '$app/navigation';
    import dayjs from 'dayjs';
    import isLeapYear from 'dayjs/plugin/isLeapYear';
    import type { TechRow } from '$lib/types/tech-schedule';

    dayjs.extend(isLeapYear);

    let years: number[] = [];
    let selectedYear: number | null = null;
    let viewMode: 'current' | 'past' = 'current'; 
    let creatingYear = false;

    // Auth State
    let currentUser: User | null = null;
    let isLoading = true;

    // Permissions State
    let userPermissions = {
        role: 'viewer', 
        canAddYear: false,
        canEditAll: false,
        allowedColumns: [] as string[]
    };

    // CACHE STATE for Instant Loading
    let scheduleCache: Record<number, TechRow[]> = {};
    let currentRows: TechRow[] = [];
    let isScheduleLoading = false;
    
    // Guest Auth State
    let isGuestAuthenticated = false;
    let passwordInput = '';
    let passwordError = '';

    let hidePastMonths = true;

    // NEW: Delete Mode Toggle State
    let isDeleteMode = false;

    onMount(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session?.user || null;

        if (currentUser) {
            await fetchUserPermissions(currentUser.id);
        }

        supabase.auth.onAuthStateChange(async (_event, session) => {
            currentUser = session?.user || null;
            if (currentUser) {
                await fetchUserPermissions(currentUser.id);
            } else {
                userPermissions = { role: 'viewer', canAddYear: false, canEditAll: false, allowedColumns: [] };
            }
        });

        if (!currentUser) {
            checkGuestAccess();
        }

        await fetchAllYears(); 
        isLoading = false;
        
        const currentY = dayjs().year();
        if (years.includes(currentY)) {
            selectedYear = currentY;
            viewMode = 'current';
        } else if (years.length > 0) {
            selectedYear = years.sort((a, b) => b - a)[0]; 
        }
    });

    // Watch for year selection to load data (Instant if cached)
    $: if (selectedYear) {
        loadScheduleForYear(selectedYear);
        // Reset delete mode when switching years
        isDeleteMode = false;
    }

    async function loadScheduleForYear(year: number) {
        // 1. Instant Load from Cache
        if (scheduleCache[year]) {
            currentRows = scheduleCache[year];
            isScheduleLoading = false;
        } else {
            // 2. Fetch if not in cache
            isScheduleLoading = true;
            currentRows = []; 
            
            const { data, error } = await supabase
                .from('schedule_techs')
                .select('*')
                .eq('year', year)
                .order('date', { ascending: true })
                .order('sort_order', { ascending: true });

            if (!error && data) {
                scheduleCache[year] = data;
                currentRows = data;
            }
            isScheduleLoading = false;
        }
    }

    async function fetchUserPermissions(userId: string) {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('main_permission, secondary_permission')
            .eq('id', userId)
            .single();

        if (error || !data) return;

        const main = data.main_permission;
        
        let secondary: string[] = [];
        if (Array.isArray(data.secondary_permission)) {
            secondary = data.secondary_permission;
        } else if (typeof data.secondary_permission === 'string') {
            secondary = [data.secondary_permission];
        }

        const roles = [main, ...secondary].filter(Boolean);
        // Checking for 'Production' or explicitly 'Admin' if it exists in DB
        if (roles.includes('Production') || roles.includes('Admin')) {
            userPermissions = {
                role: 'production',
                canAddYear: true,
                canEditAll: true,
                allowedColumns: [] 
            };
        } else if (roles.includes('TechEditor')) {
            userPermissions = {
                role: 'editor',
                canAddYear: false,
                canEditAll: true,
                allowedColumns: []
            };
        } else if (roles.includes('TechBooker')) {
            userPermissions = {
                role: 'booker',
                canAddYear: false,
                canEditAll: false,
                allowedColumns: ['ld', 'video', 'vj', 'sound', 'tech_sm', 'dt', 'notes']
            };
        } else {
             userPermissions = { role: 'viewer', canAddYear: false, canEditAll: false, allowedColumns: [] };
        }
    }

    function checkGuestAccess() {
        try {
            const techToken = sessionStorage.getItem('tech_guest_token');
            if (techToken) {
                const { expiry } = JSON.parse(techToken);
                if (Date.now() < expiry) {
                    isGuestAuthenticated = true;
                    return;
                } else {
                    sessionStorage.removeItem('tech_guest_token');
                }
            }
        } catch (e) {
            console.error('Error reading tech token', e);
            sessionStorage.removeItem('tech_guest_token');
        }
        try {
            const smToken = sessionStorage.getItem('guest_access_token');
            if (smToken) {
                const { expiry } = JSON.parse(smToken);
                if (Date.now() < expiry) {
                    isGuestAuthenticated = true;
                    return;
                }
            }
        } catch (e) {
            console.error('Error reading SM token', e);
        }
    }

    function handlePasswordSubmit() {
        if (passwordInput === 'Tech2025!') {
            const expiry = Date.now() + (60 * 60 * 1000);
            sessionStorage.setItem('tech_guest_token', JSON.stringify({ expiry }));
            isGuestAuthenticated = true;
            passwordError = '';
        } else {
            passwordError = 'Incorrect password';
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            handlePasswordSubmit();
        }
    }

    function focusInput(node: HTMLElement) {
        node.focus();
    }

    async function fetchAllYears() {
        let allYears = new Set<number>();
        let from = 0;
        const limit = 1000;
        let keepFetching = true;

        while(keepFetching) {
            const { data, error } = await supabase
                .from('schedule_techs')
                .select('year')
                .range(from, from + limit - 1);

            if (error || !data || data.length === 0) {
                keepFetching = false;
            } else {
                data.forEach(d => allYears.add(d.year));
                if (data.length < limit) {
                    keepFetching = false;
                } else {
                    from += limit;
                }
            }
        }
        
        if (allYears.size > 0) {
            years = [...allYears];
        } else {
            years = [];
        }
    }

    async function addYear() {
        if (!currentUser || !userPermissions.canAddYear) return;
        creatingYear = true;
        const currentYear = dayjs().year();
        const maxExisting = years.length > 0 ? Math.max(...years) : currentYear - 1;
        const yearToCreate = Math.max(maxExisting + 1, currentYear);
        const startDate = dayjs(`${yearToCreate}-01-01`);
        const newRows = [];

        const isLeap = startDate.isLeapYear();
        for (let i = 0; i < (isLeap ? 366 : 365); i++) {
            const d = startDate.add(i, 'day');
            newRows.push({
                date: d.format('YYYY-MM-DD'),
                year: yearToCreate,
                sort_order: i + 1,
                type: '',
                event_name: ''
            });
        }

        const { error } = await supabase.from('schedule_techs').insert(newRows);
        if (!error) {
            years = [...years, yearToCreate].sort((a, b) => b - a);
            selectedYear = yearToCreate;
            viewMode = 'current'; 
        } else {
            alert('Error creating year: ' + (error as any).message);
        }
        creatingYear = false;
    }

    $: displayedYears =
        viewMode === 'current'
            ? years.filter((y) => y >= dayjs().year()).sort((a, b) => a - b)
            : years.filter((y) => y < dayjs().year()).sort((a, b) => b - a);
            
    $: if (viewMode) {
        const currentSelectionInList = selectedYear && displayedYears.includes(selectedYear);
        if (!currentSelectionInList) {
            if (displayedYears.length > 0) {
                selectedYear = displayedYears[0];
            } else {
                selectedYear = null;
            }
        }
    }
</script>

<svelte:head>
    <title>Schedule Techs</title>
</svelte:head>

{#if !isLoading}
    {#if currentUser || isGuestAuthenticated}
        {#if currentUser}
            <MainLayout>
                <div class="flex flex-col h-[calc(100vh-30px)] w-full bg-gray1">
                    <slot name="content">
                        <div class="flex items-center justify-between px-2 py-4 border-b border-gray2/20 bg-gray1">
                            <div class="flex items-center gap-6">
                                <h2 class="text-lime font-bold text-lg uppercase tracking-wider">Schedule Techs</h2>

                                <div class="flex space-x-1">
                                   <div class="mr-2">
                                        <button
                                            class="px-5 py-2 text-sm font-bold rounded-t-lg hover:cursor-pointer transition-colors border-t border-x bg-transparent border-gray2/30 hover:bg-white/5 text-gray2/50 uppercase"
                                            on:click={() => (viewMode = viewMode === 'current' ? 'past' : 'current')}
                                        >
                                            {viewMode}
                                        </button>
                                    </div>
                                    {#each displayedYears as year}
                                         <button
                                            class="px-5 py-2 text-sm font-bold rounded-t-lg hover:cursor-pointer transition-colors border-t border-x {selectedYear ===
                                            year
                                                ? 'bg-gray1 text-white border-gray2/30'
                                                : 'bg-transparent text-gray2 border-transparent hover:text-white hover:bg-white/5'}"
                                            on:click={() => (selectedYear = year)}
                                        >
                                            {year}
                                        </button>
                                    {/each}

                                    {#if displayedYears.length === 0}
                                        <span class="text-gray2 text-xs italic py-2 px-2">No {viewMode} years found</span>
                                    {/if}
                                 </div>
                            </div>

                            <div class="flex items-center gap-4">
                                 {#if userPermissions.role === 'production'}
                                    <button 
                                        class="flex items-center justify-center p-2 rounded-full transition-all duration-200 hover:cursor-pointer hover:scale-110 focus:outline-none {isDeleteMode ? 'bg-problem/10 hover:bg-problem/20' : 'bg-gray2/10 hover:bg-gray2/20'}"
                                        on:click={() => isDeleteMode = !isDeleteMode}
                                        title={isDeleteMode ? "Exit Delete Mode" : "Enter Delete Mode"}
                                    >
                                        {#if isDeleteMode}
                                            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-problem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                 <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                                <line x1="14" y1="11" x2="14" y2="17"></line>
                                            </svg>
                                        {:else}
                                            <div class="relative w-5 h-5 flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                     <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
                                                    <path d="M13 13l6 6"></path>
                                                 </svg>
                                                <div class="absolute inset-0 rounded-full border border-gray2 opacity-50"></div>
                                            </div>
                                        {/if}
                                    </button>
                                {/if}

                                <button
                                    class="flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-gray2/30 text-gray2 transition-all text-xs font-bold hover:text-white hover:border-gray2 hover:cursor-pointer"
                                    on:click={() => goto('/schedules/stagemanager')}
                                >
                                    <span class="uppercase tracking-wider">Stage Manager</span>
                                </button>

                                <button
                                     class="flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all text-xs font-bold hover:cursor-pointer
                                    {hidePastMonths
                                        ? 'border-gray2/30 text-gray2 hover:text-white hover:border-gray2 '
                                        : 'border-gray2/30 text-lime'}"
                                    on:click={() => (hidePastMonths = !hidePastMonths)}
                                     title={hidePastMonths ? 'Show Previous Months' : 'Hide Previous Months'}
                                >
                                    {#if hidePastMonths}
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                                            <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.742L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" clip-rule="evenodd" />
                                        </svg>
                                    {:else}
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                                             <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                                            <path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 8.201 2.665 9.336 6.41.147.481.147.99 0 1.472C18.201 14.335 14.257 17 10 17c-4.257 0-8.201-2.665-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                                        </svg>
                                    {/if}
                                     <span class="uppercase tracking-wider">Previous Months</span>
                                </button>

                                {#if currentUser}
                                 <button
                                    class="bg-lime text-black text-xs font-bold px-4 py-1.5 rounded-2xl transition-all 
                                    {userPermissions.canAddYear ? 'hover:bg-lime/80 hover:cursor-pointer' : 'opacity-30 cursor-not-allowed grayscale'} 
                                    disabled:opacity-50 disabled:cursor-not-allowed"
                                    on:click={addYear}
                                     disabled={creatingYear || !userPermissions.canAddYear}
                                    title={userPermissions.canAddYear ? "Add a new year schedule" : "Production role required"}
                                >
                                    {creatingYear ? 'GENERATING...' : '+ ADD YEAR'}
                                </button>
                               {/if}
                            </div>
                        </div>

                        <div class="flex-1 overflow-hidden relative bg-gray1">
                            {#if isLoading}
                                <div class="flex items-center justify-center h-full text-lime animate-pulse">
                                    <p>Loading...</p>
                                </div>
                            {:else if selectedYear}
                                {#key selectedYear}
                                    <TechScheduleBoard 
                                        year={selectedYear} 
                                        loading={isScheduleLoading}
                                        {hidePastMonths} 
                                        {userPermissions}
                                        {isDeleteMode}
                                        bind:rows={currentRows}
                                    />
                                {/key}
                            {:else}
                                <div class="flex flex-col items-center justify-center h-full text-gray2 gap-4">
                                     <p class="text-lg">No schedules found for {viewMode} years.</p>
                                    {#if viewMode === 'current' && currentUser && userPermissions.canAddYear}
                                         <button
                                            class="text-lime hover:cursor-pointer hover:underline font-bold"
                                            on:click={addYear}
                                        >
                                            Create {dayjs().year()} Schedule Now
                                        </button>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </slot>
                </div>
            </MainLayout>
        {:else}
            <div class="w-full h-screen bg-gray1 overflow-hidden flex flex-col p-4">
                <div class="flex items-center justify-between px-6 py-4 border-b border-gray2/20 bg-gray1">
                    <div class="flex items-center gap-6">
                         <h2 class="text-lime font-bold text-lg uppercase tracking-wider">Schedule Techs</h2>
                        <div class="flex space-x-1">
                            <div class="mr-2">
                                <button
                                    class="px-5 py-2 text-sm font-bold rounded-t-lg hover:cursor-pointer transition-colors border-t border-x bg-transparent border-gray2/30 hover:bg-white/5 text-gray2/50 uppercase"
                                    on:click={() => (viewMode = viewMode === 'current' ? 'past' : 'current')}
                                >
                                    {viewMode}
                                </button>
                            </div>
                            {#each displayedYears as year}
                                <button
                                    class="px-5 py-2 text-sm font-bold rounded-t-lg hover:cursor-pointer transition-colors border-t border-x {selectedYear ===
                                    year
                                         ? 'bg-gray1 text-white border-gray2/30'
                                        : 'bg-transparent text-gray2 border-transparent hover:text-white hover:bg-white/5'}"
                                    on:click={() => (selectedYear = year)}
                                >
                                    {year}
                                </button>
                            {/each}

                            {#if displayedYears.length === 0}
                                <span class="text-gray2 text-xs italic py-2 px-2">No {viewMode} years found</span>
                            {/if}
                        </div>
                    </div>

                    <div class="flex items-center gap-4">
                          <button
                            class="flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-gray2/30 text-gray2 transition-all text-xs font-bold hover:text-lime hover:border-gray2/30 hover:cursor-pointer"
                            on:click={() => goto('/schedules/stagemanager')}
                        >
                            <span class="uppercase tracking-wider">Stage Manager</span>
                        </button>

                        <button
                            class="flex items-center gap-2 px-3 py-1.5 rounded-2xl border transition-all text-xs font-bold hover:cursor-pointer
                            {hidePastMonths
                                ? 'border-gray2/30 text-gray2 hover:text-white hover:border-gray2 '
                                : 'border-gray2/30 text-lime'}"
                            on:click={() => (hidePastMonths = !hidePastMonths)}
                            title={hidePastMonths ? 'Show Previous Months' : 'Hide Previous Months'}
                        >
                            {#if hidePastMonths}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                                     <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.742L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" clip-rule="evenodd" />
                                </svg>
                            {:else}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                                     <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                                    <path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 8.201 2.665 9.336 6.41.147.481.147.99 0 1.472C18.201 14.335 14.257 17 10 17c-4.257 0-8.201-2.665-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                                </svg>
                            {/if}
                            <span class="uppercase tracking-wider">Previous Months</span>
                        </button>
                    </div>
                </div>

                <div class="flex-1 overflow-hidden relative bg-gray1">
                    {#if isLoading}
                        <div class="flex items-center justify-center h-full text-lime animate-pulse">
                            <p>Loading...</p>
                        </div>
                    {:else if selectedYear}
                         {#key selectedYear}
                             <TechScheduleBoard 
                                    year={selectedYear} 
                                    loading={isScheduleLoading}
                                    {hidePastMonths} 
                                    userPermissions={{ role: 'viewer', canAddYear: false, canEditAll: false, allowedColumns: [] }} 
                                    bind:rows={currentRows}
                            />
                        {/key}
                    {:else}
                        <div class="flex flex-col items-center justify-center h-full text-gray2 gap-4">
                             <p class="text-lg">No schedules found for {viewMode} years.</p>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}

    {:else}
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div class="bg-gray1 border border-gray2/30 w-full max-w-md rounded-2xl shadow-2xl p-8 flex flex-col gap-6">
                <div class="text-center">
                    <img src="/images/ProduktXX_LOGO1.png" alt="Produkt Logo" class="h-9 mx-auto mb-10" />
                    <h2 class="text-2xl font-bold text-white mb-2">Schedule Techs</h2>
                    <p class="text-gray2 text-sm">Please enter the password to view the Tech schedule.</p>
                </div>

                <div class="space-y-2">
                    <input 
                        type="password" 
                        placeholder="Enter Password" 
                        bind:value={passwordInput}
                        on:keydown={handleKeydown}
                        use:focusInput
                        class="w-full bg-black/30 border border-gray2/20 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all placeholder-gray2/50"
                    />
                    {#if passwordError}
                        <p class="text-red-500 text-xs text-center font-bold animate-in fade-in slide-in-from-top-1">
                            {passwordError}
                        </p>
                    {/if}
                </div>

                <button 
                    on:click={handlePasswordSubmit}
                    class="w-full py-3 rounded-xl bg-lime text-black font-bold hover:bg-lime/90 transition-all shadow-lg shadow-lime/10"
                >
                    Access Schedule
                </button>
            </div>
        </div>
    {/if}
{:else}
    <div class="w-full h-screen bg-gray1 flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
    </div>
{/if}