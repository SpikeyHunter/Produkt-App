<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/authStore';
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventHeader from '$lib/components/calendar/page/header/EventHeader.svelte';
	import VenueSettingsModal from '$lib/components/calendar/VenueSettingsModal.svelte';
	import EventSidebar from '$lib/components/calendar/page/sidebar/EventSidebar.svelte';
	import CalendarQuickSearch from '$lib/components/calendar/CalendarQuickSearch.svelte';

	// --- IMPORT TAB COMPONENTS ---
	import DealsTab from '$lib/components/calendar/page/tabs/deals/DealsTab.svelte';
	import RevenueTab from '$lib/components/calendar/page/tabs/revenue/RevenueTab.svelte';
	import ProFormaTab from '$lib/components/calendar/page/tabs/ProFormaTab.svelte';
	import CostsTab from '$lib/components/calendar/page/tabs/CostsTab.svelte';
	import InternalSettlementTab from '$lib/components/calendar/page/tabs/InternalSettlementTab.svelte';
	import RunOfShowTab from '$lib/components/calendar/page/tabs/RunOfShowTab.svelte';
	import ContactsTab from '$lib/components/calendar/page/tabs/ContactsTab.svelte';
	import NotesTab from '$lib/components/calendar/page/tabs/NotesTab.svelte';
	import FilesTab from '$lib/components/calendar/page/tabs/FilesTab.svelte';

	let showQuickSearch = false;

	export let data: PageData;
	$: ({ event, groupEvents, venues, tabSlug } = data);

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
	const tabComponents: Record<string, any> = {
		Deals: DealsTab,
		Revenue: RevenueTab,
		'Pro Forma': ProFormaTab,
		Costs: CostsTab,
		'Internal Settlement': InternalSettlementTab,
		'Run of Show': RunOfShowTab,
		Contacts: ContactsTab,
		Notes: NotesTab,
		Files: FilesTab
	};
	let activeTab = tabs[0];
	let isSidebarOpen = true;

	let showSettingsModal = false;
	let selectedSettingsVenueId: string | null = null;

	let authState: 'loading' | 'authenticated' = 'loading';
	let showMainLayout = false;
	let userRole = 'Email Only';
	$: isEditor = ['Editor', 'Admin'].includes(userRole);

	// 🔥 DEFINE ALLOWED TABS IN PRODUCTION HERE
	const DeployedAppTabs = ['Deals']; 
	
	let isDeployed = false;

	// Safely check hostname only in the browser
	$: if (browser) {
		isDeployed = !['localhost', '127.0.0.1'].includes(window.location.hostname);
	}

	// URL Tab Protection
	$: if (tabSlug) {
		const matchedTab = tabs.find(
			(t) => t.toLowerCase() === tabSlug.replace(/-/g, ' ').toLowerCase()
		);
		if (matchedTab) {
			if (isDeployed && !DeployedAppTabs.includes(matchedTab)) {
				activeTab = DeployedAppTabs[0] || tabs[0];
			} else {
				activeTab = matchedTab;
			}
		}
	} else {
		activeTab = isDeployed ? (DeployedAppTabs[0] || tabs[0]) : tabs[0];
	}

	onMount(() => {
		checkAuth();
	});

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

	function handleTabChange(e: CustomEvent<string>) {
		const requestedTab = e.detail;

		// 🛑 Block tab change if deployed and not allowed
		if (isDeployed && !DeployedAppTabs.includes(requestedTab)) return;

		if (userRole === 'Manager' && requestedTab !== 'Deals') return;
		activeTab = requestedTab;
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
	<title>{event?.calendar?.title || 'Event'}</title>
</svelte:head>

<div class="absolute z-9999">
	<VenueSettingsModal
		bind:isOpen={showSettingsModal}
		venueId={selectedSettingsVenueId}
		on:success={() => invalidateAll()}
	/>
	<CalendarQuickSearch bind:show={showQuickSearch} canEdit={isEditor} />
</div>

{#if authState === 'loading'}
	<div class="w-full h-screen bg-gray1 flex items-center justify-center">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
	</div>
{:else if showMainLayout}
	<MainLayout pageTitle={event?.calendar?.title || 'Event Details'}>
		<slot name="page-content">
			<div class="h-full w-full flex flex-col bg-gray1 overflow-hidden text-white">
				<EventHeader
					{event}
					{groupEvents}
					{venues}
					{tabs}
					{activeTab}
					{isSidebarOpen}
					{userRole}
					{isDeployed}
					deployedAppTabs={DeployedAppTabs}
					on:tabChange={handleTabChange}
					on:openSettings={handleOpenSettings}
					on:toggleSidebar={toggleSidebar}
				/>

				<div class="flex-1 flex overflow-hidden px-3 pt-8 pb-5 gap-5 min-h-0 relative">
					<div
						class="flex-1 flex flex-col min-w-0 bg-navbar border border-gray2/10 rounded-2xl shadow-sm relative overflow-hidden"
					>
						<svelte:component
							this={tabComponents[activeTab]}
							{userRole}
							{event}
							eventDealData={event?.calendar?.event_deal || event?.event_deal}
							eventDate={event?.start_date || event?.date || ''}
							venueCurrency={event?.calendar?.currency || 'CAD'}
						/>
					</div>
					<EventSidebar {isSidebarOpen} {userRole} {event} />
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
				{userRole}
				{isDeployed}
				deployedAppTabs={DeployedAppTabs}
				on:tabChange={handleTabChange}
				on:openSettings={handleOpenSettings}
				on:toggleSidebar={toggleSidebar}
			/>

			<div class="flex-1 flex overflow-hidden px-3 pt-8 pb-5 gap-5 min-h-0 relative">
				<div
					class="flex-1 flex flex-col min-w-0 bg-navbar border border-gray2/10 rounded-2xl shadow-sm relative overflow-hidden"
				>
					<svelte:component
						this={tabComponents[activeTab]}
						{userRole}
						{event}
						eventDealData={event?.calendar?.event_deal || event?.event_deal}
						eventDate={event?.start_date || event?.date || ''}
						venueCurrency={event?.calendar?.currency || 'CAD'}
					/>
				</div>
				<EventSidebar {isSidebarOpen} {userRole} {event} />
			</div>
		</div>
	</div>
{/if}

<style>
	/* The main wrapper gets the disabled cursor and grayed-out look */
	:global(.locked-ui) {
		opacity: 0.4 !important;
		filter: grayscale(80%);
		cursor: not-allowed !important;
	}

	/* The children lose pointer events so they can't be clicked, hovered, or highlighted, 
	   but the parent's cursor:not-allowed will still show up */
	:global(.locked-ui *) {
		pointer-events: none !important;
		user-select: none !important;
	}
</style>
