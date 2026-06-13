<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
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
	import ProFormaTab from '$lib/components/calendar/page/tabs/proforma/ProFormaTab.svelte';
	import CostsTab from '$lib/components/calendar/page/tabs/costs/CostsTab.svelte';
	import ContactsTab from '$lib/components/calendar/page/tabs/ContactsTab.svelte';
	import FilesTab from '$lib/components/calendar/page/tabs/FilesTab.svelte';

	let showQuickSearch = false;

	export let data: PageData;
	$: ({ event, groupEvents, venues, tabSlug } = data);

	// Track the actual active DB version vs the one being previewed
	$: currentVersionNum = event?.calendar?.current_version || 1;
	let viewedVersionNum = 0;
	let overrideCalendarData: any = null;

	// Safely initialize viewedVersionNum matching currentVersionNum without glitching
	$: if (viewedVersionNum === 0 && currentVersionNum !== 0) {
		viewedVersionNum = currentVersionNum;
	}

	// Reset when navigating to a new event
	let _currentEventId: number | null = null;
	$: if (event?.id && event.id !== _currentEventId) {
		_currentEventId = event.id;
		viewedVersionNum = currentVersionNum;
		overrideCalendarData = null;
	}
	// Snap back to current version when event status changes from Locked to Unlocked (e.g., Confirmed -> Hold)
	let _currentEventStatus: string | null = null;

	$: if (event?.status && event.status !== _currentEventStatus) {
		const oldStatus = _currentEventStatus;
		_currentEventStatus = event.status;

		const lockedStatuses = ['CONFIRMED', 'IN SETTLEMENT', 'SETTLED'];

		// If it transitioned from a locked state to an unlocked state
		if (oldStatus && lockedStatuses.includes(oldStatus) && !lockedStatuses.includes(event.status)) {
			viewedVersionNum = currentVersionNum;
			overrideCalendarData = null;
		}
	}

	// Trigger lock ONLY if we are viewing a historical/alternate version.
	// Status (Confirmed/Settled) no longer locks the page.
	$: isAlternateVersion = viewedVersionNum > 0 && viewedVersionNum !== currentVersionNum;
	$: isViewOnly = isAlternateVersion;

	$: viewOnlyLabel = isAlternateVersion ? 'Alternate Version Preview' : '';

	function handleSwitchVersion(e: Event) {
		const customEvent = e as CustomEvent;
		viewedVersionNum = customEvent.detail.versionNum;
		overrideCalendarData = customEvent.detail.calendarData;

		// FIX: Optimistically update the global event state to prevent the "View Only" glitch
		if (customEvent.detail.isGlobalChange && event?.calendar) {
			event.calendar.current_version = customEvent.detail.versionNum;
			event = event; // Trigger Svelte reactivity
		}
	}

	const tabs = ['Deals', 'Revenue', 'Pro Forma', 'Costs', 'Contacts', 'Files'];

	const tabComponents: Record<string, any> = {
		Deals: DealsTab,
		Revenue: RevenueTab,
		'Pro Forma': ProFormaTab,
		Costs: CostsTab,
		Contacts: ContactsTab,
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

	const DeployedAppTabs = ['Deals', 'Revenue', 'Pro Forma', 'Costs'];

	let isDeployed = false;

	$: if (browser) {
		isDeployed = !['localhost', '127.0.0.1'].includes(window.location.hostname);
	}

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
		activeTab = isDeployed ? DeployedAppTabs[0] || tabs[0] : tabs[0];
	}

	onMount(() => {
		checkAuth();
		if (typeof window !== 'undefined') {
			window.addEventListener('switchViewedVersion', handleSwitchVersion);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('switchViewedVersion', handleSwitchVersion);
		}
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
		if (isDeployed && !DeployedAppTabs.includes(requestedTab)) return;

		if (userRole === 'Manager' && requestedTab !== 'Deals') return;
		activeTab = requestedTab;
		const slug = activeTab.toLowerCase().replace(/\s+/g, '-');

		// Fixed router warning via native SvelteKit replaceState
		replaceState(`/calendar/${event.short_id}/${slug}`, $page.state);
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
				<div class="relative z-50 shrink-0">
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
				</div>

				<div class="flex-1 flex overflow-hidden px-3 pt-8 pb-5 gap-5 min-h-0 relative z-0">
					<div
						class="flex-1 flex flex-col min-w-0 bg-navbar border rounded-2xl shadow-sm relative overflow-hidden {isViewOnly
							? 'view-only-lock'
							: 'border-gray2/10'}"
					>
						{#if isViewOnly}
							<div
								class="pointer-events-none w-full shrink-0 z-[60] flex items-center justify-center gap-2 py-1.5 view-only-banner border-b backdrop-blur-sm"
							>
								<svg
									class="w-3.5 h-3.5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									stroke-width="2"
								>
									<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
									<path d="M7 11V7a5 5 0 0110 0v4"></path>
								</svg>
								<span class="text-[10px] font-black uppercase tracking-widest">
									{viewOnlyLabel ? `View Only Mode — ${viewOnlyLabel}` : 'View Only Mode'}
								</span>
							</div>
						{/if}

						{#key viewedVersionNum}
							<svelte:component
								this={tabComponents[activeTab]}
								{userRole}
								{event}
								eventDealData={overrideCalendarData
									? overrideCalendarData.event_deal
									: event?.calendar_data?.event_deal || {}}
								eventDate={event?.start_date || event?.date || ''}
								venueCurrency={event?.calendar?.currency || 'CAD'}
								{viewedVersionNum}
								{overrideCalendarData}
							/>
						{/key}
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
					class="flex-1 flex flex-col min-w-0 bg-navbar border rounded-2xl relative overflow-hidden {isViewOnly
						? 'view-only-lock'
						: 'border-gray2/10'}"
				>
					{#if isViewOnly}
						<div
							class="pointer-events-none w-full shrink-0 z-[60] flex items-center justify-center gap-2 py-1.5 view-only-banner border-b backdrop-blur-sm"
						>
							<svg
								class="w-3.5 h-3.5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								stroke-width="2"
							>
								<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
								<path d="M7 11V7a5 5 0 0110 0v4"></path>
							</svg>
							<span class="text-[10px] font-black uppercase tracking-widest">
								{viewOnlyLabel ? `View Only Mode — ${viewOnlyLabel}` : 'View Only Mode'}
							</span>
						</div>
					{/if}

					{#key viewedVersionNum}
						<svelte:component
							this={tabComponents[activeTab]}
							{userRole}
							{event}
							eventDealData={overrideCalendarData
								? overrideCalendarData.event_deal
								: event?.calendar_data?.event_deal || {}}
							eventDate={event?.start_date || event?.date || ''}
							venueCurrency={event?.calendar?.currency || 'CAD'}
							{viewedVersionNum}
							{overrideCalendarData}
						/>
					{/key}
				</div>
				<EventSidebar {isSidebarOpen} {userRole} {event} />
			</div>
		</div>
	</div>
{/if}

<style>
	/* =========================================================
	   VIEW ONLY OVERLAY COLORS 
	   Change these CSS variables to update the overlay color 
	   ========================================================= */
	:global(:root) {
		--view-only-bg: var(--color-transparent); /* Amber 400 at 5% opacity */
		--view-only-border: var(--color-problem); /* Amber 400 at 20% opacity */
		--view-only-text: var(--color-problem); /* Amber 400 */
	}

	.view-only-banner {
		background-color: var(--view-only-bg);
		border-bottom-color: var(--view-only-border);
		color: var(--view-only-text);
	}

	.view-only-lock {
		border-color: var(--view-only-border);
		border-width: 2px;
	}

	/* The children lose pointer events except explicitly allowed ones */
	:global(.locked-ui) {
		opacity: 0.4 !important;
		filter: grayscale(80%);
		cursor: not-allowed !important;
	}

	:global(.locked-ui *) {
		pointer-events: none !important;
		user-select: none !important;
	}

	/* ===== VIEW ONLY MODE =====
	   Disables interactive/edit controls inside the tab while keeping the content fully 
	   readable and scrollable. Buttons fade out to 0.5 opacity.
	   
	   NOTE: Elements with the class .view-only-exception are safely ignored 
	   (e.g., accordions/expand buttons).
	*/
	:global(.view-only-lock input:not(.view-only-exception)),
	:global(.view-only-lock textarea:not(.view-only-exception)),
	:global(.view-only-lock select:not(.view-only-exception)),
	:global(.view-only-lock button:not(.view-only-exception)),
	:global(.view-only-lock a[href]:not(.view-only-exception)),
	:global(.view-only-lock label:not(.view-only-exception)),
	:global(.view-only-lock [role='button']:not(.view-only-exception)),
	:global(.view-only-lock [draggable='true']:not(.view-only-exception)),
	:global(.view-only-lock [contenteditable='true']:not(.view-only-exception)) {
		pointer-events: none !important;
		cursor: not-allowed !important;
		opacity: 0.5 !important;
	}
</style>
