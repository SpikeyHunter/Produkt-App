<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import EventHeader from '$lib/components/calendar/page/EventHeader.svelte';

	export let data: PageData;
	
	$: ({ event, groupEvents, venues } = data);

	const tabs = [
		'Deals', 'Revenue', 'Pro Forma', 'Costs', 'Internal Settlement', 
		'Run of Show', 'Contacts', 'Notes', 'Files'
	];
	
	let activeTab = tabs[0];

	onMount(() => {
		const pathParts = window.location.pathname.split('/');
		const possibleTab = pathParts[pathParts.length - 1].replace(/-/g, ' ');
		const matchedTab = tabs.find(t => t.toLowerCase() === possibleTab.toLowerCase());
		if (matchedTab) activeTab = matchedTab;
	});

	function handleTabChange(e: CustomEvent<string>) {
		activeTab = e.detail;
		const slug = activeTab.toLowerCase().replace(/\s+/g, '-');
		// Updates URL dynamically using the short ID
		window.history.pushState({}, '', `/calendar/${event.short_id}/${slug}`);
	}
</script>

<svelte:head>
	<title>{event.calendar?.title || 'Event'} - Produkt App</title>
</svelte:head>

<div class="h-screen w-full flex flex-col bg-gray1 overflow-hidden text-white">
	
	<EventHeader 
		{event} 
		{groupEvents} 
		{venues} 
		{tabs} 
		{activeTab} 
		on:tabChange={handleTabChange} 
	/>

	<div class="flex-1 flex overflow-hidden">
		
		<div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
			<div class="bg-navbar border border-gray2/10 rounded-xl shadow-sm min-h-full flex flex-col">
				<div class="p-6 border-b border-gray2/10 flex justify-between items-center">
					<h2 class="text-xl font-black uppercase tracking-wide text-white">{activeTab}</h2>
					<div class="space-x-2">
						{#if activeTab === 'Deals'}
							<button class="px-4 py-2 border border-gray2/20 text-lime font-bold rounded-lg hover:bg-lime/10 transition-colors text-sm cursor-pointer">Create Partner Deal</button>
							<button class="px-4 py-2 bg-lime text-black font-bold rounded-lg hover:bg-lime/90 transition-colors text-sm cursor-pointer">Create Artist Deal</button>
						{/if}
					</div>
				</div>
				<div class="p-6 flex-1 text-gray2 font-medium flex items-center justify-center border-2 border-dashed border-gray2/20 m-6 rounded-xl">
					Placeholder content for {activeTab} will load here.
				</div>
			</div>
		</div>

		<div class="w-80 bg-navbar border-l border-gray2/10 overflow-y-auto custom-scrollbar flex flex-col shrink-0">
			<div class="p-5 border-b border-gray2/10">
				<h3 class="text-xs font-black text-gray2 uppercase tracking-widest mb-4">Sidebar</h3>
				<div class="bg-gray1 rounded-xl border border-gray2/10 p-4 mb-4">
					<p class="text-xs font-bold text-gray2 uppercase tracking-wider mb-1">Active Module</p>
					<p class="text-sm font-bold text-white">{activeTab} Details</p>
				</div>
			</div>
			<div class="p-5 flex-1">
				<div class="space-y-6">
					<div>
						<h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">Tasks</h4>
						<button class="w-full py-2 border border-gray2/20 rounded-lg text-sm font-bold text-gray2 hover:text-white hover:bg-white/5 cursor-pointer transition-colors">+ Add a task</button>
					</div>
					<div>
						<h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">Activity Log</h4>
						<div class="h-20 bg-gray1 rounded-lg border border-gray2/10 flex items-center justify-center text-xs text-gray2 font-medium">No recent activity</div>
					</div>
				</div>
			</div>
		</div>

	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar { width: 6px; }
	.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(189, 189, 187, 0.2); border-radius: 10px; }
	.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(225, 255, 0, 0.5); }
</style>