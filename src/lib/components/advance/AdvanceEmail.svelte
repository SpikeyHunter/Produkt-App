<script lang="ts">
	import type { EventAdvance, TimetableEntry } from '$lib/services/eventsService';
	import { generateAdvanceEmail } from './emails/emailGenerator';
	import { generateProductionClipboardMessage } from './emails/clipboardGenerator';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
	import AdvanceSheetTemplate from './sheet/AdvanceSheetTemplate.svelte';

	export let event: EventAdvance & { timetable?: TimetableEntry[] | null };

	let showPopup = false;
	let popupMessage = '';
	let justCopied = false;
	let isGeneratingPdf = false;
	let sheetContainer: HTMLDivElement; // This will hold a reference to our hidden template's container

	function handleGenerateAdvanceEmail() {
		if (event) {
			generateAdvanceEmail(event);
		}
	}

	async function handleCopyProductionMessage() {
		if (justCopied || !navigator.clipboard?.write || !event) return;
		const { text, html } = generateProductionClipboardMessage(event);
		try {
			const htmlBlob = new Blob([html], { type: 'text/html' });
			const textBlob = new Blob([text], { type: 'text/plain' });
			const clipboardItem = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob });
			await navigator.clipboard.write([clipboardItem]);
			justCopied = true;
			popupMessage = 'Production info copied!';
			showPopup = true;
			setTimeout(() => {
				justCopied = false;
				showPopup = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy production info:', err);
		}
	}


	async function handleGeneratePdf() {
		const sheetElement = sheetContainer?.querySelector('#sheet-to-print');
		if (!sheetElement) {
			console.error('Sheet element is not available.');
			popupMessage = 'Error: Preview template not found.';
			showPopup = true;
			setTimeout(() => (showPopup = false), 4000);
			return;
		}

		isGeneratingPdf = true;
		popupMessage = 'Generating PDF...';
		showPopup = true;

		const htmlContent = sheetElement.outerHTML;

		try {
			const response = await fetch('/api/generate-advance-pdf', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					htmlContent,
					artistName: event?.artist?.name || 'Artist',
					eventDate: event?.event_date || new Date().toISOString().split('T')[0]
				})
			});
			const result = await response.json();
			if (response.ok) {
				popupMessage = `Success! Saved to ${result.path}`;
			} else {
				popupMessage = `Error: ${result.error || 'Failed to generate PDF.'}`;
			}
		} catch (error) {
			console.error('Failed to generate PDF:', error);
			popupMessage = 'An unexpected error occurred.';
		} finally {
			isGeneratingPdf = false;
			setTimeout(() => (showPopup = false), 5000);
		}
	}
</script>

<div class="hidden" aria-hidden="true" bind:this={sheetContainer}>
	<AdvanceSheetTemplate
		artistName={event?.artist?.name || 'Artist'}
		venueName={event?.venue?.name || 'Venue'}
		eventDate={event?.event_date || 'Date'}
	/>
</div>

<PopupNotification bind:show={showPopup} message={popupMessage} variant="navbar" iconType="success" />

<div
	class="flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300 w-40 h-[420px]"
>
	<div class="flex items-center justify-between px-4 py-3 border-b border-gray1">
		<h2 class="text-xl font-normal text-gray3 truncate flex-1 mr-4">Emails & Docs</h2>
	</div>
<div class="flex-1 flex flex-col gap-3 px-4 py-2">
	<div class="flex items-center gap-3 text-sm">
		<button
			class="bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs hover:bg-lime transition-all duration-200 cursor-pointer flex items-center gap-2 w-full justify-center"
			on:click={handleGenerateAdvanceEmail}
		>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4" >
				<path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
				<path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
			</svg>
			<span>New Advance</span>
		</button>
	</div>

	<div class="flex items-center gap-3 text-sm">
		<button
			class="bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs hover:bg-lime transition-all duration-200 cursor-pointer flex items-center gap-2 w-full justify-center"
			on:click={handleCopyProductionMessage}
			disabled={justCopied}
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" >
				<path d="M12 2L2 7l10 5 10-5-10-5z" />
				<path d="M2 17l10 5 10-5" />
				<path d="M2 12l10 5 10-5" />
			</svg>
			<span>Production</span>
		</button>
	</div>

	<div class="flex items-center gap-3 text-sm">
		<button
			class="bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs hover:bg-lime transition-all duration-200 cursor-pointer flex items-center gap-2 w-full justify-center"
			on:click={handleGeneratePdf}
			disabled={isGeneratingPdf}
		>
			{#if isGeneratingPdf}
				<svg class="animate-spin h-4 w-4 text-black" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24" >
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<span>Generating...</span>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
					<path fill-rule="evenodd" d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" />
				</svg>
				<span>Download PDF</span>
			{/if}
		</button>
	</div>
</div>
</div>