<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { createAnnouncement, updateAnnouncement } from '$lib/services/announcementService';
	import type { Announcement } from '$lib/types/announcements';
	import { portal } from '$lib/utils/portalUtils';

	const dispatch = createEventDispatcher();

	export let announcement: Announcement | null = null;

	// Get today's date in YYYY-MM-DD format
	function getTodayDate(): string {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	// Get date 24 hours from now in YYYY-MM-DD format
	function getTomorrowDate(): string {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const year = tomorrow.getFullYear();
		const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
		const day = String(tomorrow.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	// Get current time in HH:MM format
	function getCurrentTime(): string {
		const now = new Date();
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		return `${hours}:${minutes}`;
	}

	function formatDateOnly(dateString: string): string {
		try {
			const date = new Date(dateString);
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		} catch {
			return '';
		}
	}

	function formatTimeOnly(dateString: string): string {
		try {
			const date = new Date(dateString);
			const hours = String(date.getHours()).padStart(2, '0');
			const minutes = String(date.getMinutes()).padStart(2, '0');
			return `${hours}:${minutes}`;
		} catch {
			return '';
		}
	}

	function combineDateTime(date: string, time: string): string {
		if (!date || !time) return '';
		return new Date(`${date}T${time}`).toISOString();
	}

	let title = announcement?.title || '';
	let description = announcement?.description || '';
	let startDate = announcement?.start_date ? formatDateOnly(announcement.start_date) : getTodayDate();
	let startTime = announcement?.start_date ? formatTimeOnly(announcement.start_date) : getCurrentTime();
	let endDate = announcement?.end_date ? formatDateOnly(announcement.end_date) : getTomorrowDate();
	let endTime = announcement?.end_date ? formatTimeOnly(announcement.end_date) : getCurrentTime();
	let isEnabled = announcement?.is_enabled ?? true;
	let isSaving = false;
	let isClosing = false;
	let useNowForStart = false;
	let useNowForEnd = false;

	// Check if form is valid for saving
	$: hasValidStart = useNowForStart || (startDate && startTime);
	$: hasValidEnd = useNowForEnd || (endDate && endTime);
	$: canSave = title.trim() && description.trim() && hasValidStart && hasValidEnd;

	async function handleSave() {
		if (!canSave) return;

		isSaving = true;

		const data = {
			title: title.trim(),
			description: description.trim(),
			start_date: useNowForStart ? null : (startDate && startTime ? combineDateTime(startDate, startTime) : null),
			end_date: useNowForEnd ? null : (endDate && endTime ? combineDateTime(endDate, endTime) : null),
			is_enabled: isEnabled
		};

		let success = false;

		if (announcement) {
			success = await updateAnnouncement(announcement.id, data);
		} else {
			const result = await createAnnouncement(data);
			success = result !== null;
		}

		isSaving = false;

		if (success) {
			dispatch('saved');
			closeModal();
		} else {
			alert('Failed to save announcement');
		}
	}

	function closeModal() {
		isClosing = true;
		setTimeout(() => {
			dispatch('close');
			isClosing = false;
		}, 200);
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeModal();
		}
	}

	function toggleStartNow() {
		useNowForStart = !useNowForStart;
		if (useNowForStart) {
			startDate = '';
			startTime = '';
		}
	}

	function toggleEndNow() {
		useNowForEnd = !useNowForEnd;
		if (useNowForEnd) {
			endDate = '';
			endTime = '';
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div
	use:portal
	class="modal-backdrop {isClosing ? 'backdrop-exit' : 'backdrop-enter'}"
	on:click={handleBackdropClick}
	on:keydown={handleKeydown}
	role="dialog"
	aria-modal="true"
	tabindex="-1"
>
	<div class="modal-content-wrapper">
		<div class="bg-navbar rounded-2xl shadow-2xl max-w-xl w-full flex flex-col {isClosing ? 'modal-exit' : 'modal-enter'} border border-gray1 my-auto">
		
		<!-- Header -->
		<div class="flex items-center justify-between p-6 border-b border-gray1 flex-shrink-0">
			<h2 class="text-xl font-bold text-white">
				{announcement ? 'Edit' : 'Create'} Announcement
			</h2>
			<button
				on:click={closeModal}
				class="p-2 text-gray2 hover:text-white hover:bg-gray1 rounded-lg transition-colors cursor-pointer"
				aria-label="Close modal"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="p-6 space-y-4 overflow-y-auto custom-scroll">
			<!-- Title -->
			<div>
				<label for="title" class="block text-xs text-gray3 uppercase font-bold mb-2">
					Title *
				</label>
				<input
					id="title"
					type="text"
					bind:value={title}
					placeholder="Enter announcement title"
					class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-sm placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime cursor-text"
					maxlength="255"
				/>
			</div>

			<!-- Description -->
			<div>
				<label for="description" class="block text-xs text-gray3 uppercase font-bold mb-2">
					Description *
				</label>
				<textarea
					id="description"
					bind:value={description}
					placeholder="Enter announcement description"
					rows="4"
					class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-sm placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime resize-none cursor-text"
				></textarea>
			</div>

			<!-- Start Date & Time -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<div class="block text-xs text-gray3 uppercase font-bold">
						Start Date & Time (Montreal)
					</div>
					<button
						type="button"
						on:click={toggleStartNow}
						class="text-xs font-bold px-2 py-1 rounded transition-colors cursor-pointer {useNowForStart ? 'bg-lime text-black' : 'bg-gray1 text-gray3 hover:text-white'}"
					>
						{useNowForStart ? '✓ Now' : 'Set Now'}
					</button>
				</div>
				
				<div class="grid grid-cols-2 gap-2">
					<input
						type="text"
						bind:value={startDate}
						disabled={useNowForStart}
						placeholder="YYYY-MM-DD"
						class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-sm placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime disabled:opacity-50 disabled:cursor-not-allowed cursor-text"
					/>
					<input
						type="time"
						bind:value={startTime}
						disabled={useNowForStart}
						class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					/>
				</div>
			</div>

			<!-- End Date & Time -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<div class="block text-xs text-gray3 uppercase font-bold">
						End Date & Time (Montreal)
					</div>
					<button
						type="button"
						on:click={toggleEndNow}
						class="text-xs font-bold px-2 py-1 rounded transition-colors cursor-pointer {useNowForEnd ? 'bg-lime text-black' : 'bg-gray1 text-gray3 hover:text-white'}"
					>
						{useNowForEnd ? '✓ Now' : 'Set Now'}
					</button>
				</div>
				
				<div class="grid grid-cols-2 gap-2">
					<input
						type="text"
						bind:value={endDate}
						disabled={useNowForEnd}
						placeholder="YYYY-MM-DD"
						class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-sm placeholder-gray2 focus:outline-none focus:ring-2 focus:ring-lime disabled:opacity-50 disabled:cursor-not-allowed cursor-text"
					/>
					<input
						type="time"
						bind:value={endTime}
						disabled={useNowForEnd}
						class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					/>
				</div>
			</div>

			<!-- Enable Toggle -->
			<div>
				<div class="block text-xs text-gray3 uppercase font-bold mb-2">
					Status
				</div>
				<button
					type="button"
					on:click={() => (isEnabled = !isEnabled)}
					class="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer {isEnabled
						? 'bg-lime text-black'
						: 'bg-gray1 text-gray2'}"
				>
					<span class="text-sm font-bold">{isEnabled ? 'Enabled' : 'Disabled'}</span>
					<div
						class="w-12 h-6 rounded-full transition-colors relative {isEnabled
							? 'bg-black'
							: 'bg-navbar'}"
					>
						<div
							class="absolute top-0.5 transition-all duration-200 w-5 h-5 rounded-full bg-lime {isEnabled
								? 'left-6'
								: 'left-1'}"
						></div>
					</div>
				</button>
			</div>
		</div>

		<!-- Footer -->
		<div class="px-6 pb-6 border-t border-gray1 pt-4">
			<div class="flex gap-2">
				<button
					type="button"
					on:click={closeModal}
					class="flex-1 px-4 py-2 bg-gray1 text-white text-sm font-bold rounded-lg hover:bg-gray2 transition-colors cursor-pointer"
					disabled={isSaving}
				>
					Cancel
				</button>
				<button
					type="button"
					on:click={handleSave}
					class="flex-1 px-4 py-2 bg-lime text-black text-sm font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					disabled={!canSave || isSaving}
				>
					{isSaving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>

	</div>
	</div>
</div>

<style>
	.modal-backdrop {
		backdrop-filter: blur(6px);
		background: rgba(0, 0, 0, 0.75);
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 99999;
		overflow-y: auto;
	}

	.modal-content-wrapper {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.modal-enter {
		animation: modalEnter 0.3s ease-out forwards;
	}

	.modal-exit {
		animation: modalExit 0.2s ease-in forwards;
	}

	.backdrop-enter {
		animation: backdropEnter 0.3s ease-out forwards;
	}

	.backdrop-exit {
		animation: backdropExit 0.2s ease-in forwards;
	}

	@keyframes modalEnter {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes modalExit {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(20px);
		}
	}

	@keyframes backdropEnter {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes backdropExit {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	.custom-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scroll::-webkit-scrollbar-track {
		background: #1a1a1a;
	}
	.custom-scroll::-webkit-scrollbar-thumb {
		background: #e1ff00;
		border-radius: 3px;
	}
	.custom-scroll::-webkit-scrollbar-thumb:hover {
		background: #f0ff4d;
	}
</style>