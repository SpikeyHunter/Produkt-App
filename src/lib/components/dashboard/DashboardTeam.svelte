<script lang="ts">
	import { authStore } from '$lib/stores/authStore';
	import Button from '$lib/components/buttons/Button.svelte';
	import { createEventDispatcher } from 'svelte';
	import DashboardTemplate from '$lib/components/dashboard/DashboardTemplate.svelte';

	const dispatch = createEventDispatcher();

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

	function handleJoinTeam() {
		dispatch('join-team');
	}
</script>

<DashboardTemplate title="Your Teams" width={350} height={250}>
	<div slot="icon">
		<svg class="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
			<circle cx="9" cy="7" r="4"></circle>
			<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
			<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
		</svg>
	</div>

	<div class="space-y-3">
		{#if $authStore.isLoading}
			<p class="text-gray2 text-sm">Loading your teams...</p>
		{:else if $authStore.profile}
			{#if !$authStore.profile.main_permission}
				<div class="text-center py-4">
					<p class="text-gray2 text-sm mb-3">You're not part of any team yet</p>
					<Button variant="filled" width="w-full" on:click={handleJoinTeam}>Join Your First Team</Button>
				</div>
			{:else if $authStore.profile.role === 'Admin'}
				<div class="space-y-3">
					<div class="space-y-2">
						<div class="flex items-center gap-2">
							<span class="text-lime font-bold text-sm">Admin Access</span>
						</div>
						<p class="text-gray3 text-xs pl-4">You have access to all 4 teams:</p>
                        <p class="text-lime text-xs pl-6">• Advancing</p>
                        <p class="text-lime text-xs pl-6">• Booking</p>
                        <p class="text-lime text-xs pl-6">• Marketing</p>
                        <p class="text-lime text-xs pl-6">• Production</p>

					</div>
				</div>
			{:else}
				{@const permissions =
					formatPermissions($authStore.profile.main_permission, $authStore.profile.secondary_permission)?.split(
						', '
					) ??
					[]}
				<div class="space-y-2">
					{#each permissions as team}
						<div class="flex items-center gap-2">
							<span class="w-2 h-2 bg-lime rounded-full flex-shrink-0"></span>
							<span class="text-white text-sm font-medium truncate">{team}</span>
						</div>
					{/each}
				</div>

				{#if permissions.length < 4}
					<div class="pt-2">
						<Button variant="slim" width="w-auto" on:click={handleJoinTeam}>Join a new team</Button>
					</div>
				{/if}
			{/if}
		{:else}
			<p class="text-gray2 text-sm">Unable to load teams</p>
		{/if}
	</div>
</DashboardTemplate>
