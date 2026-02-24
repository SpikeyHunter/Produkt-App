<script lang="ts">
	import Modal from './Modal.svelte';
	// Adjust this import path to match where your PopupNotification.svelte lives
	import PopupNotification from './PopupNotification.svelte'; 
	import { portal } from '$lib/utils/portalUtils';
	import { onDestroy } from 'svelte';

	export let isOpen = false;
	export let userProfile: { first_name?: string; last_name?: string; email?: string } | null = null;

	let title = '';
	let page = '';
	let description = '';
	let occurrenceCount = 1;
	let isSubmitting = false; 
	
	// Popup Notification State
	let showNotification = false;
	let notificationMessage = '';
	
	// File Upload State
	let files: File[] = [];
	let isDragging = false;
	let fileInput: HTMLInputElement;
	let fileUrls: string[] = [];

	const suggestedPages = [
		'Dashboard',
		'Calendar',
		'Set Times',
		'Marketing',
		'Booking',
		'Advancing',
		'Production',
		'Schedules',
		'NCG App',
		'Sultan+Shepard',
		'Settings',
		'Other'
	];

	let isPageDropdownOpen = false;

	function resetForm() {
		title = '';
		page = '';
		description = '';
		occurrenceCount = 1;
		files = [];
		isSubmitting = false;
		isPageDropdownOpen = false;
	}

	$: if (!isOpen) {
		resetForm();
	}

	function handleClose() {
		isOpen = false;
	}

	async function handleSubmit() {
		if (!title || !description) {
			alert('Please provide a title and description for the bug report.');
			return;
		}

		isSubmitting = true;

		try {
			const formData = new FormData();
			formData.append('title', title);
			formData.append('page', page);
			formData.append('description', description);
			formData.append('occurrenceCount', occurrenceCount.toString());
			
			formData.append('firstName', userProfile?.first_name || 'Unknown');
			formData.append('lastName', userProfile?.last_name || 'User');
			formData.append('userEmail', userProfile?.email || '');

			files.forEach((file) => {
				formData.append('files', file);
			});

			const response = await fetch('/api/bug-report', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (response.ok) {
				// Close the modal first
				handleClose(); 
				
				// Trigger the success popup notification
				notificationMessage = 'Bug Report - Request has been sent';
				showNotification = true;
			} else {
				alert(`Failed to send: ${result.message}`);
			}
		} catch (error) {
			console.error('Submission error:', error);
			alert('An error occurred while sending the report.');
		} finally {
			isSubmitting = false;
		}
	}

	function togglePageDropdown() {
		isPageDropdownOpen = !isPageDropdownOpen;
	}

	function selectPage(selectedPage: string) {
		page = selectedPage;
		isPageDropdownOpen = false;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.page-dropdown-container')) {
			isPageDropdownOpen = false;
		}
	}

	function decrementOccurrence() {
		if (occurrenceCount > 1) occurrenceCount--;
	}

	function incrementOccurrence() {
		occurrenceCount++;
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files) {
			addFiles(e.dataTransfer.files);
		}
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			addFiles(target.files);
		}
	}

	function addFiles(newFileList: FileList) {
		const newFilesArray = Array.from(newFileList);
		files = [...files, ...newFilesArray];
	}

	function removeFile(indexToRemove: number) {
		files = files.filter((_, index) => index !== indexToRemove);
	}

	$: {
		fileUrls.forEach(url => {
			if (url) URL.revokeObjectURL(url);
		});
		fileUrls = files.map(file => {
			if (file.type.startsWith('image/')) {
				return URL.createObjectURL(file);
			}
			return '';
		});
	}

	onDestroy(() => {
		fileUrls.forEach(url => {
			if (url) URL.revokeObjectURL(url);
		});
	});
</script>

<svelte:window on:click={handleClickOutside} />

<PopupNotification 
	bind:show={showNotification} 
	message={notificationMessage} 
	variant="gray1" 
	iconType="confirmed" 
	duration={4000}
/>

<div use:portal>
	<Modal
		{isOpen}
		title="Report a Bug"
		hasFooter={true}
		maxWidth="max-w-xl"
		on:close={handleClose}
	>
		<div class="flex flex-col gap-5">
			<div class="flex flex-col gap-1.5">
				<label for="bugTitle" class="text-sm font-semibold text-gray2">Title</label>
				<input
					id="bugTitle"
					type="text"
					bind:value={title}
					class="w-full bg-gray1 border border-gray2 text-white rounded-3xl px-4 py-2.5 focus:outline-none focus:border-lime transition-colors placeholder-gray2 hover:cursor-pointer"
					placeholder="Short description of the issue"
				/>
			</div>

			<div class="flex flex-row gap-5 w-full">
				<div class="flex flex-col gap-1.5 flex-1 page-dropdown-container relative">
					<label for="bugPage" class="text-sm font-semibold text-gray2">Where did this happen?</label>
					<button
						id="bugPage"
						type="button"
						class="w-full bg-gray1 border border-gray2 rounded-3xl px-4 py-2.5 flex items-center justify-between transition-colors hover:cursor-pointer focus:outline-none focus:border-lime {page ? 'text-white' : 'text-gray2'}"
						on:click={togglePageDropdown}
					>
						<span>{page || 'Select a page'}</span>
						<svg
							class="w-4 h-4 text-gray2 transition-transform {isPageDropdownOpen ? 'rotate-180' : ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M6 9l6 6 6-6" />
						</svg>
					</button>

					{#if isPageDropdownOpen}
						<div class="absolute top-full left-0 mt-2 bg-navbar border border-lime rounded-3xl shadow-xl z-[9999] w-full overflow-hidden max-h-56 overflow-y-auto">
							{#each suggestedPages as suggestedPage}
								<button
									type="button"
									class="block w-full px-4 py-2.5 text-left text-white hover:bg-lime hover:text-black transition-colors hover:cursor-pointer border-b border-gray1 last:border-b-0 text-sm font-semibold"
									on:click={() => selectPage(suggestedPage)}
								>
									{suggestedPage}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="flex flex-col gap-1.5 flex-1">
					<label for="bugOccurrence" class="text-sm font-semibold text-gray2">
						How many times did this happen?
					</label>
					<div class="flex items-center w-full bg-gray1 border border-gray2 rounded-3xl overflow-hidden focus-within:border-lime transition-colors">
						<button 
							type="button" 
							class="px-4 py-2.5 text-gray2 hover:text-white hover:text-lime transition-colors font-bold text-lg hover:cursor-pointer flex-shrink-0"
							on:click={decrementOccurrence}
							aria-label="Decrease occurrence count"
						>
							&minus;
						</button>
						<input
							id="bugOccurrence"
							type="number"
							min="1"
							bind:value={occurrenceCount}
							class="w-full bg-transparent text-white text-center font-semibold focus:outline-none hover:cursor-pointer m-0 p-0 h-full hide-arrows"
						/>
						<button 
							type="button" 
							class="px-4 py-2.5 text-gray2 hover:text-white hover:text-lime transition-colors font-bold text-lg hover:cursor-pointer flex-shrink-0"
							on:click={incrementOccurrence}
							aria-label="Increase occurrence count"
						>
							&#43;
						</button>
					</div>
				</div>
			</div>

			<div class="flex flex-col gap-1.5">
				<label for="bugDescription" class="text-sm font-semibold text-gray2">Description</label>
				<textarea
					id="bugDescription"
					bind:value={description}
					rows="4"
					class="w-full bg-gray1 border border-gray2 text-white rounded-3xl px-4 py-3 focus:outline-none focus:border-lime transition-colors resize-y placeholder-gray2 hover:cursor-pointer"
					placeholder="What were you doing when the bug occurred?"
				></textarea>
			</div>

			<div class="flex flex-col gap-1.5">
				<label for="bugScreenshots" class="text-sm font-semibold text-gray2">
					Upload Files
				</label>
				
				<div 
					role="button"
					tabindex="0"
					class="w-full border-2 border-dashed rounded-3xl p-5 flex flex-col items-center justify-center gap-4 transition-all hover:cursor-pointer {isDragging ? 'border-lime bg-lime/10' : 'border-gray2 bg-gray1 hover:border-lime hover:bg-gray1/80'}"
					on:dragover={handleDragOver}
					on:dragleave={handleDragLeave}
					on:drop={handleDrop}
					on:click={() => fileInput.click()}
					on:keydown={(e) => e.key === 'Enter' && fileInput.click()}
				>
					<input
						id="bugScreenshots"
						type="file"
						multiple
						accept="image/*,.pdf,.txt,.csv,.doc,.docx"
						class="hidden"
						bind:this={fileInput}
						on:change={handleFileSelect}
					/>
					
					<div class="flex flex-col items-center pointer-events-none">
						<svg class="h-6 w-6 text-gray2 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
						</svg>
						<p class="text-sm text-white font-medium">
							Drag & drop files here, or <span class="text-lime">browse</span>
						</p>
					</div>

					{#if files.length > 0}
						<div class="flex flex-wrap justify-center gap-4 w-full mt-1">
							{#each files as file, i}
								<div 
									role="button"
									tabindex="-1"
									class="relative w-16 h-16 group flex-shrink-0 cursor-default" 
									on:click|stopPropagation
									on:keydown|stopPropagation
								>
									<div class="w-full h-full rounded-xl border border-gray2 overflow-hidden bg-gray1 shadow-sm flex flex-col items-center justify-center">
										{#if fileUrls[i]}
											<img src={fileUrls[i]} alt="Screenshot thumbnail" class="w-full h-full object-cover" />
										{:else}
											<div class="flex flex-col items-center justify-center p-1 w-full h-full bg-gray3">
												<svg class="w-5 h-5 text-gray2 mb-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
												</svg>
												<div class="w-full text-[9px] text-gray2 truncate text-center font-medium px-1">
													{file.name}
												</div>
											</div>
										{/if}
									</div>
									
									<button 
										type="button" 
										on:click|stopPropagation|preventDefault={() => removeFile(i)} 
										class="absolute -top-2 -right-2 bg-gray3 text-black rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:cursor-pointer hover:bg-lime hover:scale-110 shadow-md z-10 flex items-center justify-center border border-gray1"
										aria-label="Remove file"
									>
										<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
											<path d="M18 6L6 18M6 6l12 12" />
										</svg>
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<svelte:fragment slot="footer">
			<div class="flex justify-end gap-3">
				<button
					type="button"
					on:click={handleClose}
					disabled={isSubmitting}
					class="px-6 py-3 rounded-3xl text-black bg-gray3 font-semibold hover:bg-gray3/80 hover:cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Cancel
				</button>
				<button
					type="button"
					on:click={handleSubmit}
					disabled={isSubmitting}
					class="px-6 py-3 rounded-3xl text-black font-semibold transition-all {isSubmitting ? 'bg-lime/50 cursor-wait' : 'bg-lime hover:opacity-80 hover:cursor-pointer'}"
				>
					{isSubmitting ? 'Sending...' : 'Send Bug Report'}
				</button>
			</div>
		</svelte:fragment>
	</Modal>
</div>

<style>
	/* Hide native arrows for number input across browsers */
	.hide-arrows::-webkit-outer-spin-button,
	.hide-arrows::-webkit-inner-spin-button {
		-webkit-appearance: none;
		appearance: none;
		margin: 0;
	}
	.hide-arrows {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>