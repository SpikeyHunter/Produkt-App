<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Person } from '$lib/types/events';
	import type { PassportInfo } from '$lib/types/passport';

	export let currentPerson: Person | undefined;
	export let currentPassportInfo: PassportInfo | undefined;
	export let isUploading = false;
	export let isDeleting = false;
	export let isDetecting = false;
	export let detectionError = '';

	const dispatch = createEventDispatcher();

	let isDragOver = false;
	let dragCounter = 0;

	function triggerFileInput() {
		dispatch('fileInput');
	}

	function openPreview() {
		if (currentPassportInfo?.passportImageUrl) {
			dispatch('preview');
		}
	}

	function handleDelete() {
		dispatch('delete');
	}

	function handleAutoDetect() {
		dispatch('autoDetect');
	}

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter++;
		if (e.dataTransfer?.types.includes('Files')) {
			isDragOver = true;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragCounter--;
		if (dragCounter === 0) {
			isDragOver = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		
		isDragOver = false;
		dragCounter = 0;
		
		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;
		
		const file = files[0];
		const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
		
		if (!allowedTypes.includes(file.type)) {
			dispatch('error', 'Invalid file type. Please upload a PDF, JPG, JPEG, or PNG file.');
			return;
		}
		
		const maxSize = 10 * 1024 * 1024;
		if (file.size > maxSize) {
			dispatch('error', 'File too large. Please upload a file smaller than 10MB.');
			return;
		}

		dispatch('fileDrop', file);
	}
</script>

<div class="space-y-3">
	<h4 class="text-base font-bold text-white">Passport Image</h4>

	{#if currentPassportInfo?.passportImageUrl}
		<div class="space-y-3">
			<div class="w-full bg-gray1 rounded-lg overflow-hidden relative group cursor-pointer" style="height: 200px;">
				<div
					class="w-full h-full relative overflow-hidden"
					on:click={openPreview}
					on:keydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							openPreview();
						}
					}}
					on:mousemove={(e) => {
						const rect = e.currentTarget.getBoundingClientRect();
						const x = ((e.clientX - rect.left) / rect.width) * 100;
						const y = ((e.clientY - rect.top) / rect.height) * 100;
						e.currentTarget.style.setProperty('--zoom-x', `${x}%`);
						e.currentTarget.style.setProperty('--zoom-y', `${y}%`);
					}}
					role="button"
					tabindex="0"
					aria-label="View passport full size"
				>
					<img
						src={currentPassportInfo.passportImageUrl}
						alt="Passport for {currentPerson?.firstName} {currentPerson?.lastName}"
						class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-150"
						style="transform-origin: var(--zoom-x, 50%) var(--zoom-y, 50%);"
					/>
					<div class="absolute top-2 right-2 bg-black/50 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
						<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="11" cy="11" r="8" />
							<path d="m21 21-4.35-4.35" />
							<line x1="11" y1="8" x2="11" y2="14" />
							<line x1="8" y1="11" x2="14" y2="11" />
						</svg>
					</div>
				</div>
			</div>
			
			<div class="flex gap-2 justify-between">
				<div class="flex gap-2">
					<button
						type="button"
						class="px-3 py-1.5 bg-gray2 text-black rounded-lg font-bold text-xs hover:bg-lime transition-colors cursor-pointer"
						on:click={openPreview}
					>
						View Full Size
					</button>
					<button
						type="button"
						class="px-3 py-1.5 border border-red-500 text-red-500 rounded-lg font-bold text-xs hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
						on:click={handleDelete}
						disabled={isDeleting}
					>
						{isDeleting ? 'Deleting...' : 'Delete'}
					</button>
				</div>
				<button
					type="button"
					class="px-3 py-1.5 border border-gray2 text-gray2 rounded-lg font-bold text-xs hover:bg-gray2 hover:text-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					on:click={handleAutoDetect}
					disabled={isDetecting}
				>
					{isDetecting ? 'Detecting...' : 'Auto Detect'}
				</button>
			</div>
			
			{#if detectionError}
				<div class="text-red-500 text-xs">{detectionError}</div>
			{/if}
		</div>
	{:else}
		<div
			class="group border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ease-in-out transform cursor-pointer {isDragOver ? 'border-lime scale-105' : 'border-gray2 hover:border-lime'}"
			role="button"
			tabindex="0"
			aria-label="File drop zone - drag and drop files here or press Enter to browse"
			on:drop={handleDrop}
			on:dragover={handleDragOver}
			on:dragleave={handleDragLeave}
			on:keydown={(e) => e.key === 'Enter' && triggerFileInput()}
			on:click={triggerFileInput}
		>
			<svg class="w-12 h-12 mx-auto mb-4 text-gray2 transition-colors duration-200 group-hover:text-lime {isDragOver ? 'text-lime' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
			</svg>
			<p class="text-white font-bold mb-2 group-hover:text-lime transition-colors duration-200">
				{#if isUploading}
					Uploading passport...
				{:else if isDragOver}
					Drop passport file here
				{:else}
					Drop your passport here
				{/if}
			</p>
			<p class="text-gray2 text-sm mb-4">or click to browse</p>
			<p class="text-xs text-gray2">PDF, JPG, JPEG, PNG files up to 10MB</p>
		</div>
	{/if}
</div>

<style>
	.group:hover img {
		cursor: zoom-in;
	}
</style>