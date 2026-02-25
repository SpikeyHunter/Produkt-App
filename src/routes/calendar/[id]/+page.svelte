<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/authStore';
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventHeader from '$lib/components/calendar/page/EventHeader.svelte';
	import VenueSettingsModal from '$lib/components/calendar/VenueSettingsModal.svelte';

	export let data: PageData;
	$: ({ event, groupEvents, venues } = data);

	const tabs = [
		'Deals',
		'Revenue',
		'Pro Forma',
		'Costs',
		'Internal Settlement',
		'Run of Show',
		'Contacts',
		'Notes',
		'Files'
	];
	let activeTab = tabs[0];
	let isSidebarOpen = true;

	// Venue Settings Modal State
	let showSettingsModal = false;
	let selectedSettingsVenueId: string | null = null;

	// --- NEW PERMISSION & AUTH LOGIC ---
	let authState: 'loading' | 'authenticated' = 'loading';
	let showMainLayout = false;
	let userRole = 'Email Only';

	// Only Editor and Admin can edit things on this page
	$: isEditor = ['Editor', 'Admin'].includes(userRole);

	onMount(() => {
		// Set initial tab based on URL
		const pathParts = window.location.pathname.split('/');
		const possibleTab = pathParts[pathParts.length - 1].replace(/-/g, ' ');
		const matchedTab = tabs.find((t) => t.toLowerCase() === possibleTab.toLowerCase());
		if (matchedTab) activeTab = matchedTab;

		// Check Authentication
		checkAuth();
	});

	// Wait for authStore to initialize before checking
	$: if (browser && $authStore.isInitialized && authState === 'loading') {
		checkAuth();
	}

	function checkAuth() {
		if ($authStore.profile) {
			const sessionUser = $authStore.profile;
			const hasBasePerm =
				sessionUser.role === 'Admin' ||
				sessionUser.main_permission === 'Calendar' ||
				(sessionUser.secondary_permission || []).includes('Calendar') ||
				(sessionUser.page_permissions || []).includes('CalendarEditor');

			if (hasBasePerm) {
				showMainLayout = true;

				// OVERRIDE: If they are a global App Admin, force the Calendar Admin role
				if (sessionUser.role === 'Admin') {
					userRole = 'Admin';
					authState = 'authenticated';
				} else {
					verifyCalendarUserRole(sessionUser.email || '');
				}
			} else {
				goto('/dashboard', { replaceState: true });
			}
		} else if ($authStore.isInitialized) {
			showMainLayout = false;
			checkGuestAccess();
		}
	}

	async function verifyCalendarUserRole(email: string) {
		const { data, error } = await supabase
			.from('calendar_users')
			.select('*')
			.eq('email', email)
			.single();

		// Only Manager, Editor, and Admin can access the page [id]
		if (data && ['Manager', 'Editor', 'Admin'].includes(data.role)) {
			userRole = data.role;
			authState = 'authenticated';
		} else {
			goto('/calendar', { replaceState: true });
		}
	}

	function checkGuestAccess() {
		try {
			const stored = localStorage.getItem('calendar_guest_session');
			if (stored) {
				const { email, expiry } = JSON.parse(stored);
				if (Date.now() < expiry) {
					verifyCalendarUserRole(email);
					return;
				} else {
					localStorage.removeItem('calendar_guest_session');
				}
			}
		} catch (e) {}

		goto('/calendar', { replaceState: true });
	}
	// -----------------------------------

	function handleTabChange(e: CustomEvent<string>) {
		activeTab = e.detail;
		const slug = activeTab.toLowerCase().replace(/\s+/g, '-');
		window.history.pushState({}, '', `/calendar/${event.short_id}/${slug}`);
	}

	function handleOpenSettings(e: CustomEvent<{ venueId: string | null }>) {
		selectedSettingsVenueId = e.detail.venueId;
		showSettingsModal = true;
	}

	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}
</script>

<svelte:head>
	<title>{event.calendar?.title || 'Event'} - Produkt App</title>
</svelte:head>

<div class="absolute z-[9999]">
	<VenueSettingsModal
		bind:isOpen={showSettingsModal}
		venueId={selectedSettingsVenueId}
		on:success={() => invalidateAll()}
	/>
</div>

{#if authState === 'loading'}
	<div class="w-full h-screen bg-gray1 flex items-center justify-center">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
	</div>
{:else if showMainLayout}
	<MainLayout pageTitle={event.calendar?.title || 'Event Details'}>
		<slot name="page-content">
			<div class="h-full w-full flex flex-col bg-gray1 overflow-hidden text-white">
				<EventHeader
					{event}
					{groupEvents}
					{venues}
					{tabs}
					{activeTab}
					{isSidebarOpen}
					on:tabChange={handleTabChange}
					on:openSettings={handleOpenSettings}
					on:toggleSidebar={toggleSidebar}
				/>
				<div class="flex-1 flex overflow-hidden px-3 pt-8 pb-5 gap-5 min-h-0 relative">
					<div
						class="flex-1 flex flex-col min-w-0 bg-navbar border border-gray2/10 rounded-2xl shadow-sm relative overflow-hidden"
					>
						<div class="px-6 py-6 border-b border-gray2/10 flex flex-col gap-4 shrink-0">
							<h2 class="text-xl font-black uppercase tracking-wide text-white">{activeTab}</h2>
							<div class="flex items-center gap-3">
								{#if activeTab === 'Deals' && isEditor}
									<button
										class="px-5 py-2.5 border border-gray2/20 text-lime font-bold rounded-lg hover:bg-white/5 transition-colors text-sm cursor-pointer"
										>Create Partner Deal</button
									>
									<button
										class="px-5 py-2.5 bg-lime text-black font-bold rounded-lg hover:bg-lime/90 transition-colors text-sm cursor-pointer"
										>Create Artist Deal</button
									>
								{/if}
							</div>
						</div>
						<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
							<div
								class="w-full text-gray2 font-medium flex items-start justify-start border-2 border-dashed border-gray2/10 rounded-xl p-6"
							>
								<p>Placeholder content for {activeTab} will load here.</p>
							</div>
						</div>
					</div>
					<div
						class="transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden shrink-0 {isSidebarOpen
							? 'w-[320px] opacity-100'
							: 'w-0 opacity-0'}"
					>
						<div
							class="w-[320px] h-full bg-navbar border border-gray2/10 rounded-2xl shadow-sm flex flex-col overflow-hidden"
						>
							<div class="px-6 py-6 border-b border-gray2/10 shrink-0">
								<h3 class="text-xs font-black text-gray2 uppercase tracking-widest mb-4">
									Sidebar
								</h3>
								<div class="bg-gray1 rounded-xl border border-gray2/10 p-4">
									<p class="text-xs font-bold text-gray2 uppercase tracking-wider mb-1">
										Active Module
									</p>
									<p class="text-sm font-bold text-white truncate">{activeTab} Details</p>
								</div>
							</div>
							<div class="p-6 flex-1 overflow-y-auto custom-scrollbar">
								<div class="space-y-6">
									<div>
										<h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">
											Tasks
										</h4>
										{#if isEditor}
											<button
												class="w-full py-2 border border-gray2/20 rounded-lg text-sm font-bold text-gray2 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
												>+ Add a task</button
											>
										{/if}
									</div>
									<div>
										<h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">
											Activity Log
										</h4>
										<div
											class="h-24 bg-gray1 rounded-lg border border-gray2/10 flex items-center justify-center text-xs text-gray2 font-medium"
										>
											No recent activity
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</slot>
	</MainLayout>
{:else}
	<div class="w-full h-screen bg-gray1 overflow-hidden flex flex-col p-4">
		<div class="h-full w-full flex flex-col bg-gray1 overflow-hidden text-white rounded-2xl">
			<EventHeader
				{event}
				{groupEvents}
				{venues}
				{tabs}
				{activeTab}
				{isSidebarOpen}
				on:tabChange={handleTabChange}
				on:openSettings={handleOpenSettings}
				on:toggleSidebar={toggleSidebar}
			/>
			<div class="flex-1 flex overflow-hidden px-3 pt-8 pb-5 gap-5 min-h-0 relative">
				<div
					class="flex-1 flex flex-col min-w-0 bg-navbar border border-gray2/10 rounded-2xl shadow-sm relative overflow-hidden"
				>
					<div class="px-6 py-6 border-b border-gray2/10 flex flex-col gap-4 shrink-0">
						<h2 class="text-xl font-black uppercase tracking-wide text-white">{activeTab}</h2>
						<div class="flex items-center gap-3">
							{#if activeTab === 'Deals' && isEditor}
								<button
									class="px-5 py-2.5 border border-gray2/20 text-lime font-bold rounded-lg hover:bg-white/5 transition-colors text-sm cursor-pointer"
									>Create Partner Deal</button
								>
								<button
									class="px-5 py-2.5 bg-lime text-black font-bold rounded-lg hover:bg-lime/90 transition-colors text-sm cursor-pointer"
									>Create Artist Deal</button
								>
							{/if}
						</div>
					</div>
					<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
						<div
							class="w-full text-gray2 font-medium flex items-start justify-start border-2 border-dashed border-gray2/10 rounded-xl p-6"
						>
							<p>Placeholder content for {activeTab} will load here.</p>
						</div>
					</div>
				</div>
				<div
					class="transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden shrink-0 {isSidebarOpen
						? 'w-[320px] opacity-100'
						: 'w-0 opacity-0'}"
				>
					<div
						class="w-[320px] h-full bg-navbar border border-gray2/10 rounded-2xl shadow-sm flex flex-col overflow-hidden"
					>
						<div class="px-6 py-6 border-b border-gray2/10 shrink-0">
							<h3 class="text-xs font-black text-gray2 uppercase tracking-widest mb-4">Sidebar</h3>
							<div class="bg-gray1 rounded-xl border border-gray2/10 p-4">
								<p class="text-xs font-bold text-gray2 uppercase tracking-wider mb-1">
									Active Module
								</p>
								<p class="text-sm font-bold text-white truncate">{activeTab} Details</p>
							</div>
						</div>
						<div class="p-6 flex-1 overflow-y-auto custom-scrollbar">
							<div class="space-y-6">
								<div>
									<h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">Tasks</h4>
									{#if isEditor}
										<button
											class="w-full py-2 border border-gray2/20 rounded-lg text-sm font-bold text-gray2 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
											>+ Add a task</button
										>
									{/if}
								</div>
								<div>
									<h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">
										Activity Log
									</h4>
									<div
										class="h-24 bg-gray1 rounded-lg border border-gray2/10 flex items-center justify-center text-xs text-gray2 font-medium"
									>
										No recent activity
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(189, 189, 187, 0.2);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(225, 255, 0, 0.5);
	}
</style>
