<script lang="ts">
	import Modal from '$lib/components/modals/Modal.svelte';
	import DatePicker from '$lib/components/buttons/DatePicker.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { updateEventAdvance, type EventAdvance } from '$lib/services/eventsService';
	import { browser } from '$app/environment';
	import { autofillData } from '$lib/services/autofillService';

	export let isOpen = false;
	export let event: EventAdvance;
	$: artistName = event ? event.artist_name : 'Artist Name';
	const dispatch = createEventDispatcher();
	let isSaving = false;

	// --- Drag & Drop State ---
	let draggedIndex: number | null = null;
	let dragOverIndex: number | null = null;
	let isDragging = false;

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

	// --- Drag & Drop Functions ---
	function handleDragStart(e: DragEvent, index: number) {
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', 'dragging');
			e.dataTransfer.effectAllowed = 'move';
		}
		draggedIndex = index;
		isDragging = true;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
		isDragging = false;
	}

	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		if (draggedIndex !== null && draggedIndex !== index) {
			dragOverIndex = index;
		}
	}

	function handleDragLeave(e: DragEvent) {
		// Only clear dragOverIndex if we're actually leaving the drop zone
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX;
		const y = e.clientY;
		if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
			dragOverIndex = null;
		}
	}

	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === dropIndex) {
			handleDragEnd();
			return;
		}

		// Perform the reorder
		const draggedItem = rows[draggedIndex];
		const newRows = [...rows];
		
		// Remove dragged item
		newRows.splice(draggedIndex, 1);
		
		// Insert at new position (adjust index if we removed an item before the drop position)
		const adjustedDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
		newRows.splice(adjustedDropIndex, 0, draggedItem);
		
		rows = newRows;
		handleDragEnd();
	}

	// --- Move functions for accessibility and touch devices ---
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
		dragHandle: 'w-[50px]',
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

	type CalendarEntry = {
		id: number;
		date: string;
		type: 'Arrival' | 'Departure' | 'Soundcheck' | 'Post-SC' | 'Show' | 'Post Show' | '';
		driverName: string;
		pickupTime: string;
		pickupLocation: string;
		dropoffTime: string;
		dropoffLocation: string;
		paxNames: string;
		flightInfo: string;
		contact: string;
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
		handleDragEnd(); // Reset drag state when modal opens
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
			await updateEventAdvance(event.event_id, event.artist_name, {
				ground_transport: rows
			});
			dispatch('save_success');
			handleClose();
		} catch (error) {
			console.error('Failed to save ground transport data:', error);
		} finally {
			isSaving = false;
		}
	}
</script>

<style>
	.dragging {
		opacity: 0.6;
		transform: rotate(2deg);
		z-index: 50;
	}
	
	.drag-over {
		box-shadow: 0 -3px 0 var(--color-lime);
		transform: translateY(-1px);
	}

	.drag-handle {
		cursor: grab;
	}
	
	.drag-handle:active {
		cursor: grabbing;
	}

	.drag-handle:hover .drag-dots {
		opacity: 1;
	}

	.drag-dots {
		opacity: 0.6;
		transition: opacity 0.2s ease;
	}
</style>

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

		<div>
			<div
				class="flex items-center gap-3 pb-2 mb-2 border-b border-gray2 text-gray2 text-xs font-bold uppercase"
			>
				<div class={columnStyles.dragHandle}>Order</div>
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
					{@const isDraggedOver = dragOverIndex === index && draggedIndex !== null}
					{@const isBeingDragged = draggedIndex === index}
					<div
						in:fly={{ y: 10, duration: 300, delay: index * 50 }}
						class="flex items-center gap-3 transition-all duration-200 {isBeingDragged ? 'dragging' : ''} {isDraggedOver ? 'drag-over' : ''}"
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, index)}
						on:dragover={(e) => handleDragOver(e, index)}
						on:dragleave={handleDragLeave}
						on:drop={(e) => handleDrop(e, index)}
						on:dragend={handleDragEnd}
						role="listitem"
					>
						<!-- Drag Handle Column -->
						<div class="{columnStyles.dragHandle} flex items-center justify-center">
							<div class="drag-handle flex items-center justify-center p-2 rounded hover:bg-gray2/20" title="Drag to reorder">
								<div class="drag-dots grid grid-cols-2 gap-0.5">
									<div class="w-1 h-1 bg-gray2 rounded-full"></div>
									<div class="w-1 h-1 bg-gray2 rounded-full"></div>
									<div class="w-1 h-1 bg-gray2 rounded-full"></div>
									<div class="w-1 h-1 bg-gray2 rounded-full"></div>
									<div class="w-1 h-1 bg-gray2 rounded-full"></div>
									<div class="w-1 h-1 bg-gray2 rounded-full"></div>
								</div>
							</div>
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
								class="bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs hover:bg-lime hover:text-black transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 w-full"
								on:click={() => toggleDropdown(typeDropdownId)}
							>
								<span class={row.type ? 'text-black' : 'text-gray-500'}>
									{row.type || 'Select Type'}
								</span>
								<svg
									class="w-3 h-3 text-black transition-transform {openDropdownId === typeDropdownId ?
										'rotate-180' :
										''}"
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
									class="w-3 h-3 text-black transition-transform {openDropdownId === driverDropdownId ?
										'rotate-180' :
										''}"
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

	<div slot="footer" class="flex justify-end items-center w-full p-4">
		<Button on:click={handleSave} variant="filled" disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Save & Close'}
		</Button>
	</div>
</Modal>