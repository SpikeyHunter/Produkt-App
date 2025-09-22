<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore.js';
	import { supabase } from '$lib/supabase.js';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import TypebarCredentials from '$lib/components/inputs/TypebarCredentials.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
	import motdList from '$lib/data/motd.json';

	let mounted = false;
	let currentMotd = '';
	
	// Updated the type to include name properties
	let userProfile: {
		first_name?: string;
		last_name?: string;
		main_permission?: string;
		secondary_permission?: string | string[];
	} | null = null;
	
	let isLoading = true;
	let showModal = false;

	// Team code form state
	let teamCode = '';
	let isSubmitting = false;
	let isValidating = false;

	// Popup notification state
	let showPopup = false;
	let popupMessage = '';

	function generateMotd() {
		if (!motdList || motdList.length === 0) {
			currentMotd = 'Welcome to Produkt App!';
			return;
		}
		const randomIndex = Math.floor(Math.random() * motdList.length);
		currentMotd = motdList[randomIndex];
	}

	// Fetch user profile with permissions and name
	async function fetchUserProfile() {
		if (!$user) {
			isLoading = false;
			return;
		}
		isLoading = true;
		try {
			// Added first_name and last_name to the query
			const { data, error } = await supabase
				.from('user_profiles')
				.select('first_name, last_name, main_permission, secondary_permission')
				.eq('id', $user.id)
				.single();

			if (error) {
				console.error('Error fetching user profile:', error.message);
				return;
			}
			userProfile = data;
		} catch (error) {
			console.error('Caught error fetching user profile:', error);
		} finally {
			isLoading = false;
		}
	}

	// Format permissions for display
	function formatPermissions(
		main: string | undefined,
		secondary: string | string[] | undefined
	): string | null {
		if (!main) return null;
		let permissions = [main];
		if (secondary) {
			const secondaryPerms = Array.isArray(secondary)
				? secondary
				: secondary.split(',').map((p: string) => p.trim());
			permissions = permissions.concat(secondaryPerms);
		}
		return permissions.join(', ');
	}

	// Show popup message
	function showPopupMessage(message: string): void {
		popupMessage = message;
		showPopup = true;
	}

	// Team code validation
	async function validateTeamCode(
		code: string
	): Promise<{ isValid: boolean; teamName?: string; alreadyJoined?: boolean; message?: string }> {
		if (!code.trim()) return { isValid: false };
		if (isValidating) {
			return { isValid: false, message: 'Validation in progress...' };
		}
		if (!$user) {
			return { isValid: false, message: 'You must be logged in to join a team' };
		}
		isValidating = true;
		try {
			const response = await fetch('/api/validate-team-code', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: code.trim(), userId: $user.id })
			});
			return await response.json();
		} catch (error) {
			return { isValid: false, message: 'Network error. Please try again.' };
		} finally {
			setTimeout(() => {
				isValidating = false;
			}, 500);
		}
	}

	async function handleJoinTeam() {
		if (!teamCode.trim()) {
			showPopupMessage('Please enter a team access code');
			return;
		}
		if (!$user) {
			showPopupMessage('You must be logged in to join a team');
			return;
		}
		if (isSubmitting) return;

		isSubmitting = true;
		try {
			const validation = await validateTeamCode(teamCode);
			if (!validation.isValid) {
				showPopupMessage(validation.message || 'Invalid team access code');
				return;
			}
			if (validation.alreadyJoined) {
				showPopupMessage(validation.message || "You've already joined that team");
			} else {
				showPopupMessage(validation.message || `Successfully joined the ${validation.teamName} team!`);
			}
			setTimeout(() => {
				closeModal();
				setTimeout(async () => {
					await fetchUserProfile();
				}, 300);
			}, 2000);
		} catch (error) {
			showPopupMessage('An unexpected error occurred. Please try again.');
		} finally {
			isSubmitting = false;
		}
	}

	function openModal() {
		showModal = true;
		teamCode = '';
	}

	function closeModal() {
		showModal = false;
		teamCode = '';
	}

	onMount(() => {
		generateMotd();
		setTimeout(() => {
			mounted = true;
		}, 150);
	});

	$: if ($user && !userProfile) {
		fetchUserProfile();
	}
</script>

<svelte:head>
	<title>Dashboard — Produkt App</title>
</svelte:head>

<MainLayout pageTitle="Dashboard">
	<PopupNotification message={popupMessage} bind:show={showPopup} duration={3000} variant="navbar" />
	<div class="h-full p-6 overflow-auto">
		<div class="max-w-7xl mx-auto h-full">
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
				<div class="flex flex-col gap-6">
					<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.1s;">
						<div class="bg-navbar rounded-2xl p-6">
							<div class="space-y-4">
								{#if $user}
									<p class="text-white text-xl font-bold">
										{#if userProfile?.first_name}
											Welcome back, <span class="text-lime">{userProfile.first_name}</span>
										{:else if !isLoading}
											Welcome back
										{/if}
									</p>
									{#if !userProfile?.first_name && !isLoading}
									<p class="text-white text-base pl-6 font-bold">
										You're signed in as, <span class="text-gray3">{$user.email}</span>
									</p>
									{/if}
								{/if}
								<div class="pl-7">
									{#if isLoading}
										<p class="text-gray2 text-sm">Loading your profile...</p>
									{:else if userProfile}
										{#if !userProfile.main_permission}
											<div class="flex items-center gap-2">
												<span class="text-white text-sm">You don't have a team yet?</span>
												<Button variant="slim" width="w-auto" on:click={openModal}>Join a team</Button>
											</div>
										{:else}
											<div class="text-white text-sm mb-2">
												<p class="mb-2">You're in the following team:</p>
												<ul class="list-disc list-inside text-lime space-y-1 ml-4">
													{#each formatPermissions(userProfile.main_permission, userProfile.secondary_permission)?.split(', ') || [] as permission}
														<li>{permission}</li>
													{/each}
												</ul>
											</div>
											{#if !userProfile.secondary_permission || (Array.isArray(userProfile.secondary_permission) ? userProfile.secondary_permission.length < 3 : userProfile.secondary_permission.split(',').length < 2)}
												<div class="flex items-center gap-2">
													<span class="text-white text-sm">Wanna join another team?</span>
													<Button variant="slim" width="w-auto" on:click={openModal}>Join a new team</Button>
												</div>
											{/if}
										{/if}
									{:else}
										<p class="text-gray2 text-sm">Unable to load permissions</p>
									{/if}
								</div>
							</div>
						</div>
					</div>
					<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.2s;">
						<div class="bg-navbar rounded-2xl p-6">
							<div class="flex items-baseline gap-2 mb-4">
								<h2 class="text-xl font-bold text-white -translate-y-0.5">Latest Updates</h2>
							</div>
							<div class="pl-7 space-y-2">
								<div class="text-white text-sm">
									<span class="text-white">Version:</span> <span class="text-lime">v1.2.3</span>
								</div>
								<div class="text-white text-sm"><span class="text-white">Changes:</span></div>
								<ul class="text-gray2 text-sm space-y-1 ml-4">
									<li>• Improved dashboard performance</li>
									<li>• Added new team collaboration features</li>
									<li>• Fixed notification system bugs</li>
								</ul>
							</div>
						</div>
					</div>
				</div>
				<div class="lg:col-span-2">
					<!-- Content for the right column goes here -->
				</div>
			</div>
		</div>
	</div>
</MainLayout>

<Modal
	bind:isOpen={showModal}
	title="Request to join a Team!"
	maxWidth="max-w-xl"
	hasFooter={true}
	on:close={closeModal}
>
	<div class="space-y-4">
		<p class="font-normal text-gray2">
			To join a team, please enter your access code. If you don't have one, reach out to an admin.
		</p>
		<p class="font-normal text-lime">Team Access Code</p>
		<TypebarCredentials
			variant="clear-lime"
			placeholder="enter your team access code"
			bind:value={teamCode}
		/>
	</div>
	<div slot="footer" class="flex gap-3 justify-end">
		<Button variant="outline" on:click={closeModal}>Cancel</Button>
		<Button
			variant={!teamCode.trim() ? 'blocked' : isSubmitting ? 'loading' : 'filled'}
			disabled={!teamCode.trim() || isSubmitting}
			on:click={handleJoinTeam}
		>
			{isSubmitting ? 'Joining...' : 'Join Team'}
		</Button>
	</div>
</Modal>

<style>
	.fade-in {
		opacity: 0;
		transform: translateY(20px);
		transition: opacity 0.6s ease-out, transform 0.6s ease-out;
	}
	.fade-in.mounted {
		opacity: 1;
		transform: translateY(0);
	}
</style>