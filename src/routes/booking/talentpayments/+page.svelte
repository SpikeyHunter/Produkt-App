<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventSelectorPayment from '$lib/components/booking/talentpayments/EventSelectorPayment.svelte';
	import EventInfoPayment from '$lib/components/booking/talentpayments/EventInfoPayment.svelte';
	import ArtistListCard from '$lib/components/booking/talentpayments/ArtistListCard.svelte';
	import ArtistListRow from '$lib/components/booking/talentpayments/ArtistListRow.svelte';
	import TalentPaymentActions from '$lib/components/booking/talentpayments/TalentPaymentActions.svelte';
	import EventAddModal from '$lib/components/modals/EventAddModal.svelte';
	import EventEditModal from '$lib/components/modals/EventEditModal.svelte';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/authStore';
	import {
		PRIMARY_STATUSES,
		FINAL_STATUSES,
		ALL_STATUSES,
		normalizeStatus,
		statusChipClass,
		parseLocalDate
	} from '$lib/components/booking/talentpayments/paymentStatus';

	/* ------------------------------------------------------------- state ---- */

	let events: any[] = [];
	let loadingEvents = true;
	let selectedEvent: any = null;
	let currentEventId: number | null = null;

	let masterArtistList: any[] = [];
	let liveArtists: any[] = [];
	let pastArtists: any[] = [];
	let singleEventArtists: any[] = [];
	let loadingArtists = true;
	let selectedArtist: any = null;

	let isAddModalOpen = false;
	let isEditModalOpen = false;
	let eventToEdit: any = null;

	let viewMode: 'EVENT' | 'ALL' = 'ALL';
	let timeFilter: 'ALL' | 'LIVE' | 'PAST' = 'ALL';
	let layout: 'LIST' | 'CARDS' = 'LIST'; // list is the default view
	let selectedStatus: string | null = null;

	const timeFilterOptions: ('LIVE' | 'PAST' | 'ALL')[] = ['LIVE', 'PAST', 'ALL'];
	const LAYOUT_KEY = 'tp_layout';

	let realtimeChannel: any = null;
	let urlReady = false;

	/* --------------------------------------------------------- lifecycle ---- */

	onMount(async () => {
		// Restore the last layout before the first list paints.
		try {
			const stored = localStorage.getItem(LAYOUT_KEY);
			if (stored === 'LIST' || stored === 'CARDS') layout = stored;
		} catch (e) {
			/* private mode — stay on the default */
		}

		await loadInitialData();
		subscribeToRealtime();
	});

	onDestroy(() => {
		if (realtimeChannel) supabase.removeChannel(realtimeChannel);
	});

	/* ---------------------------------------------------------- derived ----- */

	$: filteredArtists = selectedStatus
		? masterArtistList.filter((a) => normalizeStatus(a.paymentData?.status) === selectedStatus)
		: masterArtistList;

	$: {
		if (viewMode === 'EVENT') {
			singleEventArtists = selectedEvent
				? filteredArtists
						.filter((a) => a.event_id === selectedEvent.event_id)
						.sort((a, b) => a.artist_name.localeCompare(b.artist_name))
				: [];
			liveArtists = [];
			pastArtists = [];
		} else {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const ts = (a: any) => parseLocalDate(a.eventDateDisplay)?.getTime() ?? 0;

			singleEventArtists = [];
			liveArtists = filteredArtists
				.filter((a) => (parseLocalDate(a.eventDateDisplay) ?? new Date(0)) >= today)
				.sort((a, b) => ts(a) - ts(b) || a.artist_name.localeCompare(b.artist_name));
			pastArtists = filteredArtists
				.filter((a) => (parseLocalDate(a.eventDateDisplay) ?? new Date(0)) < today)
				.sort((a, b) => ts(b) - ts(a) || a.artist_name.localeCompare(b.artist_name));
		}
	}

	// Single source for both the list and card renderers, so the two views can
	// never disagree about ordering or grouping.
	$: sections =
		viewMode === 'EVENT'
			? [{ key: 'event', label: '', items: singleEventArtists, accent: true }]
			: [
					{ key: 'live', label: 'Upcoming', items: liveArtists, accent: true },
					{ key: 'past', label: 'Past Events', items: pastArtists, accent: false }
				].filter((s) => {
					if (s.items.length === 0) return false;
					if (timeFilter === 'LIVE') return s.key === 'live';
					if (timeFilter === 'PAST') return s.key === 'past';
					return true;
				});

	$: totalVisible = sections.reduce((sum, s) => sum + s.items.length, 0);
	$: showSectionLabels = viewMode === 'ALL' && timeFilter === 'ALL';

	/* ------------------------------------------------------------- data ----- */

	async function loadInitialData() {
		await fetchEvents();
		await fetchBulkData();

		const params = $page.url.searchParams;
		const urlEventId = params.get('event_id');
		const urlMode = params.get('mode');
		const urlFilter = params.get('filter');
		const urlStatus = params.get('status');
		const urlArtistName = params.get('artist_name');
		const urlView = params.get('view');

		viewMode = urlMode === 'EVENT' ? 'EVENT' : 'ALL';
		if (urlFilter && ['LIVE', 'PAST', 'ALL'].includes(urlFilter)) timeFilter = urlFilter as any;
		if (urlView === 'cards') layout = 'CARDS';
		else if (urlView === 'list') layout = 'LIST';

		if (urlStatus) {
			const normalized = normalizeStatus(urlStatus);
			if (ALL_STATUSES.includes(normalized as any)) selectedStatus = normalized;
		}

		if (urlEventId) {
			currentEventId = parseInt(urlEventId);
			const foundEvent = events.find((e) => e.event_id === currentEventId);
			if (foundEvent) await selectEventFull(foundEvent);
			else currentEventId = null;
		}

		if (urlArtistName) {
			const foundArtist = masterArtistList.find(
				(a) =>
					a.artist_name === urlArtistName &&
					(currentEventId ? a.event_id === currentEventId : true)
			);
			if (foundArtist) {
				selectedArtist = foundArtist;
				if (!currentEventId && foundArtist.event_id) {
					currentEventId = foundArtist.event_id;
					const foundEvent = events.find((e) => e.event_id === currentEventId);
					if (foundEvent) await selectEventFull(foundEvent);
				}
			}
		}

		urlReady = true;
		syncUrl();
	}

	async function fetchEvents() {
		loadingEvents = true;
		const { data, error } = await supabase
			.from('events')
			.select('event_id, event_name, event_date, event_venue, event_flyer, event_status')
			.gte('event_date', '2026-03-01')
			.order('event_date', { ascending: false });
		if (!error) events = data || [];
		loadingEvents = false;
	}

	async function selectEventFull(partialEvent: any) {
		const { data } = await supabase
			.from('events')
			.select('timetable')
			.eq('event_id', partialEvent.event_id)
			.single();
		selectedEvent = { ...partialEvent, timetable: data?.timetable || [] };
	}

	async function fetchBulkData() {
		loadingArtists = true;

		const { data: eventData, error: eventError } = await supabase
			.from('events')
			.select('event_id, event_name, event_date, event_flyer')
			.gte('event_date', '2026-03-01')
			.order('event_date', { ascending: false })
			.limit(400);

		if (eventError || !eventData) {
			masterArtistList = [];
			loadingArtists = false;
			return;
		}

		const targetEventIds = eventData.map((e) => e.event_id);
		const eventsMap = new Map(eventData.map((e) => [e.event_id, e]));

		const { data: advancesData } = await supabase
			.from('events_advance')
			.select('*')
			.eq('artist_type', 'Local')
			.in('event_id', targetEventIds);

		const { data: paymentsData } = await supabase
			.from('talent_payments')
			.select('*')
			.in('event_id', targetEventIds);

		const paymentsList = paymentsData || [];

		const paymentMap = new Map();
		paymentsList.forEach((p) =>
			paymentMap.set(`${p.advance_id}-${p.artist_name?.trim().toLowerCase()}`, p)
		);

		const paymentsToInsert: any[] = [];
		(advancesData || []).forEach((advance) => {
			const splitNames = advance.artist_name.split(/\s+B2B\s+/i);
			splitNames.forEach((name: string) => {
				const cleanName = name.trim();
				if (!paymentMap.has(`${advance.id}-${cleanName.toLowerCase()}`)) {
					paymentsToInsert.push({
						advance_id: advance.id,
						event_id: advance.event_id,
						artist_name: cleanName,
						amount: 150.0,
						currency: 'CAD',
						status: 'Draft',
						delivery_method: 'Pick Up'
					});
				}
			});
		});

		if (paymentsToInsert.length > 0) {
			const { data: newPayments } = await supabase
				.from('talent_payments')
				.insert(paymentsToInsert)
				.select();
			if (newPayments) paymentsList.push(...newPayments);
		}

		const processedList: any[] = [];
		(advancesData || []).forEach((advance) => {
			const evt = eventsMap.get(advance.event_id);
			const splitNames = advance.artist_name.split(/\s+B2B\s+/i);
			const advancePayments = paymentsList
				.filter((p) => p.advance_id === advance.id)
				.sort((a, b) => a.id - b.id);

			const createItem = (name: string, pData: any, idxStr: string) => ({
				...advance,
				ui_id: `${advance.id}-${idxStr}`,
				artist_name: name,
				paymentData: pData,
				eventNameDisplay: evt?.event_name,
				eventDateDisplay: evt?.event_date,
				event_flyer: evt?.event_flyer
			});

			if (splitNames.length === 1) {
				const name = splitNames[0].trim();
				const pData =
					advancePayments.find((p) => p.artist_name === name) || advancePayments[0] || {};
				processedList.push(createItem(name, pData, '0'));
			} else {
				splitNames.forEach((name: string, index: number) => {
					const clean = name.trim();
					const pData =
						advancePayments.find((p) => p.artist_name === clean) ||
						advancePayments[index] ||
						{};
					processedList.push(createItem(clean, pData, index.toString()));
				});
			}
		});

		masterArtistList = processedList;

		// Keep the open side panel pointed at the refreshed record.
		if (selectedArtist) {
			const refreshed = masterArtistList.find((a) => a.ui_id === selectedArtist.ui_id);
			selectedArtist = refreshed || null;
		}

		loadingArtists = false;
	}

	/* ------------------------------------------------------- realtime ------- */

	function subscribeToRealtime() {
		realtimeChannel = supabase
			.channel('talent_payments_global')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'talent_payments' },
				handleRealtimeUpdate
			)
			.subscribe();
	}

	function handleRealtimeUpdate(payload: any) {
		const { eventType, new: newRecord } = payload;
		if (eventType === 'UPDATE') {
			masterArtistList = masterArtistList.map((artist) => {
				if (artist.paymentData && artist.paymentData.id === newRecord.id) {
					const updatedArtist = { ...artist, paymentData: newRecord };
					if (selectedArtist && selectedArtist.ui_id === artist.ui_id) {
						selectedArtist = updatedArtist;
					}
					return updatedArtist;
				}
				return artist;
			});
		} else {
			fetchBulkData();
		}
	}

	/* ----------------------------------------------------- interactions ----- */

	function syncUrl() {
		if (!urlReady) return;
		const newUrl = new URL($page.url);

		if (currentEventId) newUrl.searchParams.set('event_id', currentEventId.toString());
		else newUrl.searchParams.delete('event_id');

		if (selectedArtist?.artist_name)
			newUrl.searchParams.set('artist_name', selectedArtist.artist_name);
		else newUrl.searchParams.delete('artist_name');

		newUrl.searchParams.set('mode', viewMode);
		newUrl.searchParams.set('filter', timeFilter);
		newUrl.searchParams.set('view', layout === 'CARDS' ? 'cards' : 'list');

		if (selectedStatus) newUrl.searchParams.set('status', selectedStatus);
		else newUrl.searchParams.delete('status');

		if (newUrl.toString() === $page.url.toString()) return;
		goto(newUrl.toString(), { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function handleEventSelect(e: CustomEvent) {
		const partialEvent = e.detail;
		selectedArtist = null;

		if (partialEvent) {
			currentEventId = partialEvent.event_id;
			viewMode = 'EVENT';
			await selectEventFull(partialEvent);
		} else {
			currentEventId = null;
			selectedEvent = null;
		}
		syncUrl();
	}

	async function handleArtistSelect(artist: any) {
		selectedArtist = artist;

		if (artist.event_id && (!selectedEvent || selectedEvent.event_id !== artist.event_id)) {
			const foundEvent = events.find((e) => e.event_id === artist.event_id);
			if (foundEvent) {
				currentEventId = foundEvent.event_id;
				await selectEventFull(foundEvent);
			}
		}
		syncUrl();
	}

	function setViewMode(mode: 'EVENT' | 'ALL') {
		if (viewMode === mode) return;
		viewMode = mode;
		selectedArtist = null;
		if (mode === 'ALL') {
			selectedEvent = null;
			currentEventId = null;
		}
		syncUrl();
	}

	function setTimeFilter(filter: 'ALL' | 'LIVE' | 'PAST') {
		timeFilter = filter;
		if (viewMode !== 'ALL') {
			viewMode = 'ALL';
			selectedArtist = null;
			selectedEvent = null;
			currentEventId = null;
		}
		syncUrl();
	}

	function handleSelectorFilterChange(e: CustomEvent) {
		setTimeFilter(e.detail);
	}

	function setLayout(next: 'LIST' | 'CARDS') {
		if (layout === next) return;
		layout = next;
		try {
			localStorage.setItem(LAYOUT_KEY, next);
		} catch (e) {
			/* ignore */
		}
		syncUrl();
	}

	function toggleStatus(status: string) {
		selectedStatus = selectedStatus === status ? null : status;
		syncUrl();
	}

	function clearFilters() {
		selectedStatus = null;
		syncUrl();
	}

	function openEditModal() {
		eventToEdit = {
			...selectedArtist,
			id: `${selectedArtist.event_id}-${selectedArtist.artist_name}`,
			event_venue: selectedEvent?.event_venue || ''
		};
		isEditModalOpen = true;
	}

	async function handleEditSave(e: CustomEvent) {
		isEditModalOpen = false;
		await fetchEvents();
		await fetchBulkData();

		const { event: updatedEventData } = e.detail;
		if (updatedEventData) {
			const updatedArtist = masterArtistList.find(
				(a) =>
					a.event_id === updatedEventData.event_id &&
					a.artist_name === updatedEventData.artist_name
			);
			selectedArtist = updatedArtist || null;
			syncUrl();
		}
	}

	async function handleEditDelete() {
		isEditModalOpen = false;
		selectedArtist = null;
		await fetchEvents();
		await fetchBulkData();
		syncUrl();
	}
</script>

<svelte:head>
	<title
		>{selectedArtist?.artist_name
			? `${selectedArtist.artist_name} - Invoice DJ`
			: 'Talent Payments'}</title
	>
</svelte:head>

<MainLayout pageTitle="Talent Payments">
	<div class="tp-page">
		<div class="tp-grid">
			<!-- ------------------------------------------------------ left ---- -->
			<div class="tp-col tp-col--left">
				<div class="tp-panel tp-selector bg-navbar">
					<EventSelectorPayment
						{events}
						loading={loadingEvents}
						mode={viewMode}
						{timeFilter}
						selectedEventId={currentEventId}
						on:select={handleEventSelect}
						on:filterChange={handleSelectorFilterChange}
					/>
				</div>
				<div class="tp-info">
					<EventInfoPayment event={selectedEvent} />
				</div>
			</div>

			<!-- ---------------------------------------------------- center ---- -->
			<div class="tp-col">
				<div class="tp-panel bg-navbar flex h-full flex-col">
					<!-- Toolbar -->
					<div class="flex-shrink-0 space-y-2 border-b border-gray1 bg-gray1/30 px-3 py-2.5">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<div class="flex gap-0.5 rounded-full bg-gray1 p-0.5">
									<button
										class="cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors {viewMode ===
										'ALL'
											? 'bg-white text-black'
											: 'text-gray2 hover:text-white'}"
										on:click={() => setViewMode('ALL')}
									>
										All Artists
									</button>
									<button
										class="cursor-pointer rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors {viewMode ===
										'EVENT'
											? 'bg-white text-black'
											: 'text-gray2 hover:text-white'}"
										on:click={() => setViewMode('EVENT')}
									>
										Per Event
									</button>
								</div>

								{#if viewMode === 'ALL'}
									<div class="flex gap-0.5 rounded-full bg-gray1 p-0.5">
										{#each timeFilterOptions as t}
											<button
												class="cursor-pointer rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors {timeFilter ===
												t
													? 'bg-lime text-black'
													: 'text-gray2 hover:text-white'}"
												on:click={() => setTimeFilter(t)}
											>
												{t}
											</button>
										{/each}
									</div>
								{/if}
							</div>

							<div class="flex items-center gap-2">
								<span class="text-[10px] font-bold uppercase tracking-wider text-gray2">
									{totalVisible}
									{totalVisible === 1 ? 'artist' : 'artists'}
								</span>

								<!-- List / Cards -->
								<div class="flex gap-0.5 rounded-full bg-gray1 p-0.5">
									<button
										class="flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors {layout ===
										'LIST'
											? 'bg-white text-black'
											: 'text-gray2 hover:text-white'}"
										on:click={() => setLayout('LIST')}
										title="List view"
									>
										<svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
											<path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
										</svg>
										List
									</button>
									<button
										class="flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors {layout ===
										'CARDS'
											? 'bg-white text-black'
											: 'text-gray2 hover:text-white'}"
										on:click={() => setLayout('CARDS')}
										title="Card view"
									>
										<svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" d="M4 5h6v6H4zM14 5h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z" />
										</svg>
										Cards
									</button>
								</div>

								<button
									class="cursor-pointer rounded-full bg-lime px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black transition-colors hover:bg-lime/80"
									on:click={() => (isAddModalOpen = true)}
								>
									+ Add
								</button>
							</div>
						</div>

						<!-- Status filters -->
						<div class="flex flex-wrap items-center gap-1.5">
							{#each PRIMARY_STATUSES as status}
								<button
									class={statusChipClass(status, selectedStatus === status)}
									on:click={() => toggleStatus(status)}
								>
									{status}
								</button>
							{/each}

							<span class="mx-0.5 h-4 w-px bg-white/15"></span>

							<div class="flex items-center gap-1 rounded-full border border-white/10 p-0.5">
								{#each FINAL_STATUSES as status}
									<button
										class={statusChipClass(status, selectedStatus === status)}
										on:click={() => toggleStatus(status)}
									>
										{status}
									</button>
								{/each}
							</div>

							{#if selectedStatus}
								<button
									class="cursor-pointer px-1.5 text-[10px] font-bold uppercase tracking-wider text-gray2 hover:text-problem"
									on:click={clearFilters}
								>
									Clear
								</button>
							{/if}
						</div>
					</div>

					<!-- Results -->
					<div class="flex-1 overflow-y-auto px-3 py-3">
						{#if loadingArtists}
							<div class="flex h-full items-center justify-center">
								<div class="h-7 w-7 animate-spin rounded-full border-2 border-lime border-t-transparent"></div>
							</div>
						{:else if viewMode === 'EVENT' && !selectedEvent}
							<div class="flex h-full items-center justify-center text-gray2 opacity-50">
								<p class="text-xs font-bold">Select an event to view artists</p>
							</div>
						{:else if totalVisible === 0}
							<div class="flex h-full items-center justify-center text-gray2 opacity-50">
								<p class="text-xs font-bold">No artists match these filters</p>
							</div>
						{:else if layout === 'LIST'}
							<div class="tp-list">
								{#each sections as section (section.key)}
									{#if showSectionLabels && section.label}
										<div class="tp-section-label {section.accent ? 'text-lime' : 'text-gray2'}">
											{section.label}
											<span class="tp-section-rule"></span>
										</div>
									{/if}

									<div class="tp-list-head">
										<span></span>
										<span>Artist</span>
										<span>Event</span>
										<span>Date</span>
										<span>Delivery</span>
										<span>Status</span>
										<span class="text-right">Amount</span>
									</div>

									<div class="tp-list-body">
										{#each section.items as artist (artist.ui_id)}
											<ArtistListRow
												{artist}
												selected={selectedArtist?.ui_id === artist.ui_id}
												on:click={() => handleArtistSelect(artist)}
											/>
										{/each}
									</div>
								{/each}
							</div>
						{:else}
							{#each sections as section (section.key)}
								{#if showSectionLabels && section.label}
									<div class="tp-section-label {section.accent ? 'text-lime' : 'text-gray2'}">
										{section.label}
										<span class="tp-section-rule"></span>
									</div>
								{/if}
								<div class="tp-card-grid">
									{#each section.items as artist (artist.ui_id)}
										<ArtistListCard
											{artist}
											selected={selectedArtist?.ui_id === artist.ui_id}
											showEventName={true}
											on:click={() => handleArtistSelect(artist)}
										/>
									{/each}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</div>

			<!-- ----------------------------------------------------- right ---- -->
			<div class="tp-col tp-col--right">
				<div class="tp-panel bg-navbar h-full">
					{#if selectedArtist}
						<TalentPaymentActions
							advance={selectedArtist}
							payment={selectedArtist.paymentData}
							eventDate={selectedArtist.eventDateDisplay ||
								(selectedEvent ? selectedEvent.event_date : '')}
							currentUserProfile={$authStore.profile}
							on:edit={openEditModal}
						/>
					{:else}
						<div class="flex h-full items-center justify-center p-8 text-center text-gray2 opacity-50">
							<p class="text-xs font-bold">Select an artist to view actions</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</MainLayout>

<EventAddModal
	bind:isOpen={isAddModalOpen}
	on:close={() => (isAddModalOpen = false)}
	on:success={async () => {
		isAddModalOpen = false;
		await fetchEvents();
		await fetchBulkData();
	}}
/>

<EventEditModal
	bind:isOpen={isEditModalOpen}
	event={eventToEdit}
	on:close={() => (isEditModalOpen = false)}
	on:save={handleEditSave}
	on:delete={handleEditDelete}
/>

<style>
	.tp-page {
		height: 100%;
		overflow: hidden;
		padding: 14px;
	}

	.tp-grid {
		display: grid;
		grid-template-columns: 248px minmax(0, 1fr) 316px;
		gap: 12px;
		height: 100%;
		animation: fadeIn 0.25s ease-out both;
	}

	/* Opacity-only intro: the old translateY ran while flyers were still
	   decoding, which is what made cards look scaled/offset on a cold load. */
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.tp-col {
		height: 100%;
		min-width: 0;
		overflow: hidden;
	}

	.tp-col--left {
		display: grid;
		grid-template-rows: minmax(0, 1.15fr) minmax(0, 1fr);
		gap: 12px;
	}

	.tp-info {
		min-height: 0;
		overflow: hidden;
	}

	.tp-panel {
		position: relative;
		height: 100%;
		overflow: hidden;
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 16px;
	}

	/* EventSelectorPayment positions itself absolutely inside its container. */
	.tp-selector {
		min-height: 0;
	}

	/* --------------------------------------------------------- sections --- */

	.tp-section-label {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 4px 0 8px;
		font-size: 10px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}

	.tp-section-label:not(:first-child) {
		margin-top: 18px;
	}

	.tp-section-rule {
		flex: 1;
		height: 1px;
		background: currentColor;
		opacity: 0.2;
	}

	/* ------------------------------------------------------------- list --- */

	.tp-list {
		/* Shared track definition. Custom properties inherit into ArtistListRow,
		   so the header and every row are guaranteed to line up — this is what
		   stops columns/rows from drifting as content loads. */
		--tp-cols: 30px minmax(0, 1.3fr) minmax(0, 1.5fr) 92px 74px 138px 82px;
		display: block;
	}

	.tp-list-head {
		display: grid;
		grid-template-columns: var(--tp-cols);
		align-items: center;
		gap: 10px;
		padding: 0 12px 6px;
		font-size: 9px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: rgb(255 255 255 / 0.35);
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}

	.tp-list-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-top: 4px;
	}

	/* ------------------------------------------------------------ cards --- */

	.tp-card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(186px, 1fr));
		/* Fixed row height => cards can never be sized off a flyer's intrinsic
		   dimensions, so nothing "zooms" on first paint. */
		grid-auto-rows: 168px;
		gap: 10px;
		align-content: start;
	}

	/* ------------------------------------------------------- responsive --- */

	@media (max-width: 1500px) {
		.tp-grid {
			grid-template-columns: 232px minmax(0, 1fr) 300px;
		}
		.tp-list {
			--tp-cols: 30px minmax(0, 1.3fr) minmax(0, 1.2fr) 88px 70px 132px 78px;
		}
	}

	@media (max-width: 1280px) {
		.tp-page {
			padding: 10px;
		}
		.tp-grid {
			grid-template-columns: 208px minmax(0, 1fr) 284px;
			gap: 10px;
		}
		.tp-list {
			--tp-cols: 30px minmax(0, 1.5fr) minmax(0, 0.9fr) 78px 64px 124px 72px;
		}
		.tp-card-grid {
			grid-template-columns: repeat(auto-fill, minmax(164px, 1fr));
		}
	}
</style>