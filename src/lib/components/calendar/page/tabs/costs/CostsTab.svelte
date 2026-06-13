<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase';
	import FixedCosts from './FixedCosts.svelte';
	import VariableCosts from './VariableCosts.svelte';
	import { slide } from 'svelte/transition';

	export let userRole: string = 'Email Only';
	export let event: any = null;

	export let viewedVersionNum: number = 1;

	$: hasAccess = ['Editor', 'Admin'].includes(userRole);
	$: eventId = event?.id || event?.group_id;

	// View Only Mode evaluates to true ONLY if viewing an alternate version
	$: currentVersionNum = event?.calendar?.current_version || 1;
	$: isAlternateVersion = viewedVersionNum > 0 && viewedVersionNum !== currentVersionNum;
	$: isViewOnly = isAlternateVersion;

	let eventCosts: { fixedCosts: any[]; variableCosts: any[] } = {
		fixedCosts: [],
		variableCosts: []
	};
	let eventRevenue: any = {};
	let currency: string = 'CAD';
	let saveTimeout: ReturnType<typeof setTimeout>;
	let isSaving = false;
	let isInitialized = false;
	let currencyChannel: any;

	let fixedExpanded = true;
	let variableExpanded = false;

	export function triggerSave() {
		if (isViewOnly) return;
		if (!isInitialized || !hasAccess || !eventId) return;

		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(async () => {
			isSaving = true;
			try {
				const targetId = event?.group_id || event?.id;
				await supabase
					.from('calendar_data')
					.update({ event_cost: eventCosts })
					.eq('calendar_id', targetId)
					.eq('version_number', viewedVersionNum);
			} catch (error) {
				console.error('Error saving cost data:', error);
			} finally {
				isSaving = false;
			}
		}, 300);
	}

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

					if (params?.financials?.currency) {
						currency = params.financials.currency;
					}
				}
			}
		} catch (error) {
			console.error('Failed to sync venue settings:', error);
		}
	}

	async function loadCosts() {
		if (!eventId) return;

		const targetId = event?.group_id || event?.id;

		const { data: dbData } = await supabase
			.from('calendar_data')
			.select('event_cost, event_revenue')
			.eq('calendar_id', targetId)
			.eq('version_number', viewedVersionNum)
			.single();

		if (dbData?.event_cost) {
			eventCosts = {
				fixedCosts: dbData.event_cost.fixedCosts || [],
				variableCosts: dbData.event_cost.variableCosts || []
			};
		} else {
			eventCosts = { fixedCosts: [], variableCosts: [] };
			if (!isViewOnly) triggerSave();
		}

		if (dbData?.event_revenue) {
			eventRevenue = dbData.event_revenue;
		}

		isInitialized = true;
	}

	onMount(async () => {
		await syncVenueSettings();
		await loadCosts();

		currencyChannel = supabase
			.channel('venue-currency-updates-costs')
			.on(
				'postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'calendar_settings' },
				() => syncVenueSettings()
			)
			.subscribe();
	});

	onDestroy(() => {
		if (currencyChannel) supabase.removeChannel(currencyChannel);
	});

	$: if (isInitialized && eventCosts) triggerSave();
</script>

{#if !hasAccess}
	<div class="flex-1 flex items-center justify-center p-6 bg-navbar">
		<p class="text-gray2 font-bold text-lg">You do not have permission to view this.</p>
	</div>
{:else}
	<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 bg-navbar">
		{#if isInitialized}
			<FixedCosts
				bind:fixedCosts={eventCosts.fixedCosts}
				bind:expanded={fixedExpanded}
				{currency}
				{triggerSave}
			/>

			<VariableCosts
				bind:variableCosts={eventCosts.variableCosts}
				bind:expanded={variableExpanded}
				{eventRevenue}
				{currency}
				{triggerSave}
			/>
		{/if}
	</div>
{/if}