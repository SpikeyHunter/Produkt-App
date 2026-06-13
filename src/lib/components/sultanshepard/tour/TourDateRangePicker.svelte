<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fly } from 'svelte/transition';

    export let startDate = '';
    export let endDate = '';
    export let tourYear: number;
    export let disabled = false;
    
    const dispatch = createEventDispatcher();

    let showPicker = false;
    let containerElement: HTMLDivElement;

    // View state a
    let currentMonth = new Date().getMonth();
    let currentYear = new Date().getFullYear();

    // Temp selection state
    let tempStart = '';
    let tempEnd = '';
    let hoverDate = '';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Keep view synced with tour year when it opens or changes
    $: availableYears = tourYear && tourYear > 2000 ? [tourYear - 1, tourYear, tourYear + 1] : [];
    $: if (tourYear && !availableYears.includes(currentYear)) {
        currentYear = tourYear;
    }

    function handleClickOutside(event: MouseEvent) {
        if (showPicker && containerElement && !containerElement.contains(event.target as Node)) {
            cancel();
        }
    }

    function openPicker() {
        if (disabled) return;
        tempStart = startDate;
        tempEnd = endDate;
        hoverDate = '';
        
        if (startDate) {
            const d = new Date(startDate + 'T00:00:00');
            currentMonth = d.getMonth();
            currentYear = d.getFullYear();
        } else if (tourYear) {
            currentMonth = 0; // January
            currentYear = tourYear;
        }
        
        showPicker = true;
    }

    function cancel() {
        showPicker = false;
        hoverDate = '';
    }

    function confirm() {
        startDate = tempStart;
        endDate = tempEnd;
        dispatch('change', { startDate, endDate });
        showPicker = false;
        hoverDate = '';
    }

    function formatDate(y: number, m: number, d: number) {
        return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    function formatDisplay(dateStr: string) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // New Footer Formatter: Jan, 16th 2027
    function getOrdinal(n: number) {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    }

    function formatFooterDate(dateStr: string) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        if (isNaN(d.getTime())) return '';
        const month = d.toLocaleDateString('en-US', { month: 'short' });
        const day = d.getDate();
        const year = d.getFullYear();
        return `${month}, ${day}${getOrdinal(day)} ${year}`;
    }

    function selectDate(y: number, m: number, d: number) {
        const selected = formatDate(y, m, d);
        
        if (!tempStart || (tempStart && tempEnd)) {
            tempStart = selected;
            tempEnd = '';
            hoverDate = '';
        } else {
            if (selected < tempStart) {
                tempEnd = tempStart;
                tempStart = selected;
            } else {
                tempEnd = selected;
            }
            hoverDate = '';
        }
    }

    function handleMouseEnter(y: number, m: number, d: number) {
        if (tempStart && !tempEnd) {
            hoverDate = formatDate(y, m, d);
        }
    }

    function changeMonth(delta: number) {
        let newM = currentMonth + delta;
        let newY = currentYear;
        if (newM < 0) { newM = 11; newY--; }
        if (newM > 11) { newM = 0; newY++; }
        
        if (availableYears.includes(newY)) {
            currentMonth = newM;
            currentYear = newY;
        }
    }

    $: calendarDays = (() => {
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        const remainder = days.length % 7;
        if (remainder > 0) {
            for (let i = 0; i < 7 - remainder; i++) days.push(null);
        }
        return days;
    })();

    // FIXED: Passed variables as arguments so Svelte tracks them reactively
    function getDayClasses(day: number | null, start: string, end: string, hover: string) {
        if (day === null) return '';
        const dateStr = formatDate(currentYear, currentMonth, day);
        
        let rStart = start;
        let rEnd = end;
        let isHovering = false;

        if (start && !end && hover) {
            if (hover < start) {
                rStart = hover;
                rEnd = start;
            } else {
                rEnd = hover;
            }
            isHovering = true;
        }

        const isStart = dateStr === start;
        const isEnd = dateStr === end;
        const isHoverBound = dateStr === hover && !end;
        const inRange = rStart && rEnd && dateStr > rStart && dateStr < rEnd;

        // Base shape
        let classes = 'rounded-full scale-100 '; 

        if (isStart || isEnd) {
            classes += 'bg-lime text-black font-bold shadow-sm z-10 relative';
        } else if (isHoverBound && dateStr !== start) {
            classes += 'bg-lime/40 text-white font-bold border border-lime border-dashed z-10 relative';
        } else if (inRange) {
            // Range connecting shape
            classes = 'rounded-xl scale-95 '; 
            if (isHovering) {
                classes += 'bg-lime/10 text-lime border border-dashed border-lime/30 font-medium';
            } else {
                classes += 'bg-lime/20 text-lime font-medium';
            }
        } else {
            classes += 'text-white hover:bg-white/10';
        }

        return classes;
    }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="relative w-full" bind:this={containerElement}>
    <button
        type="button"
        class="w-full bg-gray1 rounded-3xl px-4 h-[50px] text-white focus:outline-none focus:ring-1 focus:ring-lime transition-all flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed hover:cursor-pointer"
        on:click={() => showPicker ? cancel() : openPicker()}
        {disabled}
    >
        <div class="flex items-center gap-2 text-sm">
            {#if !startDate && !endDate}
                <span class="text-gray2">Select tour dates</span>
            {:else}
                <span class={startDate ? 'text-white font-bold' : 'text-gray2'}>
                    {startDate ? formatDisplay(startDate) : 'Start'}
                </span>
                <span class="text-gray2 text-xs font-bold">—</span>
                <span class={endDate ? 'text-white font-bold' : 'text-gray2'}>
                    {endDate ? formatDisplay(endDate) : 'End'}
                </span>
            {/if}
        </div>
        <svg class="w-4 h-4 text-gray3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    </button>

    {#if showPicker}
        <div
            transition:fly={{ y: -10, duration: 200 }}
            class="absolute top-full right-0 md:left-0 md:right-auto mt-2 bg-[#1a1a1a] border border-gray1 rounded-3xl shadow-2xl z-[9999] p-5 flex flex-col w-[580px] max-w-[90vw] origin-top"
        >
            <div class="flex flex-row">
                <div class="pr-6 border-r border-gray1/50 flex gap-4">
                    <div class="flex flex-col">
                        <div class="text-[10px] text-gray2 font-bold uppercase tracking-widest mb-3 text-center">Year</div>
                        <div class="flex flex-col gap-2 flex-1 justify-center">
                            {#each availableYears as y}
                                <button type="button" class="px-3 py-1.5 text-sm font-bold rounded-xl transition-colors cursor-pointer border {currentYear === y ? 'bg-lime/10 text-lime border-lime/30' : 'bg-transparent text-gray2 border-transparent hover:bg-white/5 hover:text-white'}" on:click|stopPropagation={() => currentYear = y}>
                                    {y}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <div class="flex flex-col">
                        <div class="text-[10px] text-gray2 font-bold uppercase tracking-widest mb-3 text-center">Month</div>
                        <div class="grid grid-cols-2 gap-x-2 gap-y-1.5">
                            {#each months as month, idx}
                                <button type="button" class="px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer border {currentMonth === idx ? 'bg-lime/10 text-lime border-lime/30' : 'bg-transparent text-gray2 border-transparent hover:bg-white/5 hover:text-white'}" on:click|stopPropagation={() => { currentMonth = idx; }}>
                                    {month}
                                </button>
                            {/each}
                        </div>
                    </div>
                </div>

                <div class="flex-1 pl-6 flex flex-col justify-center">
                    <div class="flex items-center justify-between mb-4">
                        <button type="button" aria-label="Previous Month" on:click|stopPropagation={() => changeMonth(-1)} class="h-8 w-8 flex items-center justify-center text-gray2 hover:text-white hover:bg-black/30 rounded-full transition-colors cursor-pointer disabled:opacity-30" disabled={currentYear === availableYears[0] && currentMonth === 0}>
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" /></svg>
                        </button>
                        
                        <div class="text-sm text-white font-bold tracking-wide select-none">
                            {months[currentMonth]} {currentYear}
                        </div>
                        
                        <button type="button" aria-label="Next Month" on:click|stopPropagation={() => changeMonth(1)} class="h-8 w-8 flex items-center justify-center text-gray2 hover:text-white hover:bg-black/30 rounded-full transition-colors cursor-pointer disabled:opacity-30" disabled={currentYear === availableYears[2] && currentMonth === 11}>
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6" /></svg>
                        </button>
                    </div>

                    <div class="grid grid-cols-7 mb-2">
                        {#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as day}
                            <div class="text-center text-[10px] text-gray2 font-bold uppercase">{day}</div>
                        {/each}
                    </div>

                    <div class="grid grid-cols-7 gap-y-1" on:mouseleave={() => hoverDate = ''} role="grid" aria-label="Calendar" tabindex="0">
                        {#each calendarDays as day}
                            <div class="relative flex items-center justify-center h-9">
                                {#if day !== null}
                                    <button 
                                        type="button" 
                                        class="w-full h-full text-xs transition-all cursor-pointer flex items-center justify-center {getDayClasses(day, tempStart, tempEnd, hoverDate)}" 
                                        on:click|stopPropagation={() => selectDate(currentYear, currentMonth, day)}
                                        on:mouseenter={() => handleMouseEnter(currentYear, currentMonth, day)}
                                    >
                                        {day}
                                    </button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            <div class="mt-5 flex items-center justify-between border-t border-gray1 pt-4 px-1">
                <div class="text-[13px] text-white font-bold tracking-wide">
                    {#if !tempStart && !tempEnd}
                        <span class="text-gray2">No dates selected</span>
                    {:else}
                        <span class="text-lime">{formatFooterDate(tempStart)}</span> 
                        <span class="text-gray2 mx-2">—</span> 
                        <span class={tempEnd ? "text-lime" : "text-gray2 opacity-50"}>{tempEnd ? formatFooterDate(tempEnd) : 'Select end date...'}</span>
                    {/if}
                </div>
                <div class="flex gap-2">
                    <button type="button" class="px-4 py-2 text-xs font-bold text-gray2 hover:text-white transition-colors cursor-pointer" on:click={cancel}>Clear</button>
                    <button type="button" class="px-4 py-2 text-xs font-bold bg-lime text-black rounded-full hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed" disabled={!tempStart || !tempEnd} on:click={confirm}>Apply Range</button>
                </div>
            </div>
        </div>
    {/if}
</div>