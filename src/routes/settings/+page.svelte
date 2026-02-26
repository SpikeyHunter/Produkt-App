<script lang="ts">
	import { onMount } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import PermissionsModal from '$lib/components/settings/PermissionsModal.svelte';

	let mounted = false;
	let isPermissionsModalOpen = false;

	onMount(() => {
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
					<div class="bg-navbar rounded-2xl p-6 border border-gray1">
						<h2 class="text-xl font-bold text-white mb-2">Manage Permissions</h2>
						<p class="text-gray2 text-sm mb-6">
							Manage roles, section access, and page-specific permissions for all users on the platform.
						</p>
						<button 
							on:click={() => isPermissionsModalOpen = true}
							class="bg-lime text-black font-bold py-2.5 px-6 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
						>
							Open Permissions Manager
						</button>
					</div>
				</div>

				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.2s;">
					<div class="bg-navbar rounded-2xl p-6">
						<h2 class="text-xl font-bold text-white mb-4">Account Settings</h2>
						<div class="text-gray2 text-sm">
							<p>Account management features coming soon...</p>
						</div>
					</div>
				</div>

				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.3s;">
					<div class="bg-navbar rounded-2xl p-6">
						<h2 class="text-xl font-bold text-white mb-4">Team Management</h2>
						<div class="text-gray2 text-sm">
							<p>Team management features coming soon...</p>
						</div>
					</div>
				</div>

				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.4s;">
					<div class="bg-navbar rounded-2xl p-6">
						<h2 class="text-xl font-bold text-white mb-4">Notification Settings</h2>
						<div class="text-gray2 text-sm">
							<p>Notification preferences coming soon...</p>
						</div>
					</div>
				</div>

				<div class="fade-in {mounted ? 'mounted' : ''}" style="transition-delay: 0.5s;">
					<div class="bg-navbar rounded-2xl p-6">
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