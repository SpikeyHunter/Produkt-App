<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Shift, ShiftType, Staff } from '$lib/types/schedule';

	export let isOpen = false;
	export let staff: Staff | null = null;
	export let dayName: string = '';
	export let shift: Partial<Shift> = {};
    export let dayShiftCount = 0;
    export let existingShifts: Shift[] = []; // Passed from parent for validation

	const dispatch = createEventDispatcher();

	const HEX_COLORS: Record<string, string> = {
		'Bazart': '#e9e9e9', 'Bazart Nuits': '#ffe5a0', 'Moet City': '#f8edd3',
		'NCG Show': '#d4edbc', 'NCG 360': '#ffcfc9', 'DSTRKT': '#bfe1f6',
		'Tour Production': '#c6dbe1', 'Corpo': '#e6cff2', 'Maintenance': '#ffc8aa',
		'Other': '#fdfdfd', 'Office': 'transparent'
	};
    
    const TYPE_KEYS = Object.keys(HEX_COLORS) as ShiftType[];

	let startTime = '10:00';
	let endTime = '18:00';
    // Set Office as default
	let selectedType: ShiftType = 'Office';
    let customLabel = '';
    let validationError = '';

    // Reset state when modal opens
	$: if (isOpen) {
        if (shift.id) {
            // EDIT MODE
            startTime = shift.start_time || '10:00';
            endTime = shift.end_time || '18:00';
            selectedType = (shift.shift_type && HEX_COLORS[shift.shift_type]) ? (shift.shift_type as ShiftType) : 'Office';
            customLabel = shift.custom_label || '';
        } else {
            // CREATE MODE - Smart Suggestions
            selectedType = 'Office';
            customLabel = '';
            suggestSmartTime();
        }
	}

    // Validation Logic (Reactive)
    $: {
        validationError = '';
        const newStart = parseInt(startTime.replace(':', ''));
        const newEnd = parseInt(endTime.replace(':', ''));

        if (newEnd <= newStart) {
            // Optional: Allow overnight shifts? If not, warn.
            // validationError = "End time must be after start time";
        }

        // Check Overlaps
        for (const existing of existingShifts) {
            // Skip self if editing
            if (shift.id && existing.id === shift.id) continue;
            // Skip placeholders
            if ((existing.shift_type as string) === 'PLACEHOLDER') continue;

            const exStart = parseInt(existing.start_time.slice(0,5).replace(':', ''));
            const exEnd = parseInt(existing.end_time.slice(0,5).replace(':', ''));

            // Overlap formula: (StartA < EndB) and (EndA > StartB)
            if (newStart < exEnd && newEnd > exStart) {
                validationError = "A shift is already booked during those hours";
            }
        }
    }

    function suggestSmartTime() {
        // If there is an existing shift, try to suggest a time around it
        const realShifts = existingShifts.filter(s => (s.shift_type as string) !== 'PLACEHOLDER');
        
        if (realShifts.length > 0) {
            const other = realShifts[0];
            const otherStartH = parseInt(other.start_time.split(':')[0]);
            const otherEndH = parseInt(other.end_time.split(':')[0]);

            // If the existing shift is "late" (starts after 1pm), suggest "early" (before it)
            if (otherStartH >= 13) {
                // Suggest ending 1 hour before the other starts
                let suggestEnd = otherStartH - 1;
                let suggestStart = suggestEnd - 8; // 8 hour shift
                if (suggestStart < 0) suggestStart = 0;
                
                startTime = `${suggestStart.toString().padStart(2, '0')}:00`;
                endTime = `${suggestEnd.toString().padStart(2, '0')}:00`;
            } else {
                // Otherwise (existing is early), suggest "late" (after it)
                let suggestStart = otherEndH + 1;
                let suggestEnd = suggestStart + 8;
                if (suggestEnd > 23) suggestEnd = 23; // Cap at midnight-ish

                startTime = `${suggestStart.toString().padStart(2, '0')}:00`;
                endTime = `${suggestEnd.toString().padStart(2, '0')}:00`;
            }
        } else {
            // Default if empty
            startTime = '10:00';
            endTime = '18:00';
        }
    }

	function handleSave() {
        if (validationError) return;
		dispatch('save', {
			start_time: startTime,
			end_time: endTime,
			shift_type: selectedType,
            custom_label: customLabel
		});
		close();
	}

    function handleDelete() {
        if (shift.id) { dispatch('delete', shift.id); close(); }
    }

    function handleAddAnother() {
        dispatch('addAnother');
    }

	function close() { dispatch('close'); }
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
</script>

<svelte:window on:keydown={onKeyDown}/>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div 
            class="absolute inset-0 bg-black/70 backdrop-blur-sm"
            on:click={close}
            on:keydown={(e) => e.key === 'Enter' && close()}
            role="button"
            tabindex="0"
            aria-label="Close modal"
        ></div>

		<div class="bg-gray1 border border-gray2/30 w-full max-w-2xl rounded-2xl relative z-10 overflow-hidden">
            <div class="p-8">
                <div class="flex justify-between items-start mb-8">
                    <div>
                        <h3 class="text-2xl font-bold text-white mb-1">{staff?.name?.split(' ')[0] || 'Add Shift'}</h3>
                        <p class="text-gray2 text-base">{dayName}</p>
                    </div>
                    <button 
                        on:click={close} 
                        class="text-gray2 hover:text-white cursor-pointer p-2 rounded-full hover:bg-gray2/10 transition-colors"
                        type="button"
                        aria-label="Close modal"
                    >
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div class="space-y-6">
                    <div class="space-y-2">
                        <label class="text-xs font-bold text-gray2 uppercase tracking-wider block" for="shiftType">Shift Type</label>
                        <div class="grid grid-cols-3 gap-3">
                            {#each TYPE_KEYS as type}
                                <button
                                    class="text-sm px-3 py-3 rounded-lg border transition-all truncate text-left cursor-pointer font-medium"
                                    class:border-lime={selectedType === type}
                                    class:border-transparent={selectedType !== type && type !== 'Office'}
                                    class:border-gray2={selectedType !== type && type === 'Office'}
                                    style="background-color: {HEX_COLORS[type]}; color: {type === 'Office' ? '#ffffff' : '#222'};"
                                    on:click={() => selectedType = type}
                                >
                                    {type}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-6">
                        <div class="space-y-2">
                            <label class="text-xs font-bold text-gray2 uppercase tracking-wider block" for="start">Start Time</label>
                            <input type="time" id="start" bind:value={startTime} class="w-full bg-black/30 border border-gray2/20 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-lime transition-all" />
                        </div>
                        <div class="space-y-2">
                            <label class="text-xs font-bold text-gray2 uppercase tracking-wider block" for="end">End Time</label>
                            <input type="time" id="end" bind:value={endTime} class="w-full bg-black/30 border border-gray2/20 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-lime transition-all" />
                        </div>
                    </div>
                    
                    {#if validationError}
                        <div class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            <span class="text-red-400 text-sm font-bold">{validationError}</span>
                        </div>
                    {/if}
                </div>

                <div class="mt-10 flex gap-4 items-center">
                    {#if shift.id}
                        <button class="px-5 py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-sm font-bold cursor-pointer" on:click={handleDelete}>Delete Shift</button>
                        
                        {#if dayShiftCount < 2}
                            <button 
                                class="px-5 py-3 rounded-xl bg-gray2/20 text-white hover:bg-gray2/40 transition-colors text-sm font-bold cursor-pointer"
                                on:click={handleAddAnother}
                            >
                                + Add Another
                            </button>
                        {/if}
                    {/if}
                    
                    <button 
                        class="flex-1 px-5 py-3 rounded-xl bg-lime text-black font-bold hover:bg-lime/90 transition-all text-sm cursor-pointer ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
                        on:click={handleSave}
                        disabled={!!validationError}
                    >
                        {shift.id ? 'Save Changes' : 'Add Shift'}
                    </button>
                </div>
            </div>
		</div>
	</div>
{/if}