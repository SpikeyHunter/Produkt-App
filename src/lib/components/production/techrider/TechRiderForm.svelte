<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { mount, unmount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import Modal from '$lib/components/modals/Modal.svelte';
	import TechRiderTemplate from './TechRiderTemplate.svelte';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';

	export let documentData: any;
	export let onSave: (data: any) => void;

	const dispatch = createEventDispatcher();

	// Ensure the information object exists so the form doesn't break
	$: if (documentData && !documentData.information) {
		documentData.information = {
			location: '',
			office: '',
			fax: '',
			email: '',
			website1: '',
			website2: ''
		};
	}

	let showNotif = false;
	let notifMessage = '';
	let notifIconType: 'success' | 'error' | 'warning' | 'info' | 'question' | 'login' | 'confirmed' =
		'success';

	// --- Save Logic ---
	let saveTimeout: any;
	function triggerSave() {
		clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			onSave(documentData);
		}, 2000); // Increased from 1000ms to 2000ms
	}

	// --- Download Logic ---
	let isDownloadModalOpen = false;
	let isDownloading = false;
	let hiddenPdfContainer: HTMLElement;

	async function executeDownload(theme: 'color' | 'bw') {
		isDownloading = true;

		try {
			// Svelte 5: Use mount() instead of new Component()
			const comp = mount(TechRiderTemplate, {
				target: hiddenPdfContainer,
				props: { documentData, theme }
			});

			// Wait for Svelte to mount the DOM
			await new Promise((resolve) => setTimeout(resolve, 150));
			const htmlContent = hiddenPdfContainer.innerHTML;

			// Svelte 5: Use unmount() instead of comp.$destroy()
			unmount(comp);
			hiddenPdfContainer.innerHTML = '';

			// Create dynamic filename: NCG_TECH-RIDER_<YYYY-MM-DD>
			let dateStr = new Date().toISOString().split('T')[0];
			if (documentData.last_updated_at) {
				try {
					const d = new Date(documentData.last_updated_at);
					if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
				} catch (e) {}
			}
			const filename = `NCG_TECH-RIDER_${dateStr}.pdf`;

			// Fetch the PDF from our new API endpoint
			const response = await fetch('/api/download-tech-rider', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					htmlContent,
					theme,
					secondaryLogoUrl: documentData.secondary_logo_url || null // Pass the secondary logo
				})
			});

			if (!response.ok) throw new Error('PDF generation failed');

			// Trigger local download
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);

			isDownloadModalOpen = false;
		} catch (error) {
			console.error('Error downloading PDF:', error);
			alert('An error occurred while generating the PDF.');
		} finally {
			isDownloading = false;
		}
	}

	// --- Update Tracking Logic ---
	// Track the official stamped state to disable the "Update Rider" button when no changes exist
	let stampedStateStr = JSON.stringify(documentData);

	$: currentDataStr = JSON.stringify(documentData);
	// Only turns true when the current working state differs from the last manual stamp
	$: hasChanges = currentDataStr !== stampedStateStr;

	// --- Update Rider Logic ---
	let isUpdateModalOpen = false;
	let isUpdatingStamp = false;

	async function handleUpdateRider() {
		isUpdatingStamp = true;

		try {
			// Get currently authenticated user
			const {
				data: { user }
			} = await supabase.auth.getUser();

			let firstName = '';
			let lastName = '';
			let email = user?.email || '';

			if (user) {
				const { data: profile } = await supabase
					.from('user_profiles')
					.select('first_name, last_name, email')
					.eq('id', user.id)
					.single();

				if (profile) {
					firstName = profile.first_name || '';
					lastName = profile.last_name || '';
					if (profile.email) email = profile.email;
				}
			}

			// Stamp the document data
			documentData.last_updated_by_name = `${firstName} ${lastName}`.trim() || 'Unknown User';
			documentData.last_updated_by_email = email;
			documentData.last_updated_at = new Date().toLocaleString('en-US', {
				dateStyle: 'medium',
				timeStyle: 'short'
			});

			// Helper to generate a PDF blob
			const generatePdfBlob = async (theme: 'color' | 'bw') => {
				const comp = mount(TechRiderTemplate, {
					target: hiddenPdfContainer,
					props: { documentData, theme }
				});

				// Wait for Svelte to mount the DOM
				await new Promise((resolve) => setTimeout(resolve, 150));
				const htmlContent = hiddenPdfContainer.innerHTML;

				unmount(comp);
				hiddenPdfContainer.innerHTML = ''; // Clean up

				const dateStr = new Date().toISOString().split('T')[0];
				// Format filename with _BW as requested
				const filename =
					theme === 'bw' ? `NCG_TECH-RIDER_${dateStr}_BW.pdf` : `NCG_TECH-RIDER_${dateStr}.pdf`;

				const pdfResponse = await fetch('/api/download-tech-rider', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						htmlContent,
						theme,
						secondaryLogoUrl: documentData.secondary_logo_url || null
					})
				});

				if (!pdfResponse.ok) throw new Error(`${theme} PDF generation failed`);

				return { blob: await pdfResponse.blob(), filename };
			};

			// Run sequentially to prevent race conditions on the hidden DOM container
			const colorData = await generatePdfBlob('color');
			const bwData = await generatePdfBlob('bw');

			// Bundle both files into a single payload
			const formData = new FormData();
			formData.append('files', colorData.blob, colorData.filename);
			formData.append('files', bwData.blob, bwData.filename);

			// Send the single request to the backend
			const syncRes = await fetch('/api/sync-drive-rider', { method: 'POST', body: formData });

			if (!syncRes.ok) {
				notifMessage = 'Database updated, but Drive sync failed.';
				notifIconType = 'warning';
			} else {
				notifMessage = 'Rider updated & both versions synced to Google Drive!';
				notifIconType = 'success';
			}
			showNotif = true;

			// Final Database Save
			documentData = documentData;
			triggerSave();
			stampedStateStr = JSON.stringify(documentData);
		} catch (error) {
			console.error('Error updating rider stamp:', error);
			notifMessage = 'An error occurred during update.';
			notifIconType = 'error';
			showNotif = true;
		} finally {
			isUpdatingStamp = false;
			isUpdateModalOpen = false;
		}
	}

	// --- Branding Logo Computations ---
	$: mainIsNoir = documentData?.main_logo_url
		? documentData.main_logo_url.toLowerCase().includes('noir') ||
			documentData.main_logo_url.toLowerCase().includes('black')
		: false;
	$: mainEffectiveNoir = documentData?.main_logo_inverted ? !mainIsNoir : mainIsNoir;
	$: mainBgColor = documentData?.main_logo_url
		? mainEffectiveNoir
			? 'bg-gray3'
			: 'bg-[#181818]'
		: 'bg-[#181818]';

	$: secIsNoir = documentData?.secondary_logo_url
		? documentData.secondary_logo_url.toLowerCase().includes('noir') ||
			documentData.secondary_logo_url.toLowerCase().includes('black')
		: false;
	$: secEffectiveNoir = documentData?.secondary_logo_inverted ? !secIsNoir : secIsNoir;
	$: secBgColor = documentData?.secondary_logo_url
		? secEffectiveNoir
			? 'bg-gray3'
			: 'bg-[#181818]'
		: 'bg-[#181818]';

	// --- File Upload State (Maps) ---
	let isUploadingMap = false;
	let dragOverSection: number | null = null;
	let uploadSectionIndex: number | null = null;

	async function uploadMapFile(file: File, sectionIndex: number) {
		if (!file || !file.type.startsWith('image/')) {
			alert('Please upload a valid image file.');
			return;
		}

		isUploadingMap = true;
		uploadSectionIndex = sectionIndex;

		const fileExt = file.name.split('.').pop();
		const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
		const filePath = `rider_map/${fileName}`;
		const { error: uploadError } = await supabase.storage
			.from('public-assets')
			.upload(filePath, file);

		if (uploadError) {
			console.error('Upload error:', uploadError);
			alert('Failed to upload image.');
			isUploadingMap = false;
			uploadSectionIndex = null;
			return;
		}

		const {
			data: { publicUrl }
		} = supabase.storage.from('public-assets').getPublicUrl(filePath);

		documentData.sections[sectionIndex].map_image_url = publicUrl;
		documentData = documentData;
		triggerSave();

		isUploadingMap = false;
		uploadSectionIndex = null;
	}

	function handleMapDrop(e: DragEvent, sectionIndex: number) {
		dragOverSection = null;
		if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
			uploadMapFile(e.dataTransfer.files[0], sectionIndex);
		}
	}

	function handleMapSelect(e: Event, sectionIndex: number) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			uploadMapFile(target.files[0], sectionIndex);
		}
	}

	async function removeMap(sectionIndex: number) {
		const mapUrl = documentData.sections[sectionIndex].map_image_url;
		if (mapUrl) {
			const urlParts = mapUrl.split('/');
			const fileName = urlParts[urlParts.length - 1];
			const filePath = `rider_map/${fileName}`;
			await supabase.storage.from('public-assets').remove([filePath]);
		}
		documentData.sections[sectionIndex].map_image_url = '';
		documentData = documentData;
		triggerSave();
	}

	// --- Logo Modal State & Functions ---
	let isLogoModalOpen = false;
	let isLoadingLogos = false;
	let logoTarget: 'main' | 'secondary' | null = null;
	let availableLogos: { name: string; url: string }[] = [];
	let invertedState: Record<string, boolean> = {};

	async function fetchLogos() {
		isLoadingLogos = true;
		const { data, error } = await supabase.storage.from('public-assets').list('calendar/logos', {
			limit: 100,
			offset: 0,
			sortBy: { column: 'name', order: 'asc' }
		});
		if (error) {
			console.error('Error fetching logos:', error);
		} else if (data) {
			availableLogos = data
				.filter((file) => file.name !== '.emptyFolderPlaceholder' && file.id)
				.map((file) => {
					const {
						data: { publicUrl }
					} = supabase.storage.from('public-assets').getPublicUrl(`calendar/logos/${file.name}`);
					return { name: file.name, url: publicUrl };
				});
		}
		isLoadingLogos = false;
	}

	function openLogoModal(target: 'main' | 'secondary') {
		logoTarget = target;
		isLogoModalOpen = true;
		if (availableLogos.length === 0) fetchLogos();
	}

	function selectLogo(url: string, inverted: boolean) {
		if (logoTarget === 'main') {
			documentData.main_logo_url = url;
			documentData.main_logo_inverted = inverted;
		} else if (logoTarget === 'secondary') {
			documentData.secondary_logo_url = url;
			documentData.secondary_logo_inverted = inverted;
		}
		documentData = documentData;
		triggerSave();
		isLogoModalOpen = false;
	}

	// --- Key-Value Functions ---
	function addKeyValueRow(sectionIndex: number) {
		if (!documentData.sections[sectionIndex].rows) documentData.sections[sectionIndex].rows = [];
		documentData.sections[sectionIndex].rows.push({ col1: '', col2: '' });
		documentData = documentData;
		triggerSave();
	}

	function removeKeyValueRow(sectionIndex: number, rowIndex: number) {
		documentData.sections[sectionIndex].rows.splice(rowIndex, 1);
		documentData = documentData;
		triggerSave();
	}

	// --- Equipment Tree Functions ---
	function addCategory(sectionIndex: number) {
		if (!documentData.sections[sectionIndex].categories)
			documentData.sections[sectionIndex].categories = [];
		documentData.sections[sectionIndex].categories.push({
			name: 'New Category',
			items: [],
			notes: ''
		});
		documentData = documentData;
		triggerSave();
	}

	// --- Delete Confirmation State ---
	let isDeleteModalOpen = false;
	let pendingDelete: {
		type: 'section' | 'category';
		sectionIndex: number;
		catIndex?: number;
	} | null = null;

	function removeCategory(sectionIndex: number, catIndex: number) {
		pendingDelete = { type: 'category', sectionIndex, catIndex };
		isDeleteModalOpen = true;
	}

	function removeSection(sectionIndex: number) {
		pendingDelete = { type: 'section', sectionIndex };
		isDeleteModalOpen = true;
	}

	function confirmDelete() {
		if (!pendingDelete) return;

		if (pendingDelete.type === 'section') {
			documentData.sections.splice(pendingDelete.sectionIndex, 1);
		} else if (pendingDelete.type === 'category') {
			documentData.sections[pendingDelete.sectionIndex].categories.splice(
				pendingDelete.catIndex!,
				1
			);
		}

		documentData = documentData;
		triggerSave();
		isDeleteModalOpen = false;
		pendingDelete = null;
	}

	function addEquipmentItem(sectionIndex: number, catIndex: number, isDimension: boolean = false) {
		const newItem: any = {
			name: '',
			sub_items: []
		};

		if (isDimension) {
			newItem.isDimension = true;
			newItem.dimension = '';
		}

		documentData.sections[sectionIndex].categories[catIndex].items.push(newItem);
		documentData = documentData;
		triggerSave();
	}

	function removeEquipmentItem(sectionIndex: number, catIndex: number, itemIndex: number) {
		documentData.sections[sectionIndex].categories[catIndex].items.splice(itemIndex, 1);
		documentData = documentData;
		triggerSave();
	}

	function addSubItem(sectionIndex: number, catIndex: number, itemIndex: number) {
		if (!documentData.sections[sectionIndex].categories[catIndex].items[itemIndex].sub_items) {
			documentData.sections[sectionIndex].categories[catIndex].items[itemIndex].sub_items = [];
		}
		documentData.sections[sectionIndex].categories[catIndex].items[itemIndex].sub_items.push('');
		documentData = documentData;
		triggerSave();
	}

	function removeSubItem(
		sectionIndex: number,
		catIndex: number,
		itemIndex: number,
		subItemIndex: number
	) {
		documentData.sections[sectionIndex].categories[catIndex].items[itemIndex].sub_items.splice(
			subItemIndex,
			1
		);
		documentData = documentData;
		triggerSave();
	}

	// --- Global Section Functions ---
	function addCustomSection() {
		documentData.sections.push({
			id: `custom_${Date.now()}`,
			title: 'NEW CUSTOM SECTION',
			type: 'equipment_tree',
			categories: []
		});
		documentData = documentData;
		triggerSave();
	}

	// --- Capacity / Rooms Functions ---
	// --- Capacity / Rooms Functions ---
	function addRoom(sectionIndex: number) {
		if (!documentData.sections[sectionIndex].rooms) documentData.sections[sectionIndex].rooms = [];
		documentData.sections[sectionIndex].rooms.push({
			name: 'New Room',
			rows: [{ type: '', quantity: '' }]
		});
		documentData = documentData;
		triggerSave();
	}

	function removeRoom(sectionIndex: number, roomIndex: number) {
		documentData.sections[sectionIndex].rooms.splice(roomIndex, 1);
		documentData = documentData;
		triggerSave();
	}

	function addRoomRow(sectionIndex: number, roomIndex: number) {
		if (!documentData.sections[sectionIndex].rooms[roomIndex].rows) {
			documentData.sections[sectionIndex].rooms[roomIndex].rows = [];
		}
		documentData.sections[sectionIndex].rooms[roomIndex].rows.push({ type: '', quantity: '' });
		documentData = documentData;
		triggerSave();
	}

	function removeRoomRow(sectionIndex: number, roomIndex: number, rowIndex: number) {
		documentData.sections[sectionIndex].rooms[roomIndex].rows.splice(rowIndex, 1);
		documentData = documentData;
		triggerSave();
	}
</script>

<header class="flex justify-between items-end pb-8 rounded-full shrink-0">
	<div>
		<h1 class="text-[36px] font-bold text-white leading-tight">Technical Rider Builder</h1>
		<p class="text-xs font-semibold text-gray2 mt-1">
			Update New City Gas technical specifications
		</p>
	</div>

	<div class="flex items-center gap-3">
		<button
			on:click={() => (isDownloadModalOpen = true)}
			class="bg-gray1 text-white hover:bg-gray2 hover:text-black border border-gray2 text-sm font-bold px-5 py-2.5 rounded-3xl transition-colors shadow-md cursor-pointer flex items-center gap-2"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-4 w-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
				/></svg
			>
			Download PDF
		</button>

		<button
			on:click={() => (isUpdateModalOpen = true)}
			disabled={!hasChanges}
			class="bg-gray3 text-black hover:bg-lime text-sm font-bold px-5 py-2.5 rounded-3xl transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray3 {hasChanges
				? 'cursor-pointer'
				: ''}"
		>
			Update Rider
		</button>
	</div>
</header>

<div class="flex-1 overflow-y-auto custom-scrollbar space-y-8">
	{#if documentData?.information}
		<div class="space-y-4">
			<input
				type="text"
				value="INFORMATION"
				disabled
				class="text-xl font-bold text-lime uppercase bg-transparent border-none outline-none w-full pb-1 focus:ring-0 px-0 cursor-default"
			/>

			<div class="bg-navbar p-6 rounded-3xl space-y-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div>
						<label
							for="info-location"
							class="block text-[12px] font-bold text-gray2 mb-1.5 uppercase tracking-wider pl-2"
							>Location</label
						>
						<input
							id="info-location"
							type="text"
							bind:value={documentData.information.location}
							on:input={triggerSave}
							class="w-full bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white placeholder:text-gray2/50 focus:outline-none focus:border-lime transition-colors"
							placeholder="e.g., New City Gas"
						/>
					</div>
					<div>
						<label
							for="info-email"
							class="block text-[12px] font-bold text-gray2 mb-1.5 uppercase tracking-wider pl-2"
							>Email</label
						>
						<input
							id="info-email"
							type="email"
							bind:value={documentData.information.email}
							on:input={triggerSave}
							class="w-full bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white placeholder:text-gray2/50 focus:outline-none focus:border-lime transition-colors"
							placeholder="e.g., info@newcitygas.com"
						/>
					</div>
					<div>
						<label
							for="info-office"
							class="block text-[12px] font-bold text-gray2 mb-1.5 uppercase tracking-wider pl-2"
							>Office</label
						>
						<input
							id="info-office"
							type="text"
							bind:value={documentData.information.office}
							on:input={triggerSave}
							class="w-full bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white placeholder:text-gray2/50 focus:outline-none focus:border-lime transition-colors"
							placeholder="e.g., 514-879-1166"
						/>
					</div>
					<div>
						<label
							for="info-fax"
							class="block text-[12px] font-bold text-gray2 mb-1.5 uppercase tracking-wider pl-2"
							>Fax</label
						>
						<input
							id="info-fax"
							type="text"
							bind:value={documentData.information.fax}
							on:input={triggerSave}
							class="w-full bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white placeholder:text-gray2/50 focus:outline-none focus:border-lime transition-colors"
							placeholder="e.g., 514-879-1935"
						/>
					</div>
					<div>
						<label
							for="info-website1"
							class="block text-[12px] font-bold text-gray2 mb-1.5 uppercase tracking-wider pl-2"
							>Website 1</label
						>
						<input
							id="info-website1"
							type="url"
							bind:value={documentData.information.website1}
							on:input={triggerSave}
							class="w-full bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white placeholder:text-gray2/50 focus:outline-none focus:border-lime transition-colors"
							placeholder="e.g., www.newcitygas.com"
						/>
					</div>
					<div>
						<label
							for="info-website2"
							class="block text-[12px] font-bold text-gray2 mb-1.5 uppercase tracking-wider pl-2"
							>Website 2 (Optional)</label
						>
						<input
							id="info-website2"
							type="url"
							bind:value={documentData.information.website2}
							on:input={triggerSave}
							class="w-full bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white placeholder:text-gray2/50 focus:outline-none focus:border-lime transition-colors"
							placeholder="e.g., www.produkt.ca"
						/>
					</div>
				</div>

				{#if documentData.last_updated_at}
					<div class="border-t border-gray1 pt-4 px-2">
						<p class="text-[13px] text-gray2 font-semibold">
							Updated last by: <span class="text-lime"
								>{documentData.last_updated_by_name} ({documentData.last_updated_by_email})</span
							>
							on {documentData.last_updated_at}
						</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="space-y-4">
		<input
			type="text"
			value="BRANDING"
			disabled
			class="text-xl font-bold text-lime uppercase bg-transparent border-none outline-none w-full pb-1 focus:ring-0 px-0 cursor-default"
		/>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-navbar p-6 rounded-3xl">
			<div class="flex flex-col gap-3 bg-gray1 p-4 rounded-3xl border border-transparent">
				<button
					on:click={() => openLogoModal('main')}
					class="bg-navbar text-white text-sm font-bold px-5 py-3 rounded-2xl border-2 border-gray1 hover:bg-lime hover:text-black transition-colors hover:cursor-pointer w-full text-center"
				>
					Select Venue Logo
				</button>
				<div
					class="w-full flex justify-center items-center h-28 rounded-2xl p-4 transition-colors {mainBgColor} border border-black/10"
				>
					{#if documentData?.main_logo_url}
						<img
							src={documentData.main_logo_url}
							alt="Main Logo"
							class="max-h-full max-w-full object-contain drop-shadow-sm"
							style={documentData.main_logo_inverted ? 'filter: invert(1);' : ''}
						/>
					{:else}
						<span class="text-xs text-gray2 font-bold opacity-50">No logo selected</span>
					{/if}
				</div>
			</div>

			<div class="flex flex-col gap-3 bg-gray1 p-4 rounded-3xl border border-transparent">
				<button
					on:click={() => openLogoModal('secondary')}
					class="bg-navbar text-white text-sm font-bold px-5 py-3 rounded-2xl border border-gray1 hover:bg-lime hover:text-black transition-colors hover:cursor-pointer w-full text-center"
				>
					Select Promoter Logo
				</button>
				<div
					class="w-full flex justify-center items-center h-28 rounded-2xl p-4 transition-colors {secBgColor} border border-black/10"
				>
					{#if documentData?.secondary_logo_url}
						<img
							src={documentData.secondary_logo_url}
							alt="Secondary Logo"
							class="max-h-full max-w-full object-contain drop-shadow-sm"
							style={documentData.secondary_logo_inverted ? 'filter: invert(1);' : ''}
						/>
					{:else}
						<span class="text-xs text-gray2 font-bold opacity-50">No logo selected</span>
					{/if}
				</div>
			</div>
		</div>
	</div>

	{#if documentData?.sections}
		{#each documentData.sections as section, sIdx}
			<div class="space-y-4">
				<div class="flex justify-between items-center w-full">
					<input
						type="text"
						bind:value={section.title}
						on:input={triggerSave}
						class="text-xl font-bold text-lime uppercase bg-transparent border-none outline-none flex-1 pb-1 transition-colors placeholder:text-lime/50 focus:ring-0 px-0 hover:cursor-pointer focus:cursor-text"
						placeholder="SECTION TITLE"
					/>

					{#if section.id && section.id.startsWith('custom_')}
						<button
							on:click={() => removeSection(sIdx)}
							class="text-red-500 hover:text-red-400 hover:bg-red-500/10 font-bold px-3 py-1.5 rounded-3xl transition-colors text-xs border-2 border-transparent hover:border-red-500 cursor-pointer flex items-center gap-1"
							title="Delete this custom section"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/></svg
							>
						</button>
					{/if}
				</div>

				{#if section.type === 'direction_map'}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6 bg-navbar p-6 rounded-3xl">
						<div class="space-y-5">
							<div>
								<label
									for="main_entrance_{sIdx}"
									class="block text-[12px] font-bold text-gray2 mb-1.5 uppercase tracking-wider pl-2"
									>Main Entrance</label
								>
								<input
									id="main_entrance_{sIdx}"
									type="text"
									bind:value={section.main_entrance}
									on:input={triggerSave}
									class="w-full bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-lime transition-colors"
								/>
							</div>
							<div>
								<label
									for="artist_entrance_{sIdx}"
									class="block text-[12px] font-bold text-gray2 mb-1.5 uppercase tracking-wider pl-2"
									>Artist Entrance</label
								>
								<input
									id="artist_entrance_{sIdx}"
									type="text"
									bind:value={section.artist_entrance}
									on:input={triggerSave}
									class="w-full bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-lime transition-colors"
								/>
							</div>
						</div>

						<div
							class="border-2 border-gray1 hover:border-lime rounded-3xl flex items-center justify-center text-sm font-semibold text-gray2 transition-all relative overflow-hidden bg-gray1 min-h-[160px]"
							class:border-lime={dragOverSection === sIdx}
							class:text-white={dragOverSection === sIdx}
							on:dragover|preventDefault={() => (dragOverSection = sIdx)}
							on:dragleave|preventDefault={() => (dragOverSection = null)}
							on:drop|preventDefault={(e) => handleMapDrop(e, sIdx)}
							role="region"
							aria-label="Map image dropzone"
						>
							{#if isUploadingMap && uploadSectionIndex === sIdx}
								<div
									class="animate-spin w-8 h-8 border-4 border-lime border-t-transparent rounded-full"
								></div>
							{:else if section.map_image_url}
								<img
									src={section.map_image_url}
									alt="Map preview"
									class="absolute inset-0 w-full h-full object-cover opacity-80"
								/>
								<button
									on:click={() => removeMap(sIdx)}
									class="absolute top-3 right-3 bg-gray3 text-black rounded-full w-8 h-8 flex items-center justify-center font-bold z-10 hover:bg-lime transition-colors shadow-lg cursor-pointer"
									>✕</button
								>
							{:else}
								<label
									class="absolute inset-0 flex items-center justify-center hover:cursor-pointer hover:text-lime hover:border-lime w-full h-full cursor-pointer transition-colors p-6 text-center"
								>
									<span>+ Upload / Drag & Drop Map Image</span>
									<input
										type="file"
										accept="image/*"
										class="hidden"
										on:change={(e) => handleMapSelect(e, sIdx)}
									/>
								</label>
							{/if}
						</div>
					</div>
				{:else if section.id === 'capacity' || section.title.toUpperCase() === 'CAPACITY'}
					<div class="bg-navbar p-6 rounded-3xl space-y-6">
						{#each section.rooms || [] as room, rIdx}
							<div class="bg-gray1/30 rounded-3xl p-5 relative group border border-gray1">
								<button
									on:click={() => removeRoom(sIdx, rIdx)}
									class="absolute top-5 right-5 text-red-500 hover:text-red-400 font-bold text-lg opacity-0 group-hover:opacity-100 transition-opacity hover:cursor-pointer"
									>×</button
								>

								<input
									type="text"
									bind:value={room.name}
									on:input={triggerSave}
									class="placeholder:text-gray2/50 text-sm font-bold text-white mb-4 uppercase bg-transparent border-none p-0 focus:ring-0 w-[90%] hover:cursor-pointer focus:cursor-text pl-2"
									placeholder="Room Name"
								/>

								<div class="space-y-3 mb-4">
									<div class="grid grid-cols-[1fr_1fr_auto] gap-4 mb-1 pl-2">
										<div class="text-[12px] font-bold text-gray2 uppercase tracking-wider">
											Type
										</div>
										<div class="text-[12px] font-bold text-gray2 uppercase tracking-wider">
											Quantity
										</div>
										<div class="w-6"></div>
									</div>

									{#each room.rows || [] as row, rowIdx}
										<div class="grid grid-cols-[1fr_1fr_auto] gap-4 items-center pl-2">
											<input
												type="text"
												bind:value={row.type}
												on:input={triggerSave}
												placeholder="e.g. Standing"
												class="placeholder:text-gray2/50 bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-lime transition-colors"
											/>
											<input
												type="text"
												bind:value={row.quantity}
												on:input={triggerSave}
												placeholder="e.g. 500"
												class="placeholder:text-gray2/50 bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-lime transition-colors"
											/>
											<button
												on:click={() => removeRoomRow(sIdx, rIdx, rowIdx)}
												class="text-red-500 hover:text-red-400 font-bold px-2 py-1 text-lg flex items-center justify-center transition-colors hover:cursor-pointer"
												>×</button
											>
										</div>
									{/each}
									<button
										on:click={() => addRoomRow(sIdx, rIdx)}
										class="text-xs font-bold text-lime pl-4 hover:opacity-80 transition-opacity mt-2 hover:cursor-pointer"
										>+ Add Line</button
									>
								</div>
							</div>
						{/each}
						<div class="w-full flex justify-center mt-2">
							<button
								on:click={() => addRoom(sIdx)}
								class="w-[200px] py-3 bg-gray1 text-gray3 text-sm font-bold rounded-3xl transition-all hover:bg-lime hover:text-black hover:cursor-pointer"
								>+ Add Room</button
							>
						</div>
					</div>
				{:else if section.type === 'key_value'}
					<div class="bg-navbar p-6 rounded-3xl space-y-3">
						<div class="grid grid-cols-[1fr_1fr_auto] gap-4 mb-1 pl-3">
							{#each section.columns as colName}
								<div class="text-[12px] font-bold text-gray2 uppercase tracking-wider">
									{colName}
								</div>
							{/each}
							<div class="w-6"></div>
						</div>
						<div class="space-y-3">
							{#each section.rows as row, rIdx}
								<div class="grid grid-cols-[1fr_1fr_auto] gap-4 items-center">
									<input
										type="text"
										bind:value={row.col1}
										on:input={triggerSave}
										placeholder="Enter type/name"
										class="placeholder:text-gray2/50 bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-lime transition-colors"
									/>
									<input
										type="text"
										bind:value={row.col2}
										on:input={triggerSave}
										placeholder="Enter quantity/dimensions"
										class="placeholder:text-gray2/50 bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-lime transition-colors"
									/>
									<button
										on:click={() => removeKeyValueRow(sIdx, rIdx)}
										class="text-red-500 hover:text-red-400 font-bold px-2 py-1 text-lg flex items-center justify-center transition-colors hover:cursor-pointer"
										>×</button
									>
								</div>
							{/each}
						</div>
						<button
							on:click={() => addKeyValueRow(sIdx)}
							class="text-xs font-bold text-lime mt-4 ml-2 hover:opacity-80 transition-opacity hover:cursor-pointer"
							>+ Add Line</button
						>

						{#if section.id === 'stage' || section.title.toUpperCase() === 'STAGE'}
							<div class="mt-8 border-t border-gray1 pt-6 space-y-6">
								{#each section.categories || [] as category, cIdx}
									<div class="bg-gray1/30 rounded-3xl p-5 relative group border border-gray1">
										<button
											on:click={() => removeCategory(sIdx, cIdx)}
											class="absolute top-5 right-5 text-red-500 hover:text-red-400 font-bold text-lg opacity-0 group-hover:opacity-100 transition-opacity hover:cursor-pointer"
											>×</button
										>

										<input
											type="text"
											bind:value={category.name}
											on:input={triggerSave}
											class="placeholder:text-gray2/50 text-sm font-bold text-white mb-4 uppercase bg-transparent border-none p-0 focus:ring-0 w-[90%] hover:cursor-pointer focus:cursor-text pl-2"
											placeholder="Subsection Name"
										/>

										<div class="space-y-3 mb-6">
											{#if category.items.some((item: any) => item.isDimension || item.dimension !== undefined)}
												<div class="grid grid-cols-[1fr_1fr_auto] gap-3 pl-2 pr-8 mb-1">
													<div class="text-[12px] font-bold text-gray2 uppercase tracking-wider">
														Name / Type
													</div>
													<div class="text-[12px] font-bold text-gray2 uppercase tracking-wider">
														Dimension
													</div>
												</div>
											{/if}

											{#each category.items as item, iIdx}
												<div class="flex items-center gap-3 pl-2">
													<input
														type="text"
														bind:value={item.name}
														on:input={triggerSave}
														class="flex-1 bg-gray1 border border-transparent rounded-3xl px-4 py-2 text-sm text-white placeholder:text-gray2/50 focus:outline-none focus:border-lime transition-colors"
														placeholder={item.isDimension ? 'e.g., Trim Height' : 'Item Name'}
													/>

													{#if item.isDimension || item.dimension !== undefined}
														<input
															type="text"
															bind:value={item.dimension}
															on:input={triggerSave}
															class="flex-1 bg-gray1 border border-transparent rounded-3xl px-4 py-2 text-sm text-white placeholder:text-gray2/50 focus:outline-none focus:border-lime transition-colors"
															placeholder="e.g., 30ft"
														/>
													{/if}

													<button
														on:click={() => removeEquipmentItem(sIdx, cIdx, iIdx)}
														class="text-red-500 hover:text-red-400 font-bold px-2 hover:cursor-pointer"
														>×</button
													>
												</div>
											{/each}

											<div class="flex gap-4 pl-4 mt-2">
												<button
													on:click={() => addEquipmentItem(sIdx, cIdx, true)}
													class="text-xs font-bold text-lime hover:opacity-80 transition-opacity hover:cursor-pointer"
												>
													+ Add Dimension
												</button>

												<button
													on:click={() => addEquipmentItem(sIdx, cIdx, false)}
													class="text-xs font-bold text-lime hover:opacity-80 transition-opacity hover:cursor-pointer"
												>
													+ Add Line
												</button>
											</div>
										</div>

										<div class="border-t border-gray1/50 pt-4">
											<label
												for="stage_notes_{sIdx}_{cIdx}"
												class="block text-sm font-bold text-gray2 mb-2 uppercase tracking-wider pl-2"
												>Subsection Notes</label
											>
											<textarea
												id="stage_notes_{sIdx}_{cIdx}"
												bind:value={category.notes}
												on:input={triggerSave}
												class="placeholder:text-gray2/50 w-full bg-gray1 border border-transparent rounded-3xl px-4 py-3 text-sm text-white focus:outline-none focus:border-lime transition-colors min-h-[80px]"
												placeholder="Add any notes specifically for this here"
											></textarea>
										</div>
									</div>
								{/each}
								<div class="w-full flex justify-center">
									<button
										on:click={() => addCategory(sIdx)}
										class="w-[200px] py-3 bg-gray1 text-gray3 text-sm font-bold rounded-3xl transition-all hover:bg-lime hover:text-black hover:cursor-pointer"
										>+ Add Subsection</button
									>
								</div>
							</div>
						{/if}
					</div>
				{:else if section.type === 'equipment_tree'}
					<div class="space-y-6">
						{#each section.categories || [] as category, cIdx}
							<div class="bg-navbar rounded-3xl p-6 relative group">
								<button
									on:click={() => removeCategory(sIdx, cIdx)}
									class="absolute top-6 right-6 text-red-500 hover:text-red-400 font-bold text-lg opacity-0 group-hover:opacity-100 transition-opacity hover:cursor-pointer"
									>×</button
								>
								<input
									type="text"
									bind:value={category.name}
									on:input={triggerSave}
									class="text-sm font-bold text-white mb-5 uppercase bg-transparent border-none p-0 focus:ring-0 w-[90%] hover:cursor-pointer focus:cursor-text pl-2"
									placeholder="CATEGORY NAME"
								/>
								<div class="space-y-4">
									{#each category.items as item, iIdx}
										<div class="space-y-3 pl-4 border-l-2 border-gray1 relative group/item">
											<div class="flex items-center gap-3">
												<input
													type="text"
													bind:value={item.name}
													on:input={triggerSave}
													class="placeholder:text-gray2/50 flex-1 bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-lime transition-colors"
													placeholder="Item Name"
												/>
												<button
													on:click={() => addSubItem(sIdx, cIdx, iIdx)}
													class="text-xs font-bold text-gray2 hover:text-lime whitespace-nowrap px-2 hover:cursor-pointer"
													>+ Sub-item</button
												>
												<button
													on:click={() => removeEquipmentItem(sIdx, cIdx, iIdx)}
													class="text-red-500 hover:text-red-400 font-bold px-2 opacity-0 group-hover/item:opacity-100 transition-opacity hover:cursor-pointer"
													>×</button
												>
											</div>
											{#if item.sub_items && item.sub_items.length > 0}
												<div class="pl-6 space-y-3">
													{#each item.sub_items as subItem, siIdx}
														<div class="flex items-center gap-2">
															<span class="text-gray2 text-xs font-bold">↳</span>
															<input
																type="text"
																bind:value={item.sub_items[siIdx]}
																on:input={triggerSave}
																class="placeholder:text-gray2/50 flex-1 bg-gray1 border border-transparent rounded-3xl px-4 py-2 text-xs text-white focus:text-white focus:outline-none focus:border-lime transition-colors"
																placeholder="Sub-item details"
															/>
															<button
																on:click={() => removeSubItem(sIdx, cIdx, iIdx, siIdx)}
																class="text-red-500 hover:text-red-400 text-sm font-bold px-2 hover:cursor-pointer"
																>×</button
															>
														</div>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
									<button
										on:click={() => addEquipmentItem(sIdx, cIdx, false)}
										class="text-xs font-bold text-lime pl-4 hover:opacity-80 transition-opacity mt-2 hover:cursor-pointer"
										>+ Add Item</button
									>
								</div>
								{#if category.notes !== undefined}
									<div class="mt-8 border-t border-gray1 pt-6">
										<label
											for="notes_{sIdx}_{cIdx}"
											class="block text-sm font-bold text-gray2 mb-2 uppercase tracking-wider pl-2"
											>Notes</label
										>
										<textarea
											id="notes_{sIdx}_{cIdx}"
											bind:value={category.notes}
											on:input={triggerSave}
											class="placeholder:text-gray2/50 w-full bg-gray1 border border-transparent rounded-3xl px-4 py-3 text-sm text-white focus:outline-none focus:border-lime transition-colors min-h-[80px]"
											placeholder="Add any specific notes here"
										></textarea>
									</div>
								{/if}
							</div>
						{/each}
						<div class="w-full flex justify-center">
							<button
								on:click={() => addCategory(sIdx)}
								class="w-[250px] py-4 bg-navbar text-gray3 text-sm font-bold rounded-3xl transition-all hover:bg-lime hover:text-black hover:cursor-pointer"
							>
								+ Add Category
							</button>
						</div>
					</div>
				{:else if section.type === 'text_content'}
					<div class="bg-navbar p-6 rounded-3xl">
						<p class="mb-4 text-xs text-gray2">INFORMATION</p>
						<textarea
							bind:value={section.text_content}
							on:input={triggerSave}
							class="w-full bg-gray1 border border-transparent rounded-3xl px-5 py-4 text-sm text-white placeholder:text-gray2/50 focus:outline-none focus:border-lime transition-colors min-h-[160px]"
							placeholder="Enter details here (Press Enter for new lines)"
						></textarea>
					</div>
				{:else if section.id === 'capacity' || section.title.toUpperCase() === 'CAPACITY'}
					<div class="bg-navbar p-6 rounded-3xl space-y-6">
						{#each section.rooms || [] as room, rIdx}
							<div class="bg-gray1/30 rounded-3xl p-5 relative group border border-gray1">
								<button
									on:click={() => removeRoom(sIdx, rIdx)}
									class="absolute top-5 right-5 text-red-500 hover:text-red-400 font-bold text-lg opacity-0 group-hover:opacity-100 transition-opacity hover:cursor-pointer"
									>×</button
								>

								<input
									type="text"
									bind:value={room.name}
									on:input={triggerSave}
									class="placeholder:text-gray2/50 text-sm font-bold text-white mb-4 uppercase bg-transparent border-none p-0 focus:ring-0 w-[90%] hover:cursor-pointer focus:cursor-text pl-2"
									placeholder="Room Name"
								/>

								<div class="space-y-3 mb-4">
									<div class="grid grid-cols-[1fr_1fr_auto] gap-4 mb-1 pl-2">
										<div class="text-[12px] font-bold text-gray2 uppercase tracking-wider">
											Type
										</div>
										<div class="text-[12px] font-bold text-gray2 uppercase tracking-wider">
											Quantity
										</div>
										<div class="w-6"></div>
									</div>

									{#each room.rows || [] as row, rowIdx}
										<div class="grid grid-cols-[1fr_1fr_auto] gap-4 items-center pl-2">
											<input
												type="text"
												bind:value={row.type}
												on:input={triggerSave}
												placeholder="e.g. Standing"
												class="bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-lime transition-colors"
											/>
											<input
												type="text"
												bind:value={row.quantity}
												on:input={triggerSave}
												placeholder="e.g. 500"
												class="bg-gray1 border border-transparent rounded-3xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-lime transition-colors"
											/>
											<button
												on:click={() => removeRoomRow(sIdx, rIdx, rowIdx)}
												class="text-red-500 hover:text-red-400 font-bold px-2 py-1 text-lg flex items-center justify-center transition-colors hover:cursor-pointer"
												>×</button
											>
										</div>
									{/each}
									<button
										on:click={() => addRoomRow(sIdx, rIdx)}
										class="text-xs font-bold text-lime pl-4 hover:opacity-80 transition-opacity mt-2 hover:cursor-pointer"
										>+ Add Line</button
									>
								</div>
							</div>
						{/each}
						<div class="w-full flex justify-center mt-6">
							<button
								on:click={() => addRoom(sIdx)}
								class="w-[200px] py-3 bg-gray1 text-gray3 text-sm font-bold rounded-3xl transition-all hover:bg-lime hover:text-black hover:cursor-pointer"
								>+ Add Room</button
							>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	{/if}

	<div class="pt-4 w-full flex justify-center">
		<button
			on:click={addCustomSection}
			class="w-[300px] py-4 bg-navbar/50 text-gray3 text-md font-bold rounded-3xl transition-all hover:bg-lime hover:text-black hover:cursor-pointer"
		>
			+ Add New Custom Section
		</button>
	</div>
</div>

<Modal
	bind:isOpen={isUpdateModalOpen}
	on:close={() => (isUpdateModalOpen = false)}
	title="Update Rider"
	maxWidth="max-w-md"
>
	<div class="p-2 text-center">
		<p class="text-gray2 text-sm mb-8">
			Are you sure you want to officially stamp and update this Technical Rider?
		</p>

		<div class="flex gap-4 justify-center">
			<button
				on:click={() => (isUpdateModalOpen = false)}
				class="px-6 py-3 rounded-3xl bg-gray1 text-white hover:bg-navbar border border-gray2 transition-colors font-bold text-sm cursor-pointer"
			>
				Cancel
			</button>
			<button
				on:click={handleUpdateRider}
				disabled={isUpdatingStamp}
				class="px-6 py-3 rounded-3xl bg-lime text-black hover:opacity-90 transition-opacity font-bold text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
			>
				{#if isUpdatingStamp}
					<div
						class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"
					></div>
					Saving...
				{:else}
					Confirm Update
				{/if}
			</button>
		</div>
	</div>
</Modal>

<Modal
	bind:isOpen={isLogoModalOpen}
	on:close={() => (isLogoModalOpen = false)}
	title="Select Logo"
	maxWidth="max-w-4xl"
>
	<div class="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
		{#if isLoadingLogos}
			<div class="flex items-center justify-center p-12">
				<div
					class="animate-spin w-10 h-10 border-4 border-lime border-t-transparent rounded-full"
				></div>
			</div>
		{:else if availableLogos.length === 0}
			<div class="text-center text-gray2 p-10 font-bold">
				No logos found in calendar/logos/ bucket.
			</div>
		{:else}
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-6">
				{#each availableLogos as logo, i}
					{@const baseIsNoir =
						logo.name.toLowerCase().includes('noir') || logo.name.toLowerCase().includes('black')}
					{@const effectiveIsNoir = invertedState[logo.url] ? !baseIsNoir : baseIsNoir}
					{@const bgColor = effectiveIsNoir ? 'bg-gray3' : 'bg-gray1'}
					{@const textColor = effectiveIsNoir ? 'text-black' : 'text-white'}

					<div
						class="flex flex-col items-center p-4 border border-gray1 rounded-2xl {bgColor} hover:border-lime transition-all group"
					>
						<button
							type="button"
							on:click={() => selectLogo(logo.url, invertedState[logo.url] || false)}
							class="w-full h-24 flex items-center justify-center rounded-xl p-2 relative cursor-pointer outline-none focus:ring-2 focus:ring-lime"
						>
							<img
								src={logo.url}
								alt={logo.name}
								class="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
								style={invertedState[logo.url] ? 'filter: invert(1);' : ''}
							/>
						</button>

						<div
							class="mt-3 w-full flex items-center justify-between border-t border-black/10 pt-3"
						>
							<div class="flex items-center gap-2">
								<input
									type="checkbox"
									id="invert-{i}"
									bind:checked={invertedState[logo.url]}
									class="custom-checkbox w-4 h-4 rounded cursor-pointer"
								/>
								<label
									for="invert-{i}"
									class="text-[12px] uppercase tracking-wider font-bold cursor-pointer {textColor} opacity-70"
									>Invert</label
								>
							</div>
							<span class="text-[12px] font-bold truncate max-w-[100px] {textColor} opacity-50"
								>{logo.name}</span
							>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Modal>

<Modal
	bind:isOpen={isDeleteModalOpen}
	on:close={() => (isDeleteModalOpen = false)}
	title="Delete Section"
	maxWidth="max-w-sm"
>
	<div class="p-2 text-center">
		<p class="text-gray2 text-sm mb-8">
			Are you sure you want to delete this {pendingDelete?.type}? This action cannot be undone.
		</p>

		<div class="flex gap-4 justify-center">
			<button
				on:click={() => (isDeleteModalOpen = false)}
				class="px-6 py-3 rounded-3xl bg-gray1 text-white hover:bg-navbar border border-gray2 transition-colors font-bold text-sm cursor-pointer"
			>
				Cancel
			</button>
			<button
				on:click={confirmDelete}
				class="px-6 py-3 rounded-3xl bg-red-500 text-white hover:bg-red-600 transition-colors font-bold text-sm cursor-pointer flex items-center gap-2"
			>
				Confirm
			</button>
		</div>
	</div>
</Modal>
<div bind:this={hiddenPdfContainer} class="hidden"></div>

<PopupNotification
	bind:show={showNotif}
	message={notifMessage}
	iconType={notifIconType}
	variant="navbar"
	duration={4000}
/>

<Modal
	bind:isOpen={isDownloadModalOpen}
	on:close={() => (isDownloadModalOpen = false)}
	title="Download Tech Rider"
	maxWidth="max-w-md"
>
	<div class="p-2 text-center flex flex-col items-center">
		<div class="mb-6 space-y-1">
			<p class="text-gray2 text-sm">Choose the styling format for your PDF download.</p>
			<p class="text-gray2 text-sm">The file will be exported in 8.5" x 11" format.</p>
		</div>

		{#if isDownloading}
			<div class="flex flex-col items-center justify-center py-6 gap-4">
				<div
					class="w-8 h-8 border-4 border-lime border-t-transparent rounded-full animate-spin"
				></div>
				<p class="text-white font-bold">Generating PDF...</p>
			</div>
		{:else}
			<div class="flex gap-4 justify-center w-full mt-2">
				<button
					on:click={() => executeDownload('bw')}
					class="flex flex-col items-center justify-center p-6 rounded-3xl bg-gray1 border-2 border-transparent hover:border-gray2 transition-all cursor-pointer w-full"
				>
					<div
						class="w-12 h-12 rounded-lg border border-gray2 mb-3 bg-[linear-gradient(135deg,#ffffff_50%,#000000_50%)]"
					></div>
					<span class="text-white font-bold text-sm">Black & White</span>
				</button>

				<button
					on:click={() => executeDownload('color')}
					class="flex flex-col items-center justify-center p-6 rounded-3xl bg-gray1 border-2 border-transparent hover:border-lime transition-all cursor-pointer w-full"
				>
					<div
						class="w-12 h-12 rounded-lg border-2 border-lime/50 mb-3 bg-gradient-to-br from-lime via-lime to-confirmed"
					></div>
					<span class="text-white font-bold text-sm">Full Color</span>
				</button>
			</div>

			<div class="mt-8 flex justify-center">
				<button
					on:click={() => (isDownloadModalOpen = false)}
					class="bg-gray1 text-white hover:bg-gray2 hover:text-black border border-gray2 text-sm font-bold px-5 py-2.5 rounded-3xl transition-colors shadow-md cursor-pointer flex items-center gap-2"
				>
					Cancel
				</button>
			</div>
		{/if}
	</div>
</Modal>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--color-lime, #e1ff00);
		border-radius: 3px;
	}
</style>
