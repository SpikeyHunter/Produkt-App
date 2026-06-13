<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { invalidateAll } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';

	export let event: any;
	export let isEditor: boolean = false;

	// The Version Dropdown is the only thing that cares about LOCKED_STATUSES
	// because you cannot change the global active version if Confirmed/Settled.
	const LOCKED_STATUSES = ['CONFIRMED', 'IN SETTLEMENT', 'SETTLED'];
	$: isStatusLocked = LOCKED_STATUSES.includes(event?.status);

	const EVENT_TYPES = [
		'Corpo',
		'Bazart Nuits',
		'Moet City',
		'NCG Show',
		'NCG 360',
		'DSTRKT',
		'Tour Prod',
		'Other'
	];

	const typeColors: Record<string, string> = {
		Corpo: '#d7b8e8',
		'Bazart Nuits': '#ffe089',
		'Moet City': '#f1e5cb',
		'NCG Show': '#c4ef9b',
		'NCG 360': '#fa7a90',
		DSTRKT: '#afd3e9',
		'Tour Prod': '#aec5d5',
		Other: '#828282'
	};

	let versions: any[] = [];
	let showDrop = false;
	let isLoading = false;

	// Modal States
	let showNameModal = false;
	let showDeleteModal = false;
	let modalMode: 'add' | 'edit' = 'add';
	let targetVersion: any = null;
	let inputName = '';
	let inputType = 'NCG Show';

	// Copy State
	let copyPreviousData = false;
	let copySourceVersionId: string | null = null;

	$: calendarId = event?.group_id || event?.id;
	$: currentVersionNum = event?.calendar?.current_version || 1;
	let viewedVersionNum = 0;

	// Safely initialize viewedVersionNum matching currentVersionNum without glitching
	$: if (viewedVersionNum === 0 && currentVersionNum !== 0) {
		viewedVersionNum = currentVersionNum;
	}

	// Reset when navigating to a new event
	let _currentEventId: number | null = null;
	$: if (event?.id && event.id !== _currentEventId) {
		_currentEventId = event.id;
		viewedVersionNum = currentVersionNum;
	}

	$: activeVersion = versions.find((v) => v.version_number === viewedVersionNum) || versions[0];

	// The event's base (version 1 / calendar-level) type
	$: eventBaseType = (() => {
		const d = event?.calendar?.details ?? event?.details;
		if (!d) return null;
		try {
			const p = typeof d === 'string' ? JSON.parse(d) : d;
			return p?.type || null;
		} catch {
			return null;
		}
	})();

	function focusInput(node: HTMLInputElement) {
		setTimeout(() => node.focus(), 10);
	}

	async function fetchVersions() {
		if (!calendarId) return;
		const { data } = await supabase
			.from('calendar_data')
			.select('id, version_number, version_name, version_type')
			.eq('calendar_id', calendarId)
			.order('version_number', { ascending: true });

		if (data) versions = data;
	}

	$: if (calendarId) {
		fetchVersions();
	}

	async function switchVersion(versionNum: number) {
		if (versionNum === viewedVersionNum) return;
		showDrop = false;

		// Grab the basic version info we already loaded
		const targetVersionData = versions.find((v) => v.version_number === versionNum);

		if (isStatusLocked) {
			// Update locally ONLY when locked to prevent fetch flickering
			viewedVersionNum = versionNum;
			if (versionNum === currentVersionNum) {
				window.dispatchEvent(
					new CustomEvent('switchViewedVersion', {
						detail: { versionNum, calendarData: null, versionType: targetVersionData?.version_type }
					})
				);
			} else {
				// DO NOT update DB. Preview in view-only mode via Window Event bus.
				const { data } = await supabase
					.from('calendar_data')
					.select('*')
					.eq('calendar_id', calendarId)
					.eq('version_number', versionNum)
					.single();

				if (data) {
					window.dispatchEvent(
						new CustomEvent('switchViewedVersion', {
							detail: { versionNum, calendarData: data }
						})
					);
				}
			}
		} else {
			// Update local state immediately for instant feedback in the dropdown
			viewedVersionNum = versionNum;
			// Send a flag to tell other components this is a permanent, global change
			window.dispatchEvent(
				new CustomEvent('switchViewedVersion', {
					detail: {
						versionNum,
						calendarData: null,
						isGlobalChange: true,
						versionType: targetVersionData?.version_type
					}
				})
			);
			// Officially change version in DB if unlocked
			await supabase.from('calendar').update({ current_version: versionNum }).eq('id', calendarId);

			invalidateAll();
		}
	}

	function openAddModal() {
		if (isStatusLocked) return;
		showDrop = false;
		modalMode = 'add';
		copyPreviousData = false;
		copySourceVersionId = null;

		const nextNum =
			versions.length > 0 ? Math.max(...versions.map((v) => v.version_number)) + 1 : 1;
		inputName = `Version ${nextNum}`;
		inputType = eventBaseType || 'NCG Show';
		showNameModal = true;
	}

	function openEditModal(version: any) {
		if (isStatusLocked) return;
		showDrop = false;
		modalMode = 'edit';
		targetVersion = version;
		inputName = version.version_name || `Version ${version.version_number}`;
		showNameModal = true;
	}

	function openDeleteModal(version: any) {
		if (isStatusLocked) return;
		showDrop = false;
		targetVersion = version;
		showDeleteModal = true;
	}

	async function saveNameModal() {
		if (!inputName.trim()) return;
		if (modalMode === 'add' && copyPreviousData && !copySourceVersionId) return;

		isLoading = true;

		if (modalMode === 'add') {
			const nextNum =
				versions.length > 0 ? Math.max(...versions.map((v) => v.version_number)) + 1 : 1;

			if (copyPreviousData && copySourceVersionId) {
				// Duplicate existing version
				const { data: sourceData } = await supabase
					.from('calendar_data')
					.select('*')
					.eq('id', copySourceVersionId)
					.single();

				if (sourceData) {
					const {
						id,
						created_at,
						calendar_id,
						version_number,
						version_name,
						version_type,
						...rest
					} = sourceData;
					await supabase.from('calendar_data').insert({
						...rest,
						calendar_id: calendarId,
						version_number: nextNum,
						version_name: inputName.trim(),
						version_type: nextNum >= 2 ? inputType : null
					});
				}
			} else {
				// Standard Blank Version
				const { data: currentData } = await supabase
					.from('calendar_data')
					.select('event_ids')
					.eq('calendar_id', calendarId)
					.eq('version_number', currentVersionNum)
					.single();

				await supabase.from('calendar_data').insert({
					calendar_id: calendarId,
					version_number: nextNum,
					version_name: inputName.trim(),
					version_type: nextNum >= 2 ? inputType : null,
					event_ids: currentData?.event_ids || [],
					event_deal: { headliner_id: 'NULL', headliner_pic: 'NULL', headliner_name: 'NULL' },
					event_revenue: {},
					event_cost: {},
					pro_forma: {}
				});
			}

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

		await supabase.from('calendar_data').delete().eq('id', targetVersion.id);

		if (targetVersion.version_number === currentVersionNum) {
			const remaining = versions.filter((v) => v.id !== targetVersion.id);
			const fallbackNum =
				remaining.length > 0 ? Math.max(...remaining.map((v) => v.version_number)) : 1;
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
		if (
			showDrop &&
			e.target instanceof Element &&
			!e.target.closest('.version-dropdown-container')
		) {
			showDrop = false;
		}
	}}
/>

<div class="flex items-center gap-2">
	{#if isStatusLocked && viewedVersionNum !== currentVersionNum}
		<span
			class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-problem border border-amber-problem px-2.5 py-1 rounded-3xl whitespace-nowrap"
		>
			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
				/>
			</svg>
			View Only Mode
		</span>
	{/if}

	<div class="relative version-dropdown-container z-[100]">
		<button
			class="flex items-center gap-3 px-5 py-2.5 rounded-3xl bg-navbar shadow-lg border transition-colors
        {isStatusLocked && viewedVersionNum !== currentVersionNum
				? 'border-problem'
				: 'border-gray2/10'}
        {isEditor ? 'hover:bg-white/5 cursor-pointer' : 'opacity-80 cursor-not-allowed'}"
			on:click={() => {
				if (isEditor) showDrop = !showDrop;
			}}
			disabled={!isEditor}
			title={isStatusLocked && viewedVersionNum !== currentVersionNum
				? 'View-only mode — returning to current version allows editing'
				: ''}
		>
			<svg
				class="w-4 h-4 {isStatusLocked && viewedVersionNum !== currentVersionNum
					? 'text-problem'
					: 'text-gray2'}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
				></path>
			</svg>

			<span
				class="text-sm font-bold whitespace-nowrap {isStatusLocked &&
				viewedVersionNum !== currentVersionNum
					? 'text-problem'
					: 'text-white'}"
			>
				{activeVersion?.version_name || `Version ${viewedVersionNum}`}
			</span>

			{#if isEditor}
				<svg
					class="w-4 h-4 ml-1 {isStatusLocked && viewedVersionNum !== currentVersionNum
						? 'text-problem'
						: 'text-gray2'}"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			{/if}
		</button>

		{#if showDrop}
			<div
				class="absolute right-0 top-[calc(100%+8px)] w-60 bg-navbar rounded-2xl shadow-2xl overflow-hidden py-2 z-[100] border border-gray2/10"
			>
				{#if isEditor}
					<button
						class="w-full px-5 py-3 flex items-center gap-3 text-center transition-colors font-bold border-b border-gray2/10 mb-1 {isStatusLocked
							? 'text-gray2 opacity-50 cursor-not-allowed'
							: 'text-gray3 hover:text-lime cursor-pointer'}"
						disabled={isStatusLocked}
						on:click={openAddModal}
					>
						<span class="text-md leading-none">+</span> Add a new version
					</button>
				{/if}

				<div class="max-h-60 overflow-y-auto custom-scrollbar">
					{#each versions as version}
						<div
							class="flex items-center justify-between px-2 py-1 hover:bg-white/5 transition-colors group"
						>
							<button
								class="flex-1 px-3 py-2 text-left flex items-center gap-3 cursor-pointer {version.version_number ===
								viewedVersionNum
									? 'text-lime'
									: 'text-white'}"
								on:click={() => switchVersion(version.version_number)}
							>
								<span class="text-sm font-bold truncate max-w-[130px]"
									>{version.version_name || `Version ${version.version_number}`}</span
								>
							</button>

							{#if isEditor}
								<div
									class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2"
								>
									<button
										class="p-2 transition-colors {isStatusLocked
											? 'text-gray2 opacity-50 cursor-not-allowed'
											: 'text-gray2 hover:text-white cursor-pointer'}"
										disabled={isStatusLocked}
										on:click={() => openEditModal(version)}
										aria-label="Edit"
									>
										<svg
											class="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											stroke-width="2"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
											></path></svg
										>
									</button>
									{#if versions.length > 1}
										<button
											class="p-2 transition-colors {isStatusLocked
												? 'text-gray2 opacity-50 cursor-not-allowed'
												: 'text-gray2 hover:text-problem cursor-pointer'}"
											disabled={isStatusLocked}
											on:click={() => openDeleteModal(version)}
											aria-label="Delete"
										>
											<svg
												class="w-4 h-4"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
												stroke-width="2"
												><path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												></path></svg
											>
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

{#if showNameModal}
	<div
		class="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm"
		transition:fade={{ duration: 200 }}
	>
		<div
			class="bg-navbar border border-gray2/20 rounded-2xl p-6 w-full max-w-md shadow-2xl"
			transition:fly={{ y: 30, duration: 300 }}
		>
			<h3 class="text-xl font-black text-white mb-4">
				{modalMode === 'add' ? 'Create New Version' : 'Rename Version'}
			</h3>

			<div class="flex flex-col gap-5 mb-6">
				{#if modalMode === 'add'}
					<div
						class="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-gray2/10"
					>
						<div>
							<p class="text-sm font-bold text-white">Copy Data</p>
							<p class="text-[11px] text-gray2 mt-0.5">Duplicate an existing version's data</p>
						</div>
						<button
							class="relative w-10 h-5 rounded-full transition-colors duration-300 {copyPreviousData
								? 'bg-lime'
								: 'bg-gray2/30'} cursor-pointer shrink-0"
							on:click={() => (copyPreviousData = !copyPreviousData)}
							aria-label="Toggle copy data from previous version"
							title="Toggle copy data"
						>
							<div
								class="absolute top-1 left-1 w-3 h-3 rounded-full transition-transform duration-300 shadow-sm {copyPreviousData
									? 'translate-x-5 bg-black'
									: 'translate-x-0 bg-white'}"
							></div>
						</button>
					</div>

					{#if copyPreviousData}
						<div transition:fade={{ duration: 150 }}>
							<span class="block text-xs font-bold uppercase tracking-wider text-gray3 mb-2 pl-1">
								Select Version to Copy <span class="text-problem">*</span>
							</span>
							<div class="flex flex-wrap gap-2">
								{#each versions as v}
									<button
										type="button"
										class="px-3 py-1.5 rounded-3xl text-xs font-bold transition-all cursor-pointer border {copySourceVersionId ===
										v.id
											? 'bg-white/10 text-white border-white'
											: 'bg-black/40 text-gray2 border-transparent hover:bg-white/5 hover:text-white'}"
										on:click={() => {
											copySourceVersionId = v.id;
											inputName = `${v.version_name || 'Version ' + v.version_number} (Copied)`;
											inputType = v.version_type || inputType;
										}}
									>
										{v.version_name || `Version ${v.version_number}`}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				{/if}

				<div>
					<label
						for="version-name-input"
						class="block text-xs font-bold uppercase tracking-wider text-gray3 mb-2 pl-1"
					>
						Version Name
					</label>
					<input
						id="version-name-input"
						type="text"
						bind:value={inputName}
						placeholder="Version Name"
						class="w-full bg-gray1 border border-gray2/30 rounded-3xl px-4 py-3 text-white focus:outline-none focus:border-lime"
						on:keydown={(e) => e.key === 'Enter' && saveNameModal()}
						use:focusInput
					/>
				</div>

				{#if modalMode === 'add'}
					<div>
						<span class="block text-xs font-bold uppercase tracking-wider text-gray3 mb-2 pl-1">
							Event Type for this Version
						</span>
						<div class="flex flex-wrap gap-2">
							{#each EVENT_TYPES as t}
								{@const tColor = typeColors[t] || typeColors['Other']}
								<button
									type="button"
									class="px-3 py-1.5 rounded-3xl text-xs font-bold transition-all cursor-pointer border"
									style="
										border-color: {tColor}; 
										color: {inputType === t ? '#000' : tColor}; 
										background-color: {inputType === t ? tColor : 'rgba(0,0,0,0.2)'};
									"
									on:click={() => (inputType = t)}
								>
									{t === 'Bazart Nuits' ? 'Nuits Bazart' : t}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<button
					class="px-5 py-2.5 text-gray2 font-bold hover:text-white transition-colors cursor-pointer"
					on:click={() => (showNameModal = false)}
					disabled={isLoading}>Cancel</button
				>
				<button
					class="px-8 py-2.5 bg-lime text-black font-bold rounded-3xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					on:click={saveNameModal}
					disabled={isLoading ||
						!inputName.trim() ||
						(modalMode === 'add' && copyPreviousData && !copySourceVersionId)}
				>
					{isLoading ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showDeleteModal}
	<div
		class="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4 backdrop-blur-sm"
		transition:fade={{ duration: 200 }}
	>
		<div
			class="bg-navbar border border-gray2/20 rounded-2xl p-6 w-full max-w-md shadow-2xl"
			transition:fly={{ y: 30, duration: 300 }}
		>
			<h3 class="text-xl font-black text-problem mb-2">Delete Version</h3>
			<p class="text-gray3 mb-6 font-medium">
				Are you sure you want to delete <strong class="text-white"
					>{targetVersion?.version_name}</strong
				>? This action is irreversible.
			</p>
			<div class="flex justify-end gap-3">
				<button
					class="px-5 py-2.5 text-gray2 font-bold hover:text-white transition-colors cursor-pointer"
					on:click={() => (showDeleteModal = false)}
					disabled={isLoading}>Cancel</button
				>
				<button
					class="px-5 py-2.5 bg-red-500 text-white font-bold rounded-3xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
					on:click={confirmDelete}
					disabled={isLoading}
				>
					{isLoading ? 'Deleting...' : 'Yes, Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}
