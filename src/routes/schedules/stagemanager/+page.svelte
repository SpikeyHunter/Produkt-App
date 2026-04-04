<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { User } from '@supabase/supabase-js';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import ScheduleBoard from '$lib/components/schedules/stagemanager/ScheduleBoard.svelte';

	let currentUser: User | null = null;
	let loading = true;

	// Guest Auth State
	let isGuestAuthenticated = false;
	let passwordInput = '';
	let passwordError = '';

	onMount(async () => {
		// 1. Check Supabase User
		const {
			data: { session }
		} = await supabase.auth.getSession();
		currentUser = session?.user || null;

		supabase.auth.onAuthStateChange((_event, session) => {
			currentUser = session?.user || null;
		});

		// 2. Check Guest Token if not logged in via Supabase
		if (!currentUser) {
			checkGuestAccess();
		}

		loading = false;
	});

	function checkGuestAccess() {
		try {
			// Changed to localStorage to persist for 7 days even if browser closes
			const stored = localStorage.getItem('guest_access_token');
			if (stored) {
				const { expiry } = JSON.parse(stored);
				// Check if token is still valid
				if (Date.now() < expiry) {
					isGuestAuthenticated = true;
				} else {
					// Token expired, clear it
					localStorage.removeItem('guest_access_token');
				}
			}
		} catch (e) {
			console.error('Error reading guest token', e);
			localStorage.removeItem('guest_access_token');
		}
	}

	async function handlePasswordSubmit() {
		// 1. Fetch the correct password from the database
		const { data, error } = await supabase
			.from('parameters')
			.select('data_1')
			.eq('param_name', 'password_stagemanager')
			.single();

		if (error || !data) {
			console.error('Failed to fetch password:', error);
			passwordError = 'System error: Could not verify password.';
			return;
		}

		const correctPassword = data.data_1;

		// 2. Compare user input to the database password
		if (passwordInput === correctPassword) {
			// Success: Save token with 1h expiry
			const expiry = Date.now() + 60 * 60 * 1000;
			sessionStorage.setItem('guest_access_token', JSON.stringify({ expiry }));

			// Flipping this to true automatically mounts <ScheduleBoard />
			isGuestAuthenticated = true;
			passwordError = '';
		} else {
			passwordError = 'Incorrect password';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handlePasswordSubmit();
		}
	}

	function focusInput(node: HTMLElement) {
		node.focus();
	}
</script>

<svelte:head>
	<title>Stage Manager</title>
</svelte:head>

{#if !loading}
	{#if currentUser}
		<MainLayout pageTitle="Stage Manager">
			<ScheduleBoard {currentUser} />
		</MainLayout>
	{:else if isGuestAuthenticated}
		<div class="w-full h-screen bg-gray1 overflow-hidden">
			<ScheduleBoard {currentUser} />
		</div>
	{:else}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
		>
			<div
				class="bg-gray1 border border-gray2/30 w-full max-w-md rounded-2xl shadow-2xl p-8 flex flex-col gap-6"
			>
				<div class="text-center">
					<img src="/images/ProduktXX_LOGO1.png" alt="Produkt Logo" class="h-9 mx-auto mb-10" />
					<h2 class="text-2xl font-bold text-white mb-2">Stage Manager</h2>
					<p class="text-gray2 text-sm">Please enter the password to view the schedule.</p>
				</div>

				<div class="space-y-2">
					<input
						type="password"
						placeholder="Enter Password"
						bind:value={passwordInput}
						on:keydown={handleKeydown}
						use:focusInput
						class="w-full bg-black/30 border border-gray2/20 rounded-xl px-4 py-3 text-white text-center focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime transition-all placeholder-gray2/50"
					/>
					{#if passwordError}
						<p
							class="text-red-500 text-xs text-center font-bold animate-in fade-in slide-in-from-top-1"
						>
							{passwordError}
						</p>
					{/if}
				</div>

				<button
					on:click={handlePasswordSubmit}
					class="w-full py-3 rounded-xl bg-lime text-black font-bold hover:bg-lime/90 transition-all shadow-lg shadow-lime/10"
				>
					Access Schedule
				</button>
			</div>
		</div>
	{/if}
{:else}
	<div class="w-full h-screen bg-gray1 flex items-center justify-center">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
	</div>
{/if}
