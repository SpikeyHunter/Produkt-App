<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Shift, ShiftType, Staff } from '$lib/types/schedule';

	export let isOpen = false;
	export let staff: Staff | null = null;
	export let dayName: string = '';
	export let shift: Partial<Shift> = {};
	export let dayShiftCount = 0;
	export let existingShifts: Shift[] = [];

	const dispatch = createEventDispatcher();

	const HEX_COLORS: Record<string, string> = {
		'Bazart': '#e9e9e9', 'Bazart Nuits': '#ffe5a0', 'Moet City': '#f8edd3',
		'NCG Show': '#d4edbc', 'NCG 360': '#ffcfc9', 'DSTRKT': '#bfe1f6',
		'Tour Production': '#c6dbe1', 'Corpo': '#e6cff2', 'Maintenance': '#ffc8aa',
		'Other': '#fdfdfd', 'Office': 'transparent', 'OFF': '#333333',
		'LD': '#555555' // Added LD option, brighter than OFF
	};

	// Cast to string[] to avoid TS errors if 'LD' is missing from ShiftType
	const TYPE_KEYS = Object.keys(HEX_COLORS);

	// 1. CONFIGURATION FOR DEFAULT TIMES
	const DEFAULT_TIMES: Record<string, { start: string, end: string }> = {
		'Office': { start: '10:00', end: '18:00' },
		'NCG 360': { start: '19:00', end: '04:00' },
		'NCG Show': { start: '19:00', end: '04:00' },
		'DSTRKT': { start: '19:00', end: '04:00' },
		'Tour Production': { start: '19:00', end: '04:00' },
		'Bazart Nuits': { start: '19:00', end: '04:00' },
		'Moet City': { start: '10:00', end: '21:00' }
	};

	// Default fallback if not in list above
	const GLOBAL_DEFAULT = { start: '10:00', end: '18:00' };

	let startTime = '10:00';
	let endTime = '18:00';
	// Use string type to accommodate 'LD' without strict ShiftType constraints
	let selectedType: string = 'Office';
	let customLabel = '';
	let validationError = '';

	$: if (isOpen) {
		if (shift.id) {
			// EDIT MODE
			startTime = shift.start_time || '10:00';
			endTime = shift.end_time || '18:00';
			// Cast to string for local state
			selectedType = (shift.shift_type && HEX_COLORS[shift.shift_type]) ? (shift.shift_type as string) : 'Office';
			customLabel = shift.custom_label || '';
		} else {
			// CREATE MODE
			selectedType = 'Office';
			customLabel = '';
			applyTimeDefaults('Office');
		}
	}

	$: {
		validationError = '';
		// Only validate times if NOT OFF and NOT LD
		if (selectedType !== 'OFF' && selectedType !== 'LD') {
			const newStart = parseInt(startTime.replace(':', ''));
			const newEnd = parseInt(endTime.replace(':', ''));

			// Check Overlaps
			for (const existing of existingShifts) {
				if (shift.id && existing.id === shift.id) continue;
				if ((existing.shift_type as string) === 'PLACEHOLDER') continue;
				
				// Don't check overlap against OFF/LD shifts or if we are making an OFF/LD shift
				const existingType = existing.shift_type as string;
				if (existingType === 'OFF' || existingType === 'LD') continue;

				const exStart = parseInt(existing.start_time.slice(0,5).replace(':', ''));
				const exEnd = parseInt(existing.end_time.slice(0,5).replace(':', ''));
				
				if (newStart < exEnd && newEnd > exStart) {
					validationError = "A shift is already booked during those hours";
				}
			}
		}
	}

	function applyTimeDefaults(type: string) {
		// If OFF or LD, no time defaults needed
		if (type === 'OFF' || type === 'LD') return;
		
		const defaults = DEFAULT_TIMES[type] || GLOBAL_DEFAULT;
		startTime = defaults.start;
		endTime = defaults.end;
	}

	function selectType(type: string) {
		selectedType = type;
		applyTimeDefaults(type);
	}

	function handleSave() {
		if (validationError && selectedType !== 'OFF' && selectedType !== 'LD') return;
		
		const isNoTimeShift = selectedType === 'OFF' || selectedType === 'LD';

		dispatch('save', {
			// If OFF or LD, clear times to 00:00
			start_time: isNoTimeShift ? '00:00' : startTime,
			end_time: isNoTimeShift ? '00:00' : endTime,
			shift_type: selectedType,
			custom_label: customLabel
		});
		close();
	}

	function handleDelete() {
		if (shift.id) { 
            dispatch('delete', shift.id);
			close(); 
        }
	}

	function handleAddAnother() {
		dispatch('addAnother');
	}

	function close() { dispatch('close'); }
	function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') close();
	}
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
									class:border-transparent={selectedType !== type && type !== 'Office' && type !== 'OFF' && type !== 'LD'}
									class:border-gray2={selectedType !== type && (type === 'Office' || type === 'OFF' || type === 'LD')}
									style="background-color: {HEX_COLORS[type]}; color: {type === 'Office' || type === 'OFF' || type === 'LD' ? '#ffffff' : '#222'};"
									on:click={() => selectType(type)}
								>
									{type}
								</button>
							{/each}
						</div>
					</div>

					{#if selectedType !== 'OFF' && selectedType !== 'LD'}
						<div class="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
							<div class="space-y-2">
								<label class="text-xs font-bold text-gray2 uppercase tracking-wider block" for="start">Start Time</label>
								<input type="time" id="start" bind:value={startTime} class="w-full bg-black/30 border border-gray2/20 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-lime transition-all" />
							</div>
							<div class="space-y-2">
								<label class="text-xs font-bold text-gray2 uppercase tracking-wider block" for="end">End Time</label>
								<input type="time" id="end" bind:value={endTime} class="w-full bg-black/30 border border-gray2/20 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-lime transition-all" />
							</div>
						</div>
					{:else}
						<div class="p-4 rounded-lg bg-gray2/10 border border-gray2/20 text-center text-gray2 text-sm italic animate-in fade-in">
							Staff marked as {selectedType} for this slot.
						</div>
					{/if}
					
					{#if validationError && selectedType !== 'OFF' && selectedType !== 'LD'}
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
						disabled={!!validationError && selectedType !== 'OFF' && selectedType !== 'LD'}
					>
						{shift.id ? 'Save Changes' : 'Add Shift'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}