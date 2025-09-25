<script lang="ts">
	import Modal from '$lib/components/modals/Modal.svelte';
	import DatePicker from '$lib/components/buttons/DatePicker.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { updateEventAdvance, type EventAdvance } from '$lib/services/eventsService';
	import { browser } from '$app/environment';
	import { autofillData } from '$lib/services/autofillService';
	import type { CalendarEntry } from '$lib/types/GoogleCalendar';

	export let isOpen = false;
	export let event: EventAdvance;
	$: artistName = event ? event.artist_name : 'Artist Name';
	const dispatch = createEventDispatcher();
	let isSaving = false;
	let isSyncing = false;
	let syncError = '';
	let syncSuccess = '';

	// Check if already synced with calendar
	$: isCalendarSynced = !!event?.calendar_synced;
	$: calendarEventIds = (() => {
		if (!event?.calendar_event_ids) return {};
		// Handle both object and string formats
		if (typeof event.calendar_event_ids === 'string') {
			try {
				return JSON.parse(event.calendar_event_ids);
			} catch {
				return {};
			}
		}
		return event.calendar_event_ids;
	})();

	// --- State for custom dropdowns ---
	let openDropdownId: string | null = null;
	function toggleDropdown(id: string) {
		openDropdownId = openDropdownId === id ? null : id;
	}

	function selectOption(rowId: number, column: 'type' | 'driver', value: string) {
		const rowIndex = rows.findIndex((r) => r.id === rowId);
		if (rowIndex !== -1) {
			if (column === 'type') {
				rows[rowIndex].type = value as CalendarEntry['type'];
			} else if (column === 'driver') {
				rows[rowIndex].driverName = value;
			}
			rows = rows; // Trigger reactivity
		}
		openDropdownId = null; // Close dropdown after selection
	}

	onMount(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (openDropdownId && !target.closest('.dropdown-container')) {
				openDropdownId = null;
			}
		};
		if (browser) {
			document.addEventListener('click', handleClickOutside, true);
		}
		return () => {
			if (browser) {
				document.removeEventListener('click', handleClickOutside, true);
			}
		};
	});

	// --- Move functions ---
	function moveRowUp(index: number) {
		if (index <= 0) return;
		const newRows = [...rows];
		[newRows[index - 1], newRows[index]] = [newRows[index], newRows[index - 1]];
		rows = newRows;
	}

	function moveRowDown(index: number) {
		if (index >= rows.length - 1) return;
		const newRows = [...rows];
		[newRows[index], newRows[index + 1]] = [newRows[index + 1], newRows[index]];
		rows = newRows;
	}

	// --- Original Logic ---
	function handleClose() {
		dispatch('close');
	}

	const columnStyles = {
		move: 'w-[50px]',
		date: 'w-[110px]',
		type: 'w-[120px]',
		driver: 'w-[80px]',
		pickupTime: 'w-[70px]',
		pickupLocation: 'w-[90px]',
		dropoffTime: 'w-[70px]',
		dropoffLocation: 'w-[90px]',
		paxNames: 'w-[120px]',
		flightInfo: 'w-[150px]',
		contact: 'w-[180px]',
		delete: 'w-[40px]'
	};

	const driverOptions = ['Eddy', 'Reza', 'Tarek', 'Charles', 'UBER'];
	const eventTypes: CalendarEntry['type'][] = [
		'Arrival',
		'Departure',
		'Soundcheck',
		'Post-SC',
		'Show',
		'Post Show'
	];
	const defaultEventTypes: CalendarEntry['type'][] = [
		'Arrival',
		'Soundcheck',
		'Post-SC',
		'Show',
		'Post Show',
		'Departure'
	];

	// Function to get type-specific colors
	function getTypeButtonColor(type: CalendarEntry['type']): string {
		switch (type) {
			case 'Arrival':
			case 'Departure':
				return 'bg-[#93c5fd] text-black hover:bg-[#7dd3fc]'; // question blue
			case 'Soundcheck':
			case 'Post-SC':
				return 'bg-[#c4b5fd] text-black hover:bg-[#a78bfa]'; // info purple
			case 'Show':
			case 'Post Show':
				return 'bg-[#FCA5A5] text-black hover:bg-[#f87171]'; // problem red
			default:
				return 'bg-gray2 text-black hover:bg-lime hover:text-black'; // default
		}
	}

	function createNewRow(type: CalendarEntry['type'] = ''): CalendarEntry {
		return {
			id: Date.now() + Math.random(),
			date: '',
			type: type,
			driverName: 'Eddy',
			pickupTime: '',
			pickupLocation: '',
			dropoffTime: '',
			dropoffLocation: '',
			paxNames: '',
			flightInfo: '',
			contact: ''
		};
	}

	let rows: CalendarEntry[] = [];

	$: if (isOpen) {
		if (
			event &&
			event.ground_transport &&
			Array.isArray(event.ground_transport) &&
			event.ground_transport.length > 0
		) {
			rows = JSON.parse(JSON.stringify(event.ground_transport));
		} else {
			rows = defaultEventTypes.map((type) => createNewRow(type));
		}
		openDropdownId = null; // Reset dropdown state when modal opens
		syncError = ''; // Clear any previous errors
		syncSuccess = ''; // Clear any previous success messages
	}

	function addRow() {
		rows = [...rows, createNewRow()];
	}

	function removeRow(index: number) {
		rows = rows.filter((_, i) => i !== index);
	}

	// --- Modified & New Functions ---
	function clearFields() {
		rows = rows.map((row) => ({
			// Keep the row's ID and type, but clear all other fields
			id: row.id,
			type: row.type, // Persist the row's original purpose
			driverName: 'Eddy', // Reset to default
			date: '',
			pickupTime: '',
			pickupLocation: '',
			dropoffTime: '',
			dropoffLocation: '',
			paxNames: '',
			flightInfo: '',
			contact: ''
		}));
	}

	function handleAutofill() {
		const newData = autofillData(event);
		rows = newData;
	}
	// --- End Modified & New Functions ---

	function calculateDropoffTime(pickupTime: string, type: CalendarEntry['type']): string | null {
		if (!pickupTime || !type) return null;
		const [hours, minutes] = pickupTime.split(':').map(Number);
		if (isNaN(hours) || isNaN(minutes)) return null;
		const pickupDate = new Date();
		pickupDate.setHours(hours, minutes, 0, 0);
		let duration = 0;
		if (type === 'Arrival' || type === 'Departure') {
			duration = 30;
		} else if (
			type === 'Soundcheck' ||
			type === 'Show' ||
			type === 'Post-SC' ||
			type === 'Post Show'
		) {
			duration = 15;
		}
		if (duration > 0) {
			const dropoffDate = new Date(pickupDate.getTime() + duration * 60000);
			const dropoffMinutes = dropoffDate.getMinutes();
			const remainder = dropoffMinutes % 15;
			if (remainder !== 0) {
				dropoffDate.setMinutes(dropoffMinutes + (15 - remainder));
			}
			const finalHours = String(dropoffDate.getHours()).padStart(2, '0');
			const finalMinutes = String(dropoffDate.getMinutes()).padStart(2, '0');
			return `${finalHours}:${finalMinutes}`;
		}
		return null;
	}

	$: {
		if (rows) {
			for (const row of rows) {
				const calculatedDropoffTime = calculateDropoffTime(row.pickupTime, row.type);
				if (calculatedDropoffTime !== null && row.dropoffTime !== calculatedDropoffTime) {
					row.dropoffTime = calculatedDropoffTime;
				}
			}
		}
	}

async function handleSave() {
    if (!event) return;
    isSaving = true;
    try {
        // Only save rows that have meaningful data, otherwise save an empty array.
        const hasMeaningfulData = rows.some((row) => row.date && row.pickupTime);
        const dataToSave = hasMeaningfulData ? rows : [];

        await updateEventAdvance(event.event_id, event.artist_name, {
            ground_transport: dataToSave
        });
        dispatch('save_success');
        handleClose();
    } catch (error) {
        console.error('Failed to save ground transport data:', error);
    } finally {
        isSaving = false;
    }
}
	// Determine sync status and button text
	const SyncStatus = {
		NO_SYNC: 'no_sync',
		UPDATE: 'update',
		UPDATE_AND_SYNC: 'update_and_sync',
		NO_UPDATES: 'no_updates'
	};

	// Make sync status reactive to all dependencies
$: syncStatus = (() => {
    // First, check if there's any actual data to sync.
    const hasMeaningfulData = rows.some((row) => row.date && row.pickupTime);

    // If no meaningful data has been entered, there are no updates needed.
    if (!hasMeaningfulData) {
        // If there are existing synced events, that means the user deleted everything, which is an update.
        if (isCalendarSynced && Object.keys(calendarEventIds).length > 0) {
            return SyncStatus.UPDATE;
        }
        return SyncStatus.NO_UPDATES;
    }

    // If we have meaningful data, then proceed with the original sync checks.
    if (!isCalendarSynced || !calendarEventIds || Object.keys(calendarEventIds).length === 0) {
        return SyncStatus.NO_SYNC;
    }

    // Compare current rows with what was synced
    let hasNewRows = false;
    let hasChangedRows = false;

    // Check for new rows (not in calendarEventIds)
    for (const row of rows) {
        if (row.type && row.date && row.pickupTime) {
            if (!calendarEventIds[row.id]) {
                hasNewRows = true;
                break;
            }
        }
    }

    // Check for modified rows (comparing with original data)
    if (event && event.ground_transport && Array.isArray(event.ground_transport)) {
        const originalRows = event.ground_transport;
        for (const row of rows) {
            const originalRow = originalRows.find((r) => r.id === row.id);
            if (originalRow && calendarEventIds[row.id]) {
                const rowCopy = { ...row };
                const originalCopy = { ...originalRow };
                const fieldsToCompare: (keyof CalendarEntry)[] = [
                    'type',
                    'date',
                    'driverName',
                    'pickupTime',
                    'pickupLocation',
                    'dropoffTime',
                    'dropoffLocation',
                    'paxNames',
                    'flightInfo',
                    'contact'
                ];
                for (const field of fieldsToCompare) {
                    if (rowCopy[field] !== originalCopy[field]) {
                        hasChangedRows = true;
                        break;
                    }
                }
                if (hasChangedRows) break;
            }
        }
    }

    // Check for deleted rows (in calendarEventIds but not in current rows)
    if (calendarEventIds) {
        const currentRowIds = rows.map((r) => r.id);
        for (const syncedId in calendarEventIds) {
            if (!currentRowIds.includes(parseFloat(syncedId))) {
                hasChangedRows = true;
                break;
            }
        }
    }

    if (hasNewRows) {
        return SyncStatus.UPDATE_AND_SYNC;
    } else if (hasChangedRows) {
        return SyncStatus.UPDATE;
    } else {
        return SyncStatus.NO_UPDATES;
    }
})();

	$: syncButtonText =
		{
			[SyncStatus.NO_SYNC]: 'Sync to Calendar',
			[SyncStatus.UPDATE]: 'Update',
			[SyncStatus.UPDATE_AND_SYNC]: 'Update and Sync',
			[SyncStatus.NO_UPDATES]: 'No updates'
		}[syncStatus] || 'Sync to Calendar';

	$: syncButtonDisabled = syncStatus === SyncStatus.NO_UPDATES || rows.length === 0;
	$: hasMeaningfulData = rows.some((row) => row.date && row.pickupTime);
	$: isSaveAndCloseDisabled = isCalendarSynced && syncStatus !== SyncStatus.NO_UPDATES;

	// Debug logging to see what's happening
	$: console.log('Sync Status Debug:', {
		syncStatus,
		isCalendarSynced,
		calendarEventIds,
		rowsCount: rows.length,
		buttonText: syncButtonText
	});

	// Save ground transport data first, then sync
	async function saveGroundTransport(): Promise<boolean> {
		try {
			await updateEventAdvance(event.event_id, event.artist_name, {
				ground_transport: rows
			});
			// Update the event object with the saved data
			event.ground_transport = rows;
			return true;
		} catch (error) {
			console.error('Failed to save ground transport:', error);
			syncError = 'Failed to save transport data before syncing';
			return false;
		}
	}

	// Updated sync function that saves first
	async function handleCalendarSync() {
		if (!event || !rows || rows.length === 0) return;
		if (syncButtonDisabled) return;

		isSyncing = true;
		syncError = '';
		syncSuccess = '';

		try {
			// First, save the ground transport data
			console.log('Saving ground transport data first...');
			const saved = await saveGroundTransport();
			if (!saved) {
				isSyncing = false;
				return;
			}

			// Then sync to calendar
			const response = await fetch('/api/google-calendar', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					rows,
					artistName,
					eventId: event.event_id,
					existingEventIds: isCalendarSynced ? calendarEventIds : undefined
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Calendar sync failed:', errorText);
				syncError = `Server error (${response.status}): ${errorText}`;
				return;
			}

			const result = await response.json();

			if (result.success) {
				const hasEventIds = Object.keys(result.eventIds).length > 0;

				if (hasEventIds) {
					// Customize success message based on what happened
					if (syncStatus === SyncStatus.NO_SYNC) {
						syncSuccess = `Successfully synced ${Object.keys(result.eventIds).length} events to calendar!`;
					} else if (syncStatus === SyncStatus.UPDATE) {
						syncSuccess = 'Calendar events updated successfully!';
					} else if (syncStatus === SyncStatus.UPDATE_AND_SYNC) {
						syncSuccess = 'Calendar updated with new and modified events!';
					}

					// Update the local event object
					if (event) {
						event.calendar_synced = true;
						event.calendar_event_ids = result.eventIds;
						event.calendar_sync_time = new Date().toISOString();
						event.ground_transport = rows;
					}

					// Update reactive variables
					isCalendarSynced = true;
					calendarEventIds = result.eventIds;

					// Dispatch success event
					dispatch('calendar_sync_success', {
						...result,
						updatedEvent: event
					});
				} else {
					syncError = 'No events were created or found in calendar';
				}
			} else {
				syncError = result.error || 'Failed to sync with Google Calendar';
			}
		} catch (error) {
			console.error('Calendar sync error:', error);
			syncError = 'Network error: Could not connect to calendar service';
		} finally {
			isSyncing = false;
		}
	}
</script>

<!-- Rest of the template remains the same -->
<Modal
	{isOpen}
	on:close={handleClose}
	title="Ground Transport - {artistName}"
	maxWidth="max-w-screen-xl"
	hasFooter={true}
>
	<div class="p-4 bg-gray1 rounded-lg">
		<div class="flex items-center justify-start gap-2 mb-4">
			<button
				on:click={addRow}
				class="flex items-center gap-1.5 px-3 py-1 bg-gray1 text-lime border-1 border-lime rounded-xl text-xs font-bold hover:bg-lime hover:text-black hover:cursor-pointer transition-colors"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
				</svg>
				Add Line
			</button>
			<button
				on:click={handleAutofill}
				class="px-3 py-1 bg-gray2 text-black rounded-xl text-xs font-bold hover:cursor-pointer hover:bg-lime transition-colors"
			>
				Auto-Fill
			</button>
			<button
				on:click={clearFields}
				class="px-3 py-1 bg-gray1 text-red-400 border-1 border-red-400 rounded-xl text-xs font-bold hover:bg-red-400 hover:text-black hover:cursor-pointer transition-colors"
			>
				Clear Fields
			</button>
		</div>

		{#if syncError}
			<div class="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
				<strong>Calendar Sync Error:</strong>
				{syncError}
			</div>
		{/if}

		{#if syncSuccess}
			<div class="mb-4 p-3 bg-lime/20 border border-lime rounded-lg text-lime text-sm">
				{syncSuccess}
			</div>
		{/if}

		<div>
			<div
				class="flex items-center gap-3 pb-2 mb-2 border-b border-gray2 text-gray2 text-xs font-bold uppercase"
			>
				<div class={columnStyles.move}>Move</div>
				<div class={columnStyles.date}>Date</div>
				<div class={columnStyles.type}>Type</div>
				<div class={columnStyles.driver}>Driver</div>
				<div class={columnStyles.pickupTime}>Pickup</div>
				<div class={columnStyles.pickupLocation}>P/U Location</div>
				<div class={columnStyles.dropoffTime}>Dropoff</div>
				<div class={columnStyles.dropoffLocation}>D/O Location</div>
				<div class={columnStyles.paxNames}>Pax Name(s)</div>
				<div class={columnStyles.flightInfo}>Flight Info</div>
				<div class={columnStyles.contact}>Contact</div>
				<div class={columnStyles.delete}></div>
			</div>

			<div class="space-y-1.5">
				{#each rows as row, index (row.id)}
					{@const typeDropdownId = `${row.id}-type`}
					{@const driverDropdownId = `${row.id}-driver`}
					<div
						in:fly={{ y: 10, duration: 300, delay: index * 50 }}
						class="flex items-center gap-3 transition-all duration-200"
						role="listitem"
					>
						<div class="{columnStyles.move} flex items-center justify-center gap-1">
							<button
								on:click={() => moveRowUp(index)}
								disabled={index === 0}
								class="p-1 rounded-full text-gray2 hover:bg-gray2/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
								aria-label="Move up"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="3"
									><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg
								>
							</button>
							<button
								on:click={() => moveRowDown(index)}
								disabled={index === rows.length - 1}
								class="p-1 rounded-full text-gray2 hover:bg-gray2/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
								aria-label="Move down"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="3"
									><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg
								>
							</button>
						</div>

						<div class={columnStyles.date}>
							<div
								class="w-full bg-navbar border border-gray2 rounded-xl focus-within:ring-1 focus-within:ring-lime focus-within:border-lime"
							>
								<DatePicker bind:value={row.date} placeholder="Set Date" />
							</div>
						</div>

						<div class="dropdown-container relative {columnStyles.type}">
							<button
								type="button"
								class="{getTypeButtonColor(
									row.type
								)} rounded-xl px-3 py-1 font-bold text-xs transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 w-full"
								on:click={() => toggleDropdown(typeDropdownId)}
							>
								<span class={row.type ? 'text-black' : 'text-gray-500'}>
									{row.type || 'Select Type'}
								</span>
								<svg
									class="w-3 h-3 text-black transition-transform {openDropdownId === typeDropdownId
										? 'rotate-180'
										: ''}"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M6 9l6 6 6-6" />
								</svg>
							</button>
							{#if openDropdownId === typeDropdownId}
								<div
									class="absolute top-full left-0 mt-1 bg-navbar border border-lime rounded-lg shadow-xl z-10 w-max min-w-full overflow-hidden"
								>
									{#each eventTypes as option}
										<button
											type="button"
											class="block w-full px-3 py-1 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0 text-xs font-bold whitespace-nowrap"
											on:click={() => selectOption(row.id, 'type', option)}
										>
											{option}
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<div class="dropdown-container relative {columnStyles.driver}">
							<button
								type="button"
								class="bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs hover:bg-lime hover:text-black transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 w-full"
								on:click={() => toggleDropdown(driverDropdownId)}
							>
								<span class={row.driverName ? 'text-black' : 'text-gray-500'}>
									{row.driverName || 'Select'}
								</span>
								<svg
									class="w-3 h-3 text-black transition-transform {openDropdownId ===
									driverDropdownId
										? 'rotate-180'
										: ''}"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M6 9l6 6 6-6" />
								</svg>
							</button>
							{#if openDropdownId === driverDropdownId}
								<div
									class="absolute top-full left-0 mt-1 bg-navbar border border-lime rounded-lg shadow-xl z-10 w-max min-w-full overflow-hidden"
								>
									{#each driverOptions as option}
										<button
											type="button"
											class="block w-full px-3 py-1 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0 text-xs font-bold whitespace-nowrap"
											on:click={() => selectOption(row.id, 'driver', option)}
										>
											{option}
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<div class={columnStyles.pickupTime}>
							<input
								type="time"
								bind:value={row.pickupTime}
								class="w-full bg-navbar border border-gray2 text-white text-xs rounded-xl focus:ring-lime focus:border-lime px-1 py-1.5"
							/>
						</div>

						<div class={columnStyles.pickupLocation}>
							<input
								type="text"
								bind:value={row.pickupLocation}
								placeholder="Location"
								class="w-full bg-navbar border border-gray2 text-white text-xs rounded-xl focus:ring-lime focus:border-lime px-3 py-1.5"
							/>
						</div>

						<div class={columnStyles.dropoffTime}>
							<input
								type="time"
								bind:value={row.dropoffTime}
								class="w-full bg-navbar border border-gray2 text-white text-xs rounded-xl focus:ring-lime focus:border-lime px-1 py-1.5"
							/>
						</div>

						<div class={columnStyles.dropoffLocation}>
							<input
								type="text"
								bind:value={row.dropoffLocation}
								placeholder="Location"
								class="w-full bg-navbar border border-gray2 text-white text-xs rounded-xl focus:ring-lime focus:border-lime px-3 py-1.5"
							/>
						</div>

						<div class={columnStyles.paxNames}>
							<input
								type="text"
								bind:value={row.paxNames}
								placeholder="Names"
								class="w-full bg-navbar border border-gray2 text-white text-xs rounded-xl focus:ring-lime focus:border-lime px-3 py-1.5"
							/>
						</div>

						<div class={columnStyles.flightInfo}>
							<input
								type="text"
								bind:value={row.flightInfo}
								placeholder="Info"
								class="w-full bg-navbar border border-gray2 text-white text-xs rounded-xl focus:ring-lime focus:border-lime px-3 py-1.5"
							/>
						</div>

						<div class={columnStyles.contact}>
							<input
								type="text"
								bind:value={row.contact}
								placeholder="Contact"
								class="w-full bg-navbar border border-gray2 text-white text-xs rounded-xl focus:ring-lime focus:border-lime px-3 py-1.5"
							/>
						</div>

						<div class="{columnStyles.delete} flex justify-center">
							<button
								on:click={() => removeRow(index)}
								class="text-gray2 hover:text-problem p-1 rounded-full transition-colors"
								aria-label="Remove row"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
<div slot="footer" class="flex justify-between items-center w-full p-4">
	<button
		on:click={handleCalendarSync}
		disabled={isSyncing || syncButtonDisabled}
		class={`flex items-center gap-2 px-4 py-3 rounded-full text-sm font-bold transition-all ${
			syncStatus === SyncStatus.NO_UPDATES
				? 'bg-gray2 text-gray-500'
				: syncStatus === SyncStatus.NO_SYNC
				? 'bg-lime text-black'
				: syncStatus === SyncStatus.UPDATE
				? 'bg-[#93c5fd] text-black'
				: 'bg-[#c4b5fd] text-black'
		} ${
			syncButtonDisabled
				? 'opacity-50 cursor-not-allowed'
				: 'hover:opacity-90 cursor-pointer' // <-- This line adds the pointer cursor
		}`}
	>
		{#if isSyncing}
			<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			Syncing...
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				{#if syncStatus === SyncStatus.NO_UPDATES}
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				{:else}
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
					/>
				{/if}
			</svg>
			{syncButtonText}
		{/if}
	</button>

	<Button on:click={handleSave} variant="filled" disabled={isSaving || isSaveAndCloseDisabled}>
		{isSaving ? 'Saving...' : 'Save & Close'}
	</Button>
</div>
</Modal>
