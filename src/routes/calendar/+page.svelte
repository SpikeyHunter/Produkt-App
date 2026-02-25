<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/authStore';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import Calendar from '$lib/components/calendar/Calendar.svelte';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import CalendarContactList from '$lib/components/calendar/CalendarContactList.svelte';

	let mounted = false;
	let viewType: 'month' | 'week' | 'list' = 'month';
	let currentViewDate = new Date();
	let showPopup = false;
	let popupMessage = '';
	let showContactModal = false;

	

	// Auth & Role State
	let authState: 'loading' | 'login' | 'change_password' | 'authenticated' | 'denied' = 'loading';
	let showMainLayout = false;
	let userRole = 'Email Only';
	let guestUserRecord: any = null;

	// Permissions mapping
	$: canViewHolds = ['Manager', 'Editor', 'Admin'].includes(userRole);
	$: canEdit = ['Editor', 'Admin'].includes(userRole);
	$: canManageContacts = userRole === 'Admin';

	// Guest Login Form State
	let emailInput = '';
	let passwordInput = '';
	let emailError = '';
	let passwordError = '';
	let loginError = '';

	// Password Change State
	let newPassword = '';
	let confirmPassword = '';
	let newPasswordError = '';
	let confirmPasswordError = '';

	// NEW: Show/Hide Password State
	let showPassword = false;
	let showNewPassword = false;
	let showConfirmPassword = false;

	function validateEmail(email: string) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	$: if (browser && mounted && $authStore.isInitialized) {
		const sessionUser = $authStore.profile;
		if (sessionUser && authState === 'loading') {
			const hasBasePerm =
				sessionUser.role === 'Admin' ||
				sessionUser.main_permission === 'Calendar' ||
				(sessionUser.secondary_permission || []).includes('Calendar') ||
				(sessionUser.page_permissions || []).includes('CalendarEditor');

			if (hasBasePerm) {
				showMainLayout = true;

				// OVERRIDE: If they are an App Admin, force the Calendar Admin role immediately
				if (sessionUser.role === 'Admin') {
					userRole = 'Admin';
					authState = 'authenticated';
				} else {
					// Otherwise, fetch their specific role from calendar_users
					verifyCalendarUserRole(sessionUser.email || '');
				}
			} else {
				goto('/dashboard', { replaceState: true });
			}
		} else if (!sessionUser && authState === 'loading') {
			showMainLayout = false;
			checkGuestAccess();
		}
	}

	async function verifyCalendarUserRole(email: string) {
		// Use the secure RPC to bypass RLS for Guest users
		const { data, error } = await supabase.rpc('get_calendar_guest_role', { p_email: email });

		if (!error && data && data !== 'Email Only') {
			userRole = data;
			authState = 'authenticated';
		} else {
			authState = 'denied';
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
		authState = 'login';
	}

	async function handleGuestLogin() {
		// Reset Errors
		emailError = '';
		passwordError = '';
		loginError = '';

		// Validation
		if (!validateEmail(emailInput)) {
			emailError = 'Please enter a valid email address.';
			return;
		}
		if (!passwordInput) {
			passwordError = 'Password is required.';
			return;
		}

		const { data, error } = await supabase.rpc('verify_calendar_password', {
			p_email: emailInput.toLowerCase(),
			p_password: passwordInput
		});

		if (error || !data || data.length === 0) {
			loginError = 'Invalid email or password.';
			return;
		}

		guestUserRecord = data[0];

		if (guestUserRecord.has_default_password) {
			authState = 'change_password';
		} else if (guestUserRecord.role !== 'Email Only') {
			userRole = guestUserRecord.role;
			saveGuestSession(guestUserRecord.email);
			authState = 'authenticated';
		} else {
			loginError = 'You do not have permission to view the calendar.';
		}
	}

	async function handleChangePassword() {
		newPasswordError = '';
		confirmPasswordError = '';
		loginError = '';

		if (newPassword.length < 8) {
			newPasswordError = 'Password must be at least 8 characters long.';
			return;
		}
		if (newPassword !== confirmPassword) {
			confirmPasswordError = 'Passwords do not match.';
			return;
		}

		const { data, error } = await supabase.rpc('update_calendar_password', {
			p_user_id: guestUserRecord.id,
			p_new_password: newPassword
		});

		if (error || !data) {
			loginError = 'Failed to update password. Please try again.';
			return;
		}

		userRole = guestUserRecord.role;
		saveGuestSession(guestUserRecord.email);
		authState = 'authenticated';
	}

	function saveGuestSession(email: string) {
		const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 Days
		localStorage.setItem('calendar_guest_session', JSON.stringify({ email, expiry }));
	}

	function handleKeydown(e: KeyboardEvent, action: Function) {
		if (e.key === 'Enter') action();
	}

	function showPopupMessage(message: string): void {
		popupMessage = message;
		showPopup = true;
	}

	if (browser) {
		const urlView = $page.url.searchParams.get('view');
		if (urlView && ['month', 'week', 'list'].includes(urlView)) {
			viewType = urlView as 'month' | 'week' | 'list';
		}
		const urlDate = $page.url.searchParams.get('date');
		if (urlDate) {
			currentViewDate = new Date(urlDate + 'T00:00:00');
		}
	}

	$: if (browser && mounted && authState === 'authenticated') {
		const url = new URL(window.location.href);
		url.searchParams.set('view', viewType);
		url.searchParams.set('date', currentViewDate.toISOString().split('T')[0]);
		goto(url.toString(), { replaceState: true, keepFocus: true });
	}

	onMount(() => {
		setTimeout(() => {
			mounted = true;
		}, 100);
	});
</script>

<svelte:head>
	<title>Calendar</title>
</svelte:head>

{#if authState === 'loading'}
	<div class="w-full h-screen bg-gray1 flex items-center justify-center">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
	</div>
{:else if authState === 'login' || authState === 'change_password'}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
		<div
			class="bg-gray1 border border-gray2/30 w-full max-w-md rounded-3xl shadow-2xl p-8 flex flex-col gap-8"
		>
			<div class="text-center">
				<img src="/images/ProduktXX_LOGO1.png" alt="Produkt Logo" class="h-9 mx-auto mb-8" />
				<h2 class="text-2xl font-bold text-white mb-2">Calendar Access</h2>
				<p class="text-gray2 text-sm">
					{authState === 'login'
						? 'Please sign in to view the schedule.'
						: 'Please update your default password to continue.'}
				</p>
			</div>

			{#if authState === 'login'}
				<div class="space-y-4">
					<div>
						<input
							type="email"
							placeholder="Email Address"
							bind:value={emailInput}
							class="w-full bg-black/30 border {emailError ? 'border-problem' : 'border-gray2/20'} rounded-3xl px-5 py-3.5 text-white text-center focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all placeholder-gray2/50"
						/>
						{#if emailError}
							<p class="text-problem text-xs text-center font-bold mt-2 opacity-100 visible">
								{emailError}
							</p>
						{/if}
					</div>

					<div>
						<div class="relative w-full">
							<input
								type={showPassword ? "text" : "password"}
								placeholder="Password"
								bind:value={passwordInput}
								on:keydown={(e) => handleKeydown(e, handleGuestLogin)}
								class="w-full bg-black/30 border {passwordError ? 'border-problem' : 'border-gray2/20'} rounded-3xl px-5 py-3.5 text-white text-center focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all placeholder-gray2/50"
							/>
							<button 
								type="button" 
								class="absolute right-5 top-1/2 -translate-y-1/2 text-gray2 hover:text-white transition-colors cursor-pointer z-10"
								on:click={() => showPassword = !showPassword}
							>
								{#if showPassword}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
								{/if}
							</button>
						</div>
						{#if passwordError}
							<p class="text-problem text-xs text-center font-bold mt-2 opacity-100 visible">
								{passwordError}
							</p>
						{/if}
					</div>

					{#if loginError}
						<p class="text-problem text-sm text-center font-bold mt-2 opacity-100 visible">
							{loginError}
						</p>
					{/if}

					<button
						on:click={handleGuestLogin}
						class="w-full py-3.5 mt-4 rounded-3xl bg-lime text-black font-bold hover:bg-lime/90 transition-all shadow-lg shadow-lime/10 cursor-pointer"
					>
						Sign In
					</button>
				</div>
			{:else}
				<div class="space-y-4">
					<div>
						<div class="relative w-full">
							<input
								type={showNewPassword ? "text" : "password"}
								placeholder="New Password (min 8 characters)"
								bind:value={newPassword}
								class="w-full bg-black/30 border {newPasswordError ? 'border-problem' : 'border-gray2/20'} rounded-3xl px-5 py-3.5 text-white text-center focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all placeholder-gray2/50"
							/>
							<button 
								type="button" 
								class="absolute right-5 top-1/2 -translate-y-1/2 text-gray2 hover:text-white transition-colors cursor-pointer z-10"
								on:click={() => showNewPassword = !showNewPassword}
							>
								{#if showNewPassword}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
								{/if}
							</button>
						</div>
						{#if newPasswordError}
							<p class="text-problem text-xs text-center font-bold mt-2 opacity-100 visible">
								{newPasswordError}
							</p>
						{/if}
					</div>

					<div>
						<div class="relative w-full">
							<input
								type={showConfirmPassword ? "text" : "password"}
								placeholder="Confirm New Password"
								bind:value={confirmPassword}
								on:keydown={(e) => handleKeydown(e, handleChangePassword)}
								class="w-full bg-black/30 border {confirmPasswordError ? 'border-problem' : 'border-gray2/20'} rounded-3xl px-5 py-3.5 text-white text-center focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all placeholder-gray2/50"
							/>
							<button 
								type="button" 
								class="absolute right-5 top-1/2 -translate-y-1/2 text-gray2 hover:text-white transition-colors cursor-pointer z-10"
								on:click={() => showConfirmPassword = !showConfirmPassword}
							>
								{#if showConfirmPassword}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
								{/if}
							</button>
						</div>
						{#if confirmPasswordError}
							<p class="text-problem text-xs text-center font-bold mt-2 opacity-100 visible">
								{confirmPasswordError}
							</p>
						{/if}
					</div>

					{#if loginError}
						<p class="text-problem text-sm text-center font-bold mt-2 opacity-100 visible">
							{loginError}
						</p>
					{/if}

					<button
						on:click={handleChangePassword}
						class="w-full py-3.5 mt-4 rounded-3xl bg-lime text-black font-bold hover:bg-lime/90 transition-all shadow-lg shadow-lime/10 cursor-pointer"
					>
						Update Password
					</button>
				</div>
			{/if}
		</div>
	</div>
{:else if authState === 'denied'}
	{#if showMainLayout}
		<MainLayout pageTitle="Calendar">
			<div class="h-full w-full flex flex-col items-center justify-center text-center p-6">
				<svg
					class="w-16 h-16 text-gray2/50 mb-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
					></path>
				</svg>
				<h2 class="text-2xl font-bold text-white mb-2">Access Denied</h2>
				<p class="text-gray2 text-sm">
					You do not have the required permissions to view this calendar.
				</p>
			</div>
		</MainLayout>
	{:else}
		<div class="w-full h-screen bg-gray1 flex flex-col items-center justify-center text-center p-6">
			<svg
				class="w-16 h-16 text-gray2/50 mb-4 mx-auto"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
				></path>
			</svg>
			<h2 class="text-2xl font-bold text-white mb-2">Access Denied</h2>
			<p class="text-gray2 text-sm">
				You do not have the required permissions to view this calendar.
			</p>
		</div>
	{/if}
{:else if authState === 'authenticated'}
	<PopupNotification
		message={popupMessage}
		bind:show={showPopup}
		duration={3000}
		variant="navbar"
	/>

	{#if showMainLayout}
		<MainLayout pageTitle="Calendar">
			<div class="h-full w-full p-2 overflow-hidden flex flex-col">
				<div class="flex justify-between items-center mb-3 px-1 fade-in {mounted ? 'mounted' : ''}">
					<div class="flex gap-1 bg-[#BDBDBB]/10 p-1 rounded-full">
						<button
							class="px-6 py-2 rounded-full text-sm font-bold transition-all cursor-pointer {viewType ===
							'month'
								? 'bg-[#E1FF00] text-black'
								: 'text-[#BDBDBB] hover:bg-[#BDBDBB]/20 hover:text-white'}"
							on:click={() => (viewType = 'month')}>Month</button
						>
						<button
							class="px-6 py-2 rounded-full text-sm font-bold transition-all cursor-pointer {viewType ===
							'week'
								? 'bg-[#E1FF00] text-black'
								: 'text-[#BDBDBB] hover:bg-[#BDBDBB]/20 hover:text-white'}"
							on:click={() => (viewType = 'week')}>Week</button
						>
						<button
							class="px-6 py-2 rounded-full text-sm font-bold transition-all cursor-pointer {viewType ===
							'list'
								? 'bg-[#E1FF00] text-black'
								: 'text-[#BDBDBB] hover:bg-[#BDBDBB]/20 hover:text-white'}"
							on:click={() => (viewType = 'list')}>List</button
						>
					</div>

					{#if canManageContacts}
						<div class="relative flex items-center group">
							<span
								class="absolute right-14 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-3 py-1.5 rounded-3xl whitespace-nowrap pointer-events-none z-50 bg-gray1 text-white"
							>
								Contact List
							</span>
							<button
								class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all border-gray2 text-gray2 hover:border-lime hover:text-lime cursor-pointer"
								on:click={() => (showContactModal = true)}
								aria-label="Open Contact List"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
									/>
								</svg>
							</button>
						</div>
					{/if}
				</div>

				<div class="flex-1 min-h-0 fade-in {mounted ? 'mounted' : ''}">
					<Calendar bind:viewType bind:currentViewDate {canEdit} {canViewHolds} />
				</div>
			</div>
		</MainLayout>
	{:else}
		<div class="w-full h-screen bg-gray1 overflow-hidden flex flex-col p-4">
			<div class="h-full w-full p-2 overflow-hidden flex flex-col">
				<div class="flex justify-between items-center mb-3 px-1 fade-in {mounted ? 'mounted' : ''}">
					<div class="flex gap-1 bg-[#BDBDBB]/10 p-1 rounded-full">
						<button
							class="px-6 py-2 rounded-full text-sm font-bold transition-all cursor-pointer {viewType ===
							'month'
								? 'bg-[#E1FF00] text-black'
								: 'text-[#BDBDBB] hover:bg-[#BDBDBB]/20 hover:text-white'}"
							on:click={() => (viewType = 'month')}>Month</button
						>
						<button
							class="px-6 py-2 rounded-full text-sm font-bold transition-all cursor-pointer {viewType ===
							'week'
								? 'bg-[#E1FF00] text-black'
								: 'text-[#BDBDBB] hover:bg-[#BDBDBB]/20 hover:text-white'}"
							on:click={() => (viewType = 'week')}>Week</button
						>
						<button
							class="px-6 py-2 rounded-full text-sm font-bold transition-all cursor-pointer {viewType ===
							'list'
								? 'bg-[#E1FF00] text-black'
								: 'text-[#BDBDBB] hover:bg-[#BDBDBB]/20 hover:text-white'}"
							on:click={() => (viewType = 'list')}>List</button
						>
					</div>

					{#if canManageContacts}
						<div class="relative flex items-center group">
							<span
								class="absolute right-14 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-3 py-1.5 rounded-3xl whitespace-nowrap pointer-events-none z-50 bg-gray1 text-white"
							>
								Contact List
							</span>
							<button
								class="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all border-gray2 text-gray2 hover:border-lime hover:text-lime cursor-pointer"
								on:click={() => (showContactModal = true)}
								aria-label="Open Contact List"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
									/>
								</svg>
							</button>
						</div>
					{/if}
				</div>

				<div class="flex-1 min-h-0 fade-in {mounted ? 'mounted' : ''}">
					<Calendar bind:viewType bind:currentViewDate {canEdit} {canViewHolds} />
				</div>
			</div>
		</div>
	{/if}

	<Modal
		bind:isOpen={showContactModal}
		title="Contact List"
		maxWidth="max-w-7xl"
		showCloseButton={true}
		on:close={() => (showContactModal = false)}
	>
		<CalendarContactList />
	</Modal>
{/if}

<style>
	.fade-in {
		opacity: 0;
		transform: translateY(10px);
		transition:
			opacity 0.3s ease-out,
			transform 0.3s ease-out;
	}
	.fade-in.mounted {
		opacity: 1;
		transform: translateY(0);
	}
</style>
