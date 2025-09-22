<script lang="ts">
	import { updateEventAdvance } from '$lib/services/eventsService';
	import type { EventAdvance } from '$lib/services/eventsService';
	import { getAccessToken } from '$lib/stores/auth';
	import { createEventDispatcher } from 'svelte';
	import UploadModal from '$lib/components/modals/UploadModal.svelte';
	import PreviewModal from '$lib/components/modals/PreviewModal.svelte';

	// Portal action to render modal outside component tree
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

	// Props
	export let event: EventAdvance;
	export let placeholder: string = 'Upload File';
	export let viewText: string = ''; // NEW: Custom text to show when file exists
	export let storageBucket: string = 'documents';
	export let storageFolder: string = 'contracts';
	export let urlColumn: string = 'contract_url';
	export let statusColumn: string = 'contract';
	export let fileNameTemplate: string = 'Contract - {artist_name}';
	export let allowRename: boolean = true;
	export let acceptedTypes: string = '.pdf';
	export let width: string = 'w-auto';
	export let height: string = 'h-auto';

	// Internal state
	let isUploading = false;
	let isDeleting = false;
	let showUploadModal = false;
	let showPreviewModal = false;
	let currentFileUrl = '';
	let currentFileName = '';
	let customFileName = '';
	let displayText = ''; // NEW: Text to display on button
	
	const dispatch = createEventDispatcher();

	// Get current file info from event - with better debugging
	$: {
		currentFileUrl = (event as any)[urlColumn] || '';
		currentFileName = extractFileNameFromUrl(currentFileUrl);
		// NEW: Use viewText if provided and file exists, otherwise use filename or placeholder
		displayText = currentFileUrl && viewText ? viewText : (currentFileName || placeholder);
		console.log('📄 UploadButton reactive update:', {
			urlColumn,
			currentFileUrl,
			currentFileName,
			displayText,
			statusColumn,
			status: (event as any)[statusColumn]
		});
	}

	// Generate custom file name with proper template replacement
	$: {
		if (fileNameTemplate && event.artist_name) {
			customFileName = fileNameTemplate.replace('{artist_name}', event.artist_name);
		}
	}

	function extractFileNameFromUrl(url: string): string {
		if (!url) return '';
		
		try {
			// Handle both full URLs and just filenames
			const parts = url.split('/');
			const fileName = parts[parts.length - 1];
			const decodedFileName = decodeURIComponent(fileName);
			
			// Remove file extension for display
			const cleanName = decodedFileName.replace(/\.[^.]+$/, '');
			
			return cleanName || decodedFileName;
		} catch (error) {
			console.error('Error extracting filename:', error);
			return 'Unknown File';
		}
	}

	function openModal() {
		if (currentFileUrl) {
			showPreviewModal = true;
		} else {
			showUploadModal = true;
		}
	}

	function closeUploadModal() {
		showUploadModal = false;
	}

	function closePreviewModal() {
		showPreviewModal = false;
	}

	async function handleUpload(uploadEvent: CustomEvent) {
		const { file, fileName, useCustomName } = uploadEvent.detail;
		
		try {
			isUploading = true;

			// Get auth token
			const token = await getAccessToken();
			if (!token) {
				throw new Error('Not authenticated. Please log in and try again.');
			}

			const finalFileName = useCustomName ? fileName : file.name;
			// Clean filename for storage - remove special chars but keep structure
			const cleanFileName = finalFileName.replace(/[<>:"/\\|?*]/g, '_');
			
			// Create file path: contracts/Contract - ArtistName.pdf
			const filePath = `${storageFolder}/${cleanFileName}`;

			console.log('📁 Uploading to path:', filePath);
			console.log('📄 Final filename:', finalFileName);
			console.log('🔑 Using auth token:', token ? 'Present' : 'Missing');

			// Upload via authenticated API
			const uploadResult = await handleUploadViaAPI(file, filePath, token);

			console.log('✅ File uploaded successfully to storage:', uploadResult);

			// Update database with both URL and status
			const updates = {
				[urlColumn]: uploadResult.publicUrl,
				[statusColumn]: true
			};

			console.log('📝 Updating database with:', updates);

			// Update the database
			const dbResult = await updateEventAdvance(event.event_id, event.artist_name, updates);
			console.log('✅ Database update result:', dbResult);

			// Dispatch field update events for both columns
			dispatch('fieldUpdate', { 
				column: urlColumn, 
				value: uploadResult.publicUrl,
				eventId: event.event_id,
				artistName: event.artist_name
			});

			dispatch('fieldUpdate', { 
				column: statusColumn, 
				value: true,
				eventId: event.event_id,
				artistName: event.artist_name
			});

			// Update local state immediately for UI
			(event as any)[urlColumn] = uploadResult.publicUrl;
			(event as any)[statusColumn] = true;

			// Force reactivity update
			event = { ...event };

			dispatch('uploaded', {
				fileUrl: uploadResult.publicUrl,
				fileName: finalFileName
			});

			closeUploadModal();
			console.log('✅ Upload completed successfully');

			// 🚀 NEW: Dispatch upload-complete event for progress bar refresh
			console.log('📤 Dispatching upload-complete event for progress refresh');
			dispatch('upload-complete', {
				statusColumn: statusColumn,
				urlColumn: urlColumn,
				success: true,
				fileUrl: uploadResult.publicUrl,
				fileName: finalFileName,
				eventId: event.event_id,
				artistName: event.artist_name
			});

		} catch (error) {
			console.error('❌ Error uploading file:', error);
			
			// Show specific error messages
			let errorMessage = 'Failed to upload file';
			if (error instanceof Error) {
				if (error.message.includes('401') || error.message.includes('Unauthorized')) {
					errorMessage = 'Authentication failed. Please refresh and try again.';
				} else if (error.message.includes('403') || error.message.includes('Forbidden')) {
					errorMessage = 'Permission denied. Please contact support.';
				} else if (error.message.includes('413') || error.message.includes('too large')) {
					errorMessage = 'File is too large. Please choose a smaller file.';
				} else {
					errorMessage = error.message;
				}
			}
			
			dispatch('error', { message: errorMessage });
			
			// 🚀 NEW: Dispatch upload-error event
			dispatch('upload-error', {
				statusColumn: statusColumn,
				urlColumn: urlColumn,
				success: false,
				error: errorMessage,
				eventId: event.event_id,
				artistName: event.artist_name
			});
		} finally {
			isUploading = false;
		}
	}

	async function handleDelete() {
		if (!currentFileUrl) return;

		try {
			isDeleting = true;

			// Get auth token
			const token = await getAccessToken();
			if (!token) {
				throw new Error('Not authenticated. Please log in and try again.');
			}

			console.log('🗑️ Deleting file:', currentFileUrl);

			// Delete via authenticated API
			const response = await fetch('/api/upload', {
				method: 'DELETE',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({
					fileUrl: currentFileUrl,
					bucket: storageBucket
				})
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
				throw new Error(errorData.error || `Delete failed with status ${response.status}`);
			}

			console.log('✅ File deleted from storage');

			// Update database - clear URL and set status to false
			const updates = {
				[urlColumn]: null,
				[statusColumn]: false
			};

			console.log('📝 Updating database after delete:', updates);

			try {
				// Update database
				const dbResult = await updateEventAdvance(event.event_id, event.artist_name, updates);
				console.log('✅ Database updated after delete:', dbResult);
			} catch (dbError) {
				console.error('❌ Database update failed:', dbError);
				// Still continue with UI updates even if DB update fails
			}

			// Update local state immediately for UI responsiveness
			(event as any)[urlColumn] = null;
			(event as any)[statusColumn] = false;
			event = { ...event };

			// Dispatch field update events for progress bar updates
			dispatch('fieldUpdate', { 
				column: urlColumn, 
				value: null,
				eventId: event.event_id,
				artistName: event.artist_name
			});

			dispatch('fieldUpdate', { 
				column: statusColumn, 
				value: false,
				eventId: event.event_id,
				artistName: event.artist_name
			});

			dispatch('deleted');
			
			closePreviewModal();
			console.log('✅ File deleted successfully');

			// 🚀 NEW: Dispatch delete-complete event for progress bar refresh
			console.log('🗑️ Dispatching delete-complete event for progress refresh');
			dispatch('delete-complete', {
				statusColumn: statusColumn,
				urlColumn: urlColumn,
				success: true,
				eventId: event.event_id,
				artistName: event.artist_name
			});

		} catch (error) {
			console.error('❌ Error deleting file:', error);
			
			let errorMessage = 'Failed to delete file';
			if (error instanceof Error) {
				if (error.message.includes('401') || error.message.includes('Unauthorized')) {
					errorMessage = 'Authentication failed. Please refresh and try again.';
				} else {
					errorMessage = error.message;
				}
			}
			
			dispatch('error', { message: errorMessage });
			
			// 🚀 NEW: Dispatch delete-error event
			dispatch('delete-error', {
				statusColumn: statusColumn,
				urlColumn: urlColumn,
				success: false,
				error: errorMessage,
				eventId: event.event_id,
				artistName: event.artist_name
			});
		} finally {
			isDeleting = false;
		}
	}

	// Improved authenticated upload function
	async function handleUploadViaAPI(file: File, filePath: string, token: string) {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('filePath', filePath);
		formData.append('bucket', storageBucket);
		formData.append('eventId', event.event_id.toString());
		formData.append('artistName', event.artist_name);

		console.log('📤 Sending upload request with auth token');

		const response = await fetch('/api/upload', {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Authorization': `Bearer ${token}`
			},
			body: formData
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
			console.error('❌ Upload API error:', errorData);
			throw new Error(errorData.error || `Upload failed with status ${response.status}`);
		}

		const result = await response.json();
		console.log('✅ Upload API success:', result);
		return result;
	}
</script>

<!-- Main Upload Button Container -->
<div class="upload-button-container relative {width} {height}">
	<button
		type="button"
		class="bg-transparent border border-lime text-lime hover:!text-black hover:!bg-lime cursor-pointer font-bold text-center rounded-xl px-3 py-1 text-xs transition-all duration-200 whitespace-nowrap {isUploading || isDeleting ? 'opacity-70' : ''}"
		on:click={openModal}
		disabled={isUploading || isDeleting}
	>
		{#if isUploading}
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 border border-lime border-t-transparent rounded-full animate-spin"></div>
				<span class="whitespace-nowrap">Uploading...</span>
			</div>
		{:else if isDeleting}
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin"></div>
				<span class="whitespace-nowrap">Deleting...</span>
			</div>
		{:else}
			<span class="whitespace-nowrap">
				{displayText}
			</span>
		{/if}
	</button>
</div>

<!-- MODALS PORTALED TO DOCUMENT.BODY -->

<!-- Upload Modal -->
{#if showUploadModal}
<div use:portal>
	<UploadModal
		bind:isOpen={showUploadModal}
		title="Upload File"
		{acceptedTypes}
		{allowRename}
		{fileNameTemplate}
		{customFileName}
		{isUploading}
		on:close={closeUploadModal}
		on:upload={handleUpload}
	/>
</div>
{/if}

<!-- Preview Modal -->
{#if showPreviewModal}
<div use:portal>
	<PreviewModal
		bind:isOpen={showPreviewModal}
		fileName={currentFileName}
		fileUrl={currentFileUrl}
		showDeleteButton={true}
		showDownloadButton={true}
		{isDeleting}
		on:close={closePreviewModal}
		on:delete={handleDelete}
	/>
</div>
{/if}