<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';

	// Props
	export let isOpen = false;
	export let fileName = '';
	export let fileUrl = '';
	export let showDeleteButton = true;
	export let showDownloadButton = true;
	export let isDeleting = false;

	// Internal state
	let showDeleteConfirm = false;

	const dispatch = createEventDispatcher();
	// Reset when modal opens
	$: if (isOpen) {
		showDeleteConfirm = false;
	}

	function closeModal() {
		dispatch('close');
	}

	// Fixed download function
	async function handleDownload() {
		if (!fileUrl || !fileName) return;
		try {
			const response = await fetch(fileUrl);
			if (!response.ok) throw new Error('Failed to fetch file');
			
			const blob = await response.blob();
			const downloadUrl = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = downloadUrl;
			link.style.display = 'none';
			
			let downloadFileName = fileName;
			if (!fileName.includes('.')) {
				const urlParts = fileUrl.split('.');
				const extension = urlParts[urlParts.length - 1].split('?')[0];
				downloadFileName = `${fileName}.${extension || 'pdf'}`;
			}
			
			link.download = downloadFileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(downloadUrl);
		} catch (error) {
			console.error('Download failed:', error);
			// Fallback to simple download
			const link = document.createElement('a');
			link.href = fileUrl;
			link.download = fileName.includes('.') ? fileName : `${fileName}.pdf`;
			link.style.display = 'none';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	function handleDelete() {
		dispatch('delete');
		showDeleteConfirm = false;
	}
</script>

<Modal
	bind:isOpen
	title={fileName}
	maxWidth="max-w-[95vw] lg:max-w-6xl"
	hasFooter={false}
	on:close={closeModal}
	showCloseButton={false} >
	<div class="absolute top-4 right-4 flex items-center gap-2 z-10">
		{#if showDownloadButton}
			<button
				class="bg-gray2 text-black p-2 flex items-center gap-2 rounded-lg font-bold text-xs hover:bg-lime transition-colors cursor-pointer"
				on:click={handleDownload}
				aria-label="Download file"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
				</svg>
				<span class="hidden sm:inline pr-1">Download</span>
			</button>
		{/if}
		{#if showDeleteButton}
			<button
				class="border border-gray2 text-gray2 p-2 flex items-center gap-2 rounded-lg font-bold text-xs hover:border-red-500 hover:text-red-500 transition-colors cursor-pointer disabled:opacity-75"
				on:click={() => (showDeleteConfirm = true)}
				disabled={isDeleting}
				aria-label="Delete file"
			>
				{#if isDeleting}
					<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<span class="hidden sm:inline pr-1">Deleting...</span>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
  						<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
					<span class="hidden sm:inline pr-1">Delete</span>
				{/if}
			</button>
		{/if}

		<button 
			on:click={closeModal} 
			class="p-2 rounded-lg text-gray2 hover:bg-gray2 hover:text-black transition-colors"
			aria-label="Close modal"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="relative w-full">
		<div
			class="w-full rounded-lg bg-gray1 overflow-hidden"
			style="height: min(80vh, calc(100vh - 160px));"
		>
			<iframe
				src="{fileUrl}?v={Date.now()}#view=FitH"
				class="w-full h-full rounded-lg border-0"
				title="PDF Viewer"
				style="min-height: 400px;"
				loading="lazy"
			></iframe>
		</div>

		<div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 sm:hidden">
			<div class="flex items-center gap-2 bg-black/80 backdrop-blur-sm rounded-full px-4 py-2">
				{#if showDownloadButton}
					<button
						class="text-white hover:text-lime transition-colors text-sm"
						on:click={handleDownload}
					>
						Download
					</button>
					<div class="w-px h-4 bg-gray-600"></div>
				{/if}
				{#if showDeleteButton}
					<button
						class="text-white hover:text-red-400 transition-colors text-sm"
						on:click={() => (showDeleteConfirm = true)}
						disabled={isDeleting}
					>
						{isDeleting ? 'Deleting...' : 'Delete'}
					</button>
				{/if}
			</div>
		</div>
	</div>
</Modal>

<Modal
	bind:isOpen={showDeleteConfirm}
	title="Delete File"
	maxWidth="max-w-sm"
	hasFooter={true}
	on:close={() => (showDeleteConfirm = false)}
>
	<p class="text-white text-sm">Are you sure you want to delete this file? This action cannot be undone.</p>
	
	<div slot="footer" class="flex gap-3 justify-end">
		<button
			class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
			on:click={() => (showDeleteConfirm = false)}
			disabled={isDeleting}
		>
			Cancel
		</button>
		<button
			class="px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors cursor-pointer flex items-center justify-center gap-2"
			on:click={handleDelete}
			disabled={isDeleting}
		>
			{#if isDeleting}
				<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<span>Deleting...</span>
			{:else}
				<span>Delete</span>
			{/if}
		</button>
	</div>
</Modal>