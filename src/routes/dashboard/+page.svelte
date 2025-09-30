<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/authStore';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import TypebarCredentials from '$lib/components/inputs/TypebarCredentials.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
	import motdList from '$lib/data/motd.json';

	let mounted = false;
	let currentMotd = '';
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
		if (!$authStore.user) {
			return { isValid: false, message: 'You must be logged in to join a team' };
		}
		isValidating = true;
		try {
			const response = await fetch('/api/validate-team-code', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: code.trim(), userId: $authStore.user.id })
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
		if (!$authStore.user) {
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
					await authStore.refreshProfile();
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
</script>

<svelte:head>
	<title>Dashboard – Produkt App</title>
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
								{#if $authStore.user}
									<p class="text-white text-xl font-bold">
										{#if $authStore.profile?.first_name}
											Welcome back, <span class="text-lime">{$authStore.profile.first_name}</span>
										{:else if !$authStore.isLoading}
											Welcome back
										{/if}
									</p>
									{#if !$authStore.profile?.first_name && !$authStore.isLoading}
									<p class="text-white text-base pl-6 font-bold">
										You're signed in as, <span class="text-gray3">{$authStore.user.email}</span>
									</p>
									{/if}
								{/if}
								<div class="pl-7">
									{#if $authStore.isLoading}
										<p class="text-gray2 text-sm">Loading your profile...</p>
									{:else if $authStore.profile}
										{#if !$authStore.profile.main_permission}
											<div class="flex items-center gap-2">
												<span class="text-white text-sm">You don't have a team yet?</span>
												<Button variant="slim" width="w-auto" on:click={openModal}>Join a team</Button>
											</div>
										{:else}
											<div class="text-white text-sm mb-2">
												<p class="mb-2">
													{#if $authStore.profile.role === 'Admin'}
														<span class="text-lime font-bold">👑 Admin</span> - You have access to everything
													{:else}
														{@const permissionCount = formatPermissions($authStore.profile.main_permission, $authStore.profile.secondary_permission)?.split(', ').length ?? 0}
														You're in the following team{permissionCount > 1 ? 's' : ''}:
													{/if}
												</p>
												{#if $authStore.profile.role !== 'Admin'}
													<ul class="list-disc list-inside text-lime space-y-1 ml-4">
														{#each formatPermissions($authStore.profile.main_permission, $authStore.profile.secondary_permission)?.split(', ') ?? [] as permission}
															<li>{permission}</li>
														{/each}
													</ul>
												{/if}
											</div>
											{#if $authStore.profile.role !== 'Admin' && (!$authStore.profile.secondary_permission || (Array.isArray($authStore.profile.secondary_permission) ? $authStore.profile.secondary_permission.length < 3 : $authStore.profile.secondary_permission.split(',').length < 2))}
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
									<span class="text-white">Version:</span> <span class="text-lime">v1.3.0</span>
								</div>
								<div class="text-white text-sm"><span class="text-white">Changes:</span></div>
								<ul class="text-gray2 text-sm space-y-1 ml-4">
									<li>• Role-based access control implemented</li>
									<li>• Admin role with full access</li>
									<li>• Permission-based page restrictions</li>
									<li>• Enhanced security and navigation</li>
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