<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import DropdownButton from '$lib/components/buttons/DropdownButton.svelte';
	import InputButton from '$lib/components/buttons/InputButton.svelte';
	import ProgressBar from '$lib/components/inputs/ProgressBar.svelte';
	import type { EventAdvance } from '$lib/services/eventsService';
	import { upsertEventContract } from '$lib/services/contractService';
	import LocalContacts from '$lib/components/modals/LocalContacts.svelte';
	import ContractPreviewModal from '$lib/components/modals/ContractPreviewModal.svelte';
	import UploadModal from '$lib/components/modals/UploadModal.svelte';
	import { portal } from '$lib/utils/portalUtils';
	import {
		dosContactOptions,
		parseDosNames,
		sortDosNames,
		formatDosValue,
		formatLocalContact,
		type LocalContactLike
	} from '$lib/components/settings/AdvanceVariables';

	export let event: EventAdvance;

	const dispatch = createEventDispatcher();

	// Component references
	let progressBarRef: any;
	let realtimeChannel: any;

	// Modal state
	let showLocalContactsModal = false;
	let showContractPreview = false;
	let showUploadModal = false;
	let isProcessingContract = false;

	// Options for dropdowns
	const artistTypeOptions = ['Headliner', 'Support', 'Local', 'Other'];
	const DOSConctactOptions = dosContactOptions;

	// Artist Liaison multi-select state
	let showDosDropdown = false;
	let dosButtonEl: HTMLButtonElement;
	let dosMenuPos = { top: 0, left: 0 };
	let isSavingDos = false;

	// Reactive variables derived from the event prop
	$: imageUrl = event.event_flyer || event.poster;
	$: eventName = event.event_name || event.name;
	$: eventDate = event.event_date || event.date || null;
	$: venueName = event.venue || 'TBD';
	$: artistName = event.artist_name || event.name;
	$: artistType = event.artist_type || '';
	$: dosContact = event.dos || '';
	$: mainContact = event.main_contact || '';
	$: displayEventName =
		eventName && eventName.length > 25
			? eventName.substring(0, 25) + '...'
			: eventName || 'Untitled Event';

	$: formattedDate = formatDisplayDate(eventDate);
	$: isLocalArtist = artistType === 'Local';
	$: mainContactDisplay = mainContact || 'Select Contact';

	// Artist Liaison — supports multiple people, Charles always listed first
	$: dosNames = sortDosNames(parseDosNames(dosContact));
	$: dosDisplay = dosNames.length ? dosNames.join(', ') : 'Select';

	// Drive Contract Flow States
	$: hasFolder = !!event.gdrive_folder_id;
	$: hasContractUrl = 
		(event.signed_contract_url && event.signed_contract_url !== 'null') || 
		(event.redlined_contract_url && event.redlined_contract_url !== 'null') || 
		(event.original_contract_url && event.original_contract_url !== 'null');
	
	$: contractBtnText = !hasFolder ? 'Create Folder' : (!hasContractUrl ? 'Upload Contract' : 'View Contract');

	function formatDisplayDate(dateString: string | null): string {
		if (!dateString) {
			return 'TBD';
		}
		try {
			const date = new Date(dateString.includes('-') ? dateString.replace(/-/g, '/') : dateString);
			if (isNaN(date.getTime())) return dateString;
			return date.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		} catch (error) {
			console.error('Error formatting date:', error);
			return dateString;
		}
	}

	async function syncDosContactForLocal() {
		if (!event?.event_id || artistType !== 'Local') return;
		try {
			const { data, error } = await supabase
				.from('events_advance')
				.select('dos, artist_type')
				.eq('event_id', event.event_id)
				.in('artist_type', ['Headliner', 'Support'])
				.limit(1)
				.single();

			if (data?.dos && data.dos !== dosContact) {
				dosContact = data.dos;
				event.dos = data.dos;
				event = { ...event };

				await supabase
					.from('events_advance')
					.update({ dos: data.dos })
					.eq('event_id', event.event_id)
					.eq('artist_name', event.artist_name);
			}
		} catch (err) {
			console.error('Error in syncDosContactForLocal:', err);
		}
	}

	// 🔑 GUARANTEE ADVANCE ID EXISTS
	async function ensureAdvanceId() {
		if (!event.advance_id && event.event_id && event.artist_name) {
			const { data } = await supabase
				.from('events_advance')
				.select('id, contract_id')
				.eq('event_id', event.event_id)
				.eq('artist_name', event.artist_name)
				.single();
			if (data) {
				event.advance_id = data.id;
				if (!event.contract_id) event.contract_id = data.contract_id;
			}
		}
	}

	// 🔑 SYNC AND DATA HEALING
	async function syncContractData() {
		await ensureAdvanceId();
		if (!event?.advance_id) return;

		try {
			// First, find if events_contract already has a row mapped to this advance
			let { data: contractRecord } = await supabase
				.from('events_contract')
				.select('*')
				.eq('advance_id', event.advance_id)
				.maybeSingle();

			// 🛠️ HEALING LOGIC: If missing, check if an orphaned row exists (advance_id = NULL) and claim it!
			if (!contractRecord && event.event_id) {
				const { data: orphanRecords } = await supabase
					.from('events_contract')
					.select('*')
					.eq('event_id', event.event_id)
					.is('advance_id', null)
					.order('created_at', { ascending: false });

				if (orphanRecords && orphanRecords.length > 0) {
					console.log('Found an orphaned contract record, fixing database link...');
					contractRecord = orphanRecords[0];
					// Claim it by updating advance_id
					await supabase
						.from('events_contract')
						.update({ advance_id: event.advance_id })
						.eq('contract_id', contractRecord.contract_id);
				}
			}

			if (contractRecord) {
				let stateChanged = false;

				// Heal events_advance if contract_id is missing
				if (!event.contract_id || event.contract_id !== contractRecord.contract_id) {
					event.contract_id = contractRecord.contract_id;
					await supabase
						.from('events_advance')
						.update({ contract_id: contractRecord.contract_id })
						.eq('id', event.advance_id);
					stateChanged = true;
				}

				// Sync UI state
				if (
					event.gdrive_folder_id !== contractRecord.gdrive_folder_id ||
					event.original_contract_url !== contractRecord.original_contract_url ||
					event.redlined_contract_url !== contractRecord.redlined_contract_url ||
					event.signed_contract_url !== contractRecord.signed_contract_url
				) {
					event.gdrive_folder_id = contractRecord.gdrive_folder_id;
					event.gdrive_folder_url = contractRecord.gdrive_folder_url;
					event.original_contract_url = contractRecord.original_contract_url;
					event.redlined_contract_url = contractRecord.redlined_contract_url;
					event.signed_contract_url = contractRecord.signed_contract_url;
					event.contract = contractRecord.contract || event.contract;
					stateChanged = true;
				}

				if (stateChanged) {
					event = { ...event };
					if (progressBarRef) progressBarRef.recalculate();
				}
			}
		} catch (err) {
			console.error('Failed to sync contract data:', err);
		}
	}

	// Setup Realtime Subscriptions
	function setupRealtime() {
		if (!event || !event.event_id) return;
		
		if (realtimeChannel) supabase.removeChannel(realtimeChannel);

		realtimeChannel = supabase
			.channel(`advance-info-${event.event_id}-${event.artist_name}`)
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events_contract' }, (payload) => {
				const newRecord = payload.new;
				if (newRecord.contract_id === event.contract_id || newRecord.advance_id === event.advance_id) {
					event.gdrive_folder_id = newRecord.gdrive_folder_id;
					event.gdrive_folder_url = newRecord.gdrive_folder_url;
					event.original_contract_url = newRecord.original_contract_url;
					event.redlined_contract_url = newRecord.redlined_contract_url;
					event.signed_contract_url = newRecord.signed_contract_url;
					event.contract = newRecord.contract;
					event = { ...event };
					if (progressBarRef) progressBarRef.recalculate();
				}
			})
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events_advance' }, (payload) => {
				const newRecord = payload.new;
				if (newRecord.id === event.advance_id) {
					event.dos = newRecord.dos;
					event.main_contact = newRecord.main_contact;
					event.artist_type = newRecord.artist_type;
					event = { ...event };
					if (progressBarRef) progressBarRef.recalculate();
					dispatch('update', { event });
				}
			})
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `event_id=eq.${event.event_id}` }, (payload) => {
				const newRecord = payload.new;
				event.event_name = newRecord.event_name;
				event.event_date = newRecord.event_date;
				event.venue = newRecord.event_venue;
				event.event_status = newRecord.event_status;
				event.poster = newRecord.event_flyer;
				event = { ...event };
			})
			.subscribe();
	}

	onMount(() => {
		if (isLocalArtist) syncDosContactForLocal();
		syncContractData(); 
		setupRealtime();
		document.addEventListener('click', handleDosClickOutside, true);
		window.addEventListener('scroll', handleDosReposition, true);
		window.addEventListener('resize', handleDosReposition);
	});

	$: if (artistType === 'Local') syncDosContactForLocal();

	onDestroy(() => {
		if (realtimeChannel) supabase.removeChannel(realtimeChannel);
		document.removeEventListener('click', handleDosClickOutside, true);
		window.removeEventListener('scroll', handleDosReposition, true);
		window.removeEventListener('resize', handleDosReposition);
	});

	function handleFieldUpdate(updateEvent: CustomEvent) {
		const { column, value } = updateEvent.detail;
		(event as any)[column] = value;
		event = { ...event };
		if (progressBarRef) progressBarRef.recalculate();
		dispatch('update', { event });
		if (column === 'artist_type' && value === 'Local') syncDosContactForLocal();
	}

	// --- Artist Liaison (multi-select) ---
	async function toggleDosName(name: string) {
		if (isSavingDos || isLocalArtist) return;

		const next = dosNames.includes(name)
			? dosNames.filter((n) => n !== name)
			: [...dosNames, name];

		const value = formatDosValue(next);

		// Optimistic UI update — dispatch straight away so the advance sheet
		// re-renders with both names without needing a refresh.
		dosContact = value;
		event.dos = value;
		event = { ...event };
		if (progressBarRef) progressBarRef.recalculate();
		dispatch('update', { event });

		isSavingDos = true;
		try {
			await supabase
				.from('events_advance')
				.update({ dos: value })
				.eq('event_id', event.event_id)
				.eq('artist_name', event.artist_name);
			dispatch('update', { event });
		} catch (err) {
			console.error('Error updating artist liaison:', err);
		} finally {
			isSavingDos = false;
		}
	}

	// The info card uses overflow-hidden, so the menu is portaled to <body> and
	// positioned against the button to avoid being clipped or stacked under
	// neighbouring cards.
	function positionDosMenu() {
		if (!dosButtonEl) return;
		const rect = dosButtonEl.getBoundingClientRect();
		dosMenuPos = { top: rect.bottom + 4, left: rect.left };
	}

	function toggleDosDropdown() {
		if (!showDosDropdown) positionDosMenu();
		showDosDropdown = !showDosDropdown;
	}

	function handleDosClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (
			showDosDropdown &&
			!target.closest('.dos-dropdown-container') &&
			!target.closest('.dos-dropdown-menu')
		) {
			showDosDropdown = false;
		}
	}

	function handleDosReposition() {
		if (showDosDropdown) showDosDropdown = false;
	}

	function openLocalContactsModal() {
		showLocalContactsModal = true;
	}

	async function handleLocalContactSelect(contact: LocalContactLike) {
		// Phone is optional — a contact with only a name is still a valid pick.
		// Falls back to the DJ name when no first name is on file.
		const formattedContact = formatLocalContact(contact);
		mainContact = formattedContact;
		event.main_contact = formattedContact;
		event = { ...event };

		if (progressBarRef) progressBarRef.recalculate();

		try {
			await supabase
				.from('events_advance')
				.update({ main_contact: formattedContact })
				.eq('event_id', event.event_id)
				.eq('artist_name', event.artist_name);
			dispatch('update', { event });
			dispatch('contactChanged', { mainContact: formattedContact });
		} catch (err) {
			console.error('Error in handleLocalContactSelect:', err);
		}
	}

	// Google Drive Contract Workflow
	async function handleContractAction() {
		if (isProcessingContract) return;

		await ensureAdvanceId(); // Guarantee advance_id is present

		if (!hasFolder) {
			isProcessingContract = true;
			try {
				const res = await fetch('/api/gdrive', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'create',
						advanceId: event.advance_id,
						eventDate: event.event_date, 
						artistName: event.artist_name,
						venueName: event.venue
					})
				});
				const data = await res.json();
				
				if (data.success) {
					event.gdrive_folder_id = data.folderId;
					event.gdrive_folder_url = data.folderUrl;
					
					const contractRecord = await upsertEventContract({
						contract_id: event.contract_id || undefined,
						advance_id: event.advance_id!,
						event_id: event.event_id,
						gdrive_folder_id: data.folderId,
						gdrive_folder_url: data.folderUrl
					});

					if (contractRecord?.contract_id) {
						event.contract_id = contractRecord.contract_id;
						await supabase
							.from('events_advance')
							.update({ contract_id: contractRecord.contract_id })
							.eq('id', event.advance_id);
					}

					event = { ...event };
				} else {
					alert('Failed to create Google Drive folder.');
				}
			} catch (err) {
				console.error('Folder creation failed:', err);
			} finally {
				isProcessingContract = false;
			}
		} else if (!hasContractUrl) {
			showUploadModal = true;
		} else {
			showContractPreview = true;
		}
	}

	async function handleContractUpload(e: CustomEvent) {
		const { file, fileName } = e.detail;
		if (!file) return;

		isProcessingContract = true;
		showUploadModal = false;

		await ensureAdvanceId(); // Guarantee advance_id is present

		const reader = new FileReader();
		reader.onloadend = async () => {
			const base64Data = (reader.result as string).split(',')[1];
			try {
				const res = await fetch('/api/gdrive', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'upload',
						folderId: event.gdrive_folder_id,
						fileName: fileName,
						fileData: base64Data,
						mimeType: file.type
					})
				});
				const data = await res.json();

				if (data.success && data.fileUrl) {
					event.original_contract_url = data.fileUrl;
					event.contract = true;
					
					const contractRecord = await upsertEventContract({
						contract_id: event.contract_id || undefined,
						advance_id: event.advance_id!,
						event_id: event.event_id,
						gdrive_folder_id: event.gdrive_folder_id, 
						gdrive_folder_url: event.gdrive_folder_url, 
						original_contract_url: data.fileUrl,
						contract: true
					});

					if (contractRecord?.contract_id) {
						event.contract_id = contractRecord.contract_id;
						await supabase
							.from('events_advance')
							.update({ contract_id: contractRecord.contract_id })
							.eq('id', event.advance_id);
					}

					event = { ...event };
					if (progressBarRef) progressBarRef.recalculate();
					dispatch('update', { event });
				} else {
					alert('Upload failed.');
				}
			} catch (err) {
				console.error('Upload Error:', err);
			} finally {
				isProcessingContract = false;
			}
		};
		reader.readAsDataURL(file);
	}
</script>

<LocalContacts
	bind:show={showLocalContactsModal}
	onSelect={handleLocalContactSelect}
	currentSelectedContact={mainContact}
	on:close={() => (showLocalContactsModal = false)}
/>

<ContractPreviewModal
	bind:isOpen={showContractPreview}
	{event}
	on:close={() => (showContractPreview = false)}
/>

{#if showUploadModal}
	<div use:portal>
		<UploadModal
			bind:isOpen={showUploadModal}
			title="Upload Contract"
			acceptedTypes=".pdf"
			fileNameTemplate="{event.event_id}_Contract_{event.artist_name}_Original"
			allowRename={true}
			on:upload={handleContractUpload}
			on:close={() => (showUploadModal = false)}
			isUploading={isProcessingContract}
		/>
	</div>
{/if}

<div class="flex bg-navbar rounded-2xl w-[500px] h-[365px] overflow-hidden">
	<div class="relative w-[220px] flex-shrink-0 pt-4 px-4 pb-4">
		<div class="relative w-full h-[285px] rounded-md overflow-hidden">
			{#if imageUrl}
				<img src={imageUrl} alt={eventName} class="w-full h-full object-cover" />
			{:else}
				<div class="w-full h-full flex flex-col justify-center items-center text-center p-4 bg-gradient-to-br from-blue-900 to-green-800">
					<div class="text-lg font-bold text-lime mb-2">{displayEventName}</div>
					<div class="text-sm text-white">{artistName}</div>
				</div>
			{/if}
			{#if event.event_status}
				<div class="absolute top-2 right-2 px-2.5 py-1 rounded-full text-xs font-bold leading-none {event.event_status.toLowerCase() === 'live' ? 'bg-lime text-black' : 'bg-gray-600 text-white'}">
					{event.event_status.toUpperCase()}
				</div>
			{/if}
		</div>
		<div class="w-full h-9 mt-2 flex items-center justify-center">
			<div class="h-9 px-2 flex items-center justify-center rounded-lg bg-gray3 text-black font-bold text-sm w-full">
				{formattedDate}
			</div>
		</div>
	</div>

	<div class="flex-1 pt-4 px-4 pb-4 pr-6 flex flex-col gap-2 min-w-0">
		<div class="text-xl font-normal text-gray3 truncate pr-2">{displayEventName}</div>
		<div class="flex items-center gap-2 text-sm mb-1">
			<span class="text-lime font-normal truncate">{formattedDate}</span>
			<span class="text-gray3 font-normal">-</span>
			<span class="text-lime font-normal truncate">{venueName}</span>
		</div>
		<div class="w-full h-0 border-t border-gray1"></div>
		<div class="flex items-center gap-3">
			<span class="text-xl font-normal text-gray3 truncate">{artistName}</span>
			<DropdownButton
				bind:value={artistType}
				{event}
				options={artistTypeOptions}
				placeholder="Type"
				column="artist_type"
				on:fieldUpdate={handleFieldUpdate}
			/>
		</div>
		<div class="flex flex-col gap-2 mb-1">
			<div class="text-sm font-normal text-gray3">Progress</div>
			<div class="w-full pr-2">
				<ProgressBar
					bind:this={progressBarRef}
					{event}
					showLabel
					labelSize="text-xs"
					barHeight="h-1.5"
					maxWidth="max-w-full"
					labelColor="text-lime"
					barColor="bg-lime"
					trackColor="bg-gray2/40"
				/>
			</div>
		</div>
		<div class="w-full h-0 border-t border-gray1"></div>
		<div class="flex flex-col gap-2">
			<div class="flex items-center gap-1 text-sm mt-2">
				<span class="font-semibold min-w-[95px] text-gray3">Artist Liaison</span>
				{#if isLocalArtist}
					<div class="px-3 py-1.5 bg-gray1 text-gray-300 rounded-3xl text-xs font-medium truncate" style="max-width: 140px;">
						{dosDisplay === 'Select' ? 'Syncing...' : dosDisplay}
					</div>
				{:else}
					<div class="dos-dropdown-container relative">
						<button
							type="button"
							bind:this={dosButtonEl}
							on:click={toggleDosDropdown}
							title={dosNames.length ? dosNames.join(', ') : 'Select artist liaison(s)'}
							class="flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-3xl text-xs font-medium transition-all cursor-pointer
								{dosNames.length ? 'bg-lime text-black hover:bg-lime/80' : 'bg-gray1 text-gray-300 hover:bg-gray2 hover:text-black'}"
							style="max-width: 160px;"
						>
							<span class="truncate">{dosDisplay}</span>
							{#if dosNames.length > 1}
								<span class="flex-shrink-0 rounded-full bg-black/20 px-1.5 py-[1px] text-[10px] font-bold leading-none">
									{dosNames.length}
								</span>
							{/if}
							<svg
								class="w-3 h-3 flex-shrink-0 transition-transform {showDosDropdown ? 'rotate-180' : ''}"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M6 9l6 6 6-6" />
							</svg>
						</button>
					</div>

					{#if showDosDropdown}
						<div
							use:portal
							class="dos-dropdown-menu fixed z-[9999] w-[128px] overflow-hidden rounded-lg border border-lime bg-navbar shadow-2xl"
							style="top: {dosMenuPos.top}px; left: {dosMenuPos.left}px;"
						>
							{#each DOSConctactOptions as option}
								{@const selected = dosNames.includes(option)}
								<button
									type="button"
									on:click={() => toggleDosName(option)}
									class="flex w-full items-center gap-2 border-b border-gray1 px-2.5 py-1.5 text-left text-xs font-bold transition-colors last:border-b-0 cursor-pointer
										{selected ? 'bg-lime/15 text-lime' : 'text-white hover:bg-lime hover:text-black'}"
								>
									<span
										class="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[4px] border
											{selected ? 'border-lime bg-lime' : 'border-gray2'}"
									>
										{#if selected}
											<svg class="h-2.5 w-2.5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4">
												<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
											</svg>
										{/if}
									</span>
									<span class="truncate">{option}</span>
								</button>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
			<div class="flex items-center gap-1 text-sm">
				<span class="font-semibold min-w-[95px] text-gray3">Main Contact</span>
				{#if isLocalArtist}
					<button
						on:click={openLocalContactsModal}
						class="px-3 py-1.5 bg-gray1 text-gray-300 rounded-3xl text-xs hover:bg-gray2 hover:text-black transition-all truncate cursor-pointer"
						style="max-width: 140px;"
						title={mainContact}
					>
						{mainContactDisplay}
					</button>
				{:else}
					<InputButton
						bind:value={mainContact}
						{event}
						placeholder="Enter phone number"
						column="main_contact"
						maxWidth={140}
						on:fieldUpdate={handleFieldUpdate}
					/>
				{/if}
			</div>
			
			{#if !isLocalArtist}
				<div class="flex items-center gap-3 text-sm mt-3">
					<span class="font-semibold min-w-[50px] text-gray3 whitespace-nowrap">Contract</span>
					
					<button
						class="px-3 py-1.5 rounded-3xl text-xs font-bold transition-all flex items-center justify-center gap-2 w-full max-w-[150px]
							{isProcessingContract ? 'bg-gray1 text-gray3 cursor-not-allowed' :
							(!hasFolder ? 'bg-lime/20 text-lime hover:bg-lime/30 border border-lime/50 cursor-pointer' :
							(!hasContractUrl ? 'bg-problem/20 text-problem hover:bg-problem/30 border border-problem/50 cursor-pointer' :
							'bg-gray1 text-white hover:bg-lime/20 hover:text-lime cursor-pointer'))}"
						on:click={handleContractAction}
						disabled={isProcessingContract}
					>
						{#if isProcessingContract}
							<div class="w-3 h-3 border-2 border-gray3 border-t-white rounded-full animate-spin"></div>
							Processing...
						{:else}
							{#if !hasFolder}
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
							{:else if !hasContractUrl}
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
							{:else}
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
							{/if}
							{contractBtnText}
						{/if}
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>