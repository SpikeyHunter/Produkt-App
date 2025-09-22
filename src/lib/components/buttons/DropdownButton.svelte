<script lang="ts">
	import { updateEventAdvance } from '$lib/services/eventsService';
	import type { EventAdvance } from '$lib/services/eventsService';
	import { PROGRESS_FIELDS } from '$lib/utils/progressUtils';
	import { createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';

	// Props
	export let event: EventAdvance | undefined = undefined;
	export let value: string = '';
	export let options: string[] = [];
	export let placeholder: string = 'Select option';
	export let customPlaceholder: string = 'Enter custom value';
	export let column: string | undefined = undefined;
	export let buttonClass: string = '';
	export let width: string = 'w-auto';
	export let height: string = 'h-auto';

	// Conversion props - make the component reusable
	export let valueType: 'text' | 'boolean' = 'text';
	export let trueValues: string[] = [];
	export let falseValues: string[] = [];

	// Internal state
	let showDropdown = false;
	let customValue = '';
	let isUpdating = false;
	let buttonElement: HTMLElement;

	// Unique identifier for this dropdown
	const dropdownId = `dropdown-${event?.event_id || 'local'}-${column || 'local'}-${Math.random()}`;
	const dispatch = createEventDispatcher();

	$: if (value === 'Other' || (value && !options.includes(value) && value !== placeholder)) {
		customValue = value === 'Other' ? '' : value;
	}

	$: showCustomInput = value === 'Other' || (value && !options.includes(value) && value !== placeholder);

	function handleGlobalDropdownEvent(event: CustomEvent) {
		if (event.detail.dropdownId !== dropdownId && showDropdown) {
			showDropdown = false;
		}
	}

	onMount(() => {
		if (browser) {
			window.addEventListener('dropdown-opened', handleGlobalDropdownEvent as EventListener);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('dropdown-opened', handleGlobalDropdownEvent as EventListener);
		}
	});

	function closeOtherDropdowns() {
		if (browser) {
			window.dispatchEvent(
				new CustomEvent('dropdown-opened', {
					detail: { dropdownId }
				})
			);
		}
	}

	function toggleDropdown() {
		if (!showDropdown) {
			closeOtherDropdowns();
		}
		showDropdown = !showDropdown;
	}

	async function selectOption(selectedOption: string) {
		const previousValue = value;
		value = selectedOption;
		showDropdown = false;
		dispatch('select', selectedOption);

		// If event and column are provided, handle the database update internally
		if (event && column) {
			try {
				isUpdating = true;
				if (selectedOption !== 'Other') {
					const dbValue = convertValueForDatabase(selectedOption);
					await updateDatabaseValue(dbValue);
				} else {
					customValue = '';
				}
			} catch (error) {
				value = previousValue; // Revert on error
				console.error(`Failed to update ${column}:`, error);
			} finally {
				isUpdating = false;
			}
		}
	}

	function convertValueForDatabase(displayValue: string): any {
		if (valueType === 'boolean') {
			if (trueValues.includes(displayValue)) {
				return true;
			}
			if (falseValues.includes(displayValue)) {
				return false;
			}
			return false;
		}
		return displayValue;
	}

	async function handleCustomValueChange() {
		if (customValue.trim()) {
			const trimmedValue = customValue.trim();
			value = trimmedValue;
			dispatch('select', trimmedValue);

			// If event and column are provided, handle the database update internally
			if (event && column) {
				try {
					isUpdating = true;
					const dbValue = convertValueForDatabase(trimmedValue);
					await updateDatabaseValue(dbValue);
				} catch (error) {
					console.error(`Failed to update custom ${column}:`, error);
					value = 'Other'; // Revert on failure
				} finally {
					isUpdating = false;
				}
			}
		}
	}

	async function updateDatabaseValue(newValue: any) {
		if (!event || !column) return;
		try {
			console.log(`🔄 Updating ${column} to:`, newValue, '(type:', typeof newValue, ')');
			const updates = { [column]: newValue };

			await updateEventAdvance(event.event_id, event.artist_name, updates);

			dispatch('fieldUpdate', {
				column,
				value: value,
				eventId: event.event_id,
				artistName: event.artist_name
			});

			if (PROGRESS_FIELDS.includes(column as any)) {
				console.log('📈 DropdownButton: Progress field updated, dispatching progress-field-updated');
				dispatch('progress-field-updated', {
					column,
					value: newValue,
					eventId: event.event_id,
					artistName: event.artist_name
				});
			}

			console.log(`✅ ${column} updated successfully`);
		} catch (error) {
			console.error(`❌ Error updating ${column}:`, error);
			throw error;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		const dropdown = event.target as HTMLElement;
		if (!dropdown.closest('.dropdown-container')) {
			showDropdown = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="dropdown-container relative {width} {height}">
	{#if showCustomInput}
		<div class="relative">
			<input
				type="text"
				class="bg-gray2 text-black rounded-xl px-3 py-1 pr-8 text-xs font-bold placeholder-gray-500 focus:outline-none focus:bg-lime focus:text-black transition-all duration-200 min-w-0 {isUpdating && event && column ? 'opacity-70' : ''}"
				style="width: {Math.min(300, Math.max(140, (customValue.length + 8) * 6.5))}px;"
				placeholder={customPlaceholder}
				bind:value={customValue}
				on:blur={handleCustomValueChange}
				on:keydown={(e) => e.key === 'Enter' && handleCustomValueChange()}
				disabled={isUpdating && !!event && !!column}
			/>
			<button
				type="button"
				class="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-pointer"
				on:click={toggleDropdown}
				aria-label="Toggle dropdown"
				disabled={isUpdating && !!event && !!column}
				bind:this={buttonElement}
			>
				<svg
					class="w-3 h-3 text-black transition-transform {showDropdown ? 'rotate-180' : ''} {isUpdating && event && column ? 'opacity-50' : ''}"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</button>
		</div>
	{:else}
		<button
			type="button"
			class="{buttonClass || 'bg-gray2'} text-black rounded-xl px-3 py-1 font-bold text-xs {buttonClass ? 'hover:opacity-80' : 'hover:bg-lime hover:text-black'} transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 {isUpdating && event && column ? 'opacity-70' : ''}"
			on:click={toggleDropdown}
			disabled={isUpdating && !!event && !!column}
			bind:this={buttonElement}
		>
			<span class={value && value !== placeholder ? 'text-black' : 'text-gray-500'}>
				{value || placeholder}
			</span>
			<svg
				class="w-3 h-3 text-black transition-transform {showDropdown ? 'rotate-180' : ''} {isUpdating && event && column ? 'opacity-50' : ''}"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M6 9l6 6 6-6" />
			</svg>
		</button>
	{/if}

	{#if showDropdown}
		<div
			class="absolute top-full left-0 mt-1 bg-navbar border border-lime rounded-lg shadow-xl z-[9999] w-max min-w-full overflow-hidden"
		>
			{#each options as option}
				<button
					type="button"
					class="block w-full px-3 py-1 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0 text-xs font-bold whitespace-nowrap {isUpdating && event && column ? 'opacity-50 pointer-events-none' : ''}"
					on:click={() => selectOption(option)}
					disabled={isUpdating && !!event && !!column}
				>
					{option}
				</button>
			{/each}
		</div>
	{/if}
</div>