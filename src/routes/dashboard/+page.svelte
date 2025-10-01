<!--
  Main Dashboard Page
  Organizes all dashboard components in a responsive, column-wrapping layout.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
	import TypebarCredentials from '$lib/components/inputs/TypebarCredentials.svelte';
	import Button from '$lib/components/buttons/Button.svelte';
	import { authStore } from '$lib/stores/authStore';

	// Import dashboard components
	import DashboardWelcome from '$lib/components/dashboard/DashboardWelcome.svelte';
	import DashboardTeam from '$lib/components/dashboard/DashboardTeam.svelte';
	import DashboardMOTD from '$lib/components/dashboard/DashboardMOTD.svelte';
	import DashboardStats from '$lib/components/dashboard/DashboardStats.svelte';
	import DashboardVersion from '$lib/components/dashboard/DashboardVersion.svelte';
	import DashboardUpcoming from '$lib/components/dashboard/DashboardUpcoming.svelte';
	import InteractiveFace from '$lib/components/dashboard/InteractiveFace.svelte';
	import DashboardCalendar from '$lib/components/dashboard/DashboardCalendar.svelte';
	import DashboardReminders from '$lib/components/dashboard/DashboardReminders.svelte';

	let mounted = false;
	let showModal = false;
	let teamCode = '';
	let isSubmitting = false;
	let isValidating = false;
	let showPopup = false;
	let popupMessage = '';

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

	function showPopupMessage(message: string): void {
		popupMessage = message;
		showPopup = true;
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

	function handleJoinTeamClick() {
		openModal();
	}

	onMount(() => {
		setTimeout(() => {
			mounted = true;
		}, 150);
	});

	// Helper function for animation delays
	const delay = (index: number) => `transition-delay: ${index * 50}ms;`;
</script>

<svelte:head>
	<title>Dashboard – Produkt App</title>
</svelte:head>

<MainLayout pageTitle="Dashboard">
	<PopupNotification message={popupMessage} bind:show={showPopup} duration={3000} variant="navbar" />

	<div class="h-full p-4 md:p4 mt-2overflow-y-auto">
		<!-- 
      Dashboard Layout Container
      - Uses Flexbox to allow columns to wrap.
      - On smaller screens, columns will stack vertically. As the screen widens,
        they will form rows (e.g., 3 columns on top, 1 below).
      - 'justify-center' centers the columns when they don't fill the full width.
        'lg:justify-start' aligns them to the left on larger screens.
    -->
		<div class="flex flex-wrap justify-start lg:justify-center gap-4">
			<!-- Column 1 -->
			<div class="flex flex-col gap-4 w-[350px]">
				<div class="fade-in {mounted ? 'mounted' : ''}" style={delay(0)}>
					<DashboardWelcome />
				</div>
				<div class="fade-in {mounted ? 'mounted' : ''}" style={delay(1)}>
					<DashboardTeam on:join-team={handleJoinTeamClick} />
				</div>
			</div>

			<!-- Column 2 -->
			<div class="flex flex-col gap-4 w-[300px]">
				<div class="fade-in {mounted ? 'mounted' : ''}" style={delay(2)}>
					<DashboardMOTD />
				</div>
				<div class="fade-in {mounted ? 'mounted' : ''}" style={delay(3)}>
					<DashboardStats />
				</div>
				<div class="fade-in {mounted ? 'mounted' : ''}" style={delay(4)}>
					<DashboardVersion />
				</div>
			</div>

			<!-- Column 3 -->
			<div class="flex flex-col gap-4 w-[300px]">
				<div class="fade-in {mounted ? 'mounted' : ''}" style={delay(5)}>
					<DashboardUpcoming />
				</div>
				<div class="fade-in {mounted ? 'mounted' : ''}" style={delay(6)}>
					<DashboardCalendar />
				</div>
			</div>

			<!-- Column 4 -->
			<div class="flex flex-col gap-4 w-[250px]">
				<div class="fade-in {mounted ? 'mounted' : ''}" style={delay(7)}>
					<InteractiveFace />
				</div>
				<div class="fade-in {mounted ? 'mounted' : ''}" style={delay(8)}>
					<DashboardReminders />
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
	/* Styles for the fade-in animation on component load */
	.fade-in {
		opacity: 0;
		transform: translateY(20px);
		transition:
			opacity 0.5s ease-out,
			transform 0.5s ease-out;
	}

	.fade-in.mounted {
		opacity: 1;
		transform: translateY(0);
	}
</style>

