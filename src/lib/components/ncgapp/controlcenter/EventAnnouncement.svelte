<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fetchAnnouncements, updateAnnouncement, deleteAnnouncement, subscribeToAnnouncements } from '$lib/services/announcementService';
	import type { Announcement } from '$lib/types/announcements';
	import AnnouncementModal from './AnnouncementModal.svelte';

	let announcements: Announcement[] = [];
	let loading = true;
	let showModal = false;
	let selectedAnnouncement: Announcement | null = null;
	let unsubscribe: (() => void) | null = null;

	onMount(async () => {
		await loadAnnouncements();
		
		// Subscribe to real-time updates
		unsubscribe = subscribeToAnnouncements((updatedAnnouncements) => {
			announcements = updatedAnnouncements;
		});
	});

	onDestroy(() => {
		if (unsubscribe) {
			unsubscribe();
		}
	});

	async function loadAnnouncements() {
		loading = true;
		announcements = await fetchAnnouncements();
		loading = false;
	}

	function handleCreate() {
		selectedAnnouncement = null;
		showModal = true;
	}

	function handleEdit(announcement: Announcement) {
		selectedAnnouncement = announcement;
		showModal = true;
	}

	function handleCloseModal() {
		showModal = false;
		selectedAnnouncement = null;
	}

	async function handleToggle(announcement: Announcement) {
		const success = await updateAnnouncement(announcement.id, {
			is_enabled: !announcement.is_enabled
		});

		if (success) {
			await loadAnnouncements();
		}
	}

	async function handleDelete(id: number) {
		if (confirm('Are you sure you want to delete this announcement?')) {
			const success = await deleteAnnouncement(id);
			if (success) {
				await loadAnnouncements();
			}
		}
	}

	function formatDateTime(dateString: string | null): string {
		if (!dateString) return 'Not set';
		try {
			const date = new Date(dateString);
			return date.toLocaleString('en-US', {
				timeZone: 'America/New_York',
				month: 'short',
				day: 'numeric',
				year: 'numeric',
				hour: 'numeric',
				minute: '2-digit',
				hour12: true
			});
		} catch {
			return dateString;
		}
	}

	function getStatusColor(announcement: Announcement): string {
		if (!announcement.is_enabled) return 'bg-gray2';
		
		switch (announcement.status) {
			case 'active':
				return 'bg-green-500';
			case 'scheduled':
				return 'bg-yellow-500';
			case 'ended':
				return 'bg-red-500';
			case 'manual':
				return 'bg-blue-500';
			default:
				return 'bg-gray2';
		}
	}

	function getStatusText(announcement: Announcement): string {
		if (!announcement.is_enabled) return 'Disabled';
		
		switch (announcement.status) {
			case 'active':
				return 'Active';
			case 'scheduled':
				return 'Scheduled';
			case 'ended':
				return 'Ended';
			case 'manual':
				return 'Manual';
			default:
				return 'Unknown';
		}
	}
</script>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden">
	<div class="p-3 border-b border-gray1 flex-shrink-0">
		<div class="flex items-center justify-between mb-2">
			<h3 class="text-white text-sm font-bold">Event Announcements</h3>
			<button
				on:click={handleCreate}
				class="px-3 py-1.5 bg-lime text-black text-xs font-bold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1"
			>
				<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				Create
			</button>
		</div>
		<p class="text-gray3 text-[10px]">{announcements.length} announcement{announcements.length !== 1 ? 's' : ''}</p>
	</div>

	<div class="flex-1 overflow-y-auto px-3 pt-4 mb-4 space-y-2 custom-scroll">
		{#if loading}
			<div class="space-y-2">
				{#each Array(3) as _}
					<div class="animate-pulse h-24 bg-gray1 rounded-lg"></div>
				{/each}
			</div>
		{:else if announcements.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg class="w-12 h-12 text-gray2 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
				</svg>
				<p class="text-gray2 text-xs">No announcements yet</p>
				<p class="text-gray3 text-[10px] mt-1">Click Create to add one</p>
			</div>
		{:else}
			{#each announcements as announcement (announcement.id)}
				<div class="bg-gray1 rounded-lg p-3 space-y-2 hover:bg-gray1/80 transition-colors">
					<div class="flex items-start justify-between gap-2">
						<div class="flex-1 min-w-0">
							<h4 class="text-white text-xs font-bold truncate">{announcement.title}</h4>
							<p class="text-gray3 text-[10px] mt-0.5 description-clamp">{announcement.description}</p>
						</div>
						
						<div class="flex items-center gap-1 flex-shrink-0">
							<span class="px-2 py-0.5 rounded text-[9px] font-bold text-black {getStatusColor(announcement)}">
								{getStatusText(announcement)}
							</span>
						</div>
					</div>

					{#if announcement.start_date || announcement.end_date}
						<div class="text-[10px] text-gray3 space-y-0.5">
							{#if announcement.start_date}
								<div class="flex items-center gap-1">
									<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="12" cy="12" r="10"></circle>
										<polyline points="12 6 12 12 16 14"></polyline>
									</svg>
									<span>Start: {formatDateTime(announcement.start_date)} ET</span>
								</div>
							{/if}
							{#if announcement.end_date}
								<div class="flex items-center gap-1">
									<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<circle cx="12" cy="12" r="10"></circle>
										<polyline points="12 6 12 12 16 14"></polyline>
									</svg>
									<span>End: {formatDateTime(announcement.end_date)} ET</span>
								</div>
							{/if}
						</div>
					{:else}
						<div class="text-[10px] text-gray3">
							<span>Manual control only</span>
						</div>
					{/if}

					<div class="flex items-center gap-2 pt-1">
						<button
							on:click={() => handleToggle(announcement)}
							class="flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors {announcement.is_enabled ? 'bg-lime text-black' : 'bg-navbar text-gray2'}"
						>
							<span class="text-[10px] font-bold">{announcement.is_enabled ? 'Enabled' : 'Disabled'}</span>
							<div class="w-8 h-4 rounded-full transition-colors relative {announcement.is_enabled ? 'bg-black' : 'bg-gray1'}">
								<div class="absolute top-0.5 transition-all duration-200 w-3 h-3 rounded-full bg-lime {announcement.is_enabled ? 'left-4' : 'left-0.5'}"></div>
							</div>
						</button>

						<button
							on:click={() => handleEdit(announcement)}
							class="p-1.5 bg-navbar hover:bg-gray2 rounded-lg transition-colors"
							title="Edit"
						>
							<svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
								<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
							</svg>
						</button>

						<button
							on:click={() => handleDelete(announcement.id)}
							class="p-1.5 bg-navbar hover:bg-red-500 rounded-lg transition-colors"
							title="Delete"
						>
							<svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<polyline points="3 6 5 6 21 6"></polyline>
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
							</svg>
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

{#if showModal}
	<AnnouncementModal
		announcement={selectedAnnouncement}
		on:close={handleCloseModal}
		on:saved={loadAnnouncements}
	/>
{/if}

<style>
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

	.description-clamp {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>