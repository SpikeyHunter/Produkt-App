<script lang="ts">
	import { updateEventColumn } from '$lib/services/eventsService.js';
	import type { EventAdvance } from '$lib/services/eventsService.js';
	import { createEventDispatcher } from 'svelte';
	// Props for customization
	export let title: string = 'Custom Title';
	export let width: number = 500;
	// Width in pixels
	export let height: number = 365; // Height in pixels
	export let defaultEnabled: boolean = false;
	// Default toggle state
	export let event: EventAdvance | null = null;
	// Event object for DB updates
	export let dbColumns: string[] = [];
	// Database columns to reset when toggled
	export let toggleColumn: string = '';
	// Column that controls the toggle state
	export let overlayStopHeight: string = '';
	// Height where overlay should stop (e.g., 'calc(100% - 80px)')
	
	const dispatch = createEventDispatcher();
	// Internal state - check toggle column value
	$: isEnabled = checkIfEnabled();
	// Check if toggle should be enabled based on toggle column
	function checkIfEnabled(): boolean {
		if (!event || !toggleColumn) {
			console.log(`🔄 Toggle check: No event or toggleColumn, defaulting to ${defaultEnabled}`);
			return defaultEnabled;
		}
		
		// Check the specific toggle column (e.g., 'immigration')
		const toggleValue = (event as any)[toggleColumn];
		console.log(`🔄 Checking toggle state for ${toggleColumn}:`, {
			value: toggleValue, 
			type: typeof toggleValue,
			exists: toggleColumn in event 
		});
		// If the column doesn't exist in the event object, default to false
		if (!(toggleColumn in event)) {
			console.log(`⚠️ Column ${toggleColumn} not found in event object, defaulting to false`);
			return false;
		}
		
		const result = toggleValue === true;
		console.log(`🔄 Toggle result: ${result}`);
		return result;
	}
	
	// Reactive styles
	$: cardStyle = `width: ${width}px; height: ${height}px;`;
	$: overlayClass = isEnabled ? 'opacity-0 pointer-events-none' : 'opacity-40';
	$: overlayStyle = overlayStopHeight ? `height: ${overlayStopHeight};` : '';
	
	// Handle toggle change with database update
	async function handleToggleChange() {
		if (event && toggleColumn) {
			try {
				console.log(`🔄 Toggling ${toggleColumn} to:`, isEnabled);
				// Update the toggle column
				await updateEventColumn(event.id, toggleColumn, isEnabled);
				console.log(`✅ Successfully updated ${toggleColumn} to ${isEnabled}`);
				// ALWAYS reset all related columns to NULL when toggling (both ON and OFF)
				if (dbColumns.length > 0) {
					console.log(`🔄 Resetting columns [${dbColumns.join(', ')}] to NULL`);
					for (const column of dbColumns) {
						await updateEventColumn(event.id, column, null);
						// Update local event object immediately
						(event as any)[column] = null;
						console.log(`✅ Successfully reset ${column} to NULL`);
					}
				}
				
				// Update local toggle column
				(event as any)[toggleColumn] = isEnabled;
				// Force reactivity
				event = { ...event };
				
				// Dispatch event to parent with updated data
				dispatch('columnUpdate', {
					toggleColumn,
					columns: dbColumns, 
					toggleValue: isEnabled,
					eventId: event.id 
				});
				console.log(`✅ Toggle and columns updated successfully`);
			} catch (error) {
				console.error(`❌ Failed to update toggle/columns:`, error);
				// Revert the toggle state on error by recalculating
				isEnabled = checkIfEnabled();
			}
		}
	}
</script>

<div 
	class="flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300"
	style={cardStyle}
>
	<div class="flex items-center justify-between px-6 py-3 border-b border-gray1">
		<h2 class="text-xl font-normal text-gray3 truncate flex-1 mr-4">
			{title}
		</h2>
		
		<div class="flex-shrink-0">
			<label class="relative inline-flex items-center cursor-pointer">
				<input
					type="checkbox"
					bind:checked={isEnabled}
					on:change={handleToggleChange}
					class="sr-only peer"
				/>
				<div class="toggle-switch {isEnabled ? 'toggle-on' : 'toggle-off'}">
					<div class="toggle-circle {isEnabled ? 'circle-on' : 'circle-off'}"></div>
				</div>
			</label>
		</div>
	</div>
	
	<div class="relative flex-1 {isEnabled ?
		'' : 'cursor-not-allowed'}">
		<div 
			class="px-6 py-2 h-full {isEnabled ?
				'pointer-events-auto' : 'pointer-events-none'}"
		>
			<slot />
		</div>
		
		<div 
			class="absolute inset-0 bg-black transition-opacity duration-300 rounded-b-2xl {overlayClass}"
			style={overlayStyle}
		></div>
	</div>
</div>

<style>
	/* Custom toggle switch styling */
	.toggle-switch {
		position: relative;
		width: 44px;
		height: 24px;
		border-radius: 12px;
		transition: all 0.3s ease;
		cursor: pointer;
	}
	
	.toggle-on {
		background: transparent;
		border: 2px solid var(--color-lime);
	}
	
	.toggle-off {
		background: var(--color-gray1);
		border: 2px solid var(--color-gray1);
	}
	
	.toggle-circle {
		position: absolute;
		top: 2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		transition: all 0.3s ease;
	}
	
	.circle-on {
		background: var(--color-lime);
		left: 22px; /* Move to right when on */
	}
	
	.circle-off {
		background: var(--color-white);
		left: 2px; /* Stay on left when off */
	}
	
	/* Focus styles */
	.toggle-switch:focus-within {
		box-shadow: 0 0 0 2px rgba(225, 255, 0, 0.3);
	}
</style>