<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { calculateDynamicProgress, refreshEventData, PROGRESS_FIELDS } from '$lib/utils/progressUtils';
	import type { EventAdvance } from '$lib/services/eventsService';

	// Props
	export let event: EventAdvance | any;
	export let showLabel: boolean = true;
	export let labelSize: string = 'text-xs'; // Tailwind text size class
	export let barHeight: string = 'h-1.5'; // Tailwind height class
	export let maxWidth: string = 'max-w-[265px]'; // Maximum width constraint
	export let labelColor: string = 'text-lime'; // Label text color
	export let barColor: string = 'bg-lime'; // Progress bar color
	export let trackColor: string = 'bg-gray2/40'; // Track background color

	// Internal state
	let isRefreshing = false;
	let currentEvent = event;

	const dispatch = createEventDispatcher();

	// Watch for changes in the event prop
	$: if (event) {
		currentEvent = event;
	}

	// Watch for changes in any progress-related fields using imported constant
	$: watchedFields = PROGRESS_FIELDS.map(field => currentEvent?.[field]);
	
	// Calculate progress reactively when any watched field changes
	$: progress = currentEvent ? calculateDynamicProgress(currentEvent) : 0;
	$: progressWidth = `${progress}%`;

	/**
	 * Refresh progress from database
	 * This is the key function that will be called from parent components
	 */
	export async function refreshProgress(columns?: string[]) {
		if (!currentEvent?.event_id || !currentEvent?.artist_name || isRefreshing) {
			return;
		}

		try {
			isRefreshing = true;
			console.log('🔄 ProgressBar: Refreshing from database...', columns ? `for columns: ${columns.join(', ')}` : 'all data');
			
			// Get fresh data from database - pass full event ID format
			const freshEventData = await refreshEventData(currentEvent.event_id.toString(), currentEvent.artist_name);
			
			// Update current event data
			currentEvent = freshEventData;
			
			// Dispatch event to notify parent component
			dispatch('progress-updated', {
				event: freshEventData,
				previousProgress: progress,
				newProgress: calculateDynamicProgress(freshEventData),
				updatedColumns: columns || PROGRESS_FIELDS
			});
			
			console.log('✅ ProgressBar: Progress refreshed successfully');
			
		} catch (error) {
			console.error('❌ ProgressBar: Error refreshing progress:', error);
			dispatch('progress-error', { error });
		} finally {
			isRefreshing = false;
		}
	}

	/**
	 * Check specific columns for changes
	 * Alternative method for more targeted updates
	 */
	export async function checkAndUpdate(columns: string[]) {
		if (!currentEvent?.event_id || !currentEvent?.artist_name || isRefreshing) {
			return;
		}

		try {
			isRefreshing = true;
			console.log('🔍 ProgressBar: Checking specific columns:', columns);
			
			const freshEventData = await refreshEventData(currentEvent.event_id.toString(), currentEvent.artist_name);
			
			// Check if any of the specified columns changed
			const changes: { [key: string]: { old: any, new: any } } = {};
			let hasChanges = false;
			
			columns.forEach(column => {
				const currentValue = (currentEvent as any)[column];
				const freshValue = (freshEventData as any)[column];
				
				if (currentValue !== freshValue) {
					changes[column] = {
						old: currentValue,
						new: freshValue
					};
					hasChanges = true;
				}
			});
			
			if (hasChanges) {
				console.log('📈 ProgressBar: Changes detected:', changes);
				currentEvent = freshEventData;
				
				dispatch('progress-updated', {
					event: freshEventData,
					changes,
					updatedColumns: columns
				});
			} else {
				console.log('📊 ProgressBar: No changes detected in specified columns');
			}
			
		} catch (error) {
			console.error('❌ ProgressBar: Error checking columns:', error);
			dispatch('progress-error', { error });
		} finally {
			isRefreshing = false;
		}
	}
	
	// Debug logging to track updates
	$: if (currentEvent) {
		console.log('🔄 ProgressBar: Progress calculated:', progress + '%', 'for fields:', PROGRESS_FIELDS);
	}
</script>

<div class="flex items-center gap-3">
	<!-- Progress Label -->
	{#if showLabel}
		<span class="{labelSize} font-normal {labelColor} transition-all duration-300">
			{#if isRefreshing}
				<span class="opacity-50">...</span>
			{:else}
				{progress}%
			{/if}
		</span>
	{/if}
	
	<!-- Progress Bar -->
	<div class="flex-1 {maxWidth} {barHeight} {trackColor} rounded overflow-hidden relative">
		<div
			class="{barHeight} {barColor} transition-all duration-500 ease-out"
			style="width: {progressWidth}"
		></div>
		
		<!-- Loading indicator overlay -->
		{#if isRefreshing}
			<div class="absolute inset-0 bg-gray2/20 rounded">
				<div class="h-full bg-lime/30 animate-pulse rounded"></div>
			</div>
		{/if}
	</div>
</div>