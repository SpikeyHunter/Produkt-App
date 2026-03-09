<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventSelectorPayment from '$lib/components/booking/talentpayments/EventSelectorPayment.svelte';
	import EventInfoPayment from '$lib/components/booking/talentpayments/EventInfoPayment.svelte';
	import ArtistListCard from '$lib/components/booking/talentpayments/ArtistListCard.svelte';
	import TalentPaymentActions from '$lib/components/booking/talentpayments/TalentPaymentActions.svelte';
	import EventAddModal from '$lib/components/modals/EventAddModal.svelte';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/authStore';
	import EventEditModal from '$lib/components/modals/EventEditModal.svelte';

	let events: any[] = [];
	let loadingEvents = true;
	let selectedEvent: any = null;
	let currentEventId: number | null = null;
	let masterArtistList: any[] = [];

	let liveArtists: any[] = [];
	let pastArtists: any[] = [];
	let singleEventArtists: any[] = [];
	let loadingArtists = false;
	let selectedArtist: any = null;
	let isAddModalOpen = false;

	let viewMode: 'EVENT' | 'ALL' = 'ALL';
	let timeFilter: 'ALL' | 'LIVE' | 'PAST' = 'ALL';
	const timeFilterOptions: ('LIVE' | 'PAST' | 'ALL')[] = ['LIVE', 'PAST', 'ALL'];
	const availableStatuses = ['Draft', 'Confirmed', 'Invoiced', 'Approved', 'Submitted', 'Paid'];
	let selectedStatuses: string[] = [];

	let isEditModalOpen = false;
	let eventToEdit: any = null;

	function openEditModal() {
		eventToEdit = {
			...selectedArtist,
			// Format ID specifically for how EventEditModal expects it
			id: `${selectedArtist.event_id}-${selectedArtist.artist_name}`,
			event_venue: selectedEvent?.event_venue || ''
		};
		isEditModalOpen = true;
	}

	async function handleEditSave(e: CustomEvent) {
		isEditModalOpen = false;

		// Refetch data instantly so the UI updates without a reload
		await fetchEvents();
		await fetchBulkData();

		// Re-select the updated artist to keep the panel open
		const { event: updatedEventData } = e.detail;
		if (updatedEventData) {
			const updatedArtist = masterArtistList.find(
				(a) =>
					a.event_id === updatedEventData.event_id && a.artist_name === updatedEventData.artist_name
			);

			if (updatedArtist) {
				await handleArtistSelect(updatedArtist);
			} else {
				selectedArtist = null;
			}
		}
	}

	async function handleEditDelete() {
		isEditModalOpen = false;
		selectedArtist = null; // Clear the panel since the artist is gone

		// Refetch data instantly
		await fetchEvents();
		await fetchBulkData();
	}

	function toggleStatus(status: string) {
		if (selectedStatuses.includes(status)) {
			selectedStatuses = [];
		} else {
			selectedStatuses = [status];
		}

		updateUrl(
			viewMode === 'EVENT' ? selectedEvent?.event_id : null,
			selectedArtist?.artist_name,
			viewMode,
			timeFilter,
			selectedStatuses.length > 0 ? selectedStatuses[0] : null
		);
	}

	function getStatusButtonStyle(status: string, selected: boolean) {
		let base =
			'px-3 py-1.5 text-[10px] font-bold rounded-full border transition-all uppercase tracking-wide cursor-pointer ';
		if (!selected) {
			let colors = '';
			switch (status.toLowerCase()) {
				case 'draft':
					colors = 'text-gray2 border-gray2/30 hover:border-gray2';
					break;
				case 'confirmed':
					colors = 'text-tentatif border-tentatif/30 hover:border-tentatif';
					break;
				case 'invoiced':
					colors = 'text-proposed border-proposed/30 hover:border-proposed';
					break;
				case 'approved':
					colors = 'text-question border-question/30 hover:border-question';
					break;
				case 'submitted':
					colors = 'text-info border-info/30 hover:border-info';
					break;
				case 'paid':
					colors = 'text-confirmed border-confirmed/30 hover:border-confirmed';
					break;
			}
			return base + 'bg-transparent ' + colors;
		} else {
			let colors = '';
			switch (status.toLowerCase()) {
				case 'draft':
					colors = 'bg-gray1 border-gray2 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]';
					break;
				case 'confirmed':
					colors =
						'bg-tentatif/20 border-tentatif text-tentatif shadow-[0_0_10px_rgba(59,130,246,0.2)]';
					break;
				case 'invoiced':
					colors =
						'bg-proposed/20 border-proposed text-proposed shadow-[0_0_10px_rgba(147,51,234,0.2)]';
					break;
				case 'approved':
					colors =
						'bg-question/20 border-question text-question shadow-[0_0_10px_rgba(20,184,166,0.2)]';
					break;
				case 'submitted':
					colors = 'bg-info/20 border-info text-info shadow-[0_0_10px_rgba(234,179,8,0.2)]';
					break;
				case 'paid':
					colors =
						'bg-confirmed/20 border-confirmed text-confirmed shadow-[0_0_10px_rgba(34,197,94,0.2)]';
					break;
			}
			return base + colors;
		}
	}

	let realtimeChannel: any = null;
	onMount(async () => {
		await loadInitialData();
		subscribeToRealtime();
	});

	onDestroy(() => {
		if (realtimeChannel) {
			supabase.removeChannel(realtimeChannel);
		}
	});

	$: {
		let filtered = [...masterArtistList];
		if (selectedStatuses.length > 0) {
			filtered = filtered.filter((a) => {
				const status = a.paymentData?.status || 'Draft';
				return selectedStatuses.includes(status);
			});
		}

		if (viewMode === 'EVENT') {
			if (selectedEvent) {
				singleEventArtists = filtered
					.filter((a) => a.event_id === selectedEvent.event_id)
					.sort((a, b) => a.artist_name.localeCompare(b.artist_name));
			} else {
				singleEventArtists = [];
			}
		} else {
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			liveArtists = filtered
				.filter((a) => new Date(a.eventDateDisplay) >= today)
				.sort(
					(a, b) => new Date(a.eventDateDisplay).getTime() - new Date(b.eventDateDisplay).getTime()
				);
			pastArtists = filtered
				.filter((a) => new Date(a.eventDateDisplay) < today)
				.sort(
					(a, b) => new Date(b.eventDateDisplay).getTime() - new Date(a.eventDateDisplay).getTime()
				);
		}
	}

	function subscribeToRealtime() {
		realtimeChannel = supabase
			.channel('talent_payments_global')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'talent_payments' },
				(payload) => {
					handleRealtimeUpdate(payload);
				}
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

	async function loadInitialData() {
		await fetchEvents();
		await fetchBulkData();

		const urlEventId = $page.url.searchParams.get('event_id');
		const urlMode = $page.url.searchParams.get('mode');
		const urlFilter = $page.url.searchParams.get('filter');
		const urlStatus = $page.url.searchParams.get('status');
		const urlArtistName = $page.url.searchParams.get('artist_name');

		viewMode = urlMode === 'EVENT' ? 'EVENT' : 'ALL';

		if (urlFilter && ['LIVE', 'PAST', 'ALL'].includes(urlFilter)) timeFilter = urlFilter as any;
		if (urlStatus && availableStatuses.includes(urlStatus)) selectedStatuses = [urlStatus];

		if (viewMode === 'EVENT') {
			if (urlEventId) {
				currentEventId = parseInt(urlEventId);
				const foundEvent = events.find((e) => e.event_id === currentEventId);
				if (foundEvent) {
					selectedEvent = foundEvent;
					await selectEventFull(foundEvent);

					if (urlArtistName) {
						const foundArtist = masterArtistList.find(
							(a) => a.artist_name === urlArtistName && a.event_id === currentEventId
						);
						if (foundArtist) selectedArtist = foundArtist;
					}
				}
			}
		} else {
			if (urlArtistName) {
				const parsedEventId = urlEventId ? parseInt(urlEventId) : null;
				const foundArtist = masterArtistList.find(
					(a) =>
						a.artist_name === urlArtistName && (parsedEventId ? a.event_id === parsedEventId : true)
				);
				if (foundArtist) {
					selectedArtist = foundArtist;
					if (foundArtist.event_id) {
						currentEventId = foundArtist.event_id;
						const foundEvent = events.find((e) => e.event_id === currentEventId);
						if (foundEvent) await selectEventFull(foundEvent);
					}
				}
			} else if (urlEventId) {
				currentEventId = parseInt(urlEventId);
				const foundEvent = events.find((e) => e.event_id === currentEventId);
				if (foundEvent) await selectEventFull(foundEvent);
			}
		}

		updateUrl(
			currentEventId,
			selectedArtist?.artist_name,
			viewMode,
			timeFilter,
			selectedStatuses.length > 0 ? selectedStatuses[0] : null
		);
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
		selectedEvent = {
			...partialEvent,
			timetable: data?.timetable || []
		};
	}

	async function handleEventSelect(e: CustomEvent, shouldUpdateUrl = true) {
		const partialEvent = e.detail;
		currentEventId = partialEvent ? partialEvent.event_id : null;

		selectedArtist = null;
		if (partialEvent) {
			viewMode = 'EVENT';
			await selectEventFull(partialEvent);
			if (shouldUpdateUrl)
				updateUrl(
					partialEvent.event_id,
					null,
					'EVENT',
					timeFilter,
					selectedStatuses.length > 0 ? selectedStatuses[0] : null
				);
		} else {
			selectedEvent = null;
			if (shouldUpdateUrl)
				updateUrl(
					null,
					null,
					viewMode,
					timeFilter,
					selectedStatuses.length > 0 ? selectedStatuses[0] : null
				);
		}
	}

	async function handleArtistSelect(artist: any) {
		selectedArtist = artist;
		const eId = artist.event_id || null;

		if (viewMode === 'ALL' && artist.event_id) {
			const foundEvent = events.find((e) => e.event_id === artist.event_id);
			if (foundEvent) {
				currentEventId = foundEvent.event_id;
				if (!selectedEvent || selectedEvent.event_id !== foundEvent.event_id) {
					await selectEventFull(foundEvent);
				}
			}
		}
		updateUrl(
			eId,
			selectedArtist.artist_name,
			viewMode,
			timeFilter,
			selectedStatuses.length > 0 ? selectedStatuses[0] : null
		);
	}

	function toggleViewModeButton(mode: 'EVENT' | 'ALL') {
		viewMode = mode;
		const currentStatus = selectedStatuses.length > 0 ? selectedStatuses[0] : null;

		selectedArtist = null;
		if (mode === 'ALL') {
			selectedEvent = null;
			currentEventId = null;
			updateUrl(null, null, 'ALL', timeFilter, currentStatus);
		} else {
			updateUrl(selectedEvent?.event_id, null, 'EVENT', timeFilter, currentStatus);
		}
	}

	function setTimeFilter(filter: 'ALL' | 'LIVE' | 'PAST') {
		timeFilter = filter;
		const currentStatus = selectedStatuses.length > 0 ? selectedStatuses[0] : null;

		if (viewMode !== 'ALL') toggleViewModeButton('ALL');
		else updateUrl(null, selectedArtist?.artist_name, 'ALL', filter, currentStatus);
	}

	function handleSelectorFilterChange(e: CustomEvent) {
		setTimeFilter(e.detail);
	}

	function updateUrl(
		eventId: number | null,
		artistName: string | null,
		mode: string,
		filter: string,
		status: string | null = null
	) {
		const newUrl = new URL($page.url);
		if (eventId) newUrl.searchParams.set('event_id', eventId.toString());
		else newUrl.searchParams.delete('event_id');

		if (artistName) newUrl.searchParams.set('artist_name', artistName);
		else newUrl.searchParams.delete('artist_name');

		newUrl.searchParams.set('mode', mode);
		newUrl.searchParams.set('filter', filter);

		if (status) newUrl.searchParams.set('status', status);
		else newUrl.searchParams.delete('status');

		goto(newUrl.toString(), { replaceState: true, keepFocus: true, noScroll: true });
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

		let paymentsToInsert: any[] = [];
		const paymentMap = new Map();
		paymentsList.forEach((p) =>
			paymentMap.set(`${p.advance_id}-${p.artist_name?.trim().toLowerCase()}`, p)
		);

		(advancesData || []).forEach((advance) => {
			const splitNames = advance.artist_name.split(/\s+B2B\s+|\s+b2b\s+/i);
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

		let processedList: any[] = [];
		(advancesData || []).forEach((advance) => {
			const evt = eventsMap.get(advance.event_id);
			const eventName = evt?.event_name;
			const eventDate = evt?.event_date;
			const eventFlyer = evt?.event_flyer;

			const splitNames = advance.artist_name.split(/\s+B2B\s+|\s+b2b\s+/i);
			const advancePayments = paymentsList
				.filter((p) => p.advance_id === advance.id)
				.sort((a, b) => a.id - b.id);

			const createItem = (name: string, pData: any, idxStr: string) => ({
				...advance,
				ui_id: `${advance.id}-${idxStr}`,
				artist_name: name,
				paymentData: pData,
				eventNameDisplay: eventName,
				eventDateDisplay: eventDate,
				event_flyer: eventFlyer
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
						advancePayments.find((p) => p.artist_name === clean) || advancePayments[index] || {};
					processedList.push(createItem(clean, pData, index.toString()));
				});
			}
		});

		masterArtistList = processedList;
		loadingArtists = false;
	}

	function clearFilters() {
		selectedStatuses = [];
		updateUrl(
			viewMode === 'EVENT' ? selectedEvent?.event_id : null,
			selectedArtist?.artist_name,
			viewMode,
			timeFilter,
			null
		);
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
	<div class="h-full overflow-hidden p-6 relative">
		<div class="liaison-container animate-fade-in-up">
			<div class="selector-column flex flex-col gap-4">
				<div
					class="flex-1 overflow-hidden bg-navbar border border-gray1 rounded-2xl shadow-lg relative"
				>
					<div class="absolute inset-0">
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
				</div>
				<div class="flex-1 overflow-hidden">
					<EventInfoPayment event={selectedEvent} />
				</div>
			</div>

			<div class="details-column">
				<div
					class="h-full bg-navbar border border-gray1 rounded-2xl overflow-hidden shadow-lg flex flex-col"
				>
					<div
						class="flex-shrink-0 p-4 border-b border-gray1 bg-gray1/30 min-h-[80px] flex flex-col gap-3"
					>
						<div class="flex flex-col gap-3">
							<div class="flex items-center justify-between">
								<div class="bg-gray1 p-1 rounded-full flex gap-1">
									<button
										class="px-4 py-2 text-xs font-bold rounded-full transition-all hover:cursor-pointer uppercase tracking-wide {viewMode ===
										'ALL'
											? 'bg-white text-black shadow-md'
											: 'text-gray2 hover:text-white'}"
										on:click={() => toggleViewModeButton('ALL')}
									>
										All Artists
									</button>
									<button
										class="px-4 py-2 text-xs font-bold rounded-full transition-all hover:cursor-pointer uppercase tracking-wide {viewMode ===
										'EVENT'
											? 'bg-white text-black shadow-md'
											: 'text-gray2 hover:text-white'}"
										on:click={() => toggleViewModeButton('EVENT')}
									>
										Per Event
									</button>
								</div>

								{#if viewMode === 'ALL'}
									<div class="bg-gray1 p-1 rounded-full flex gap-1">
										{#each timeFilterOptions as t}
											<button
												class="px-3 py-1.5 text-xs font-bold rounded-full hover:cursor-pointer transition-all uppercase tracking-wide {timeFilter ===
												t
													? 'bg-lime text-black shadow-md'
													: 'text-gray2 hover:text-white'}"
												on:click={() => setTimeFilter(t)}
											>
												{t}
											</button>
										{/each}
									</div>
								{/if}
							</div>

							<div class="flex items-center justify-between w-full flex-wrap gap-2">
								<div class="flex flex-wrap gap-2 items-center">
									{#each availableStatuses as status}
										<button
											class="transition-transform hover:scale-105 {getStatusButtonStyle(
												status,
												selectedStatuses.includes(status)
											)}"
											on:click={() => toggleStatus(status)}
										>
											{status}
										</button>
									{/each}

									{#if selectedStatuses.length > 0}
										<button
											class="px-2 py-1 text-[12px] hover:cursor-pointer font-bold text-gray3 hover:text-problem"
											on:click={clearFilters}
										>
											Clear
										</button>
									{/if}
								</div>

								<button
									class="bg-lime border border-lime text-black px-4 py-1.5 text-[10px] md:text-xs font-bold rounded-full hover:bg-lime/80 transition-all uppercase tracking-wide cursor-pointer flex items-center justify-center min-w-[32px]"
									on:click={() => (isAddModalOpen = true)}
								>
									<span class="hidden sm:inline">+ Add</span>
									<span class="inline sm:hidden">+</span>
								</button>
							</div>
						</div>
					</div>

					<div class="flex-1 overflow-y-auto p-4">
						{#if loadingArtists}
							<div class="h-full flex items-center justify-center">
								<div
									class="animate-spin w-8 h-8 border-2 border-lime border-t-transparent rounded-full"
								></div>
							</div>
						{:else if viewMode === 'EVENT'}
							{#if !selectedEvent}
								<div class="h-full flex flex-col items-center justify-center text-gray2 opacity-50">
									<p class="text-sm font-bold">Select an event to view artists</p>
								</div>
							{:else if singleEventArtists.length === 0}
								<div class="h-full flex flex-col items-center justify-center text-gray2 opacity-50">
									<p class="text-sm font-bold">No artists found for this event</p>
								</div>
							{:else}
								<div
									class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start auto-rows-max"
								>
									{#each singleEventArtists as artist (artist.ui_id)}
										<ArtistListCard
											{artist}
											selected={selectedArtist?.ui_id === artist.ui_id}
											showEventName={true}
											on:click={() => handleArtistSelect(artist)}
										/>
									{/each}
								</div>
							{/if}
						{:else}
							{#if (timeFilter === 'ALL' || timeFilter === 'LIVE') && liveArtists.length > 0}
								{#if timeFilter === 'ALL'}
									<div class="flex items-center gap-3 mb-4 mt-1">
										<h3 class="text-lime text-sm font-bold uppercase tracking-widest">Upcoming</h3>
										<div class="h-[1px] bg-lime/20 flex-1"></div>
									</div>
								{/if}
								<div
									class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 mb-8 items-start auto-rows-max"
								>
									{#each liveArtists as artist (artist.ui_id)}
										<ArtistListCard
											{artist}
											selected={selectedArtist?.ui_id === artist.ui_id}
											showEventName={true}
											on:click={() => handleArtistSelect(artist)}
										/>
									{/each}
								</div>
							{/if}

							{#if (timeFilter === 'ALL' || timeFilter === 'PAST') && pastArtists.length > 0}
								{#if timeFilter === 'ALL'}
									<div class="flex items-center gap-3 mb-4 mt-2">
										<h3 class="text-gray3 text-sm font-bold uppercase tracking-widest">
											Past Events
										</h3>
										<div class="h-[1px] bg-gray2/20 flex-1"></div>
									</div>
								{/if}
								<div
									class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start auto-rows-max"
								>
									{#each pastArtists as artist (artist.ui_id)}
										<div class="opacity-100 hover:opacity-100 transition-opacity">
											<ArtistListCard
												{artist}
												selected={selectedArtist?.ui_id === artist.ui_id}
												showEventName={true}
												on:click={() => handleArtistSelect(artist)}
											/>
										</div>
									{/each}
								</div>
							{/if}

							{#if liveArtists.length === 0 && pastArtists.length === 0}
								<div class="h-full flex flex-col items-center justify-center text-gray2 opacity-50">
									<p class="text-sm font-bold">No artists found matching filters</p>
								</div>
							{/if}
						{/if}
					</div>
				</div>
			</div>

			<div class="export-column">
				<div
					class="h-full bg-navbar border border-gray1 rounded-2xl overflow-hidden shadow-lg flex flex-col"
				>
					<div class="flex-1 flex flex-col overflow-hidden">
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
							<div
								class="h-full flex flex-col items-center justify-center text-gray2 opacity-50 p-10 text-center"
							>
								<p class="text-sm font-bold">Select an artist to view actions</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</MainLayout>

<EventAddModal
	bind:isOpen={isAddModalOpen}
	on:close={() => (isAddModalOpen = false)}
	on:success={() => window.location.reload()}
/>

<EventEditModal
	bind:isOpen={isEditModalOpen}
	event={eventToEdit}
	on:close={() => (isEditModalOpen = false)}
	on:save={handleEditSave}
	on:delete={handleEditDelete}
/>

<style>
	.animate-fade-in-up {
		animation: fadeInUp 0.4s ease-out forwards;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(15px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.liaison-container {
		display: grid;
		grid-template-columns: 320px 1fr 380px;
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
		width: 380px;
		min-width: 380px;
		max-width: 380px;
	}

	.details-column {
		min-width: 0;
	}

	@media (max-width: 1400px) {
		.liaison-container {
			grid-template-columns: 280px 1fr 340px;
		}
		.selector-column {
			width: 280px;
			min-width: 280px;
			max-width: 280px;
		}
		.export-column {
			width: 340px;
			min-width: 340px;
			max-width: 340px;
		}
	}

	@media (max-width: 1200px) {
		.liaison-container {
			grid-template-columns: 260px 1fr 300px;
			gap: 12px;
		}
		.selector-column {
			width: 260px;
			min-width: 260px;
			max-width: 260px;
		}
		.export-column {
			width: 300px;
			min-width: 300px;
			max-width: 300px;
		}
	}
</style>
