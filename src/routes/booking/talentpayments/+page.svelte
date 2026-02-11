<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventSelectorPayment from '$lib/components/booking/talentpayments/EventSelectorPayment.svelte';
	import EventInfoPayment from '$lib/components/booking/talentpayments/EventInfoPayment.svelte';
	import ArtistListCard from '$lib/components/booking/talentpayments/ArtistListCard.svelte';
	import TalentPaymentActions from '$lib/components/booking/talentpayments/TalentPaymentActions.svelte';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/authStore';

	let events: any[] = [];
	let loadingEvents = true;
	let selectedEvent: any = null;
	let mounted = false;
	
	let localArtists: any[] = [];
	let loadingArtists = false;
	let selectedArtist: any = null;

    let realtimeChannel: any = null;

	onMount(async () => {
		setTimeout(() => (mounted = true), 150);
		await loadInitialData();
        subscribeToRealtime();
	});

    onDestroy(() => {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }
    });

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
        if (!selectedEvent) return;

        const { eventType, new: newRecord, old: oldRecord } = payload;

        if (eventType === 'UPDATE') {
            // OPTIMIZED: Update local state immediately without re-fetching
            localArtists = localArtists.map(artist => {
                // Check if this artist holds the payment that was just updated
                if (artist.paymentData && artist.paymentData.id === newRecord.id) {
                    // Update the payment data inside the artist object
                    const updatedArtist = { ...artist, paymentData: newRecord };
                    
                    // If this is the currently selected artist, update the selection too so Actions panel updates
                    if (selectedArtist && selectedArtist.ui_id === artist.ui_id) {
                        selectedArtist = updatedArtist;
                    }
                    return updatedArtist;
                }
                return artist;
            });
        } else {
            // INSERT or DELETE: Re-fetch to ensure B2B splits and structure are correct
            // Only re-fetch if the change relates to the current event
            const relevantId = newRecord?.event_id || oldRecord?.event_id;
            if (relevantId && relevantId === selectedEvent.event_id) {
                fetchLocalArtists(selectedEvent.event_id);
            }
        }
    }

	async function loadInitialData() {
		await fetchEvents();

		const urlEventId = $page.url.searchParams.get('event_id');
		if (urlEventId) {
			const foundEvent = events.find(e => e.event_id.toString() === urlEventId);
			if (foundEvent) {
				await handleEventSelect({ detail: foundEvent } as CustomEvent);

				const urlArtistName = $page.url.searchParams.get('artist_name');
				if (urlArtistName && localArtists.length > 0) {
					const decodedName = decodeURIComponent(urlArtistName);
					const foundArtist = localArtists.find(a => a.artist_name === decodedName);
					if (foundArtist) {
						selectedArtist = foundArtist;
					}
				}
			}
		}
	}

	async function fetchEvents() {
		loadingEvents = true;
		const { data, error } = await supabase
			.from('events')
			.select('event_id, event_name, event_date, event_venue, event_flyer, event_status')
			.order('event_date', { ascending: false });

		if (!error) events = data || [];
		loadingEvents = false;
	}

    async function selectEventFull(partialEvent: any) {
        const { data, error } = await supabase
            .from('events')
            .select('timetable')
            .eq('event_id', partialEvent.event_id)
            .single();
        
        selectedEvent = {
            ...partialEvent,
            timetable: data?.timetable || []
        };

        await fetchLocalArtists(partialEvent.event_id);
    }

	async function handleEventSelect(e: CustomEvent) {
		const partialEvent = e.detail;
		selectedArtist = null;
		
		if (partialEvent) {
			updateUrl(partialEvent.event_id, null);
            await selectEventFull(partialEvent);
		} else {
            selectedEvent = null;
			localArtists = [];
			updateUrl(null, null);
		}
	}

	function handleArtistSelect(artist: any) {
		selectedArtist = artist;
		if (selectedEvent && selectedArtist) {
			updateUrl(selectedEvent.event_id, selectedArtist.artist_name);
		}
	}

	function updateUrl(eventId: number | null, artistName: string | null) {
		const newUrl = new URL($page.url);
		
		if (eventId) {
			newUrl.searchParams.set('event_id', eventId.toString());
		} else {
			newUrl.searchParams.delete('event_id');
		}

		if (artistName) {
			newUrl.searchParams.set('artist_name', encodeURIComponent(artistName));
		} else {
			newUrl.searchParams.delete('artist_name');
		}

		goto(newUrl.toString(), { replaceState: true, keepFocus: true, noScroll: true });
	}

	// --- DATA LOGIC ---

	async function fetchLocalArtists(eventId: number) {
		loadingArtists = true;

		// 1. Fetch Advances directly from DB
		const { data, error } = await supabase
			.from('events_advance')
			.select(`*, talent_payments (*)`)
			.eq('event_id', eventId)
			.eq('artist_type', 'Local');

		if (error) {
			console.error('Error fetching artists:', error);
			localArtists = [];
			loadingArtists = false;
			return;
		}

		// 2. Ensure Payments Exist
		let paymentsToInsert: any[] = [];

		data.forEach(advance => {
			const splitNames = advance.artist_name.split(/\s+B2B\s+|\s+b2b\s+/i);
			const existingPayments = advance.talent_payments || [];
			
			// Loop through each split name (e.g. "Eviatar", "Tali Rose")
			splitNames.forEach((name: string, index: number) => {
				const cleanName = name.trim();
				
                // Check if a payment for this specific name ALREADY exists.
                // We check by matching the 'artist_name' field in talent_payments to the split name.
                // If the payment table doesn't have the name yet (old schema), we might fallback to index,
                // but the goal is to rely on the name now.
                const exists = existingPayments.some((p: any) => p.artist_name === cleanName);

                if (!exists) {
                    // Only insert if we really don't have a payment for "Tali Rose" linked to this advance
                    paymentsToInsert.push({
						advance_id: advance.id,
						event_id: eventId,
						artist_name: cleanName, 
						amount: 150.00,
						currency: 'CAD',
						status: 'Draft',
						delivery_method: 'Pick Up'
					});
                }
			});
		});

		if (paymentsToInsert.length > 0) {
			const { error: insertError } = await supabase.from('talent_payments').insert(paymentsToInsert);
			if (!insertError) {
				const { data: refreshedData } = await supabase
					.from('events_advance')
					.select(`*, talent_payments (*)`)
					.eq('event_id', eventId)
					.eq('artist_type', 'Local');
				
				if (refreshedData) {
					processArtistData(refreshedData);
					loadingArtists = false;
					return;
				}
			}
		}

		processArtistData(data);
		loadingArtists = false;
	}

	function processArtistData(data: any[]) {
		let processedList: any[] = [];

        // Deduplication: Identify standalone artist names
        const existingRealNames = new Set<string>();
        data.forEach(advance => {
            if (!advance.artist_name.match(/\s+B2B\s+|\s+b2b\s+/i)) {
                existingRealNames.add(advance.artist_name.toLowerCase().trim());
            }
        });

		data.forEach(advance => {
			const splitNames = advance.artist_name.split(/\s+B2B\s+|\s+b2b\s+/i);
			const payments = (advance.talent_payments || []).sort((a: any, b: any) => a.id - b.id);

            // Case A: Standalone
            if (splitNames.length === 1) {
                const paymentData = payments[0] || {};
                processedList.push({
                    ...advance,
                    ui_id: `${advance.id}-0`, 
                    artist_name: splitNames[0].trim(), 
                    paymentData: paymentData
                });
                return;
            }

            // Case B: B2B Split
			splitNames.forEach((name: string, index: number) => {
                const cleanName = name.trim();
                
                // If this name exists as a standalone row, skip it to avoid duplicates
                if (existingRealNames.has(cleanName.toLowerCase())) {
                    return;
                }

                // Match payment by name if possible, else index
				const paymentData = payments.find((p: any) => p.artist_name === cleanName) || payments[index] || {};
                
                processedList.push({
					...advance,
					ui_id: `${advance.id}-${index}`, 
					artist_name: cleanName, 
					paymentData: paymentData
				});
			});
		});

		localArtists = processedList;
		
		if (selectedArtist) {
			const found = localArtists.find(a => 
				(selectedArtist.ui_id && a.ui_id === selectedArtist.ui_id) || 
				a.artist_name === selectedArtist.artist_name
			);
			if (found) selectedArtist = found;
		}
	}
</script>

<svelte:head>
	<title>Talent Payments - NCG</title>
</svelte:head>

<MainLayout pageTitle="Talent Payments">
	<div class="h-full overflow-hidden p-6">
		<div class="liaison-container fade-in {mounted ? 'mounted' : ''}">
			
			<div class="selector-column flex flex-col gap-4">
				<div class="flex-1 overflow-hidden bg-navbar border border-gray1 rounded-2xl shadow-lg relative">
					 <div class="absolute inset-0">
                         <EventSelectorPayment 
                            {events} 
                            loading={loadingEvents} 
                            on:select={handleEventSelect} 
                        />
                     </div>
				</div>
                <div class="flex-1 overflow-hidden">
                    <EventInfoPayment event={selectedEvent} />
                </div>
			</div>

			<div class="details-column">
				<div class="h-full bg-navbar border border-gray1 rounded-2xl overflow-hidden shadow-lg flex flex-col">
					 <div class="flex-shrink-0 p-5 border-b border-gray1 bg-gray1/30 min-h-[80px] flex flex-col justify-center">
						{#if selectedEvent}
							<h2 class="text-xl font-bold text-white truncate">{selectedEvent.event_name}</h2>
							<p class="text-lime text-xs font-bold mt-1 uppercase tracking-wide">
								{new Date(selectedEvent.event_date).toDateString()}
							</p>
						{:else}
							<h2 class="text-xl font-bold text-gray2">Select Event</h2>
						{/if}
					</div>

					<div class="flex-1 overflow-y-auto p-4 space-y-3">
						 {#if loadingArtists}
							<div class="h-full flex items-center justify-center">
								<div class="animate-spin w-8 h-8 border-2 border-lime border-t-transparent rounded-full"></div>
							</div>
						{:else if !selectedEvent}
							<div class="h-full flex flex-col items-center justify-center text-gray2 opacity-50">
								<p class="text-sm font-bold">Select an event to view artists</p>
							</div>
						{:else if localArtists.length === 0}
							<div class="h-full flex flex-col items-center justify-center text-gray2 opacity-50">
								<p class="text-sm font-bold">No local artists found</p>
							</div>
						{:else}
							{#each localArtists as artist (artist.ui_id)}
								<ArtistListCard 
									{artist} 
									selected={selectedArtist?.ui_id === artist.ui_id}
									on:click={() => handleArtistSelect(artist)}
								/>
							{/each}
						{/if}
					</div>
				</div>
			</div>

			<div class="export-column">
				<div class="h-full bg-navbar border border-gray1 rounded-2xl overflow-hidden shadow-lg flex flex-col">
					 <div class="flex-1 flex flex-col overflow-hidden">
						{#if selectedArtist && selectedEvent}
							{#key selectedArtist.ui_id}
								<TalentPaymentActions 
									advance={selectedArtist}
									payment={selectedArtist.paymentData}
									eventDate={selectedEvent.event_date}
									currentUserProfile={$authStore.profile}
								/>
							{/key}
						{:else}
							<div class="h-full flex flex-col items-center justify-center text-gray2 opacity-50 p-10 text-center">
								<p class="text-sm font-bold">Select an artist to view actions</p>
							</div>
						{/if}
					</div>
				</div>
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