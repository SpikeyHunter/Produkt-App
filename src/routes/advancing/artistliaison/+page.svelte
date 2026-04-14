<script lang="ts">
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventSelectorLiaison from '$lib/components/artistliaison/EventSelectorLiaison.svelte';
	import EventDetailsDisplay from '$lib/components/artistliaison/EventDetailsDisplay.svelte';
	import ExportManager from '$lib/components/artistliaison/ExportManager.svelte';

	let selectedEvent: any = null;
	let isExporting = false;
	let mounted = false;

	onMount(() => {
		setTimeout(() => (mounted = true), 150);
	});

	function handleEventSelect(event: CustomEvent) {
		selectedEvent = event.detail;
	}

	async function handleExport(event: CustomEvent) {
		const { event: eventToExport } = event.detail;

		console.log('Exporting event:', eventToExport);

		isExporting = true;

		try {
			// Find the EventDetailsDisplay container
			const elementToExport = document.querySelector('.event-details-container');

			if (!elementToExport) {
				console.error('Could not find event details container');
				alert('Error: Could not find content to export');
				return;
			}

			// Clone the element to clean it
			const clone = elementToExport.cloneNode(true) as HTMLElement;

			// IMPORTANT: Sync all form values to HTML attributes before cleaning
			const originalInputs = elementToExport.querySelectorAll('input, textarea');
			const clonedInputs = clone.querySelectorAll('input, textarea');

			originalInputs.forEach((original, index) => {
				const cloned = clonedInputs[index] as HTMLInputElement | HTMLTextAreaElement;
				if (!cloned) return;

				if (original instanceof HTMLInputElement) {
					if (original.type === 'radio' || original.type === 'checkbox') {
						// Sync checked state
						if (original.checked) {
							cloned.setAttribute('checked', 'checked');
						} else {
							cloned.removeAttribute('checked');
						}
					} else {
						// Sync value for text inputs
						cloned.setAttribute('value', original.value);
					}
				} else if (original instanceof HTMLTextAreaElement) {
					// Sync textarea content
					cloned.textContent = original.value;
				}
			});

			// Remove all Svelte-generated attributes and classes
			const allElements = clone.querySelectorAll('*');
			allElements.forEach((el) => {
				// Remove Svelte attributes
				Array.from(el.attributes).forEach((attr) => {
					if (attr.name.startsWith('s-') || attr.name.startsWith('data-')) {
						el.removeAttribute(attr.name);
					}
				});
			});

			// Get cleaned HTML
			const htmlContent = clone.outerHTML;

			console.log('HTML content length:', htmlContent.length);

			// Generate filename
			const eventDate = new Date(eventToExport.event_date);
			const day = eventDate.getDate();
			const month = eventDate.toLocaleString('en-US', { month: 'short' });
			const year = eventDate.getFullYear();
			const fileName = `Artist_Liaison_${eventToExport.event_name}_${day}-${month}-${year}`;

			// Call the API to generate PDF
			const response = await fetch('/api/generate-liaison-pdf', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					htmlContent,
					fileName
				})
			});

			if (!response.ok) {
				const errorResult = await response
					.json()
					.catch(() => ({ error: 'Failed to generate PDF.' }));
				throw new Error(errorResult.error || `Server responded with status ${response.status}`);
			}

			// Get the PDF as a blob
			const pdfBlob = await response.blob();

			// Create download link
			const pdfUrl = URL.createObjectURL(pdfBlob);
			const link = document.createElement('a');
			link.href = pdfUrl;
			link.download = `${fileName}.pdf`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(pdfUrl);

			console.log('Export completed successfully');
		} catch (error) {
			console.error('Export failed:', error);
			alert(`Error exporting PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			isExporting = false;
		}
	}
</script>

<svelte:head>
	<title>Artist Liaison - NCG</title>
</svelte:head>

<MainLayout pageTitle="Artist Liaison">
	<div class="h-full overflow-hidden p-6">
		<div class="liaison-container fade-in {mounted ? 'mounted' : ''}">
			<div class="selector-column">
				<EventSelectorLiaison on:select={handleEventSelect} />
			</div>

			<div class="details-column">
				<EventDetailsDisplay {selectedEvent} />
			</div>

			<div class="export-column">
				<ExportManager {selectedEvent} {isExporting} on:export={handleExport} />
			</div>
		</div>
	</div>
</MainLayout>

<style>
	.fade-in {
		opacity: 0;
		transform: translateY(20px);
		transition:
			opacity 0.6s ease-out,
			transform 0.6s ease-out;
	}

	.fade-in.mounted {
		opacity: 1;
		transform: translateY(0);
	}

	.liaison-container {
		display: grid;
		grid-template-columns: 320px 1fr 280px;
		gap: 16px;
		height: 100%;
	}

	.selector-column,
	.details-column,
	.export-column {
		height: 100%;
		overflow: hidden;
	}

	.selector-column {
		width: 320px;
		min-width: 320px;
		max-width: 320px;
	}

	.export-column {
		width: 280px;
		min-width: 280px;
		max-width: 280px;
	}

	.details-column {
		min-width: 0;
	}

	@media (max-width: 1400px) {
		.liaison-container {
			grid-template-columns: 280px 1fr 250px;
		}

		.selector-column {
			width: 280px;
			min-width: 280px;
			max-width: 280px;
		}

		.export-column {
			width: 250px;
			min-width: 250px;
			max-width: 250px;
		}
	}

	@media (max-width: 1200px) {
		.liaison-container {
			grid-template-columns: 260px 1fr 220px;
			gap: 12px;
		}

		.selector-column {
			width: 260px;
			min-width: 260px;
			max-width: 260px;
		}

		.export-column {
			width: 220px;
			min-width: 220px;
			max-width: 220px;
		}
	}
</style>
