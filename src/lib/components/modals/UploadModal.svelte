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
		useCustomName = allowRename;
		customFileName = fileNameTemplate;
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			processSelectedFile(target.files[0]);
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		
		if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
			processSelectedFile(e.dataTransfer.files[0]);
		}
	}

	function processSelectedFile(file: File) {
		selectedFile = file;
		// Initialize customFileName to the template or original name without extension if empty
		if (!customFileName) {
			const lastDotIndex = file.name.lastIndexOf('.');
			const nameWithoutExt = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
			customFileName = fileNameTemplate || nameWithoutExt;
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
			// Safely get file extension with the dot included
			const lastDotIndex = selectedFile.name.lastIndexOf('.');
			const fileExtension = lastDotIndex !== -1 ? selectedFile.name.substring(lastDotIndex) : '';
			
			// Prevent double extensions if user manually typed it
			finalFileName = customFileName.endsWith(fileExtension) 
				? customFileName 
				: `${customFileName}${fileExtension}`;
		} else {
			finalFileName = selectedFile.name;
		}

		dispatch('upload', {
			file: selectedFile,
			fileName: finalFileName,
			useCustomName
		});
	}

	$: isValid = selectedFile && !isUploading && (!useCustomName || (useCustomName && customFileName.trim() !== ''));

	// Preview what the filename will be
	$: previewFileName = (() => {
		if (!selectedFile) return '';
		
		if (useCustomName && customFileName) {
			const lastDotIndex = selectedFile.name.lastIndexOf('.');
			const fileExtension = lastDotIndex !== -1 ? selectedFile.name.substring(lastDotIndex) : '';
			
			return customFileName.endsWith(fileExtension) 
				? customFileName 
				: `${customFileName}${fileExtension}`;
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
		<input
			type="file"
			accept={acceptedTypes}
			on:change={handleFileSelect}
			class="hidden"
			id="upload-file-input"
		/>

		<div
			class="group border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ease-in-out transform {selectedFile ? 'border-gray2 cursor-default' : 'cursor-pointer'} {isDragOver ? 'border-lime scale-105 bg-lime/5' : selectedFile ? 'border-gray2' : 'border-gray2 hover:border-lime hover:bg-white/5'}"
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
					<svg class="w-8 h-8 mx-auto mb-2 text-lime transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="font-bold text-sm text-white break-all">{selectedFile.name}</p>
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

		{#if allowRename && selectedFile}
			<div class="space-y-4">
				<label class="flex items-center gap-3 text-white text-sm font-bold cursor-pointer group w-max">
					<input
						type="checkbox"
						bind:checked={useCustomName}
						class="custom-checkbox w-4 h-4 rounded border border-gray2 transition-all duration-200 accent-lime"
					/>
					<span class="group-hover:text-lime transition-colors duration-200">Use custom name</span>
				</label>
				
				{#if useCustomName}
					<div class="space-y-3">
						<input 
							type="text" 
							bind:value={customFileName} 
							placeholder="Enter custom file name" 
							class="w-full bg-navbar border border-gray2/20 rounded-xl px-4 py-3 text-white focus:border-lime focus:outline-none transition-colors text-sm" 
						/>
						<div class="p-4 bg-gray1 rounded-xl border border-gray2/50 shadow-inner">
							<p class="text-xs text-gray2 mb-1 uppercase tracking-wider font-bold">File will be saved as:</p>
							<p class="text-sm text-lime font-bold break-all">{previewFileName}</p>
						</div>
					</div>
				{:else}
					<div class="p-4 bg-gray1 rounded-xl border border-gray2/50 shadow-inner">
						<p class="text-xs text-gray2 mb-1 uppercase tracking-wider font-bold">File will be saved as:</p>
						<p class="text-sm text-white font-bold break-all">{selectedFile.name}</p>
					</div>
				{/if}
			</div>
		{/if}

		{#if selectedFile && !allowRename}
			<div class="p-4 bg-gray1 rounded-xl border border-gray2/50 shadow-inner">
				<p class="text-xs text-gray2 mb-1 uppercase tracking-wider font-bold">Ready to upload:</p>
				<p class="text-sm text-lime font-bold break-all">{selectedFile.name}</p>
			</div>
		{/if}
	</div>

	<div slot="footer" class="flex gap-3 justify-end">
		<button
			class="px-6 py-3 border border-gray2/30 text-gray2 rounded-2xl hover:bg-gray2/20 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm"
			on:click={closeModal}
			disabled={isUploading}
		>
			Cancel
		</button>
		<button
			class="px-6 py-3 rounded-2xl transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 font-bold text-sm shadow-md"
			class:bg-lime={isValid}
			class:text-black={isValid}
			class:cursor-pointer={isValid}
			class:hover:opacity-90={isValid}
			class:bg-gray1={!isValid}
			class:text-gray2={!isValid}
			disabled={!isValid}
			on:click={handleUpload}
		>
			{#if isUploading}
				<div class="flex items-center gap-2">
					<div class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
					UPLOADING...
				</div>
			{:else}
				UPLOAD
			{/if}
		</button>
	</div>
</Modal>

<style>
	/* Custom styling for the checkbox to match the lime theme */
	.custom-checkbox {
		appearance: none;
		-webkit-appearance: none;
		background-color: transparent;
		display: inline-block;
		position: relative;
		cursor: pointer;
	}
	.custom-checkbox:checked {
		background-color: #E1FF00;
		border-color: #E1FF00;
	}
	.custom-checkbox:checked::after {
		content: '';
		position: absolute;
		left: 4px;
		top: 1px;
		width: 5px;
		height: 10px;
		border: solid black;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}
</style>