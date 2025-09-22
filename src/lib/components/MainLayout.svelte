<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { logout } from '$lib/stores/auth';

	// --- PROPS & STATE ---
	export let pageTitle: string = 'Dashboard';

	// Navigation state
	let isNavExpanded = true;
	let activeSubMenu: string | null = null;

	// UI state
	let isLoading = false;
	let isMounted = false;
	let playAnimations = false;
	let navElement: HTMLElement;

	// --- TYPES ---
	interface SubMenuItem {
		label: string;
		route: string;
	}

	interface MenuItem {
		id: string;
		label: string;
		icon: string;
		subItems: SubMenuItem[];
		route?: string;
	}

	// --- LIFECYCLE ---
	onMount(() => {
		const savedNavState = localStorage.getItem('isNavExpanded');
		isNavExpanded = savedNavState ? savedNavState === 'true' : true;
		setActiveSubMenuFromRoute($page.url.pathname);
		const hasPlayed = sessionStorage.getItem('animationsPlayed');
		if (!hasPlayed) {
			playAnimations = true;
			sessionStorage.setItem('animationsPlayed', 'true');
		}
		isMounted = true;

		function handleDocumentClick(event: MouseEvent) {
			if (isNavExpanded && navElement && !navElement.contains(event.target as Node)) {
				isNavExpanded = false;
				localStorage.setItem('isNavExpanded', 'false');
			}
		}
		document.addEventListener('click', handleDocumentClick);

		return () => {
			document.removeEventListener('click', handleDocumentClick);
		};
	});

	// --- REACTIVITY ---
	$: ($page.url.pathname, setActiveSubMenuFromRoute($page.url.pathname));
	$: if (!isNavExpanded) {
		activeSubMenu = null;
	}

	// --- DATA ---
	const icons = {
		dashboard: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
		calendar: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
		marketing: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"></path><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path></svg>`,
		booking: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
		advancing: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
		production: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>`,
		dataEditor: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10,9 9,9 8,9"></polyline></svg>`,
		settings: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
		arrow: `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
		logout: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
		toggle: `<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`
	};

	const menuItems: MenuItem[] = [
		{ id: 'dashboard', label: 'Dashboard', icon: icons.dashboard, route: '/dashboard', subItems: [] },
		{ id: 'calendar', label: 'Calendar', icon: icons.calendar, route: '/calendar', subItems: [] },
		{
			id: 'marketing',
			label: 'Marketing',
			icon: icons.marketing,
			subItems: [
				{ label: 'Events Info', route: '/marketing/eventsinfo' }
			]
		},
		{
			id: 'booking',
			label: 'Booking',
			icon: icons.booking,
			subItems: [
				{ label: 'Set Times', route: '/booking/settimes' }
			]
		},
		{
			id: 'advancing',
			label: 'Advancing',
			icon: icons.advancing,
			subItems: [
				{ label: 'Advance Gathered', route: '/advancing/gathered' }
			]
		},
		{
			id: 'production',
			label: 'Production',
			icon: icons.production,
			subItems: [
				{ label: 'Backline', route: '/production/backline' }
			]
		}
	];

	// --- FUNCTIONS ---
	function toggleNav() {
		isNavExpanded = !isNavExpanded;
		localStorage.setItem('isNavExpanded', String(isNavExpanded));
	}

	function handleMenuClick(item: MenuItem) {
		if (item.route) {
			navigateToRoute(item.route);
			return;
		}
		if (item.subItems.length > 0) {
			if (!isNavExpanded) {
				isNavExpanded = true;
				localStorage.setItem('isNavExpanded', 'true');
				activeSubMenu = item.id;
			} else {
				activeSubMenu = activeSubMenu === item.id ? null : item.id;
			}
		}
	}

	function navigateToRoute(route: string) {
		if ($page.url.pathname === route) return;
		goto(route);
	}

	async function handleLogout() {
		isLoading = true;
		try {
			await logout();
		} catch (error) {
			console.error('Logout failed', error);
		} finally {
			isLoading = false;
		}
	}

	function setActiveSubMenuFromRoute(pathname: string) {
		if (!isNavExpanded) return;
		const activeParent = menuItems.find((item) =>
			item.subItems.some((sub) => pathname.startsWith(sub.route))
		);
		activeSubMenu = activeParent ? activeParent.id : null;
	}

	function isActive(item: MenuItem | SubMenuItem): boolean {
		const currentPath = $page.url.pathname;
		if ('subItems' in item) {
			if (item.route) return currentPath.startsWith(item.route);
			return item.subItems.some((sub) => currentPath.startsWith(sub.route));
		}
		return currentPath.startsWith(item.route);
	}
</script>

<div class="flex h-screen bg-gray1 text-white font-sans">
	<nav bind:this={navElement} class="navbar" class:collapsed={!isNavExpanded}>
		<div class="flex flex-col h-full">
			<div class="nav-header" class:animate-in={playAnimations}>
				<div class="header-content-expanded">
					<img src="/images/ProduktXX_LOGO1.png" alt="ProduktXX Logo" class="logo mb-2" />
					<div class="welcome-text">
						<span class="text-sm text-gray2">Welcome back!</span>
					</div>
				</div>
				<button
					type="button"
					class="toggle-button-collapsed"
					on:click={toggleNav}
					aria-label="Expand navigation"
				>
					{@html icons.toggle}
				</button>
			</div>
			<div class="flex-1 nav-scroll-area flex flex-col">
				<div class="flex-grow">
					{#each menuItems as item, i (item.id)}
						<div
							class="nav-item-container"
							in:fly={playAnimations
								? { y: 20, duration: 400, delay: i * 50 + 200, easing: quintOut }
								: { duration: 0 }}
						>
							<button
								type="button"
								class="nav-button"
								class:active={isActive(item)}
								on:click={() => handleMenuClick(item)}
								aria-haspopup={item.subItems.length > 0}
								aria-expanded={activeSubMenu === item.id}
							>
								<span class="icon">{@html item.icon}</span>
								<span class="label">{item.label}</span>
								{#if item.subItems.length > 0}
									<span class="arrow" class:rotated={activeSubMenu === item.id}>
										{@html icons.arrow}
									</span>
								{/if}
							</button>

							{#if item.subItems.length > 0}
								<div class="submenu-container" class:expanded={activeSubMenu === item.id}>
									<div class="submenu-content">
										{#each item.subItems as subItem (subItem.route)}
											<button
												type="button"
												class="submenu-button"
												class:active={isActive(subItem)}
												on:click={() => navigateToRoute(subItem.route)}
											>
												{subItem.label}
											</button>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}

					<div
						class="nav-item-container"
						in:fly={playAnimations
							? { y: 20, duration: 400, delay: menuItems.length * 50 + 200, easing: quintOut }
							: { duration: 0 }}
					>
						<button type="button" class="nav-button disabled">
							<span class="icon">{@html icons.dataEditor}</span>
							<span class="label">Coming Soon</span>
						</button>
					</div>
				</div>
				<div class="mt-auto">
					<div class="nav-separator"></div>
					<div
						class="nav-item-container"
						in:fly={playAnimations
							? { y: 20, duration: 400, delay: (menuItems.length + 1) * 50 + 200, easing: quintOut }
							: { duration: 0 }}
					>
						<button
							type="button"
							class="nav-button"
							class:active={$page.url.pathname.startsWith('/settings')}
							on:click={() => navigateToRoute('/settings')}
						>
							<span class="icon">{@html icons.settings}</span>
							<span class="label">Settings</span>
						</button>
					</div>
					<div
						class="nav-item-container"
						in:fly={playAnimations
							? { y: 20, duration: 400, delay: (menuItems.length + 2) * 50 + 200, easing: quintOut }
							: { duration: 0 }}
					>
						<button type="button" class="nav-button" on:click={handleLogout} disabled={isLoading}>
							<span class="icon">
								{#if isLoading}
									<div
										class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"
									></div>
								{:else}
									{@html icons.logout}
								{/if}
							</span>
							<span class="label">{isLoading ? 'Logging out...' : 'Logout'}</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	</nav>

	<div class="main-content">
		<header class="p-6 flex items-center justify-between flex-shrink-0 border-b border-gray2">
			{#if isMounted}
				<div in:fly={playAnimations ? { y: -20, duration: 500, easing: quintOut } : { duration: 0 }}>
					<h1 class="text-4xl font-bold text-white">{pageTitle}</h1>
				</div>
			{/if}
		</header>
		<main class="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6">
			<slot />
		</main>
	</div>
</div>
<style>
	:root {
		--nav-width-expanded: 256px;
		--nav-width-collapsed: 88px;
		--transition-duration: 0.3s;
		--transition-easing: cubic-bezier(0.4, 0, 0.2, 1);
		--nav-bg: var(--color-navbar);
		--accent-color: var(--color-lime);
		--text-primary: var(--color-white);
		--text-secondary: var(--color-gray2);
		--text-tertiary: #6b7280;
		--hover-bg: rgba(var(--color-lime-rgb), 0.1);
	}
	.navbar {
		width: var(--nav-width-expanded);
		background-color: var(--nav-bg);
		flex-shrink: 0;
		transition: width var(--transition-duration) var(--transition-easing);
		overflow: hidden;
		border-right: 1px solid var(--color-gray1);
	}
	.navbar.collapsed {
		width: var(--nav-width-collapsed);
	}
	.main-content {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-width: 0;
	}
	.nav-header {
		position: relative;
		display: flex;
		align-items: center;
		padding: 1.5rem;
		height: 89px;
		flex-shrink: 0;
	}
	@keyframes header-fade-in {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	.nav-header.animate-in {
		animation: header-fade-in 0.4s var(--transition-easing) forwards;
	}
	.header-content-expanded {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		transition:
			opacity 0.2s ease-in-out,
			transform 0.3s var(--transition-easing);
		opacity: 1;
		transform: translateX(0);
	}
	.navbar.collapsed .header-content-expanded {
		opacity: 0;
		pointer-events: none;
		transform: translateX(-20px);
	}
	.logo {
		height: 1.5rem;
	}
	.toggle-button-collapsed {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		padding: 0.5rem;
		border-radius: 0.5rem;
		color: var(--text-secondary);
		cursor: pointer;
		transition: opacity 0.2s ease-in-out;
		opacity: 0;
		pointer-events: none;
	}
	.navbar.collapsed .toggle-button-collapsed {
		opacity: 1;
		pointer-events: auto;
	}
	.toggle-button-collapsed:hover {
		color: var(--text-primary);
		background-color: var(--hover-bg);
	}
	.nav-scroll-area {
		padding: 0 1rem 1rem 1rem;
		overflow-y: auto;
		overflow-x: hidden;
	}
	.nav-separator {
		height: 1px;
		background-color: var(--color-gray1);
		margin: 1rem 0;
		transition: opacity var(--transition-duration) var(--transition-easing);
	}
	.navbar.collapsed .nav-separator {
		opacity: 0;
	}
	.nav-item-container {
		margin-bottom: 0.5rem;
	}
	.nav-button {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		text-align: left;
		font-weight: 700;
		font-size: 1rem;
		color: var(--text-secondary);
		transition:
			background-color 0.2s ease,
			color 0.2s ease;
		cursor: pointer;
	}
	.navbar.collapsed .nav-button {
		justify-content: center;
	}
	.nav-button:hover:not(.active):not(.disabled) {
		background-color: var(--hover-bg);
		color: var(--text-primary);
	}
	.nav-button.active {
		background-color: var(--accent-color);
		color: var(--color-black);
	}
	.nav-button.disabled {
		color: var(--text-tertiary);
		cursor: not-allowed;
	}
	.icon {
		flex-shrink: 0;
		margin-right: 1rem;
		transition: margin-right var(--transition-duration) var(--transition-easing);
	}
	.navbar.collapsed .icon {
		margin-right: 0;
	}
	.label,
	.arrow {
		white-space: nowrap;
		opacity: 1;
		transition: opacity var(--transition-duration) var(--transition-easing);
		width: auto;
	}
	.navbar.collapsed .label,
	.navbar.collapsed .arrow {
		opacity: 0;
		width: 0;
		pointer-events: none;
	}
	.arrow {
		margin-left: auto;
		transition:
			transform 0.2s ease,
			opacity var(--transition-duration) var(--transition-easing);
	}
	.arrow.rotated {
		transform: rotate(180deg);
	}
	.submenu-container {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows var(--transition-duration) ease-in-out;
	}
	.submenu-container.expanded {
		grid-template-rows: 1fr;
	}
	.submenu-content {
		overflow: hidden;
		padding-top: 0.25rem;
		padding-left: 1.5rem;
	}
	.submenu-button {
		display: block;
		width: 100%;
		padding: 0.5rem 1rem;
		text-align: left;
		font-size: 0.875rem;
		border-radius: 0.5rem;
		color: var(--text-secondary);
		transition:
			background-color 0.2s ease,
			color 0.2s ease;
		cursor: pointer;
	}
	.submenu-button:hover:not(.active) {
		background-color: var(--hover-bg);
		color: var(--text-primary);
	}
	.submenu-button.active {
		background-color: var(--accent-color);
		color: var(--color-black);
		font-weight: 600;
	}
	:global(html) {
		scrollbar-width: auto;
		scrollbar-color: var(--color-lime) transparent;
	}
	:global(*::-webkit-scrollbar) {
		width: 6px;
		height: 6px;
	}
	:global(*::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(*::-webkit-scrollbar-thumb) {
		background: var(--color-lime);
		border-radius: 3px;
		border: none;
	}
	:global(*::-webkit-scrollbar-thumb:hover) {
		background: var(--color-lime);
		opacity: 0.9;
	}
	:global(*::-webkit-scrollbar-corner) {
		background: transparent;
	}
</style>