<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';

	// Props
	export let isOpen = false;
	export let title = 'Upload File';
	export let acceptedTypes = '.pdf';
	export let allowRename = true;
	export let fileNameTemplate = '';
	export let customFileName = '';
	export let isUploading = false;

	// Internal state
	let selectedFile: File | null = null;
	let isDragOver = false;
	let useCustomName = true;

	const dispatch = createEventDispatcher();

	// Reset when modal opens
	$: if (isOpen) {
		selectedFile = null;
		isDragOver = false;
		useCustomName = allowRename && !!fileNameTemplate;
	}

	// Determine if we can show rename options
	$: showRenameOption = allowRename && fileNameTemplate && customFileName;

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			selectedFile = target.files[0];
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		
		if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
			selectedFile = e.dataTransfer.files[0];
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
	}

	function closeModal() {
		dispatch('close');
	}

	function handleUpload() {
		if (!selectedFile) return;

		let finalFileName: string;
		
		if (useCustomName && customFileName) {
			// Get file extension from selected file
			const fileExtension = selectedFile.name.split('.').pop() || 'pdf';
			finalFileName = `${customFileName}.${fileExtension}`;
		} else {
			finalFileName = selectedFile.name;
		}

		dispatch('upload', {
			file: selectedFile,
			fileName: finalFileName,
			useCustomName
		});
	}

	$: isValid = selectedFile && !isUploading;

	// Preview what the filename will be
	$: previewFileName = (() => {
		if (!selectedFile) return '';
		
		if (useCustomName && customFileName) {
			const fileExtension = selectedFile.name.split('.').pop() || 'pdf';
			return `${customFileName}.${fileExtension}`;
		}
		
		return selectedFile.name;
	})();
</script>

<Modal
	bind:isOpen
	{title}
	maxWidth="max-w-md"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-6">
		<!-- Hidden File Input -->
		<input
			type="file"
			accept={acceptedTypes}
			on:change={handleFileSelect}
			class="hidden"
			id="upload-file-input"
		/>

		<!-- File Drop Zone -->
		<div
			class="group border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ease-in-out transform {selectedFile ? 'border-gray2 cursor-default' : 'cursor-pointer'} {isDragOver ? 'border-lime scale-105' : selectedFile ? 'border-gray2' : 'border-gray2 hover:border-lime'}"
			role="button"
			tabindex="0"
			aria-label="File drop zone - drag and drop files here or press Enter to browse"
			on:drop={handleDrop}
			on:dragover={handleDragOver}
			on:dragleave={handleDragLeave}
			on:keydown={(e) => e.key === 'Enter' && document.getElementById('upload-file-input')?.click()}
			on:click={() => !selectedFile && document.getElementById('upload-file-input')?.click()}
		>
			{#if selectedFile}
				<div class="text-white">
					<!-- File check icon -->
					<svg class="w-8 h-8 mx-auto mb-2 text-lime transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="font-bold text-sm text-white">{selectedFile.name}</p>
					<p class="text-xs text-gray2 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
				</div>
			{:else}
				<svg class="w-12 h-12 mx-auto mb-4 text-gray2 transition-colors duration-200 group-hover:text-lime {isDragOver ? 'text-lime' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
				</svg>
				<p class="text-white font-bold mb-2 group-hover:text-lime transition-colors duration-200">
					Drop your file here
				</p>
				<p class="text-gray2 text-sm mb-4">or click to browse</p>
			{/if}
		</div>

		<!-- Rename Option -->
		{#if showRenameOption && selectedFile}
			<div class="space-y-3">
				<label class="flex items-center gap-3 text-white text-sm font-bold cursor-pointer group">
					<input
						type="checkbox"
						bind:checked={useCustomName}
						class="custom-checkbox w-4 h-4 rounded border border-gray2 transition-all duration-200"
					/>
					<span class="group-hover:text-lime transition-colors duration-200">Use custom name</span>
				</label>
				
				{#if useCustomName}
					<div class="mt-3 p-3 bg-gray1 rounded-xl border border-gray2">
						<p class="text-xs text-gray2 mb-1">File will be saved as:</p>
						<p class="text-sm text-lime font-bold break-words">{previewFileName}</p>
					</div>
				{:else}
					<div class="mt-3 p-3 bg-gray1 rounded-xl border border-gray2">
						<p class="text-xs text-gray2 mb-1">File will be saved as:</p>
						<p class="text-sm text-white font-bold break-words">{selectedFile.name}</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- File preview when selected -->
		{#if selectedFile && !showRenameOption}
			<div class="p-3 bg-gray1 rounded-xl border border-gray2">
				<p class="text-xs text-gray2 mb-1">Ready to upload:</p>
				<p class="text-sm text-lime font-bold break-words">{selectedFile.name}</p>
			</div>
		{/if}
	</div>

	<div slot="footer" class="flex gap-3 justify-end">
		<button
			class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
			on:click={closeModal}
			disabled={isUploading}
		>
			Cancel
		</button>
		<button
			class="px-6 py-3 rounded-full transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transform hover:scale-105 active:scale-95"
			class:bg-lime={isValid}
			class:text-black={isValid}
			class:hover:opacity-90={isValid}
			class:bg-gray1={!isValid}
			class:text-gray2={!isValid}
			disabled={!isValid}
			on:click={handleUpload}
		>
			{#if isUploading}
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
					Uploading...
				</div>
			{:else}
				Upload
			{/if}
		</button>
	</div>
</Modal>