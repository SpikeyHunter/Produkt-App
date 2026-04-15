<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';

    export let value = '';
    export let placeholder = 'Select date';
    export let width = 'w-full';
    export let height = 'h-[50px]';
    export let variant = 'input'; 
    export let disabled = false;

    // Tour-specific props
    export let tourStartDate = '';
    export let tourEndDate = '';
    export let bookedDates: string[] = []; 

    const dispatch = createEventDispatcher();
    let showDatePicker = false;
    let currentCalendarDate = new Date();
    let containerElement: HTMLDivElement;

    // DEBUG LOGS: Watch the console to see if the DB dates are successfully reaching this component
    $: {
        console.log("🗓️ [DatePicker] Received Start Date:", tourStartDate);
        console.log("🗓️ [DatePicker] Received End Date:", tourEndDate);
    }

    // Calculate boundary dates for month navigation
    $: minMonthDate = tourStartDate ? new Date(tourStartDate + 'T00:00:00') : null;
    $: maxMonthDate = tourEndDate ? new Date(tourEndDate + 'T00:00:00') : null;

    // Logic to disable Previous/Next month buttons
    $: canGoPrev = minMonthDate ? 
        (currentCalendarDate.getFullYear() > minMonthDate.getFullYear() || 
        (currentCalendarDate.getFullYear() === minMonthDate.getFullYear() && currentCalendarDate.getMonth() > minMonthDate.getMonth())) 
        : true;

    $: canGoNext = maxMonthDate ? 
        (currentCalendarDate.getFullYear() < maxMonthDate.getFullYear() || 
        (currentCalendarDate.getFullYear() === maxMonthDate.getFullYear() && currentCalendarDate.getMonth() < maxMonthDate.getMonth())) 
        : true;

    $: displayValue = value ? formatDisplayDate(value) : '';
    
    $: monthYearDisplay = currentCalendarDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
    });

    function handleClickOutside(event: MouseEvent) {
        if (event.target && (event.target as Element).closest) {
            if (!(event.target as Element).closest('.datepicker-container')) {
                showDatePicker = false;
            }
        }
    }

    function openPicker() {
        showDatePicker = !showDatePicker;
        
        if (showDatePicker && !value && tourStartDate) {
            const start = new Date(tourStartDate + 'T00:00:00');
            if (!isNaN(start.getTime())) {
                currentCalendarDate = new Date(start.getFullYear(), start.getMonth(), 1);
            }
        } else if (showDatePicker && value) {
            const initialDate = new Date(value + 'T00:00:00');
            if (!isNaN(initialDate.getTime())) {
                currentCalendarDate = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
            }
        }
    }

    function formatDisplayDate(dateString: string): string {
        if (!dateString) return '';
        try {
            const date = new Date(dateString + 'T00:00:00');
            if (isNaN(date.getTime())) return '';
            const year = date.getFullYear();
            const day = String(date.getDate()).padStart(2, '0');
            const monthShort = date.toLocaleString('en-US', { month: 'short' });
            return `${day}-${monthShort}-${year}`;
        } catch (error) {
            return '';
        }
    }

    function selectDate(dateStr: string) {
        value = dateStr;
        dispatch('change', value);
        setTimeout(() => { showDatePicker = false; }, 100);
    }

    function changeMonth(amount: number) {
        if (amount === -1 && !canGoPrev) return;
        if (amount === 1 && !canGoNext) return;

        currentCalendarDate = new Date(
            currentCalendarDate.getFullYear(),
            currentCalendarDate.getMonth() + amount,
            1
        );
    }

    $: calendarDays = (() => {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDayOfMonth.getDay(); 

        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < startDayOfWeek; i++) {
            days.push({ day: 0, dateStr: '', isCurrentMonth: false, isSelected: false, isDisabled: true, isBooked: false, isToday: false });
        }

        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            const date = new Date(year, month, i);
            date.setHours(0, 0, 0, 0);
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            let isSelected = value === dateStr;
            let isBooked = bookedDates.includes(dateStr);
            
            if (isSelected && isBooked) isBooked = false;

            let isDisabled = false;
            if (tourStartDate && dateStr < tourStartDate) isDisabled = true;
            if (tourEndDate && dateStr > tourEndDate) isDisabled = true;
            
            days.push({
                day: i,
                dateStr: dateStr,
                isCurrentMonth: true,
                isToday: date.getTime() === today.getTime(),
                isSelected,
                isBooked, 
                isDisabled 
            });
        }

        const remainingCells = 42 - days.length;
        for (let i = 1; i <= remainingCells; i++) {
            days.push({ day: 0, dateStr: '', isCurrentMonth: false, isSelected: false, isDisabled: true, isBooked: false, isToday: false });
        }
        return days;
    })();

    $: variantClasses = variant === 'input' 
        ? 'px-4 bg-gray1 text-white text-base rounded-full '
        : 'bg-navbar border border-gray2 text-white text-xs rounded-lg px-3 py-1.5  !hover:cursor-pointer !hover:text-lime';
</script>

<svelte:window on:click={handleClickOutside} />

<div class="relative datepicker-container {width} {height}" bind:this={containerElement}>
    <button
        type="button"
        class="relative flex items-center justify-between text-left transition-colors duration-200  {variantClasses} {width} {height}"
        on:click={openPicker}
        {disabled}
    >
        <span class={value ? 'text-white' : 'text-gray2'}>
            {displayValue || placeholder}
        </span>
        {#if !value}
            <svg class="w-4 h-4 text-gray2 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
        {/if}
    </button>

    {#if showDatePicker}
        <div class="absolute top-full left-0 mt-1.5 bg-gray1 rounded-xl shadow-2xl z-99 p-4 w-80">
            <div class="flex items-center justify-between mb-4">
                <button 
                    type="button" 
                    on:click|stopPropagation={() => changeMonth(-1)} 
                    class="p-2 text-gray2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-lime disabled:opacity-30 disabled:cursor-not-allowed {!canGoPrev ? '' : 'hover:text-white hover:bg-gray1 cursor-pointer'}" 
                    aria-label="Previous month"
                    disabled={!canGoPrev}
                >
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                
                <div class="text-base text-white font-bold text-center">{monthYearDisplay}</div>
                
                <button 
                    type="button" 
                    on:click|stopPropagation={() => changeMonth(1)} 
                    class="p-2 text-gray2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-lime disabled:opacity-30 disabled:cursor-not-allowed {!canGoNext ? '' : 'hover:text-white hover:bg-gray1 cursor-pointer'}" 
                    aria-label="Next month"
                    disabled={!canGoNext}
                >
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6" /></svg>
                </button>
            </div>

            <div class="grid grid-cols-7 gap-1 mb-2">
                {#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as day}
                    <div class="text-center text-sm text-gray2 font-medium py-2">{day}</div>
                {/each}
            </div>

            <div class="grid grid-cols-7 gap-1">
                {#each calendarDays as day}
                    <button
                        type="button"
                        class="aspect-square text-base transition-colors rounded-lg flex items-center justify-center h-9 w-9 
                            {day.isCurrentMonth
                                ? day.isSelected
                                    ? 'bg-lime text-black font-medium' 
                                    : day.isBooked
                                        ? 'bg-lime/60 text-black cursor-not-allowed font-medium' 
                                        : day.isDisabled
                                            ? 'text-gray2 opacity-30 cursor-not-allowed' 
                                            : day.isToday
                                                ? 'bg-gray1 text-lime border border-lime cursor-pointer hover:bg-gray1'
                                                : 'text-white hover:bg-gray1 cursor-pointer'
                                : 'opacity-0 cursor-default'}" 
                        on:click|stopPropagation={() => {
                            if (!day.isDisabled && !day.isBooked && day.isCurrentMonth) selectDate(day.dateStr);
                        }}
                        disabled={!day.isCurrentMonth || day.isDisabled || day.isBooked}
                    >
                        {#if day.isCurrentMonth} {day.day} {/if}
                    </button>
                {/each}
            </div>
        </div>
    {/if}
</div>