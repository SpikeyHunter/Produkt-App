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
		const { event: exportEvent, format, options } = event.detail;
		
		isExporting = true;
		
		try {
			// TODO: Implement actual export logic here
			console.log('Exporting event:', exportEvent);
			console.log('Format:', format);
			console.log('Options:', options);
			
			// Simulate export process
			await new Promise(resolve => setTimeout(resolve, 2000));
			
			// Show success message (you can use a toast notification here)
			alert(`Successfully exported ${exportEvent.event_name} as ${format.toUpperCase()}`);
			
		} catch (error) {
			console.error('Export failed:', error);
			alert('Export failed. Please try again.');
		} finally {
			isExporting = false;
		}
	}
</script>

<svelte:head>
	<title>Artist Liaison - NCG</title>
</svelte:head>

<MainLayout pageTitle="Artist Liaison" requiredPermission="ArtistLiaison">
	<div class="h-full overflow-hidden p-6">
		<div class="liaison-container fade-in {mounted ? 'mounted' : ''}">
			<div class="selector-column">
				<EventSelectorLiaison on:select={handleEventSelect} />
			</div>

			<div class="details-column">
				<EventDetailsDisplay {selectedEvent} />
			</div>

			<div class="export-column">
				<ExportManager 
					{selectedEvent} 
					{isExporting}
					on:export={handleExport}
				/>
			</div>
		</div>
	</div>
</MainLayout>

<style>
	.fade-in {
		opacity: 0;
		transform: translateY(20px);
		transition: opacity 0.6s ease-out, transform 0.6s ease-out;
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
		min-width: 0; /* Allows flex item to shrink below content size */
	}

	/* Responsive adjustments for smaller screens */
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