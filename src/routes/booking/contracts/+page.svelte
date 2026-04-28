<script lang="ts">
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import ContractSelector from '$lib/components/booking/contracts/ContractSelector.svelte';
	import DocumentViewer from '$lib/components/booking/contracts/DocumentViewer.svelte';

	import EventAddModal from '$lib/components/modals/EventAddModal.svelte';
	import EventEditModal from '$lib/components/modals/EventEditModal.svelte';
	import { fetchEventsAdvance, type EventAdvance } from '$lib/services/eventsService';
	import { upsertEventContract } from '$lib/services/contractService';

	let advances: EventAdvance[] = [];
	let selectedAdvance: EventAdvance | null = null;
	let loading = true;
	let isSelectorOpen = true;

	let showAddModal = false;
	let showEditModal = false;
	let eventToEdit: EventAdvance | null = null;
	let isGeneratingFolder = false;

	async function loadData() {
		loading = true;
		advances = await fetchEventsAdvance();
		if (selectedAdvance) {
			selectedAdvance = advances.find((a) => a.id === selectedAdvance!.id) || null;
		}
		loading = false;
	}

	onMount(() => loadData());

	async function handleSelection(e: CustomEvent<EventAdvance>) {
		const adv = e.detail;
		if (isGeneratingFolder) return;

		if (!adv.gdrive_folder_id && adv.advance_id) {
			isGeneratingFolder = true;
			try {
				const res = await fetch('/api/gdrive', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'create',
						eventDate: adv.event_date,
						artistName: adv.artist_name,
						venueName: adv.event_venue || adv.venue
					})
				});
				const driveData = await res.json();
				if (driveData.success) {
					const savedContract = await upsertEventContract({
						advance_id: adv.advance_id,
						event_id: adv.event_id,
						gdrive_folder_id: driveData.folderId,
						gdrive_folder_url: driveData.folderUrl
					});
					adv.gdrive_folder_id = driveData.folderId;
					adv.gdrive_folder_url = driveData.folderUrl;
					if (savedContract?.contract_id) adv.contract_id = savedContract.contract_id;
					advances = [...advances];
					selectedAdvance = { ...adv };
					return;
				}
			} catch (err) {
				console.error('Failed to auto-generate drive folder:', err);
			} finally {
				isGeneratingFolder = false;
			}
		}
		selectedAdvance = adv;
	}

	function handleEditRequest(e: CustomEvent<EventAdvance>) {
		eventToEdit = e.detail;
		showEditModal = true;
	}
</script>

<svelte:head>
	<title>Contract & Files</title>
</svelte:head>

<EventAddModal isOpen={showAddModal} on:close={() => (showAddModal = false)} on:success={() => { showAddModal = false; loadData(); }} />
<EventEditModal isOpen={showEditModal} event={eventToEdit} on:close={() => { showEditModal = false; eventToEdit = null; }} on:save={loadData} on:delete={loadData} />

<MainLayout pageTitle="Contract & Files">
	<div class="h-full w-full flex p-2 gap-6 overflow-hidden">
		<div class="relative flex flex-col gap-4 flex-shrink-0 h-[calc(100vh-40px)] transition-all duration-300 ease-in-out {isSelectorOpen ? 'w-[250px]' : 'w-[75px]'}">
			<button on:click={() => (isSelectorOpen = !isSelectorOpen)} class="absolute -right-3 top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-7 h-7 bg-navbar border border-gray1 rounded-full text-gray2 hover:text-white hover:bg-gray1 transition-all shadow-md cursor-pointer" title={isSelectorOpen ? 'Collapse' : 'Expand'}>
				<svg class="w-4 h-4 transition-transform duration-300 {isSelectorOpen ? '' : 'rotate-180'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
			</button>
			<div class="px-1">
				<div class="flex items-center {isSelectorOpen ? 'justify-between' : 'justify-center'} min-h-[32px]">
					{#if isSelectorOpen}<h1 class="text-2xl font-bold text-white whitespace-nowrap overflow-hidden animate-in fade-in duration-300">Events Files</h1>{/if}
					<button on:click={() => (showAddModal = true)} class="bg-lime text-black font-bold hover:opacity-90 transition-all shadow-lg flex items-center justify-center cursor-pointer rounded-3xl {isSelectorOpen ? 'px-2 py-1 text-xs' : 'px-1.5 py-1 text-[11px] w-full'}">{isSelectorOpen ? '+ Add Event' : '+ Add'}</button>
				</div>
				{#if isSelectorOpen}<p class="text-gray2 text-xs mt-1 animate-in fade-in duration-300">Select an event to load documents</p>{/if}
			</div>
			<div class="flex-1 min-h-0 bg-navbar rounded-xl border border-gray1 overflow-hidden flex flex-col">
				<ContractSelector {advances} {loading} isOpen={isSelectorOpen} bind:selectedAdvance on:select={handleSelection} on:edit={handleEditRequest} />
			</div>
		</div>

		<div class="flex-1 bg-navbar rounded-2xl border border-gray1 flex flex-col overflow-hidden h-[calc(100vh-40px)]">
			<DocumentViewer bind:advance={selectedAdvance} />
		</div>
	</div>
</MainLayout>