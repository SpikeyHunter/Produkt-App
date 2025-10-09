<script lang="ts">
	import MainLayout from '$lib/components/MainLayout.svelte';
</script>

<svelte:head>
	<title>Comp Tickets</title>
</svelte:head>

<MainLayout requiredPermission="CompTickets">
	<div class="p-6">
		<h1 class="text-2xl font-bold">Comp Tickets Management</h1>
		<p class="text-gray-400 mt-2">
			This page is protected and requires the "CompTickets" page permission.
		</p>
	</div>
</MainLayout>