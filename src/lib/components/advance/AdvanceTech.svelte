<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { getAccessToken } from '$lib/stores/auth';
	import type { EventAdvance } from '$lib/services/eventsService';
	import UploadModal from '$lib/components/modals/UploadModal.svelte';
	import PreviewModal from '$lib/components/modals/PreviewModal.svelte';

	export let event: EventAdvance;
	const dispatch = createEventDispatcher();

	// --- Portal for Modals ---
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			}
		};
	}

	// --- State ---
	let saving = false;
	let uploading = false;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	let riderFiles: {
		tech_rider_url?: string | null;
		hospitality_included?: 'Yes' | 'No' | '';
		hospo_rider_url?: string | null;
	} = {};
	let visuals: Record<string, string> = {};
	let isInitialized = false;
	let showUploadModal: 'tech' | 'hospo' | null = null;
	let showPreviewModal: 'tech' | 'hospo' | null = null;

	$: if (event) {
		initializeData();
	}

	function initializeData() {
		if (!event) return;
		// 🔽 START: MODIFIED CODE
		const parsedData = parseJsonData(event.rider_files) || {};
		if (!parsedData.hospitality_included) {
			// Set 'Yes' as the default if the property doesn't exist or is empty
			parsedData.hospitality_included = 'Yes';
		}
		riderFiles = parsedData;
		// 🔼 END: MODIFIED CODE
		visuals = parseJsonData(event.visuals) || {};
		isInitialized = true;
	}

	function parseJsonData(data: any): any {
		if (!data) return {};
		if (typeof data === 'object') return data;
		if (typeof data === 'string') {
			try {
				return JSON.parse(data);
			} catch (e) {
				return {};
			}
		}
		return {};
	}

	$: hasTechRider = !!riderFiles.tech_rider_url;
	$: visualLinks = Object.values(visuals).filter((link) => link && String(link).trim());

	function generateFileName(type: string): string {
		if (!event?.event_date || !event?.event_venue || !event?.artist_name) {
			return `${event.artist_name || 'Artist'} - ${type}`;
		}
		try {
			const date = new Date(event.event_date.replace(/-/g, '/'));
			const monthName = date.toLocaleString('en-US', { month: 'long' });
			const dayNumber = date.getDate();
			return `${monthName} ${dayNumber} - ${event.event_venue} - ${event.artist_name} - ${type}`;
		} catch (error) {
			return `${event.artist_name} - ${type}`;
		}
	}
	$: techRiderFileName = generateFileName('Rider');
	$: hospoRiderFileName = generateFileName('Hospo');

	function scheduleAutoSave() {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(saveChanges, 1500);
	}

	async function saveChanges() {
		if (!event?.event_id || !event.artist_name) return;

		saving = true;
		try {
			const updates = {
				rider_files: riderFiles,
				visuals: visuals,
				visual_received: visualLinks.length > 0
			};

			const { error } = await supabase
				.from('events_advance')
				.update(updates)
				.eq('event_id', event.event_id)
				.eq('artist_name', event.artist_name);

			if (error) {
				console.error('❌ Failed to save tech data:', error);
			} else {
				dispatch('datachanged', { ...updates });
			}
		} catch (err) {
			console.error('❌ Unexpected error saving:', err);
		} finally {
			saving = false;
		}
	}

	async function uploadFileViaAPI(file: File, folder: string, fileName: string) {
		const token = await getAccessToken();
		if (!token) {
			throw new Error('Not authenticated. Please log in and try again.');
		}

		const cleanFileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
		const filePath = `${folder}/${cleanFileName}`;

		const formData = new FormData();
		formData.append('file', file);
		formData.append('filePath', filePath);
		formData.append('bucket', 'documents');

		const response = await fetch('/api/upload', {
			method: 'POST',
			credentials: 'include',
			headers: {
				Authorization: `Bearer ${token}`
			},
			body: formData
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
			throw new Error(errorData.error || `Upload failed with status ${response.status}`);
		}

		const result = await response.json();
		return result.publicUrl;
	}

	async function deleteFileViaAPI(fileUrl: string) {
		const token = await getAccessToken();
		if (!token) {
			throw new Error('Not authenticated. Please log in and try again.');
		}

		const response = await fetch('/api/upload', {
			method: 'DELETE',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify({
				fileUrl: fileUrl,
				bucket: 'documents'
			})
		});
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
			throw new Error(errorData.error || `Delete failed with status ${response.status}`);
		}
	}

	async function handleTechRiderUpload(file: File) {
		try {
			uploading = true;
			const publicUrl = await uploadFileViaAPI(file, 'documents/tech_rider', techRiderFileName);
			riderFiles.tech_rider_url = publicUrl;
			riderFiles = { ...riderFiles };
			await saveChanges();
			dispatch('upload-complete', { url: publicUrl });
		} catch (error) {
			console.error('❌ Error uploading tech rider:', error);
			alert(`Failed to upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			uploading = false;
		}
	}

	async function handleHospoRiderUpload(file: File) {
		try {
			uploading = true;
			const publicUrl = await uploadFileViaAPI(file, 'documents/hospo_rider', hospoRiderFileName);
			riderFiles.hospo_rider_url = publicUrl;
			riderFiles = { ...riderFiles };
			await saveChanges();
			dispatch('upload-complete', { url: publicUrl });
		} catch (error) {
			console.error('❌ Error uploading hospo rider:', error);
			alert(`Failed to upload: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			uploading = false;
		}
	}

	async function handleTechRiderDelete() {
		try {
			uploading = true;
			if (riderFiles.tech_rider_url) {
				await deleteFileViaAPI(riderFiles.tech_rider_url);
			}
			riderFiles.tech_rider_url = null;
			riderFiles.hospitality_included = '';
			riderFiles = { ...riderFiles };
			await saveChanges();
			dispatch('delete-complete');
		} catch (error) {
			console.error('❌ Error deleting tech rider:', error);
			alert(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			uploading = false;
		}
	}

	async function handleHospoRiderDelete() {
		try {
			uploading = true;
			if (riderFiles.hospo_rider_url) {
				await deleteFileViaAPI(riderFiles.hospo_rider_url);
			}
			riderFiles.hospo_rider_url = null;
			riderFiles = { ...riderFiles };
			await saveChanges();
			dispatch('delete-complete');
		} catch (error) {
			console.error('❌ Error deleting hospo rider:', error);
			alert(`Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			uploading = false;
		}
	}

	async function handleModalUpload(e: CustomEvent) {
		const { file } = e.detail;
		if (showUploadModal === 'tech') {
			await handleTechRiderUpload(file);
		} else if (showUploadModal === 'hospo') {
			await handleHospoRiderUpload(file);
		}
		showUploadModal = null;
	}

	async function handleModalDelete() {
		if (showPreviewModal === 'tech') {
			await handleTechRiderDelete();
		} else if (showPreviewModal === 'hospo') {
			await handleHospoRiderDelete();
		}
		showPreviewModal = null;
	}

	function addNewVisualField() {
		const key = `visual_${Date.now()}`;
		visuals[key] = '';
		visuals = { ...visuals };
	}

	function updateVisualInput() {
		visuals = { ...visuals };
		scheduleAutoSave();
	}

	function removeVisualInput(key: string) {
		delete visuals[key];
		visuals = { ...visuals };
		scheduleAutoSave();
	}

	onDestroy(() => {
		if (debounceTimer) clearTimeout(debounceTimer);
	});
</script>

<div
	class="flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300"
	style="width: 340px; height: 420px;"
>
	<div class="flex items-center justify-between px-6 py-3 border-b border-gray1">
		<h2 class="text-xl font-normal text-gray3 truncate flex-1 mr-4">Riders & Visuals</h2>
		{#if saving || uploading}
			<div class="text-xs text-gray3 animate-pulse">
				{uploading ? 'Updating file...' : 'Saving...'}
			</div>
		{/if}
	</div>

	{#if isInitialized}
		<div class="px-6 py-4 h-full space-y-4 text-sm overflow-y-auto">
			<div class="space-y-3">
				<h3 class="font-semibold text-gray2 text-sm">Rider Section</h3>

				<div class="flex items-center gap-3">
					<span class="font-semibold min-w-[120px] text-gray3 text-xs">Tech Rider</span>
					{#if !riderFiles.tech_rider_url}
						<button
							on:click={() => (showUploadModal = 'tech')}
							class="bg-transparent border border-lime text-lime hover:!text-black hover:!bg-lime cursor-pointer font-bold text-center rounded-xl px-3 py-1 text-xs transition-all duration-200"
							disabled={uploading}
						>
							{uploading && showUploadModal === 'tech' ? 'Uploading...' : 'Upload Tech Rider'}
						</button>
					{:else}
						<button
							on:click={() => (showPreviewModal = 'tech')}
							class="bg-transparent border border-lime text-lime hover:!text-black hover:!bg-lime cursor-pointer font-bold text-center rounded-xl px-3 py-1 text-xs transition-all duration-200"
						>
							View Tech Rider
						</button>
					{/if}
				</div>

				{#if hasTechRider}
					<div class="flex items-center gap-3">
						<span class="font-semibold min-w-[120px] text-gray3 text-xs">Hospitality Included</span>
						<button
							on:click={() => {
								riderFiles.hospitality_included =
									riderFiles.hospitality_included === 'Yes' ? 'No' : 'Yes';
								scheduleAutoSave();
							}}
							class="w-12 text-center rounded-xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer"
							class:bg-lime={riderFiles.hospitality_included === 'Yes'}
							class:text-black={riderFiles.hospitality_included === 'Yes'}
							class:font-bold={riderFiles.hospitality_included === 'Yes'}
							class:bg-gray1={riderFiles.hospitality_included !== 'Yes'}
							class:text-gray3={riderFiles.hospitality_included !== 'Yes'}
						>
							{riderFiles.hospitality_included === 'Yes' ? 'Yes' : 'No'}
						</button>
					</div>

					{#if riderFiles.hospitality_included === 'No'}
						<div class="flex items-center gap-3 animate-fade-in">
							<span class="font-semibold min-w-[120px] text-gray3 text-xs">Upload Rider</span>
							{#if !riderFiles.hospo_rider_url}
								<button
									on:click={() => (showUploadModal = 'hospo')}
									class="bg-transparent border border-lime text-lime hover:!text-black hover:!bg-lime cursor-pointer font-bold text-center rounded-xl px-3 py-1 text-xs transition-all duration-200"
									disabled={uploading}
								>
									{uploading && showUploadModal === 'hospo' ? 'Uploading...' : 'Upload Hospo Rider'}
								</button>
							{:else}
								<button
									on:click={() => (showPreviewModal = 'hospo')}
									class="bg-transparent border border-lime text-lime hover:!text-black hover:!bg-lime cursor-pointer font-bold text-center rounded-xl px-3 py-1 text-xs transition-all duration-200"
								>
									View Hospo Rider
								</button>
							{/if}
						</div>
					{/if}
				{/if}
			</div>

			<div class="w-full h-0 border-t border-gray1"></div>

			{#if event.event_venue !== 'Bazart'}
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h3 class="font-semibold text-gray2 text-sm">Visuals</h3>
						<button
							on:click={addNewVisualField}
							class="flex items-center justify-center w-6 h-6 text-lime hover:bg-lime hover:text-black rounded-full transition-colors"
							aria-label="Add visual link"
						>
							<svg
								class="w-4 h-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
							</svg>
						</button>
					</div>

					<div class="space-y-2">
						{#each Object.keys(visuals) as key (key)}
							<div class="flex items-center gap-2 animate-fade-in">
								<input
									type="text"
									placeholder="https://visual-link.com"
									class="flex-1 bg-gray1 text-gray3 p-2 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-lime"
									bind:value={visuals[key]}
									on:input={updateVisualInput}
								/>
								<button
									on:click={() => removeVisualInput(key)}
									class="flex-shrink-0 flex items-center justify-center w-6 h-6 text-red-500 hover:cursor-pointer hover:bg-red-500 hover:text-white rounded-full transition-colors"
									aria-label="Remove visual"
								>
									<svg
										class="w-4 h-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</div>
						{/each}

						{#if visualLinks.length === 0}
							<div class="text-gray3 opacity-60 text-xs italic text-center py-4">
								No visual links added. Click '+' to add one.
							</div>
						{/if}
					</div>
				</div>
			{:else}
				<div class="space-y-3">
					<h3 class="font-semibold text-gray2 text-sm">Visuals</h3>
					<div class="text-gray3 opacity-60 text-xs italic text-center py-4">
						No visuals needed for this show.
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="flex items-center justify-center h-full text-gray3">Loading...</div>
	{/if}
</div>

{#if showUploadModal}
	<div use:portal>
		<UploadModal
			isOpen={!!showUploadModal}
			title={showUploadModal === 'tech' ? 'Upload Tech Rider' : 'Upload Hospo Rider'}
			acceptedTypes=".pdf,.doc,.docx"
			allowRename={true}
			fileNameTemplate={showUploadModal === 'tech' ? techRiderFileName : hospoRiderFileName}
			customFileName={showUploadModal === 'tech' ? techRiderFileName : hospoRiderFileName}
			isUploading={uploading}
			on:close={() => (showUploadModal = null)}
			on:upload={handleModalUpload}
		/>
	</div>
{/if}

{#if showPreviewModal}
	<div use:portal>
		<PreviewModal
			isOpen={!!showPreviewModal}
			fileName={showPreviewModal === 'tech' ? techRiderFileName : hospoRiderFileName}
			fileUrl={(showPreviewModal === 'tech'
				? riderFiles.tech_rider_url
				: riderFiles.hospo_rider_url) ?? ''}
			isDeleting={uploading}
			on:close={() => (showPreviewModal = null)}
			on:delete={handleModalDelete}
		/>
	</div>
{/if}

<style>
	.animate-fade-in {
		animation: fadeIn 0.3s ease-out forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
