<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase';
	import FacilityFee from './FacilityFee.svelte';
	import TicketManagement from './TicketManagement.svelte';

	export let userRole: string = 'Email Only';
	export let event: any = null;

	$: hasAccess = ['Editor', 'Admin'].includes(userRole);
	$: eventId = event?.id || event?.group_id;

	let financials: any = null;
	let tickets: any[] = [];
	let currency: string = 'CAD';

	let saveTimeout: ReturnType<typeof setTimeout>;
	let isSaving = false;
	let isInitialized = false;
	let currencyChannel: any;

	function triggerSave() {
		if (!isInitialized || !hasAccess || !eventId) return;

		clearTimeout(saveTimeout);
		// Changed from 1000 to 300 for significantly faster UI updates
		saveTimeout = setTimeout(async () => {
			isSaving = true;
			const payload = { financials, tickets };

			try {
				const targetId = event?.group_id || event?.id;
				await supabase.from('calendar').update({ event_revenue: payload }).eq('id', targetId);
			} catch (error) {
				console.error('Error saving revenue data:', error);
			} finally {
				isSaving = false;
			}
		}, 300); 
	}

	let venueFinancials: any = null; // Store venue defaults

	async function syncVenueSettings() {
		if (!eventId) return;

		try {
			let venueParsed = typeof event?.venue === 'string' ? JSON.parse(event.venue) : event?.venue;
			let category = venueParsed?.category;

			if (!category) {
				const { data: eventData } = await supabase
					.from('calendar_events')
					.select('venue')
					.or(`group_id.eq.${eventId},id.eq.${eventId}`)
					.limit(1);

				const venueRaw = eventData?.[0]?.venue;
				if (!venueRaw) return;

				venueParsed = typeof venueRaw === 'string' ? JSON.parse(venueRaw) : venueRaw;
				category = venueParsed?.category;
			}

			if (category) {
				const { data: settingData } = await supabase
					.from('calendar_settings')
					.select('setting_params')
					.eq('setting_name', category)
					.eq('setting_type', 'VENUE')
					.single();

				if (settingData?.setting_params) {
					const params =
						typeof settingData.setting_params === 'string'
							? JSON.parse(settingData.setting_params)
							: settingData.setting_params;

					// Store the full venue financials
					venueFinancials = params?.financials || null;

					if (venueFinancials?.currency) {
						currency = venueFinancials.currency;
					}
				}
			}
		} catch (error) {
			console.error('Failed to sync venue settings:', error);
		}
	}

	function resetToVenueSettings() {
		if (!venueFinancials) return;
		financials = {
			...financials,
			taxRate: venueFinancials.taxRate || 0,
			taxType: venueFinancials.taxType || 'Divisor',
			facilityFee: venueFinancials.facilityFee || 0
		};
	}

	onMount(async () => {
		if (!eventId) return;

		// 1. Fetch Venue Settings (Currency, Tax, Fees)
		await syncVenueSettings();

		// 2. Fetch the Revenue DB Data directly based on the event
		const targetId = event?.group_id || event?.id;
		const { data: dbData } = await supabase
			.from('calendar')
			.select('event_revenue')
			.eq('id', targetId)
			.single();

		if (dbData?.event_revenue) {
			tickets = dbData.event_revenue.tickets || [];
			
			// Only populate with Venue Settings if the DB has no financials configured yet
			if (!dbData.event_revenue.financials) {
				financials = venueFinancials ? {
					taxRate: venueFinancials.taxRate || 0,
					taxType: venueFinancials.taxType || 'Divisor',
					facilityFee: venueFinancials.facilityFee || 0
				} : { taxRate: 0, taxType: 'Divisor', facilityFee: 0 };
				// Save this initial state
				triggerSave(); 
			} else {
				financials = dbData.event_revenue.financials;
			}
		} else {
			tickets = [];
			// Initialize a completely new event with Venue Settings
			financials = venueFinancials ? {
				taxRate: venueFinancials.taxRate || 0,
				taxType: venueFinancials.taxType || 'Divisor',
				facilityFee: venueFinancials.facilityFee || 0
			} : { taxRate: 0, taxType: 'Divisor', facilityFee: 0 };
			triggerSave();
		}

		isInitialized = true;

		// 3. Realtime Venue Updates
		currencyChannel = supabase
			.channel('venue-currency-updates')
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calendar_settings' }, () => syncVenueSettings())
			.subscribe();
	});

	onDestroy(() => {
		if (currencyChannel) supabase.removeChannel(currencyChannel);
	});

	// Save whenever user interacts with tickets/financials
	$: if (isInitialized && (financials || tickets)) triggerSave();
</script>

{#if !hasAccess}
	<div class="flex-1 flex items-center justify-center p-6 bg-navbar">
		<p class="text-gray2 font-bold text-lg">You do not have permission to view this.</p>
	</div>
{:else}
	


	<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-8 bg-navbar">
		{#if isInitialized}
			<TicketManagement bind:tickets {financials} {currency} />
			<FacilityFee bind:financials onReset={venueFinancials ? resetToVenueSettings : null} />
		{/if}
	</div>
{/if}
