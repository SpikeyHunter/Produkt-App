<!-- /src/lib/components/marketing/comptickets/CompDownload.svelte -->
<script lang="ts">
	import type { CompTicketData, CompType, CompEntry } from '$lib/types/comptickets';
	import { supabase } from '$lib/supabase';
	import type { Writable } from 'svelte/store';
	import { exportCompsToCSV } from '$lib/utils/compCsvExport';

	export let data: Writable<CompTicketData>;
	let eventName = '';
	let eventDate = '';
	let downloadingType: CompType | null = null;

	// Reactive statement to load event details when the event_id changes.
	$: if ($data.event_id) loadEventDetails($data.event_id);

	async function loadEventDetails(eventId: number) {
		const { data: eventData, error } = await supabase
			.from('events')
			.select('event_name, event_date')
			.eq('event_id', eventId)
			.single();
		
		if (error) {
			console.error('Error fetching event details for download:', error);
			eventName = 'Unknown Event';
			eventDate = '';
			return;
		}

		if (eventData) {
			eventName = eventData.event_name;
			try {
				eventDate = new Date(eventData.event_date).toLocaleDateString('en-US', {
					timeZone: 'UTC', // Treat date from DB as UTC
					month: 'long',
					day: 'numeric',
					year: 'numeric'
				});
			} catch {
				eventDate = eventData.event_date;
			}
		}
	}

	async function downloadCSV(type: CompType) {
		const compList: CompEntry[] = $data[type] ?? [];
		if (compList.length === 0) {
			// Button should be disabled, so this is a fallback.
			console.warn('Attempted to export an empty comp list.');
			return;
		}
		
		downloadingType = type;
		
		// Simulate a brief delay for user feedback
		await new Promise(resolve => setTimeout(resolve, 500));
		
		let typeName = '';
		switch (type) {
			case 'ga_comps':
				typeName = 'GA Comps';
				break;
			case 'vip_comps':
				typeName = 'VIP Comps';
				break;
			case 'other_comps':
				typeName = $data.comp_status.other_comps_name || 'Other Comps';
				break;
		}
		const fileName = `${eventName} - ${eventDate} - ${typeName}.csv`;
		exportCompsToCSV(compList, fileName);
		
		downloadingType = null;
	}

	// FIXED: Make the function reactive by depending on $data
	function getCompCount(compData: CompTicketData, type: CompType): number {
		const entries = compData[type];
		if (!Array.isArray(entries)) return 0;
		return entries.reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);
	}

	// Use reactive statements that depend on $data to trigger updates
	$: gaCount = getCompCount($data, 'ga_comps');
	$: vipCount = getCompCount($data, 'vip_comps');
	$: otherCount = getCompCount($data, 'other_comps');
	$: otherName = $data.comp_status.other_comps_name || 'Other';
	
	// Debug logging to verify reactivity
	$: console.log('Download counts updated:', { gaCount, vipCount, otherCount });
</script>

<div class="bg-navbar border border-gray1 rounded-xl p-4">
	<h3 class="text-white text-sm font-bold mb-3">Download Files</h3>
	<div class="flex flex-col gap-3">
		<!-- GA Comps Button -->
		<button 
			on:click={() => downloadCSV('ga_comps')} 
			disabled={gaCount === 0 || downloadingType !== null}
			class="w-full bg-gray1 font-bold py-2.5 px-4 rounded-3xl transition-all flex items-center justify-between group border-2 {gaCount === 0 || downloadingType !== null ? 'opacity-50 cursor-not-allowed border-gray1 text-gray-400' : 'border-gray1 text-gray-200 hover:border-lime hover:text-lime cursor-pointer'}"
		>
			<span class="flex items-center gap-2">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
				{downloadingType === 'ga_comps' ? 'Downloading...' : 'GA Comps'}
			</span>
			<span class="bg-black/20 px-2 py-0.5 rounded text-xs">{gaCount}</span>
		</button>
		
		<!-- VIP Comps Button -->
		<button 
			on:click={() => downloadCSV('vip_comps')} 
			disabled={vipCount === 0 || downloadingType !== null}
			class="w-full bg-gray1 font-bold py-2.5 px-4 rounded-3xl transition-all flex items-center justify-between group border-2 {vipCount === 0 || downloadingType !== null ? 'opacity-50 cursor-not-allowed border-gray1 text-gray-400' : 'border-gray1 text-gray-200 hover:border-lime hover:text-lime cursor-pointer'}"
		>
			<span class="flex items-center gap-2">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
				{downloadingType === 'vip_comps' ? 'Downloading...' : 'VIP Comps'}
			</span>
			<span class="bg-black/20 px-2 py-0.5 rounded text-xs">{vipCount}</span>
		</button>
		
		<!-- Other Comps Button -->
		<button 
			on:click={() => downloadCSV('other_comps')} 
			disabled={otherCount === 0 || downloadingType !== null}
			class="w-full bg-gray1 font-bold py-2.5 px-4 rounded-3xl transition-all flex items-center justify-between group border-2 {otherCount === 0 || downloadingType !== null ? 'opacity-50 cursor-not-allowed border-gray1 text-gray-400' : 'border-gray1 text-gray-200 hover:border-lime hover:text-lime cursor-pointer'}"
		>
			<span class="flex items-center gap-2">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
				{downloadingType === 'other_comps' ? 'Downloading...' : `${otherName} Comps`}
			</span>
			<span class="bg-black/20 px-2 py-0.5 rounded text-xs">{otherCount}</span>
		</button>
	</div>
</div>