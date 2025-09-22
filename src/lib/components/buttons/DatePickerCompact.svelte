<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { supabase } from '$lib/supabase.js';
export let value = '';
    export let placeholder = 'Select date';
    export let width = 'w-full';
export let height = 'h-auto';
    export let variant = 'default';
// 'default', 'slim', 'outline'
    export let disabled = false;
    export const required = false;
export let minDate = '';
    export let maxDate = '';
    export let format = 'mm/dd/yyyy';
// 'mm/dd/yyyy', 'dd/mm/yyyy', 'yyyy-mm-dd'

    // Database storage options
    export let dbTable = '';
export let dbColumn = '';
    export let dbId = '';
    export let autoSave = false;

    const dispatch = createEventDispatcher();
let showDatePicker = false;
    let currentCalendarDate = new Date();
    let containerElement: HTMLDivElement;
onMount(() => {
        if (value) {
            const initialDate = new Date(value + 'T00:00:00');
            if (!isNaN(initialDate.getTime())) {
                currentCalendarDate = initialDate;
            }
        }
    });
// Reactive formatted display value for the input
    $: displayValue = value ? formatDisplayDate(value) : '';
// Make calendar display values explicitly reactive to changes in currentCalendarDate
    $: monthYearDisplay = currentCalendarDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short'
    });
// Close datepicker when clicking outside
    function handleClickOutside(event: MouseEvent) {
        if (event.target && (event.target as Element).closest) {
            if (!(event.target as Element).closest('.datepicker-container')) {
                showDatePicker = false;
}
        }
    }

    // Format date for display based on format prop
    function formatDisplayDate(dateString: string): string {
        if (!dateString) return '';
try {
            // Add T00:00:00 to ensure the date is parsed in the local timezone, not UTC
            const date = new Date(dateString + 'T00:00:00');
if (isNaN(date.getTime())) return '';

            const year = date.getFullYear();
            const numericMonth = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
switch (format) {
                case 'dd/mm/yyyy':
                    return `${day}/${numericMonth}/${year}`;
case 'yyyy-mm-dd':
                    return `${year}-${numericMonth}-${day}`;
case 'mm/dd/yyyy':
                default:
                    // This now returns the requested 'dd-Mon-yyyy' format
                    const monthShort = date.toLocaleString('en-US', { month: 'short' });
return `${day}-${monthShort}-${year}`;
            }
        } catch (error) {
            console.error('Error formatting date:', error);
return '';
        }
    }
function selectDate(date: Date) {
    const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    value = `${year}-${month}-${day}`;

    dispatch('change', value);
// Defer closing the datepicker to prevent event conflicts
    setTimeout(() => {
        showDatePicker = false;
    }, 100);
// A small delay is enough

    if (autoSave) {
        saveToDatabase(value);
}
}

    function changeMonth(amount: number) {
        currentCalendarDate = new Date(
            currentCalendarDate.getFullYear(),
            currentCalendarDate.getMonth() + amount,
            1
        );
}

    // FIX: The logic for generating calendar days is now in this single reactive block.
// This ensures the days grid updates whenever `currentCalendarDate` changes.
$: calendarDays = (() => {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)

        const days = [];
        const today = new Date();
   
     today.setHours(0, 0, 0, 0);

        // Pad start with days from previous month
        for (let i = 0; i < startDayOfWeek; i++) {
            const date = new Date(year, month, i - startDayOfWeek + 1);
            days.push({
                day: date.getDate(),
         
       date: date,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
                isDisabled: true
            });
        }

    
    // Fill in days of the current month
        for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
            const date = new Date(year, month, i);
date.setHours(0, 0, 0, 0);

            let isSelected = false;
            if (value) {
                const selectedDate = new Date(value + 'T00:00:00');
if (!isNaN(selectedDate.getTime())) {
                    isSelected = date.getTime() === selectedDate.getTime();
}
            }

            // Check if the date is disabled
            let isDisabled = false;
if (minDate) {
                const min = new Date(minDate + 'T00:00:00');
if (!isNaN(min.getTime()) && date < min) {
                    isDisabled = true;
}
            }
            if (maxDate) {
                const max = new Date(maxDate + 'T00:00:00');
if (!isNaN(max.getTime()) && date > max) {
                    isDisabled = true;
}
            }

            days.push({
                day: i,
                date: date,
                isCurrentMonth: true,
                isToday: date.getTime() === today.getTime(),
      
          isSelected: isSelected,
                isDisabled: isDisabled
            });
}

        // Pad end with days from next month to fill 6 weeks (42 cells)
        const remainingCells = 42 - days.length;
for (let i = 1; i <= remainingCells; i++) {
            const date = new Date(year, month + 1, i);
days.push({
                day: date.getDate(),
                date: date,
                isCurrentMonth: false,
                isToday: false,
                isSelected: false,
               
 isDisabled: true
            });
}
        return days;
    })();
async function saveToDatabase(newValue: string) {
        if (!dbTable || !dbColumn || !dbId) {
            console.warn('DatePicker: Missing database props for auto-save.');
return;
        }

        try {
            const { error } = await supabase
                .from(dbTable)
                .update({ [dbColumn]: newValue })
                .eq('id', dbId);
if (error) throw error;
        } catch (error) {
            console.error('Error saving date to database:', error);
}
    }

    // Dynamic classes for an ultra-compact look
    $: baseClasses =
        'relative flex items-center justify-between text-left transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-navbar focus:ring-lime';
$: variantClasses =
        variant === 'slim'
            ? 'px-1.5 py-0.5 text-xs rounded-sm'
            : variant === 'outline'
                ? 'px-2 py-0.5 text-xs rounded border-2 border-lime bg-transparent text-lime hover:bg-lime hover:text-black'
                : 'bg-navbar border border-gray2 text-white text-xs rounded px-2 py-0.5 hover:border-lime !hover:cursor-pointer !hover:text-lime'; 
</script>

<svelte:window on:click={handleClickOutside} />

<div class="relative datepicker-container {width} {height}" bind:this={containerElement}>
    <button
        type="button"
        class="{baseClasses} {variantClasses} {width} {height}"
        on:click={() => (showDatePicker = !showDatePicker)}
        {disabled}
        aria-haspopup="true"
        aria-expanded={showDatePicker}
    >
        <span class="truncate {value ? 'text-white' : 'text-gray2'}"> 
            {displayValue || placeholder} 
        </span>
        {#if !value}
            <svg
                class="w-3 h-3 text-gray2 ml-1.5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
stroke-width="3"
            >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
<line x1="3" y1="10" x2="21" y2="10" />
            </svg>
        {/if}
    </button>

    {#if showDatePicker}
        <div
            class="absolute top-full left-0 mt-1 bg-navbar border border-lime rounded-md shadow-2xl z-[9999] p-1 w-48"
            role="dialog"
            aria-modal="true"
>
            <div class="flex items-center justify-between mb-1">
                <button
                    type="button"
                    on:click|stopPropagation={() => changeMonth(-1)}
                    class="h-5 w-5 flex items-center justify-center text-gray2 hover:text-white !hover:cursor-pointer hover:bg-gray1 rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-lime" 
                    aria-label="Previous month"
                >
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"> 
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>
                <div class="text-xs text-white font-bold text-center"> 
                    {monthYearDisplay}
                </div>
                <button
                    type="button"
                    on:click|stopPropagation={() => changeMonth(1)}
                    class="h-5 w-5 flex items-center justify-center text-gray2 hover:text-white !hover:cursor-pointer hover:bg-gray1 rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-lime" 
                    aria-label="Next month"
                >
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"> 
                        <path d="M9 18l6-6-6-6" />
                    </svg>
                </button>
            </div>

            <div class="grid grid-cols-7 gap-px mb-1"> 
                {#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as day}
                    <div class="text-center text-xs text-gray2 font-medium"> 
                        {day}
                    </div>
                {/each}
            </div>

            <div class="grid grid-cols-7 gap-px">
                {#each calendarDays as day}
                    <button
                        type="button" 
                        class="aspect-square text-xs transition-colors cursor-pointer rounded flex items-center justify-center h-5 w-5 {day.isCurrentMonth
                            ? day.isSelected
                                ? 'bg-lime text-black font-medium' 
                                : day.isToday
                                    ? 'bg-gray1 text-lime border border-lime' 
                                    : day.isDisabled
                                        ? 'text-gray2 opacity-30 cursor-not-allowed' 
                                        : 'text-white hover:bg-gray1'
                            : 'text-gray2 opacity-50 cursor-not-allowed'}"
                        on:click|stopPropagation={() =>
                            !day.isDisabled && day.isCurrentMonth && selectDate(day.date)} 
                        disabled={!day.isCurrentMonth || day.isDisabled}
                    >
                        {day.day} 
                    </button>
                {/each}
            </div>
        </div>
    {/if}
</div>