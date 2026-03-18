<script lang="ts">
	import { supabase } from '$lib/supabase';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';

	export let groupId: string | undefined | null;
	export let eventTitle: string;

	let loading = true;
	let showNotification = false;
	
	let textToCopy = '';
	let htmlToCopy = '';

	$: if (groupId) {
		prepareHolds();
	}

	async function prepareHolds() {
		loading = true;
		try {
			const { data, error } = await supabase
				.from('calendar_events')
				.select('date, hold_level')
				.eq('group_id', groupId)
				.in('status', ['HOLD', 'PENDING'])
				.order('date', { ascending: true });

			if (error) throw error;
			if (!data || data.length === 0) {
				textToCopy = '';
				htmlToCopy = '';
				return;
			}

			const groupedHolds = new Map<string, Array<{ day: number; hold: string }>>();

			data.forEach((event) => {
				const d = new Date(event.date + 'T00:00:00');
				const month = d.toLocaleDateString('en-US', { month: 'long' });
				const day = d.getDate();
				const hold = event.hold_level || 'P';

				if (!groupedHolds.has(month)) {
					groupedHolds.set(month, []);
				}
				groupedHolds.get(month)?.push({ day, hold });
			});

			let plainText = `${eventTitle}\n`;
			
			// NEW: We open a div wrapper with inline styles for the font and size
			let htmlText = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 9pt; margin: 0; padding: 0;">`;
			htmlText += `<b>${eventTitle}</b><br>`;

			let isFirstMonth = true;

			for (const [month, events] of groupedHolds.entries()) {
				if (!isFirstMonth) {
					plainText += `\n`;
					htmlText += `<br>`;
				}
				
				plainText += `${month}\n`;
				htmlText += `${month}<br>`;
				
				events.forEach((e) => {
					const formattedDay = e.day.toString().padStart(2, '0');
					plainText += `${formattedDay} - ${e.hold}\n`;
					htmlText += `${formattedDay} - ${e.hold}<br>`;
				});
				
				isFirstMonth = false;
			}

			textToCopy = plainText.trim();
			
			// Clean up trailing break tags from HTML string, then close the div
			if (htmlText.endsWith('<br>')) {
				htmlText = htmlText.slice(0, -4);
			}
			htmlToCopy = htmlText + `</div>`; // Close the styled wrapper

		} catch (err) {
			console.error('Failed to prepare holds:', err);
		} finally {
			loading = false;
		}
	}

	async function copyHolds() {
		if (!textToCopy || !htmlToCopy) return;

		try {
			const htmlBlob = new Blob([htmlToCopy], { type: 'text/html' });
			const textBlob = new Blob([textToCopy], { type: 'text/plain' });

			const item = new ClipboardItem({
				'text/html': htmlBlob,
				'text/plain': textBlob
			});

			await navigator.clipboard.write([item]);
			showNotification = true;
		} catch (err) {
			console.warn('Rich Text Clipboard API blocked, trying plain text fallback...', err);
			fallbackCopyTextToClipboard(textToCopy);
		}
	}

	function fallbackCopyTextToClipboard(text: string) {
		const textArea = document.createElement("textarea");
		textArea.value = text;
		textArea.style.top = "0";
		textArea.style.left = "0";
		textArea.style.position = "fixed";
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		try {
			document.execCommand('copy');
			showNotification = true;
		} catch (err) {
			console.error('Fallback: Oops, unable to copy', err);
		}
		document.body.removeChild(textArea);
	}
</script>

<slot {copyHolds} {loading} />

<PopupNotification
	bind:show={showNotification}
	message="Holds copied to clipboard"
	variant="navbar"
	iconType="confirmed"
	duration={3000}
/>