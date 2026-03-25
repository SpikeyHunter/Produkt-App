<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { invalidateAll } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';

	export let event: any;
	export let isEditor: boolean = false;

	let versions: any[] = [];
	let showDrop = false;
	let isLoading = false;

	// Modal States
	let showNameModal = false;
	let showDeleteModal = false;
	let modalMode: 'add' | 'edit' = 'add';
	let targetVersion: any = null;
	let inputName = '';

	$: calendarId = event?.group_id || event?.id;
	$: currentVersionNum = event?.calendar?.current_version || 1;
	$: activeVersion = versions.find(v => v.version_number === currentVersionNum) || versions[0];

	// Action to replace standard autofocus (fixes a11y_autofocus warning)
	function focusInput(node: HTMLInputElement) {
		setTimeout(() => node.focus(), 10); // slight delay to allow modal render
	}

	async function fetchVersions() {
		if (!calendarId) return;
		const { data, error } = await supabase
			.from('calendar_data')
			.select('id, version_number, version_name')
			.eq('calendar_id', calendarId)
			.order('version_number', { ascending: true });

		if (data) versions = data;
	}

	// Fetch when the event changes (e.g., navigating between events without refresh)
	$: if (calendarId) {
		fetchVersions();
	}

	async function switchVersion(versionNum: number) {
		if (versionNum === currentVersionNum) return;
		showDrop = false;
		
		await supabase
			.from('calendar')
			.update({ current_version: versionNum })
			.eq('id', calendarId);
			
		invalidateAll();
	}

	function openAddModal() {
		showDrop = false;
		modalMode = 'add';
		const nextNum = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;
		inputName = `Version ${nextNum}`;
		showNameModal = true;
	}

	function openEditModal(version: any) {
		showDrop = false;
		modalMode = 'edit';
		targetVersion = version;
		inputName = version.version_name || `Version ${version.version_number}`;
		showNameModal = true;
	}

	function openDeleteModal(version: any) {
		showDrop = false;
		targetVersion = version;
		showDeleteModal = true;
	}

	async function saveNameModal() {
		if (!inputName.trim()) return;
		isLoading = true;

		if (modalMode === 'add') {
			// Fetch only the event_ids from the current active version to keep them linked
			const { data: currentData } = await supabase
				.from('calendar_data')
				.select('event_ids')
				.eq('calendar_id', calendarId)
				.eq('version_number', currentVersionNum)
				.single();

			const nextNum = versions.length > 0 ? Math.max(...versions.map(v => v.version_number)) + 1 : 1;

			// Insert new version with EMPTY data defaults as requested
			await supabase.from('calendar_data').insert({
				calendar_id: calendarId,
				version_number: nextNum,
				version_name: inputName.trim(),
				event_ids: currentData?.event_ids || [],
				event_deal: { headliner_id: "NULL", headliner_pic: "NULL", headliner_name: "NULL" },
				event_revenue: {},
				event_cost: {},
				pro_forma: {}
			});

			// Automatically switch to the newly created version
			await supabase.from('calendar').update({ current_version: nextNum }).eq('id', calendarId);
			
		} else if (modalMode === 'edit' && targetVersion) {
			await supabase
				.from('calendar_data')
				.update({ version_name: inputName.trim() })
				.eq('id', targetVersion.id);
		}

		showNameModal = false;
		isLoading = false;
		await fetchVersions();
		if (modalMode === 'add') invalidateAll();
	}

	async function confirmDelete() {
		if (!targetVersion) return;
		isLoading = true;

		// Actually delete the row from calendar_data
		await supabase.from('calendar_data').delete().eq('id', targetVersion.id);
		
		// If we deleted the currently active version, fallback to the latest remaining one
		if (targetVersion.version_number === currentVersionNum) {
			const remaining = versions.filter(v => v.id !== targetVersion.id);
			const fallbackNum = remaining.length > 0 ? Math.max(...remaining.map(v => v.version_number)) : 1;
			await supabase.from('calendar').update({ current_version: fallbackNum }).eq('id', calendarId);
			invalidateAll();
		}

		showDeleteModal = false;
		isLoading = false;
		await fetchVersions();
	}
</script>

<svelte:window
	on:click={(e) => {
		if (showDrop && e.target instanceof Element && !e.target.closest('.version-dropdown-container')) {
			showDrop = false;
		}
	}}
/>

<div class="relative version-dropdown-container z-50">
	<button
		class="flex items-center gap-3 px-5 py-2.5 rounded-3xl bg-navbar shadow-lg border border-gray2/10 transition-colors {isEditor ? 'hover:bg-white/5 cursor-pointer' : 'opacity-80 cursor-not-allowed'}"
		on:click={() => isEditor && (showDrop = !showDrop)}
		disabled={!isEditor}
	>
		<svg class="w-4 h-4 text-gray2" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
		<span class="text-sm font-bold text-white whitespace-nowrap">
			{activeVersion?.version_name || `Version ${currentVersionNum}`}
		</span>
		{#if isEditor}
			<svg class="w-4 h-4 text-gray2 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
		{/if}
	</button>

	{#if showDrop && isEditor}
		<div class="absolute right-0 top-[calc(100%+8px)] w-60 bg-navbar rounded-2xl shadow-2xl overflow-hidden py-2 z-[100] border border-gray2/10">
			
			<button class="w-full px-5 py-3 flex items-center gap-3 text-center text-gray3 hover:text-lime transition-colors cursor-pointer font-bold border-b border-gray2/10 mb-1" on:click={openAddModal}>
				<span class="text-md leading-none">+</span> Add a new version
			</button>

			<div class="max-h-60 overflow-y-auto custom-scrollbar">
				{#each versions as version}
					<div class="flex items-center justify-between px-2 py-1 hover:bg-white/5 transition-colors group">
						<button 
							class="flex-1 px-3 py-2 text-left flex items-center gap-3 cursor-pointer {version.version_number === currentVersionNum ? 'text-lime' : 'text-white'}"
							on:click={() => switchVersion(version.version_number)}
						>
							<span class="text-sm font-bold truncate max-w-[130px]">{version.version_name || `Version ${version.version_number}`}</span>
						</button>
						
						<div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2">
							<button class="p-2 text-gray2 hover:text-white transition-colors cursor-pointer" on:click={() => openEditModal(version)} aria-label="Edit">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
							</button>
							{#if versions.length > 1}
								<button class="p-2 text-gray2 hover:text-problem transition-colors cursor-pointer" on:click={() => openDeleteModal(version)} aria-label="Delete">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

{#if showNameModal}
	<div class="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm" transition:fade={{ duration: 200 }}>
		<div class="bg-navbar border border-gray2/20 rounded-2xl p-6 w-full max-w-md shadow-2xl" transition:fly={{ y: 30, duration: 300 }}>
			<h3 class="text-xl font-black text-white mb-4">{modalMode === 'add' ? 'Create New Version' : 'Rename Version'}</h3>
			<input 
				type="text" 
				bind:value={inputName} 
				placeholder="Version Name" 
				class="w-full bg-gray1 border border-gray2/30 rounded-3xl px-4 py-3 text-white focus:outline-none focus:border-lime mb-6"
				on:keydown={(e) => e.key === 'Enter' && saveNameModal()}
				use:focusInput
			/>
			<div class="flex justify-end gap-3">
				<button class="px-5 py-2.5 text-gray2 font-bold hover:text-white transition-colors cursor-pointer" on:click={() => (showNameModal = false)} disabled={isLoading}>Cancel</button>
				<button class="px-8 py-2.5 bg-lime text-black font-bold rounded-3xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50" on:click={saveNameModal} disabled={isLoading || !inputName.trim()}>
					{isLoading ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showDeleteModal}
	<div class="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm" transition:fade={{ duration: 200 }}>
		<div class="bg-navbar border border-gray2/20 rounded-2xl p-6 w-full max-w-md shadow-2xl" transition:fly={{ y: 30, duration: 300 }}>
			<h3 class="text-xl font-black text-problem mb-2">Delete Version</h3>
			<p class="text-gray3 mb-6 font-medium">Are you sure you want to delete <strong class="text-white">{targetVersion?.version_name}</strong>? This action is irreversible.</p>
			<div class="flex justify-end gap-3">
				<button class="px-5 py-2.5 text-gray2 font-bold hover:text-white transition-colors cursor-pointer" on:click={() => (showDeleteModal = false)} disabled={isLoading}>Cancel</button>
				<button class="px-5 py-2.5 bg-red-500 text-white font-bold rounded-3xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50" on:click={confirmDelete} disabled={isLoading}>
					{isLoading ? 'Deleting...' : 'Yes, Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}