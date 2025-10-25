<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { getAccessToken } from '$lib/stores/auth';
	import {
		type EventAdvance,
		type TimetableEntry,
		updateEventColumn
	} from '$lib/services/eventsService';
	import { generateAdvanceEmail } from './emails/emailGenerator';
	import { generateProductionClipboardMessage } from './emails/clipboardGenerator';
	import { generateMihirRider, downloadEmlFile } from './emails/mihirRiderGenerator';
	import { guestlistSettings } from '$lib/components/settings/AdvanceVariables';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
	import AdvanceSheetTemplate from './sheet/AdvanceSheetTemplate.svelte';
	import PreviewModal from '$lib/components/modals/PreviewModal.svelte';
	import AdvanceSettingsModal from '$lib/components/modals/AdvanceSettings.svelte';

	export let event: EventAdvance & { timetable?: TimetableEntry[] | null };
	const dispatch = createEventDispatcher();

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			}
		};
	}

	let showPopup = false;
	let popupMessage = '';
	let justCopied = false;
	let isGeneratingPdf = false;
	let sheetContainer: HTMLDivElement;
	let isPreviewOpen = false;
	let isSettingsModalOpen = false;
	let isDeletingPdf = false;
	let isGeneratingMihirRider = false;
	let gaCount: number = 0;
	let vipCount: number = 0;
	let updateTimeout: ReturnType<typeof setTimeout>;

	onMount(async () => {
		// @ts-ignore
		if (event.guestlist && typeof event.guestlist.ga === 'number') {
			// @ts-ignore
			gaCount = event.guestlist.ga;
			// @ts-ignore
			vipCount = event.guestlist.vip;
		} else {
			const venue = event.event_venue || '';
			const artistType = event.artist_type || '';
			const defaults = guestlistSettings[venue]?.[artistType];

			if (defaults) {
				gaCount = defaults.ga;
				vipCount = defaults.vip;
				const newGuestlist = { ga: gaCount, vip: vipCount };
				try {
					await updateEventColumn(event.id, 'guestlist', newGuestlist);
					if (event) {
						// @ts-ignore
						event.guestlist = newGuestlist;
					}
					console.log('Initial guestlist defaults saved successfully.');
				} catch (error) {
					console.error('Failed to save initial guestlist defaults:', error);
				}
			}
		}
	});

	function updateGuestlistCount(type: 'ga' | 'vip', delta: 1 | -1) {
		if (type === 'ga') {
			gaCount = Math.max(0, gaCount + delta);
		} else {
			vipCount = Math.max(0, vipCount + delta);
		}
		saveGuestlist();
	}

	function saveGuestlist() {
		clearTimeout(updateTimeout);
		updateTimeout = setTimeout(async () => {
			const newGuestlist = { ga: gaCount, vip: vipCount };
			try {
				await updateEventColumn(event.id, 'guestlist', newGuestlist);
				if (event) {
					// @ts-ignore
					event.guestlist = newGuestlist;
				}
			} catch (error) {
				console.error('Failed to save guestlist:', error);
			}
		}, 500);
	}
	
	$: fileName = generateFileName();

	function generateFileName(): string {
		if (!event?.event_date || !event?.artist_name) {
			return 'Advance Sheet';
		}
		try {
			const date = new Date(event.event_date.replace(/-/g, '/'));
			const day = date.getDate();
			const month = date.toLocaleString('en-US', { month: 'short' });
			const year = date.getFullYear();
			const venue = event.event_venue || event.venue || 'Venue';
			return `${day}-${month}-${year} - ${event.artist_name} - Advance - ${venue}`;
		} catch (error) {
			return `${event.artist_name} - Advance`;
		}
	}

	function generateMihirFileName(): string {
		if (!event?.event_date) {
			return 'HospoRider_Email';
		}
		try {
			const date = new Date(event.event_date.replace(/-/g, '/'));
			const day = date.getDate();
			const month = date.toLocaleString('en-US', { month: 'short' });
			const year = date.getFullYear();
			return `${day}-${month}-${year}_HospoRider_Email`;
		} catch (error) {
			return 'HospoRider_Email';
		}
	}

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

	async function handleGenerateMihirRider() {
		if (!event) return;

		isGeneratingMihirRider = true;
		popupMessage = 'Generating Hospo Rider...';
		showPopup = true;
		try {
			const emailBody = await generateMihirRider(event);
			const fileName = generateMihirFileName();
			downloadEmlFile(emailBody, fileName);

			popupMessage = 'Hospo Rider downloaded successfully!';
		} catch (error: any) {
			console.error('Failed to generate Hospo Rider:', error);
			popupMessage = error.message || 'Error generating Hospo Rider';
		} finally {
			isGeneratingMihirRider = false;
			setTimeout(() => (showPopup = false), 3000);
		}
	}

	async function handleGeneratePdf() {
		if (!event || !event.event_date || !event.artist_name) {
			console.error('Event data is not available for PDF generation.');
			popupMessage = 'Error: Event data missing.';
			showPopup = true;
			setTimeout(() => (showPopup = false), 4000);
			return;
		}

		const sheetElement = sheetContainer?.querySelector('#sheet-to-print');
		if (!sheetElement) {
			console.error('Sheet element not found.');
			popupMessage = 'Error: Could not generate sheet.';
			showPopup = true;
			setTimeout(() => (showPopup = false), 4000);
			return;
		}

		isGeneratingPdf = true;
		popupMessage = 'Generating PDF...';
		showPopup = true;
		const artistName = event.artist_name;
		const eventDate = new Date(event.event_date.replace(/-/g, '/')).toISOString().split('T')[0];
		const htmlContent = sheetElement.outerHTML;
		try {
			const response = await fetch('/api/generate-advance-pdf', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					htmlContent,
					artistName: artistName,
					eventDate: eventDate,
					fileName: fileName
				})
			});
			if (!response.ok) {
				const errorResult = await response
					.json()
					.catch(() => ({ error: 'Failed to generate PDF.' }));
				throw new Error(errorResult.error || `Server responded with status ${response.status}`);
			}

			const result = await response.json();
			if (result.path) {
				const storageUrl = `${env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/documents/${result.path}`;
				await updateEventColumn(event.id, 'advance_sheet_url', storageUrl);
				event.advance_sheet_url = storageUrl;
				event = { ...event };
				popupMessage = 'Success! Advance Sheet Saved.';
				dispatch('datachanged', { advance_sheet_url: storageUrl });
			} else {
				throw new Error('API did not return a file path.');
			}
		} catch (error: any) {
			console.error('Failed to generate PDF and save URL:', error);
			popupMessage = `Error: ${error.message}`;
		} finally {
			isGeneratingPdf = false;
			setTimeout(() => (showPopup = false), 5000);
		}
	}

	async function handleDeletePdf() {
		if (!event.advance_sheet_url) return;

		isDeletingPdf = true;
		popupMessage = 'Deleting advance sheet...';
		showPopup = true;

		try {
			const token = await getAccessToken();
			if (!token) {
				throw new Error('Not authenticated. Please log in and try again.');
			}

			const response = await fetch('/api/upload', {
				method: 'DELETE',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					fileUrl: event.advance_sheet_url,
					bucket: 'documents'
				})
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
				throw new Error(errorData.error || `Delete failed with status ${response.status}`);
			}

			await updateEventColumn(event.id, 'advance_sheet_url', null);
			event.advance_sheet_url = null;
			event = { ...event };
			isPreviewOpen = false;
			popupMessage = 'Advance sheet deleted successfully.';
			showPopup = true;
			dispatch('datachanged', { advance_sheet_url: null });
		} catch (error: any) {
			console.error('Failed to delete advance sheet:', error);
			popupMessage = `Error deleting file: ${error.message}`;
			showPopup = true;
		} finally {
			isDeletingPdf = false;
			setTimeout(() => (showPopup = false), 4000);
		}
	}

	function handleSettingsChange(e: CustomEvent) {
		if (event) {
			event.custom_settings = e.detail;
			event = { ...event };
		}
	}
</script>

<div class="hidden" aria-hidden="true" bind:this={sheetContainer}>
	<AdvanceSheetTemplate {event} />
</div>

<PopupNotification
	bind:show={showPopup}
	message={popupMessage}
	variant="navbar"
	iconType="success"
/>

<div
	class="flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300 w-40 h-[420px]"
>
	<div class="flex items-center justify-between px-4 py-3 border-b border-gray1">
		<h2 class="text-xl font-normal text-gray3 truncate flex-1 mr-4">Others</h2>
	</div>
	<div class="flex-1 flex flex-col gap-3 px-4 py-2">
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-6 h-6"
				>
					<path
						d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z"
					/>
					<path
						d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z"
					/>
				</svg>
			</div>
			<button
				class="bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs hover:bg-lime transition-all duration-200 cursor-pointer"
				on:click={handleGenerateAdvanceEmail}
			>
				Start Thread
			</button>
		</div>
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3">
				<svg
					class="w-6 h-6"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M12 2L2 7l10 5 10-5-10-5z" />
					<path d="M2 17l10 5 10-5" />
					<path d="M2 12l10 5 10-5" />
				</svg>
			</div>
			<button
				class="bg-gray2 text-black rounded-xl px-3.5 py-1 font-bold text-xs hover:bg-lime transition-all duration-200 cursor-pointer"
				on:click={handleCopyProductionMessage}
				disabled={justCopied}
			>
				Tech/Hospo
			</button>
		</div>
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3 flex items-center justify-center">
				{#if isGeneratingMihirRider}
					<svg
						class="animate-spin h-5 w-5 text-gray-800"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="w-6 h-6"
					>
						<path
							d="M6 3v6c0 2.97 2.16 5.43 5 5.91V19H8v2h8v-2h-3v-4.09c2.84-.48 5-2.94 5-5.91V3H6zm6 10c-1.86 0-3.41-1.28-3.86-3h7.72c-.45 1.72-2 3-3.86 3zm4-5H8V5h8v3z"
						/>
					</svg>
				{/if}
			</div>
			<button
				class="bg-gray2 text-black rounded-xl px-4 py-1 font-bold text-xs hover:bg-lime transition-all duration-200 cursor-pointer"
				on:click={handleGenerateMihirRider}
				disabled={isGeneratingMihirRider}
			>
				{#if isGeneratingMihirRider}
					Generating...
				{:else}
					Mihir Email
				{/if}
			</button>
		</div>
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3 flex items-center justify-center">
				{#if isGeneratingPdf}
					<svg
						class="animate-spin h-5 w-5 text-lime"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				{:else if event.advance_sheet_url}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="w-6 h-6"
					>
						<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
						<path
							fill-rule="evenodd"
							d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113C21.182 17.022 16.97 20.25 12.001 20.25c-4.97 0-9.185-3.223-10.675-7.69a.75.75 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z"
							clip-rule="evenodd"
						/>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="currentColor"
						class="w-6 h-6"
					>
						<path
							fill-rule="evenodd"
							d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
			</div>
			{#if event.advance_sheet_url}
				<button
					class="bg-gray2 text-black rounded-xl px-4 py-1 font-bold text-xs hover:bg-lime transition-all duration-200 cursor-pointer"
					on:click={() => (isPreviewOpen = true)}
				>
					Final Sheet
				</button>
			{:else}
				<button
					class="bg-gray2 text-black rounded-xl px-4 py-1 font-bold text-xs hover:bg-lime transition-all duration-200 cursor-pointer"
					on:click={handleGeneratePdf}
					disabled={isGeneratingPdf}
				>
					{#if isGeneratingPdf}
						Generating...
					{:else}
						Final Sheet
					{/if}
				</button>
			{/if}
		</div>
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3 flex items-center justify-center">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-6 h-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			</div>
			<button
				class="bg-gray2 text-black rounded-xl px-4 py-1 font-bold text-xs hover:bg-lime transition-all duration-200 cursor-pointer"
				on:click={() => (isSettingsModalOpen = true)}
			>
				Settings
			</button>
		</div>
	</div>
	<div class="mt-auto pt-2">
		<h3 class="text-xl font-normal text-gray3 px-4">Guestlist</h3>
		<div class="border-b border-gray1 mt-2"></div>
		<div class="px-4 pt-3 pb-5">
			<div class="flex items-center justify-between text-sm mb-2">
				<span class="text-gray3 font-semibold">GA</span>
				<div class="flex items-center gap-2">
					<button
						on:click={() => updateGuestlistCount('ga', -1)}
						class="flex items-center justify-center w-5 h-5 bg-gray2 text-black rounded-md font-bold hover:bg-lime hover:text-black transition-colors cursor-pointer leading-none"
						>−</button
					>
					<span class="font-mono w-4 text-center">{gaCount}</span>
					<button
						on:click={() => updateGuestlistCount('ga', 1)}
						class="flex items-center justify-center w-5 h-5 bg-gray2 text-black rounded-md font-bold hover:bg-lime hover:text-black transition-colors cursor-pointer leading-none"
						>+</button
					>
				</div>
			</div>
			<div class="flex items-center justify-between text-sm">
				<span class="text-gray3 font-semibold">VIP</span>
				<div class="flex items-center gap-2">
					<button
						on:click={() => updateGuestlistCount('vip', -1)}
						class="flex items-center justify-center w-5 h-5 bg-gray2 text-black rounded-md font-bold hover:bg-lime hover:text-black transition-colors cursor-pointer leading-none"
						>−</button
					>
					<span class="font-mono w-4 text-center">{vipCount}</span>
					<button
						on:click={() => updateGuestlistCount('vip', 1)}
						class="flex items-center justify-center w-5 h-5 bg-gray2 text-black rounded-md font-bold hover:bg-lime hover:text-black transition-colors cursor-pointer leading-none"
						>+</button
					>
				</div>
			</div>
		</div>
	</div>
</div>

{#if isPreviewOpen}
	<div use:portal>
		<PreviewModal
			isOpen={isPreviewOpen}
			fileUrl={event.advance_sheet_url || ''}
			{fileName}
			isDeleting={isDeletingPdf}
			on:close={() => (isPreviewOpen = false)}
			on:delete={handleDeletePdf}
		/>
	</div>
{/if}

{#if isSettingsModalOpen}
	<div use:portal>
		<AdvanceSettingsModal
			bind:isOpen={isSettingsModalOpen}
			{event}
			on:close={() => (isSettingsModalOpen = false)}
			on:change={handleSettingsChange}
		/>
	</div>
{/if}