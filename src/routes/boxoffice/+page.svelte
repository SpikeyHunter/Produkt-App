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

	// Save feedback. A write that fails — or that touches no row (expired
	// session, missing report) — used to vanish into the console while the
	// grid kept showing the edits; on reload everything looked "reset".
	type SaveState = 'idle' | 'saving' | 'saved' | 'error';
	let saveState: SaveState = 'idle';
	let saveError = '';
	let saveAttempt = 0;
	let savedFlashTimer: any = null;
	let loadError = '';

	let showPdfPreview = false;
	let isDeletingPdf = false;

	// ─── RESPONSIVE SHELL ────────────────────────────────────────────────
	// Below NARROW_AT the side panels stop stealing width from the grid and
	// become overlay drawers opened from a slim always-visible rail.
	const NARROW_AT = 1180;

	let innerWidth = 1600;
	let isNarrow = false;
	let leftOpen = true;
	let rightOpen = true;

	// Auto-collapse when crossing the breakpoint, but never fight a manual toggle
	$: if (innerWidth) {
		const narrow = innerWidth < NARROW_AT;
		if (narrow !== isNarrow) {
			isNarrow = narrow;
			leftOpen = !narrow;
			rightOpen = !narrow;
		}
	}

	$: showRightPanel = !showAllEvents && selectedEvent && reportData;
	$: overlayOpen = isNarrow && (leftOpen || (rightOpen && showRightPanel));

	function closeDrawers() {
		if (isNarrow) {
			leftOpen = false;
			rightOpen = false;
		}
	}

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
		// Don't let the previous report's debounced edits ride over to this one.
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			await flushSave(selectedEvent?.event_id);
		}
		selectedEvent = event.detail;
		showAllEvents = false;
		if (selectedEvent) {
			await loadReport(selectedEvent.event_id);
		}
		// On small screens, drop the drawer once a choice is made
		closeDrawers();
	}

	async function loadReport(eventId: number) {
		loadError = '';
		const { data, error } = await supabase
			.from('box_office_reports')
			.select('*')
			.eq('event_id', eventId)
			.maybeSingle();

		// A failed read is not "no report yet" — inserting defaults over an
		// existing report (or showing an empty grid) is exactly the reset the
		// team saw. Say so and stop.
		if (error) {
			console.error('[boxoffice] load failed:', error);
			loadError = `Could not load this report (${error.message}). Check your connection and try again.`;
			reportData = null;
			return;
		}

		if (data) {
			reportData = data;
			return;
		}

		// First time this event is opened: create the blank report. If another
		// device created it a moment ago, keep theirs (ignoreDuplicates) and
		// read it back instead of failing.
		const newReport = {
			event_id: eventId,
			status: 'todo',
			online: DEFAULT_TICKETS.online,
			door: DEFAULT_TICKETS.door,
			table_tickets: DEFAULT_TICKETS.table_tickets,
			comp: DEFAULT_TICKETS.comp,
			other: DEFAULT_TICKETS.other
		};
		const { error: insErr } = await supabase
			.from('box_office_reports')
			.upsert(newReport, { onConflict: 'event_id', ignoreDuplicates: true });
		if (insErr) {
			console.error('[boxoffice] create failed:', insErr);
			loadError = `Could not create the report (${insErr.message}). You may be signed out — reload the page.`;
			reportData = null;
			return;
		}
		const { data: created, error: reErr } = await supabase
			.from('box_office_reports')
			.select('*')
			.eq('event_id', eventId)
			.single();
		if (reErr || !created) {
			loadError = 'Could not load the new report. Reload the page.';
			reportData = null;
			return;
		}
		reportData = created;

		if (selectedEvent) {
			selectedEvent.box_office_reports = [created];
			selectedEvent = { ...selectedEvent };
			const eventIndex = events.findIndex((e) => e.event_id === eventId);
			if (eventIndex > -1) {
				events[eventIndex].box_office_reports = [created];
				events = [...events];
			}
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
		saveState = 'saving';
		scheduleFlush(800);
	}

	function scheduleFlush(ms: number) {
		if (saveTimeout) clearTimeout(saveTimeout);
		// Pin the event now: switching events during the debounce must not
		// send this payload to the newly selected report.
		const eventId = selectedEvent?.event_id;
		saveTimeout = setTimeout(() => flushSave(eventId), ms);
	}

	async function flushSave(eventId: number | null | undefined) {
		saveTimeout = null;
		if (!eventId || Object.keys(pendingUpdates).length === 0) return;
		const payload = { ...pendingUpdates };

		// Writes need a live session: an expired one makes RLS quietly match
		// zero rows, which is a silent data loss. Check before, not after.
		const { data: sess } = await supabase.auth.getSession();
		if (!sess?.session) {
			saveState = 'error';
			saveError = 'You are signed out — your edits are kept on this page. Sign in again in another tab, then they will save.';
			saveAttempt++;
			saveTimeout = setTimeout(() => flushSave(eventId), 5000);
			return;
		}

		const { data, error } = await supabase
			.from('box_office_reports')
			.update(payload)
			.eq('event_id', eventId)
			.select('event_id');

		const wroteNothing = !error && (!data || data.length === 0);
		if (error || wroteNothing) {
			console.error('[boxoffice] save failed:', error?.message || 'no row was updated', payload);
			saveState = 'error';
			saveError = error
				? `Save failed: ${error.message}`
				: 'Save failed: the report row was not found (it may have been deleted). Reload the page.';
			saveAttempt++;
			// keep the payload and retry; nothing typed is thrown away
			saveTimeout = setTimeout(() => flushSave(eventId), Math.min(30000, 2000 * saveAttempt));
			return;
		}

		// Drop only what this write carried — edits made meanwhile stay queued.
		for (const key of Object.keys(payload)) {
			if (pendingUpdates[key] === payload[key]) delete pendingUpdates[key];
		}
		pendingUpdates = { ...pendingUpdates };
		saveAttempt = 0;
		saveError = '';

		if (Object.keys(pendingUpdates).length > 0) {
			scheduleFlush(300);
			return;
		}
		saveState = 'saved';
		if (savedFlashTimer) clearTimeout(savedFlashTimer);
		savedFlashTimer = setTimeout(() => {
			if (saveState === 'saved') saveState = 'idle';
		}, 2000);
	}

	function retrySaveNow() {
		if (saveTimeout) clearTimeout(saveTimeout);
		saveAttempt = 0;
		flushSave(selectedEvent?.event_id);
	}

	// Leaving with unsaved edits: send them now and warn.
	function handleBeforeUnload(e: BeforeUnloadEvent) {
		if (Object.keys(pendingUpdates).length === 0) return;
		if (saveTimeout) clearTimeout(saveTimeout);
		flushSave(selectedEvent?.event_id);
		e.preventDefault();
		e.returnValue = '';
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

<svelte:window bind:innerWidth on:beforeunload={handleBeforeUnload} />

<MainLayout>
	<div class="p-2 sm:p-3 lg:p-4 h-[calc(100vh-64px)] box-border">
		<div class="bo-shell" class:narrow={isNarrow}>
			<!-- ─── LEFT: EVENT SELECTOR ─────────────────────────────── -->
			<div class="side left" class:open={leftOpen}>
				{#if !leftOpen || isNarrow}
					<button
						type="button"
						class="rail-btn"
						aria-label="Show event selector"
						aria-expanded={leftOpen}
						on:click={() => (leftOpen = !leftOpen)}
					>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="3" y="4" width="18" height="18" rx="2" />
							<line x1="16" y1="2" x2="16" y2="6" />
							<line x1="8" y1="2" x2="8" y2="6" />
							<line x1="3" y1="10" x2="21" y2="10" />
						</svg>
						<span class="rail-label">Events</span>
					</button>
				{/if}

				{#if leftOpen}
					<div class="side-body custom-scrollbar">
						{#if !isNarrow}
							<button
								type="button"
								class="collapse-tab"
								aria-label="Hide event selector"
								on:click={() => (leftOpen = false)}
							>
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
									<polyline points="15 18 9 12 15 6" />
								</svg>
							</button>
						{/if}

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
							on:toggleAllEvents={() => {
								showAllEvents = !showAllEvents;
								closeDrawers();
							}}
						/>
					</div>
				{/if}
			</div>

			<!-- ─── CENTER: GRID / ALL EVENTS ────────────────────────── -->
			<div class="center">
				{#if showAllEvents}
					<div class="pane rounded-xl overflow-hidden shadow-lg border border-gray1/50 bg-[#1e1e1e]">
						<AllEvents {events} {dailyCounts} on:close={() => (showAllEvents = false)} />
					</div>
				{:else}
					<div class="pane rounded-xl overflow-hidden shadow-lg bg-[#1e1e1e] relative">
						{#if selectedEvent && reportData}
							<ReportGrid {reportData} on:update={handleUpdate} />

							<!-- Save state: never let a failed write look like a saved one -->
							{#if saveState === 'error'}
								<div class="absolute left-3 right-3 bottom-3 z-30 bg-problem text-white rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-3">
									<svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
										<line x1="12" y1="9" x2="12" y2="13" />
										<line x1="12" y1="17" x2="12.01" y2="17" />
									</svg>
									<div class="flex-1 min-w-0 text-sm font-bold leading-snug">
										<div>NOT SAVED — {saveError}</div>
										<div class="text-[11px] opacity-80 font-medium">Retrying automatically. Don't close this page until it says Saved.</div>
									</div>
									<button
										type="button"
										on:click={retrySaveNow}
										class="shrink-0 px-3 py-1.5 rounded-lg bg-white text-problem text-xs font-black cursor-pointer hover:bg-white/90"
									>
										Retry now
									</button>
								</div>
							{:else if saveState === 'saving'}
								<div class="absolute right-3 bottom-3 z-30 text-[11px] font-bold text-gray2 bg-black/50 rounded-full px-3 py-1">Saving…</div>
							{:else if saveState === 'saved'}
								<div class="absolute right-3 bottom-3 z-30 text-[11px] font-bold text-lime bg-black/50 rounded-full px-3 py-1">Saved</div>
							{/if}
						{:else if selectedEvent && loadError}
							<div class="h-full flex flex-col items-center justify-center text-center px-6 gap-3">
								<p class="text-problem font-bold text-sm">{loadError}</p>
								<button
									type="button"
									on:click={() => selectedEvent && loadReport(selectedEvent.event_id)}
									class="px-4 py-2 rounded-full bg-lime text-black text-xs font-black cursor-pointer"
								>
									Try again
								</button>
							</div>
						{:else}
							<div class="h-full flex items-center justify-center text-gray2 font-bold opacity-50 text-center px-6">
								Select an event to view Box Office report
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- ─── RIGHT: EXPORT / SUMMARY ──────────────────────────── -->
			{#if showRightPanel}
				<div class="side right" class:open={rightOpen}>
					{#if !rightOpen || isNarrow}
						<button
							type="button"
							class="rail-btn"
							aria-label="Show report summary"
							aria-expanded={rightOpen}
							on:click={() => (rightOpen = !rightOpen)}
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							<span class="rail-label">Report</span>
						</button>
					{/if}

					{#if rightOpen}
						<div class="side-body panel-shell rounded-xl overflow-hidden shadow-lg bg-navbar">
							{#if !isNarrow}
								<button
									type="button"
									class="collapse-tab right"
									aria-label="Hide report summary"
									on:click={() => (rightOpen = false)}
								>
									<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
										<polyline points="9 18 15 12 9 6" />
									</svg>
								</button>
							{/if}

							<ReportRightPanel
								{reportData}
								{selectedEvent}
								{isBookingUser}
								on:update={handleUpdate}
								on:openTixrImport={() => {
									showTixrModal = true;
									closeDrawers();
								}}
								on:viewPdf={() => {
									showPdfPreview = true;
									closeDrawers();
								}}
							/>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Backdrop for the overlay drawers on small screens -->
			{#if overlayOpen}
				<div
					class="drawer-backdrop"
					role="button"
					tabindex="-1"
					aria-label="Close panel"
					on:click={closeDrawers}
					on:keydown={(e) => e.key === 'Escape' && closeDrawers()}
				></div>
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
	.bo-shell {
		position: relative;
		display: flex;
		gap: 12px;
		height: 100%;
		width: 100%;
		overflow: hidden;
	}

	/* ── Center column always gets whatever is left over ───────────── */
	.center {
		flex: 1 1 auto;
		min-width: 0;
		height: 100%;
		min-height: 0;
	}
	.pane {
		height: 100%;
		min-height: 0;
	}

	/* ── Retractable side panels ───────────────────────────────────── */
	.side {
		position: relative;
		flex: 0 0 auto;
		height: 100%;
		min-height: 0;
		width: 34px;
		display: flex;
		transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.side.open {
		/* Scales with the viewport instead of a hard 280px */
		width: clamp(230px, 20vw, 300px);
	}

	.side-body {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
	}

	.panel-shell {
		backdrop-filter: blur(6px);
	}

	/* ── Slim rail (the retracted state) ───────────────────────────── */
	.rail-btn {
		width: 34px;
		flex: 0 0 34px;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 12px;
		padding-top: 14px;
		border-radius: 10px;
		border: 1px solid var(--color-gray1, #333);
		background: color-mix(in srgb, var(--color-navbar, #141414) 70%, transparent);
		color: var(--color-gray2, #777);
		cursor: pointer;
		transition:
			color 0.15s ease,
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.rail-btn:hover {
		color: var(--color-lime, #e1ff00);
		border-color: color-mix(in srgb, var(--color-lime, #e1ff00) 40%, transparent);
		background: color-mix(in srgb, var(--color-lime, #e1ff00) 6%, transparent);
	}
	.rail-label {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	/* ── Inline collapse chevron (desktop, panel open) ─────────────── */
	.collapse-tab {
		position: absolute;
		top: 6px;
		right: 6px;
		z-index: 30;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-gray1, #333) 80%, transparent);
		color: var(--color-gray2, #777);
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s ease, color 0.15s ease;
	}
	.side:hover .collapse-tab {
		opacity: 1;
	}
	.collapse-tab:hover {
		color: var(--color-lime, #e1ff00);
	}
	.collapse-tab.right {
		right: auto;
		left: 6px;
	}

	/* ── Narrow screens: panels become overlay drawers ─────────────── */
	.bo-shell.narrow .side.open {
		width: 34px;
	}
	.bo-shell.narrow .side.open .side-body {
		position: absolute;
		top: 0;
		bottom: 0;
		z-index: 60;
		width: min(320px, calc(100vw - 90px));
		border-radius: 12px;
		padding: 8px;
		background: var(--color-navbar, #141414);
		border: 1px solid var(--color-gray1, #333);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
	}
	.bo-shell.narrow .side.left.open .side-body {
		left: 38px;
	}
	.bo-shell.narrow .side.right.open .side-body {
		right: 38px;
	}

	.drawer-backdrop {
		position: absolute;
		inset: 0;
		z-index: 50;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(2px);
	}

	/* ── Scrollbars ────────────────────────────────────────────────── */
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--color-gray1, #333);
		border-radius: 3px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--color-gray2, #666);
	}

	/* Very short windows: let the whole shell scroll rather than crush rows */
	@media (max-height: 620px) {
		.side-body {
			overflow-y: auto;
		}
	}
</style>