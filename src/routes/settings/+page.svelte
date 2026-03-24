<script lang="ts">
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import PermissionsModal from '$lib/components/settings/PermissionsModal.svelte';
	import PushUpdateModal from '$lib/components/settings/PushUpdateModal.svelte';
	import { supabase } from '$lib/supabase';

	let mounted = false;
	let isPermissionsModalOpen = false;
	let isPushUpdateModalOpen = false;

	// SMS Number State
	let smsNumber = '';
	let editSmsNumber = '';
	let isEditingSms = false;
	let isLoadingSms = true;
	let isSavingSms = false;

	async function fetchSmsConfig() {
		isLoadingSms = true;
		try {
			const { data, error } = await supabase
				.from('calendar_settings')
				.select('setting_params')
				.eq('setting_type', 'CONFIG')
				.eq('setting_name', 'AWS_SNS')
				.maybeSingle();

			if (data?.setting_params?.originationNumber) {
				smsNumber = data.setting_params.originationNumber;
			} else {
				smsNumber = 'Not Set';
			}
		} catch (error) {
			console.error('Error fetching SMS config:', error);
			smsNumber = 'Error loading';
		} finally {
			isLoadingSms = false;
		}
	}

	function cleanPhoneForStorage(phone: string) {
		let cleaned = phone.replace(/\D/g, '');
		if (cleaned.length === 10) {
			return `+1${cleaned}`;
		} else if (cleaned.length >= 11 && cleaned.startsWith('1')) {
			return `+${cleaned}`;
		}
		return `+${cleaned}`;
	}

	async function saveSmsConfig() {
		if (!editSmsNumber) return;
		isSavingSms = true;

		const formattedNumber = cleanPhoneForStorage(editSmsNumber);

		try {
			const { error } = await supabase
				.from('calendar_settings')
				.update({ setting_params: { originationNumber: formattedNumber } })
				.eq('setting_type', 'CONFIG')
				.eq('setting_name', 'AWS_SNS');
			if (error) throw error;

			smsNumber = formattedNumber;
			isEditingSms = false;
		} catch (error) {
			console.error('Failed to save SMS number:', error);
			alert('Failed to save SMS number. Please try again.');
		} finally {
			isSavingSms = false;
		}
	}

	function startEditingSms() {
		editSmsNumber = smsNumber !== 'Not Set' && smsNumber !== 'Error loading' ? smsNumber : '';
		isEditingSms = true;
	}

	onMount(() => {
		fetchSmsConfig();
		setTimeout(() => {
			mounted = true;
		}, 150);
	});
</script>

<svelte:head>
	<title>Settings — Produkt App</title>
</svelte:head>

<MainLayout pageTitle="Settings">
	<div class="h-full p-6 overflow-auto">
		<div class="max-w-4xl mx-auto">
			<div class="space-y-6">
				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.1s;">
					<div class="bg-navbar rounded-3xl p-6 border border-gray1">
						<h2 class="text-xl font-bold text-white mb-2">Manage Permissions</h2>
						<p class="text-gray2 text-sm mb-6">
							Manage roles, section access, and page-specific permissions for all users on the
							platform.
						</p>
						<button
							on:click={() => (isPermissionsModalOpen = true)}
							class="bg-lime text-black font-bold py-2.5 px-6 rounded-3xl cursor-pointer hover:opacity-90 transition-opacity"
						>
							Open Permissions Manager
						</button>
					</div>
				</div>

				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.2s;">
					<div class="bg-navbar rounded-3xl p-6 border border-gray1">
						<h2 class="text-xl font-bold text-white mb-2">Update Pusher</h2>
						<p class="text-gray2 text-sm mb-6">
							Deploy mandatory patch notes and app updates to specific users, departments, or the entire team.
						</p>
						<button
							on:click={() => (isPushUpdateModalOpen = true)}
							class="bg-lime text-black font-bold py-2.5 px-6 rounded-3xl cursor-pointer hover:opacity-90 transition-opacity"
						>
							Open Update Pusher
						</button>
					</div>
				</div>

				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.3s;">
					<div class="bg-navbar rounded-3xl p-6 border border-gray1">
						<h2 class="text-xl font-bold text-white mb-4">Team Management</h2>
						<div class="text-gray2 text-sm">
							<p>Team management features coming soon...</p>
						</div>
					</div>
				</div>

				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.4s;">
					<div class="bg-navbar rounded-3xl p-6 border border-gray1">
						<h2 class="text-xl font-bold text-white mb-4">Notification Settings</h2>

						<div class="flex flex-col gap-2">
							<label for="sms-input" class="text-gray2 text-sm font-bold"
								>AWS SMS Origination Number</label
							>

							{#if isLoadingSms}
								<div class="h-12 flex items-center text-gray2 text-sm animate-pulse">
									Loading...
								</div>
							{:else if isEditingSms}
								<div class="flex items-center gap-2 max-w-sm">
									<input
										id="sms-input"
										type="text"
										bind:value={editSmsNumber}
										class="bg-black/50 border border-gray2/30 text-white rounded-3xl px-5 py-3 w-full focus:outline-none focus:border-lime transition-colors"
										placeholder="+1 (555) 555-5555"
										disabled={isSavingSms}
									/>
									<button
										on:click={saveSmsConfig}
										disabled={isSavingSms}
										class="w-12 h-12 shrink-0 flex items-center justify-center bg-lime text-black rounded-3xl hover:bg-lime/80 transition-colors disabled:opacity-50 cursor-pointer"
										aria-label="Save"
									>
										{#if isSavingSms}
											<div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
										{:else}
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
										{/if}
									</button>
									<button
										on:click={() => (isEditingSms = false)}
										disabled={isSavingSms}
										class="w-12 h-12 shrink-0 flex items-center justify-center bg-transparent border border-gray2/30 text-gray2 rounded-3xl hover:text-white hover:border-gray2 transition-colors cursor-pointer"
										aria-label="Cancel"
									>
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
									</button>
								</div>
							{:else}
								<div class="flex items-center gap-2 max-w-sm">
									<div class="bg-black/20 border border-gray2/10 text-white font-mono rounded-3xl px-5 py-3 w-full flex items-center">
										{smsNumber}
									</div>
									<button
										on:click={startEditingSms}
										class="w-12 h-12 shrink-0 flex items-center justify-center bg-gray2/10 text-gray2 rounded-3xl hover:bg-gray2/20 hover:text-white transition-colors cursor-pointer"
										aria-label="Edit"
									>
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
									</button>
								</div>
							{/if}
						</div>
					</div>
				</div>

				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.5s;">
					<div class="bg-navbar rounded-3xl p-6 border border-gray1">
						<h2 class="text-xl font-bold text-white mb-4">Privacy & Security</h2>
						<div class="text-gray2 text-sm">
							<p>Privacy and security settings coming soon...</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</MainLayout>

<PermissionsModal bind:isOpen={isPermissionsModalOpen} />
<PushUpdateModal bind:isOpen={isPushUpdateModalOpen} />

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