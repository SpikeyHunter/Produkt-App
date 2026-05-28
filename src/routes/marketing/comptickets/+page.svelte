<script lang="ts">
	import MainLayout from '$lib/components/MainLayout.svelte';
	import CompEvent from '$lib/components/booking/comptickets/CompEvent.svelte';
	import CompList from '$lib/components/booking/comptickets/CompList.svelte';
	import CompStatus from '$lib/components/booking/comptickets/CompStatus.svelte';
	import CompDownload from '$lib/components/booking/comptickets/CompDownload.svelte';
	import { writable } from 'svelte/store';
	import type { CompTicketData, CompEntry } from '$lib/types/comptickets';
	import { supabase } from '$lib/supabase';

	const initialData: CompTicketData = {
		event_id: null,
		ga_comps: [],
		vip_comps: [],
		other_comps: [],
		comp_status: { status: 'None', other_comps_name: '' }
	};
	let compData = writable<CompTicketData>({ ...initialData });
	let selectedEventId: number | null = null;
	let isLoadingEvent = false;
	// --- Database Logic ---

	const saveData = async (data: CompTicketData | null) => {
		if (!data || !data.event_id) {
			console.log('Skipping save: no event selected');
			return;
		}

		console.log(`Preparing to save for event ${data.event_id}...`);

		const hasGaComps = data.ga_comps && data.ga_comps.length > 0;
		const hasVipComps = data.vip_comps && data.vip_comps.length > 0;
		const hasOtherComps = data.other_comps && data.other_comps.length > 0;
		const hasAnyComps = hasGaComps || hasVipComps || hasOtherComps;

		if (!hasAnyComps) {
			console.log(`No comps left for event ${data.event_id}. Deleting record.`);
			const { error } = await supabase.from('comp_tickets').delete().eq('event_id', data.event_id);
			if (error) {
				console.error('Error deleting comp record:', error);
			} else {
				console.log('Successfully deleted empty comp record.');
			}
		} else {
			console.log('Upserting comp record with data:', {
				event_id: data.event_id,
				ga_count: data.ga_comps.length,
				vip_count: data.vip_comps.length,
				other_count: data.other_comps.length
			});
			const { error } = await supabase.from('comp_tickets').upsert(
				{
					event_id: data.event_id,
					ga_comps: data.ga_comps,
					vip_comps: data.vip_comps,
					other_comps: data.other_comps,
					comp_status: data.comp_status,
					updated_at: new Date()
				},
				{ onConflict: 'event_id' }
			);
			if (error) {
				console.error('Error saving comps:', error);
			} else {
				console.log('Successfully saved comps to database.');
			}
		}
	};
	/**
	 * Store subscription with improved logging
	 */
	let saveTimeout: ReturnType<typeof setTimeout> | null = null;
	compData.subscribe((data) => {
		console.log('Store subscription triggered:', {
			has_data: !!data,
			event_id: data?.event_id,
			ga_count: data?.ga_comps?.length || 0,
			vip_count: data?.vip_comps?.length || 0,
			other_count: data?.other_comps?.length || 0
		});

		if (!data || !data.event_id) {
			console.log('Not saving: event_id is', data?.event_id);
			return;
		}
		
		console.log('Store updated, scheduling save for event:', data.event_id);
		
		// Clear existing timeout
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		
		// Schedule new save
		saveTimeout = setTimeout(() => {
			console.log('Executing save...');
			saveData(data);
		}, 350);
	});
	// --- Event Selection ---

	async function handleEventSelect(e: CustomEvent<number>) {
		const eventId = e.detail;
		console.log('handleEventSelect called with eventId:', eventId);
		console.log('Current selectedEventId:', selectedEventId);
		if (selectedEventId === eventId) {
			console.log('Event already selected, skipping');
			return;
		}

		console.log('Event selected:', eventId);
		selectedEventId = eventId;
		isLoadingEvent = true;
		const { data, error } = await supabase
			.from('comp_tickets')
			.select('*')
			.eq('event_id', eventId)
			.single();

		if (error && error.code !== 'PGRST116') { // PGRST116 = row not found, which is fine.
			console.error('Error fetching comp ticket data:', error);
		}

		const parseComps = (comps: unknown): CompEntry[] => {
			if (!comps) return [];
			if (Array.isArray(comps)) {
				// MODIFIED: Ensure new fields exist for backward compatibility
				return comps.map(c => ({
					...c,
					sent: c.sent ?? false,
					added_by: c.added_by || 'Unknown'
				}));
			}
			if (typeof comps === 'string') {
				try {
					let parsed = JSON.parse(comps);
					if (typeof parsed === 'string') parsed = JSON.parse(parsed);
					if (Array.isArray(parsed)) {
						// MODIFIED: Ensure new fields exist for backward compatibility
						return parsed.map(c => ({
							...c,
							sent: c.sent ?? false,
							added_by: c.added_by || 'Unknown'
						}));
					}
					return [];
				} catch (err) {
					console.error('Failed to parse comps JSON from DB:', err);
					return [];
				}
			}
			return [];
		};
		if (data) {
			console.log('Loaded existing comp data for event:', eventId);
			compData.set({
				event_id: data.event_id,
				ga_comps: parseComps(data.ga_comps),
				vip_comps: parseComps(data.vip_comps),
				other_comps: parseComps(data.other_comps),
				comp_status: data.comp_status || { ...initialData.comp_status }
			});
		} else {
			console.log('No existing data, creating new comp data for event:', eventId);
			compData.set({ ...initialData, event_id: eventId });
		}
		isLoadingEvent = false;
		console.log('Event selection complete. Store now has event_id:', eventId);
	}
</script>

<svelte:head>
	<title>Comp Tickets</title>
</svelte:head>

<MainLayout>
	<div class="h-full overflow-hidden bg-bg-primary">
		<div class="h-full p-6 flex gap-4 min-w-[1200px]">
			<div class="w-80 flex-shrink-0 h-full">
				<CompEvent 
					{selectedEventId}
					on:select={handleEventSelect} 
				/>
			</div>

			<div class="flex-1 h-full">
				{#if selectedEventId}
					{#if isLoadingEvent}
						<div class="h-full flex items-center justify-center bg-navbar border border-gray1 rounded-xl">
							<div class="animate-spin w-8 h-8 border-4 border-lime border-t-transparent rounded-full"></div>
						</div>
					{:else}
						<CompList data={compData} />
					{/if}
				{:else}
					<div class="h-full flex flex-col items-center justify-center bg-navbar border border-gray1 rounded-xl">
						<svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<rect x="3" y="4" width="18" height="18" rx="2" />
							<line x1="16" y1="2" x2="16" y2="6" />
							<line x1="8" y1="2" x2="8" y2="6" />
							<line x1="3" y1="10" x2="21" y2="10" />
						</svg>
						<p class="text-gray2 text-sm font-bold mb-1">Select an Event</p>
						<p class="text-gray3 text-xs">Choose an event to manage comps</p>
					</div>
				{/if}
			</div>

			<div class="w-80 flex-shrink-0 h-full flex flex-col gap-4">
				{#if selectedEventId && !isLoadingEvent}
					<CompStatus data={compData} />
					<CompDownload data={compData} />
				{:else}
					<div class="flex-1 flex flex-col items-center justify-center bg-navbar border border-gray1 rounded-xl">
						<svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
							<polyline points="7 10 12 15 17 10"></polyline>
							<line x1="12" y1="15" x2="12" y2="3"></line>
						</svg>
						<p class="text-gray2 text-sm font-bold mb-1">Actions Unavailable</p>
						<p class="text-gray3 text-xs">Select an event to access actions</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</MainLayout>