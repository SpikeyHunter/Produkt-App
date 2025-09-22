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
</script>

<div class="space-y-3">
	<h4 class="text-base font-bold text-white">Passport Image</h4>

	<div class="border-2 border-dashed border-gray2 rounded-lg p-4">
		{#if currentPassportInfo?.passportImageUrl}
			<div class="space-y-3">
				<div
					class="w-full bg-gray1 rounded-lg overflow-hidden relative group cursor-pointer"
					style="height: 200px;"
				>
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
						<div
							class="absolute top-2 right-2 bg-black/50 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
						>
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
			<div class="space-y-3 text-center">
				<svg class="w-12 h-12 mx-auto text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<polyline points="14,2 14,8 20,8" />
					<line x1="16" y1="13" x2="8" y2="13" />
					<line x1="16" y1="17" x2="8" y2="17" />
					<polyline points="10,9 9,9 8,9" />
				</svg>
				<div>
					<h5 class="text-white font-bold text-sm mb-1">Upload Passport</h5>
					<p class="text-gray2 text-xs mb-3">Upload a photo or scan of the passport</p>
					<button
						type="button"
						class="px-4 py-2 bg-lime text-black rounded-full font-bold text-sm hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
						on:click={triggerFileInput}
						disabled={isUploading}
					>
						{isUploading ? 'Uploading...' : 'Choose File'}
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Magnifying glass cursor style */
	.group:hover img {
		cursor: zoom-in;
	}
</style>