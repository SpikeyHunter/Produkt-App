<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventSelectorBO from '$lib/components/boxoffice/EventSelectorBO.svelte';
	import ReportGrid from '$lib/components/boxoffice/ReportGrid.svelte';
	import ReportRightPanel from '$lib/components/boxoffice/ReportRightPanel.svelte';
	import TixrImportModal from '$lib/components/boxoffice/TixrImportModal.svelte';
	import AllEvents from '$lib/components/boxoffice/AllEvents.svelte';
	import { DEFAULT_TICKETS } from '$lib/components/boxoffice/defaults';
	import PreviewModal from '$lib/components/modals/PreviewModal.svelte';

	let events: any[] = [];
	let dailyCounts: any[] = [];
	let selectedEvent: any = null;
	let reportData: any = null;
	let currentUser: any = null;
	let channel: any;
	let isBookingUser = false;
	let showTixrModal = false;
	let showAllEvents = false;

	let pendingUpdates: any = {};
	let saveTimeout: any = null;
	let editingCategories = new Set<string>();
	let editCategoryTimeouts: Record<string, any> = {};

	let showPdfPreview = false;
	let isDeletingPdf = false;

	async function handleDeletePdf() {
		if (!reportData?.pdf_url || !selectedEvent) return;
		isDeletingPdf = true;
		try {
			const urlObj = new URL(reportData.pdf_url);
			const pathSegments = urlObj.pathname.split('/');
			const filePath = `scan_reports/${pathSegments[pathSegments.length - 1]}`;

			await supabase.storage.from('documents').remove([filePath]);
			await saveReportData({ pdf_url: null });

			showPdfPreview = false;
		} catch (e) {
			console.error('Failed to delete PDF:', e);
		} finally {
			isDeletingPdf = false;
		}
	}

	onMount(async () => {
		await loadUser();
		await loadEvents();
		setupRealtime();
	});

	onDestroy(() => {
		if (channel) supabase.removeChannel(channel);
		if (saveTimeout) clearTimeout(saveTimeout);
	});

	async function loadUser() {
		const {
			data: { user }
		} = await supabase.auth.getUser();
		if (user) {
			const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
			currentUser = data;

			// FIXED: Admins override everything. Also safely check if secondary_permission is an array or string.
			isBookingUser =
				currentUser?.role === 'Admin' ||
				currentUser?.main_permission === 'Booking' ||
				(Array.isArray(currentUser?.secondary_permission) &&
					currentUser.secondary_permission.includes('Booking')) ||
				(typeof currentUser?.secondary_permission === 'string' &&
					currentUser.secondary_permission.includes('Booking'));
		}
	}

	async function loadEvents() {
		// Fetch ALL fields from the relations so AllEvents has all ticket data
		const { data, error } = await supabase
			.from('events')
			.select('*, box_office_reports(*)')
			.order('event_date', { ascending: false });
		if (error) console.error('Error loading events:', error);
		events = data || [];
		if (events.length > 0) {
			const eventIds = events.map((e) => e.event_id);
			const { data: dcData } = await supabase
				.from('daily_count')
				.select('*')
				.in('event_id', eventIds);
			dailyCounts = dcData || [];
		}
	}

	async function handleEventSelect(event: CustomEvent) {
		selectedEvent = event.detail;
		showAllEvents = false;
		if (selectedEvent) {
			await loadReport(selectedEvent.event_id);
		}
	}

	async function loadReport(eventId: number) {
		const { data, error } = await supabase
			.from('box_office_reports')
			.select('*')
			.eq('event_id', eventId)
			.maybeSingle();
		if (!data) {
			const newReport = {
				event_id: eventId,
				status: 'todo',
				online: DEFAULT_TICKETS.online,
				door: DEFAULT_TICKETS.door,
				table_tickets: DEFAULT_TICKETS.table_tickets,
				comp: DEFAULT_TICKETS.comp,
				other: DEFAULT_TICKETS.other
			};
			const { data: inserted } = await supabase
				.from('box_office_reports')
				.insert(newReport)
				.select()
				.single();
			reportData = inserted;

			if (selectedEvent) {
				selectedEvent.box_office_reports = [inserted];
				selectedEvent = { ...selectedEvent };
				const eventIndex = events.findIndex((e) => e.event_id === eventId);
				if (eventIndex > -1) {
					events[eventIndex].box_office_reports = [inserted];
					events = [...events];
				}
			}
		} else {
			reportData = data;
		}
	}

	function setupRealtime() {
		channel = supabase
			.channel('boxoffice_changes')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'box_office_reports' },
				(payload) => {
					const newRecord = payload.new as any;

					if (!selectedEvent || newRecord.event_id !== selectedEvent.event_id) {
						const eventIndex = events.findIndex((e: any) => e.event_id === newRecord.event_id);
						if (eventIndex > -1) {
							events[eventIndex].box_office_reports = [newRecord];
							events = [...events];
						}
						return;
					}

					let mergedData = { ...reportData };
					let hasChanges = false;

					Object.keys(newRecord).forEach((key) => {
						if (editingCategories.has(key)) return;

						const localStr = JSON.stringify(mergedData[key]);
						const remoteStr = JSON.stringify(newRecord[key]);

						if (localStr !== remoteStr) {
							mergedData[key] = newRecord[key];
							hasChanges = true;
						}
					});

					if (hasChanges) {
						reportData = mergedData;
						selectedEvent.box_office_reports = [mergedData];
						selectedEvent = { ...selectedEvent };

						const eventIndex = events.findIndex((e: any) => e.event_id === newRecord.event_id);
						if (eventIndex > -1) {
							events[eventIndex].box_office_reports = [mergedData];
							events = [...events];
						}
					}
				}
			)
			.subscribe();
	}

	async function saveReportData(updates: any) {
		if (!selectedEvent) return;

		if (reportData && reportData.status === 'todo' && !updates.status) {
			updates.status = 'in_progress';
		}

		Object.keys(updates).forEach((key) => {
			editingCategories.add(key);
			if (editCategoryTimeouts[key]) clearTimeout(editCategoryTimeouts[key]);
			editCategoryTimeouts[key] = setTimeout(() => {
				editingCategories.delete(key);
			}, 3000);
		});

		// FIXED REACTIVITY: Simple merge, matching exactly what worked for you before
		reportData = { ...reportData, ...updates };

		if (selectedEvent) {
			selectedEvent.box_office_reports = [reportData];
			selectedEvent = { ...selectedEvent };
		}

		const eventIndex = events.findIndex((e: any) => e.event_id === selectedEvent.event_id);
		if (eventIndex > -1) {
			events[eventIndex].box_office_reports = [reportData];
			events = [...events];
		}

		pendingUpdates = { ...pendingUpdates, ...updates };
		if (saveTimeout) clearTimeout(saveTimeout);

		saveTimeout = setTimeout(async () => {
			const payload = { ...pendingUpdates };
			pendingUpdates = {};

			const { error } = await supabase
				.from('box_office_reports')
				.update(payload)
				.eq('event_id', selectedEvent.event_id);

			if (error) console.error('Error saving report:', error);
		}, 800);
	}

	async function handleResetReport() {
		if (!selectedEvent) return;

		const resetData = {
			status: 'todo',
			online: JSON.parse(JSON.stringify(DEFAULT_TICKETS.online)),
			door: JSON.parse(JSON.stringify(DEFAULT_TICKETS.door)),
			table_tickets: JSON.parse(JSON.stringify(DEFAULT_TICKETS.table_tickets)),
			comp: JSON.parse(JSON.stringify(DEFAULT_TICKETS.comp)),
			other: JSON.parse(JSON.stringify(DEFAULT_TICKETS.other)),
			completed_by: null,
			approved_by: null,
			approved_at: null
		};
		await saveReportData(resetData);
	}

	async function handleTixrImport(importedTickets: any[]) {
		showTixrModal = false;
		if (!reportData) return;

		const newItems = importedTickets.map((item) => ({
			id: crypto.randomUUID(),
			ticket: item.ticket,
			category: item.category,
			tier: item.tier,
			price: item.price,
			sold: item.sold,
			scanned: null,
			allowPrice: true,
			allowSold: true,
			allowScanned: true,
			allowEntry: true
		}));

		const updatedOnline = [...(reportData.online || []), ...newItems];
		await saveReportData({ online: updatedOnline });
	}

	function handleApprove(e: CustomEvent) {
		saveReportData(e.detail);
	}
	function handleStatusChange(e: CustomEvent) {
		saveReportData({ status: e.detail });
	}
	function handleUpdate(e: CustomEvent) {
		saveReportData(e.detail);
	}
	function handleTixrImportDispatch(e: CustomEvent) {
		handleTixrImport(e.detail);
	}
</script>

<svelte:head>
	<title>Box Office</title>
</svelte:head>

<MainLayout>
	<div class="p-4 max-[1200px]:pr-0 h-[calc(100vh-64px)] box-border">
		<div class="liaison-container">
			<div class="left-sidebar-wrapper custom-scrollbar">
				<div class="selector-column overflow-visible flex-shrink-0">
					<EventSelectorBO
						{events}
						{selectedEvent}
						{isBookingUser}
						{currentUser}
						isViewingAllEvents={showAllEvents}
						on:select={handleEventSelect}
						on:approve={handleApprove}
						on:statusChange={handleStatusChange}
						on:resetReport={handleResetReport}
						on:toggleAllEvents={() => (showAllEvents = !showAllEvents)}
					/>
				</div>

				{#if !showAllEvents && selectedEvent && reportData}
					<div
						class="export-column rounded-xl overflow-hidden shadow-lg bg-navbar/50 backdrop-blur"
					>
						<ReportRightPanel
							{reportData}
							{selectedEvent}
							{isBookingUser}
							on:update={handleUpdate}
							on:openTixrImport={() => (showTixrModal = true)}
							on:viewPdf={() => (showPdfPreview = true)}
						/>
					</div>
				{/if}
			</div>

			{#if showAllEvents}
				<div
					class="all-events-column rounded-xl overflow-hidden shadow-lg border border-gray1/50 bg-[#1e1e1e]"
				>
					<AllEvents {events} {dailyCounts} on:close={() => (showAllEvents = false)} />
				</div>
			{:else}
				<div
					class="details-column rounded-xl overflow-y-auto shadow-lg bg-[#1e1e1e] backdrop-blur relative"
				>
					{#if selectedEvent && reportData}
						<ReportGrid {reportData} on:update={handleUpdate} />
					{:else}
						<div class="h-full flex items-center justify-center text-gray2 font-bold opacity-50">
							Select an event to view Box Office report
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</MainLayout>

{#if showPdfPreview && reportData?.pdf_url}
	<PreviewModal
		isOpen={showPdfPreview}
		fileName={`${selectedEvent?.event_date}_Scan-Report_${selectedEvent?.event_name || 'Event'}.pdf`}
		fileUrl={reportData.pdf_url}
		isDeleting={isDeletingPdf}
		showDeleteButton={true}
		showDownloadButton={true}
		on:close={() => (showPdfPreview = false)}
		on:delete={handleDeletePdf}
	/>
{/if}

{#if showTixrModal}
	<TixrImportModal
		isOpen={showTixrModal}
		eventId={selectedEvent?.event_id}
		on:close={() => (showTixrModal = false)}
		on:import={handleTixrImportDispatch}
	/>
{/if}

<style>
	.liaison-container {
		display: flex;
		gap: 16px;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	.left-sidebar-wrapper {
		display: contents;
	}

	.selector-column {
		width: 280px;
		height: 100%;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		order: 1;
	}

	.details-column,
	.all-events-column {
		flex: 1;
		min-width: 0;
		height: 100%;
		order: 2;
	}

	.export-column {
		width: 280px;
		height: 100%;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		order: 3;
	}

	@media (max-width: 1200px) {
		.left-sidebar-wrapper {
			display: flex;
			flex-direction: column;
			gap: 16px;
			width: 240px;
			height: 100%;
			overflow-y: auto;
			flex-shrink: 0;
			/* Change this to 0 or remove it completely */
			padding-right: -10px;
			order: 1;
		}
		/* ... rest of your styles ... */

		/* Apply standardized scrollbar to wrapper */
		.left-sidebar-wrapper::-webkit-scrollbar {
			width: 6px;
		}
		.left-sidebar-wrapper::-webkit-scrollbar-track {
			background: transparent;
		}
		.left-sidebar-wrapper::-webkit-scrollbar-thumb {
			background: var(--color-gray1, #333);
			border-radius: 3px;
		}
		.left-sidebar-wrapper::-webkit-scrollbar-thumb:hover {
			background: var(--color-gray2, #666);
		}

		.selector-column {
			width: 100%;
			height: auto;
			flex-shrink: 0;
			order: 1;
		}

		.export-column {
			width: 100%;
			height: auto;
			flex-shrink: 0;
			order: 2;
		}
	}
</style>
