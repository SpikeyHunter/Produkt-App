<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { portal } from '$lib/utils/portalUtils.js';
	import SetTimesModal from '$lib/components/modals/SetTimesModal.svelte';
	import ClipboardButton from '$lib/components/buttons/ClipboardButton.svelte';
	import type {
		EventAdvance,
		TimetableEntry,
		EventWithTimetable
	} from '$lib/services/eventsService';

	// Props - EventAdvance might not have timetable, so we handle it
	export let event: EventAdvance & {
		timetable?: TimetableEntry[] | null;
		timetable_active?: boolean;
	};

	const dispatch = createEventDispatcher();

	// Modal state
	let showSetTimesModal = false;

	// Get the current artist name from the event (for highlighting)
	$: currentArtistName = event.artist_name || event.name;

	// Shared artist status logic (from setTimesCard)
	$: sharedArtistStatus = (() => {
		const artistEntries = event.timetable?.filter(
			(entry) => entry.artist !== 'DOORS' && entry.artist !== 'CURFEW'
		);

		if (!artistEntries || artistEntries.length === 0) {
			return null;
		}

		const firstStatus = artistEntries[0].status;
		const allHaveSameStatus = artistEntries.every((entry) => entry.status === firstStatus);

		return allHaveSameStatus ? firstStatus : null;
	})();
	// Add these two new helper functions to your script
	function formatTimeWithSeconds(timeStr: string): string {
		if (!timeStr) return '';
		// This will find "AM" or "PM" and insert ":00" before it.
		// e.g., "10:00PM" becomes "10:00:00 PM"
		const periodIndex = timeStr.search(/am|pm/i);
		if (periodIndex === -1) return timeStr; // Return original if AM/PM not found

		const timePart = timeStr.substring(0, periodIndex);
		const periodPart = timeStr.substring(periodIndex);

		return `${timePart}:00 ${periodPart}`;
	}

	function formatLengthWithMinutes(lengthStr: string): string {
		if (!lengthStr) return '';

		// Clean the string by removing spaces and "min" text
		const cleanedStr = lengthStr.replace(/\s+/g, '').replace('min', '');
		let totalMinutes = 0;

		// Check if the string contains hours
		if (cleanedStr.includes('h')) {
			const parts = cleanedStr.split('h');
			const hours = parseInt(parts[0]) || 0;
			const minutes = parseInt(parts[1]) || 0;
			// Calculate the total minutes from hours and minutes
			totalMinutes = hours * 60 + minutes;
		} else {
			// If no 'h', assume the value is already in minutes
			totalMinutes = parseInt(cleanedStr) || 0;
		}

		return `${totalMinutes} min`;
	}
	// Convert EventAdvance to EventWithTimetable for the modal
	$: eventForModal = event
		? {
				event_id: event.event_id,
				event_name: event.event_name || event.custom_event_name || 'Event',
				event_date: event.event_date || event.custom_event_date || '',
				event_flyer: event.event_flyer || null,
				timetable_active: event.timetable_active,
				timetable: event.timetable || null
			}
		: null;

	// Format timetable for clipboard (plain text)
	$: clipboardText = (() => {
		if (!event.timetable || event.timetable.length === 0) {
			return '';
		}

		const headers = ['Timetable', 'Length', 'Artist'];

		const rows = event.timetable.map((entry) => [
			formatTimeWithSeconds(entry.time || ''),
			formatLengthWithMinutes(entry.length || ''),
			entry.artist || ''
		]);

		const colWidths = headers.map((header, i) => {
			const columnData = [header, ...rows.map((row) => row[i])];
			return Math.max(...columnData.map((str) => str.length));
		});

		const padString = (str: string, width: number) => str.padEnd(width, ' ');

		const formattedHeader = headers.map((h, i) => padString(h, colWidths[i])).join('\t');

		const formattedRows = rows.map((row) =>
			row.map((cell, i) => padString(cell, colWidths[i])).join('\t')
		);

		return [formattedHeader, ...formattedRows].join('\n');
	})();

	// Format timetable as HTML table
	// Format timetable as HTML table
	$: clipboardHtml = (() => {
		if (!event.timetable || event.timetable.length === 0) {
			return '';
		}

		const getStatusColors = (status: string) => {
			switch (status) {
				case 'Confirmed':
					return { bg: '#d9ead3', text: '#274e13' }; // Green
				case 'Proposed':
					return { bg: '#fce5cd', text: '#783f04' }; // Orange
				case 'Tentative':
					return { bg: '#fff2cc', text: '#7f6000' }; // Yellow
				case 'Problem':
					return { bg: '#f4cccc', text: '#660000' }; // Red
				default:
					return { bg: '#ffffff', text: '#000000' }; // Default
			}
		};

		// The old `formatLength` function that was here is now correctly removed.

		// Build HTML table with styling to match the target image
		let html =
			'<table style="border-collapse: collapse; font-family: \'Helvetica Neue\', Helvetica, Arial, sans-serif; font-size: 13px; border: 0.5px solid #d1d5db;">';
		// Header row
		html += '<thead><tr style="background-color: #ffffff;">';
		html +=
			'<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 75px;">Timetable</th>';
		html +=
			'<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 40px;">Length</th>';
		html +=
			'<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 225px;">Artist</th>';
		html += '</tr></thead>';
		html += '<tbody>';

		// The corrections are inside this loop
		event.timetable.forEach((entry) => {
			const isSpecialEntry = entry.artist === 'DOORS' || entry.artist === 'CURFEW';
			const colors = isSpecialEntry
				? { bg: '#ffffff', text: '#000000' }
				: getStatusColors(entry.status);

			html += `<tr style="background-color: ${colors.bg};">`;
			// Timetable cell (UPDATED and CORRECTED)
			html += `<td style="background-color: #ffffff; border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: center;">${formatTimeWithSeconds(entry.time || '')}</td>`;
			// Length cell (UPDATED and CORRECTED)
			html += `<td style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: center; ">${formatLengthWithMinutes(entry.length || '')}</td>`;
			// Artist cell
			html += `<td style="border: 0.5px solid #d1d5db; padding: 2px 6px; color: ${colors.text}; font-weight: ${isSpecialEntry ? '400' : '600'}; font-style: ${isSpecialEntry ? 'italic' : 'normal'};">${entry.artist || ''}</td>`;
			html += '</tr>';
		});
		html += '</tbody></table>';

		return html;
	})();

	function isCurrentArtist(entry: TimetableEntry): boolean {
		if (!currentArtistName || entry.artist === 'DOORS' || entry.artist === 'CURFEW') {
			return false;
		}

		const normalizedCurrent = currentArtistName.toLowerCase().trim();
		const normalizedEntry = entry.artist.toLowerCase().trim();

		return (
			normalizedCurrent === normalizedEntry ||
			normalizedCurrent.includes(normalizedEntry) ||
			normalizedEntry.includes(normalizedCurrent)
		);
	}

	function getStatusColorClass(entry: TimetableEntry): string {
		let statusToRender = entry.status;
		const isSpecialEntry = entry.artist === 'DOORS' || entry.artist === 'CURFEW';

		if (isSpecialEntry) {
			if (sharedArtistStatus) {
				statusToRender = sharedArtistStatus;
			} else {
				return 'bg-[var(--color-gray2)]';
			}
		}

		switch (statusToRender) {
			case 'Confirmed':
				return 'bg-[var(--color-confirmed)]';
			case 'Proposed':
				return 'bg-[var(--color-proposed)]';
			case 'Tentative':
				return 'bg-[var(--color-tentatif)]';
			case 'Problem':
				return 'bg-[var(--color-problem)]';
			default:
				return 'bg-[var(--color-gray2)]';
		}
	}

	function getStatusTextColorClass(entry: TimetableEntry): string {
		let statusToRender = entry.status;
		const isSpecialEntry = entry.artist === 'DOORS' || entry.artist === 'CURFEW';

		if (isSpecialEntry) {
			if (sharedArtistStatus) {
				statusToRender = sharedArtistStatus;
			} else {
				return 'text-[var(--color-gray2)]';
			}
		}

		switch (statusToRender) {
			case 'Confirmed':
				return 'text-[var(--color-confirmed)]';
			case 'Proposed':
				return 'text-[var(--color-proposed)]';
			case 'Tentative':
				return 'text-[var(--color-tentatif)]';
			case 'Problem':
				return 'text-[var(--color-problem)]';
			default:
				return 'text-[var(--color-gray2)]';
		}
	}

	function getHighlightColorClass(entry: TimetableEntry): string {
		if (!isCurrentArtist(entry)) return '';

		switch (entry.status) {
			case 'Confirmed':
				return 'highlight-confirmed';
			case 'Proposed':
				return 'highlight-proposed';
			case 'Tentative':
				return 'highlight-tentatif';
			case 'Problem':
				return 'highlight-problem';
			default:
				return 'highlight-default';
		}
	}

	function openSetTimesModal() {
		showSetTimesModal = true;
	}

	function handleSetTimesClose() {
		showSetTimesModal = false;
	}

	function handleSetTimesSave(saveEvent: CustomEvent) {
		const { timetable } = saveEvent.detail;
		event = { ...event, timetable };
		dispatch('timetableUpdate', {
			timetable,
			eventId: event.event_id
		});
		console.log('✅ Set times updated successfully');
		showSetTimesModal = false;
	}
</script>

<div
	class="flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300 w-[260px] h-[365px]"
>
	<div class="flex items-center justify-between px-6 py-3 border-b border-gray1">
		<h2 class="text-xl font-normal text-gray3 truncate flex-1 mr-4">Run of Show</h2>

		{#if event.timetable && event.timetable.length > 0}
			<button
				on:click={openSetTimesModal}
				class="p-2 text-gray2 hover:text-black hover:bg-lime rounded-lg transition-all duration-200 cursor-pointer flex-shrink-0"
				aria-label="Edit set times"
				title="Edit set times"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
				</svg>
			</button>
		{/if}
	</div>

	<div class="flex-1 flex flex-col relative">
		{#if event.timetable && event.timetable.length > 0}
			<div class="px-6 pt-3 pb-2">
				<h3 class="text-sm font-bold text-gray3">Set Times</h3>
			</div>

			<div class="flex-1 overflow-y-auto px-6 pb-2">
				<ul class="space-y-2">
					{#each event.timetable as entry (entry.id)}
						<li
							class="flex items-center text-sm gap-2 relative {isCurrentArtist(entry)
								? 'artist-highlight'
								: ''}"
						>
							{#if isCurrentArtist(entry)}
								<div class="highlight-bg {getHighlightColorClass(entry)}"></div>
							{/if}

							<span
								class="block w-1.5 h-4 rounded-full {getStatusColorClass(entry)} relative z-10"
								title="Status: {entry.status}"
							></span>
							<span
								class="w-22 font-bold flex-shrink-0 {getStatusTextColorClass(entry)} relative z-10"
							>
								{formatTimeWithSeconds(entry.time)}
							</span>
							<span class="{getStatusTextColorClass(entry)} truncate relative z-10">
								{entry.artist}
							</span>
						</li>
					{/each}
				</ul>
			</div>

			<div class="border-t border-gray1 px-6 py-3 mt-auto flex justify-end">
				<ClipboardButton
					variant="default"
					copyText={clipboardText}
					copyHtml={clipboardHtml}
					label="Copy Table"
					successMessage="Copied!"
				/>
			</div>
		{:else}
			<div class="flex h-full w-full items-center justify-center p-4">
				<button
					on:click={openSetTimesModal}
					class="h-full w-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 bg-gray1 text-gray2 transition-all duration-200 hover:cursor-pointer hover:border-lime hover:bg-opacity-75 hover:text-white"
					aria-label="Add set times for {event.event_name || event.name}"
				>
					<svg
						class="w-8 h-8 mb-2"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
					<span class="font-bold text-sm">Add Set Times</span>
				</button>
			</div>
		{/if}
	</div>
</div>

{#if showSetTimesModal && eventForModal}
	<div use:portal>
		<SetTimesModal
			bind:isOpen={showSetTimesModal}
			event={eventForModal}
			on:save={handleSetTimesSave}
			on:close={handleSetTimesClose}
		/>
	</div>
{/if}

<style lang="postcss">
	@tailwind base;
	@tailwind components;
	@tailwind utilities;

	/* Artist highlight styles */
	.artist-highlight {
		position: relative;
		margin-left: -8px;
		margin-right: -8px;
		padding-left: 8px;
		padding-right: 8px;
		border-radius: 6px;
	}

	.highlight-bg {
		position: absolute;
		inset: -2px -8px;
		border-radius: 6px;
		border-width: 2px;
		border-style: solid;
		opacity: 0.15;
	}

	.highlight-bg::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 4px;
		border-width: 2px;
		border-style: solid;
		opacity: 0.8;
	}

	/* Highlight colors based on status */
	.highlight-confirmed {
		background-color: var(--color-confirmed);
		border-color: var(--color-confirmed);
	}

	.highlight-confirmed::before {
		border-color: var(--color-confirmed);
	}

	.highlight-proposed {
		background-color: var(--color-proposed);
		border-color: var(--color-proposed);
	}

	.highlight-proposed::before {
		border-color: var(--color-proposed);
	}

	.highlight-tentatif {
		background-color: var(--color-tentatif);
		border-color: var(--color-tentatif);
	}

	.highlight-tentatif::before {
		border-color: var(--color-tentatif);
	}

	.highlight-problem {
		background-color: var(--color-problem);
		border-color: var(--color-problem);
	}

	.highlight-problem::before {
		border-color: var(--color-problem);
	}

	.highlight-default {
		background-color: var(--color-gray2);
		border-color: var(--color-gray2);
	}

	.highlight-default::before {
		border-color: var(--color-gray2);
	}
</style>
