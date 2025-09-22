<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { EventWithTimetable, TimetableEntry } from '$lib/services/eventsService';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';

	export let event: EventWithTimetable;

	// --- Component State ---
	const dispatch = createEventDispatcher();
	let justCopied = false;
	let showPopup = false;
	let popupMessage = '';

	// --- Reactive Logic ---

	// Find the shared status of all artist entries.
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

	// Generate plain text for clipboard
	$: clipboardText = (() => {
		if (!event.timetable || event.timetable.length === 0) return '';
		const headers = ['Timetable', 'Length', 'Artist'];
		const rows = event.timetable.map((entry) => [
			formatTimeWithSeconds(entry.time || ''),
			formatLengthWithMinutes(entry.length || ''),
			entry.artist || ''
		]);
		const colWidths = headers.map((header, i) =>
			Math.max(...[header, ...rows.map((row) => row[i])].map((str) => str.length))
		);
		const padString = (str: string, width: number) => str.padEnd(width, ' ');
		const formattedHeader = headers.map((h, i) => padString(h, colWidths[i])).join('\t');
		const formattedRows = rows
			.map((row) => row.map((cell, i) => padString(cell, colWidths[i])).join('\t'))
			.join('\n');
		return [formattedHeader, ...formattedRows].join('\n');
	})();

	// Generate HTML for clipboard
	$: clipboardHtml = (() => {
		if (!event.timetable || event.timetable.length === 0) return '';

		const getStatusColors = (status: string) => {
			switch (status) {
				case 'Confirmed': return { bg: '#d9ead3', text: '#274e13' };
				case 'Proposed': return { bg: '#fce5cd', text: '#783f04' };
				case 'Tentative': return { bg: '#fff2cc', text: '#7f6000' };
				case 'Problem': return { bg: '#f4cccc', text: '#660000' };
				default: return { bg: '#ffffff', text: '#000000' };
			}
		};

		let html = `<table style="border-collapse: collapse; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; border: 0.5px solid #d1d5db;">`;
		html += `<thead><tr style="background-color: #ffffff;">`;
		html += `<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 75px;">Timetable</th>`;
		html += `<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 40px;">Length</th>`;
		html += `<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 225px;">Artist</th>`;
		html += `</tr></thead><tbody>`;

		event.timetable.forEach((entry) => {
			const isSpecialEntry = entry.artist === 'DOORS' || entry.artist === 'CURFEW';
			const colors = isSpecialEntry ? { bg: '#ffffff', text: '#000000' } : getStatusColors(entry.status);
			html += `<tr style="background-color: ${colors.bg};">`;
			html += `<td style="background-color: #ffffff; border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: center;">${formatTimeWithSeconds(entry.time || '')}</td>`;
			html += `<td style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: center; ">${formatLengthWithMinutes(entry.length || '')}</td>`;
			html += `<td style="border: 0.5px solid #d1d5db; padding: 2px 6px; color: ${colors.text}; font-weight: ${isSpecialEntry ? '400' : '600'}; font-style: ${isSpecialEntry ? 'italic' : 'normal'};">${entry.artist || ''}</td>`;
			html += `</tr>`;
		});
		html += `</tbody></table>`;
		return html;
	})();

	// --- Functions ---

	// Handles the copy action and UI feedback
	async function handleCopyClick(e: MouseEvent) {
		e.stopPropagation();
		if (justCopied || !navigator.clipboard?.write) return;

		try {
			const htmlBlob = new Blob([clipboardHtml], { type: 'text/html' });
			const textBlob = new Blob([clipboardText], { type: 'text/plain' });
			const clipboardItem = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob });
			
			await navigator.clipboard.write([clipboardItem]);

			justCopied = true;
			popupMessage = 'Set Times copied to clipboard';
			showPopup = true;

			setTimeout(() => {
				justCopied = false;
			}, 2000);

		} catch (err) {
			console.error('Failed to copy text: ', err);
		}
	}

	function formatTimeWithSeconds(timeStr: string): string {
		if (!timeStr) return '';
		const periodIndex = timeStr.search(/am|pm/i);
		if (periodIndex === -1) return timeStr;
		const timePart = timeStr.substring(0, periodIndex);
		const periodPart = timeStr.substring(periodIndex);
		return `${timePart}:00 ${periodPart}`;
	}

	function formatLengthWithMinutes(lengthStr: string): string {
		if (!lengthStr) return '';
		const cleanedStr = lengthStr.replace(/\s+/g, '').replace('min', '');
		let totalMinutes = 0;
		if (cleanedStr.includes('h')) {
			const parts = cleanedStr.split('h');
			const hours = parseInt(parts[0]) || 0;
			const minutes = parseInt(parts[1]) || 0;
			totalMinutes = hours * 60 + minutes;
		} else {
			totalMinutes = parseInt(cleanedStr) || 0;
		}
		return `${totalMinutes} min`;
	}

	function formatDisplayDate(dateString: string): string {
		if (!dateString) return 'TBD';
		try {
			const date = new Date(dateString);
			date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
			return date.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric'
			});
		} catch (e) {
			console.error('Error formatting date:', e);
			return 'Invalid Date';
		}
	}

	function handleAddClick() {
		dispatch('add', { event });
	}

	function handleHideClick() {
		dispatch('hide', { eventId: event.event_id });
	}

	function handleShowClick() {
		dispatch('show', { eventId: event.event_id });
	}

	// Corrected function to avoid type error
	function getStatusColorClass(entry: TimetableEntry): string {
		let statusToRender = entry.status;
		const isSpecialEntry = entry.artist === 'DOORS' || entry.artist === 'CURFEW';

		if (isSpecialEntry) {
			if (sharedArtistStatus) {
				statusToRender = sharedArtistStatus;
			} else {
				// If statuses are mixed or no artists, return the default color directly
				return 'bg-[var(--color-gray2)]';
			}
		}

		switch (statusToRender) {
			case 'Confirmed': return 'bg-[var(--color-confirmed)]';
			case 'Proposed': return 'bg-[var(--color-proposed)]';
			case 'Tentative': return 'bg-[var(--color-tentatif)]';
			case 'Problem': return 'bg-[var(--color-problem)]';
			default: return 'bg-[var(--color-gray2)]';
		}
	}

	// Corrected function to avoid type error
	function getStatusTextColorClass(entry: TimetableEntry): string {
		let statusToRender = entry.status;
		const isSpecialEntry = entry.artist === 'DOORS' || entry.artist === 'CURFEW';

		if (isSpecialEntry) {
			if (sharedArtistStatus) {
				statusToRender = sharedArtistStatus;
			} else {
				// If statuses are mixed or no artists, return the default color directly
				return 'text-[var(--color-gray2)]';
			}
		}

		switch (statusToRender) {
			case 'Confirmed': return 'text-[var(--color-confirmed)]';
			case 'Proposed': return 'text-[var(--color-proposed)]';
			case 'Tentative': return 'text-[var(--color-tentatif)]';
			case 'Problem': return 'text-[var(--color-problem)]';
			default: return 'text-[var(--color-gray2)]';
		}
	}

	const limeGradients = [
		'from-lime/80 to-lime/40', 'from-lime/70 to-lime/30',
		'from-lime/90 to-lime/50', 'from-lime/60 to-lime/20'
	];
	const randomGradient = limeGradients[Math.floor(Math.random() * limeGradients.length)];
</script>

<PopupNotification bind:show={showPopup} message={popupMessage} variant="navbar" iconType="success" />

<div class="bg-navbar rounded-2xl p-4 transition-all duration-200 group h-60 w-full">
	<div class="flex gap-4 h-full">
		<div class="w-2/5 flex flex-col flex-shrink-0">
			<div
				class="w-full h-44 rounded-xl {event.event_flyer
					? 'bg-gray-900'
					: `bg-gradient-to-br ${randomGradient}`} flex items-center justify-center relative overflow-hidden flex-shrink-0"
			>
				{#if event.event_flyer}
					<img src={event.event_flyer} alt={event.event_name} class="w-full h-full object-cover rounded-xl" />
				{:else}
					<div class="text-white text-center">
						<div class="w-6 h-6 mx-auto mb-1 opacity-40">
							<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
						</div>
						<div class="text-xs opacity-60 font-bold">Poster</div>
					</div>
				{/if}
			</div>

			<div class="bg-gray3 text-black px-2 py-1 rounded-lg text-center font-bold text-xs mt-3 flex-shrink-0">
				{formatDisplayDate(event.event_date)}
			</div>
		</div>

		<div class="w-3/5 flex flex-col min-w-0 overflow-hidden h-full">
			<div class="flex items-center justify-between mb-2">
				<div class="flex-1 min-w-0 pr-2">
					<h3 class="text-white text-sm font-bold leading-tight truncate-2-lines">
						{event.event_name}
					</h3>
				</div>

				{#if event.timetable && event.timetable.length > 0}
					<div class="flex items-center">
						<button
							on:click={handleCopyClick}
							class="p-2 text-gray2 hover:text-black rounded-lg transition-all duration-200 cursor-pointer flex-shrink-0"
							class:hover:bg-lime={!justCopied}
							class:bg-lime={justCopied}
							class:text-black={justCopied}
							aria-label="Copy set times"
							title={justCopied ? 'Copied!' : 'Copy timetable'}
						>
							{#if justCopied}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
							{/if}
						</button>
						<button
							on:click|stopPropagation={handleAddClick}
							class="p-2 text-gray2 hover:text-black hover:bg-lime rounded-lg transition-all duration-200 cursor-pointer flex-shrink-0"
							aria-label="Edit set times"
							title="Edit set times"
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
								<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
							</svg>
						</button>
					</div>
				{:else}
					<button
						on:click|stopPropagation={event.timetable_active === false ? handleShowClick : handleHideClick}
						class="p-2 text-gray2 hover:text-black hover:bg-lime rounded-lg transition-all duration-200 cursor-pointer flex-shrink-0"
						aria-label={event.timetable_active === false ? 'Show event in timetable' : 'Hide event from timetable'}
						title={event.timetable_active === false ? 'Show in timetable' : 'Hide from timetable'}
					>
						{#if event.timetable_active === false}
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
								<circle cx="12" cy="12" r="3" />
							</svg>
						{:else}
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
								<line x1="1" y1="1" x2="23" y2="23" />
							</svg>
						{/if}
					</button>
				{/if}
			</div>

			<div class="flex-1 flex flex-col justify-center min-h-0">
				{#if event.timetable && event.timetable.length > 0}
					<ul class="space-y-1.5">
						{#each event.timetable as entry (entry.id)}
							<li class="flex items-center text-sm gap-2">
								<span class="block w-1.5 h-4 rounded-full {getStatusColorClass(entry)}" title="Status: {entry.status}"></span>
								<span class="w-16 font-bold flex-shrink-0 {getStatusTextColorClass(entry)}">{entry.time}</span>
								<span class="{getStatusTextColorClass(entry)} truncate">{entry.artist}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<button
						on:click={handleAddClick}
						class="w-full h-full flex flex-col items-center justify-center bg-gray1 rounded-lg text-gray2 hover:cursor-pointer hover:bg-opacity-75 hover:text-white transition-all duration-200 border-2 border-dashed border-gray-600 hover:border-lime"
						aria-label="Add set times for {event.event_name}"
					>
						<svg class="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
						</svg>
						<span class="font-bold text-sm">Add Set Times</span>
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>

<style lang="postcss">
	@tailwind base;
	@tailwind components;
	@tailwind utilities;

	.truncate-2-lines {
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}
</style>