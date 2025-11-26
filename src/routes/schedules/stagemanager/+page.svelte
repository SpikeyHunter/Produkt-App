<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { User } from '@supabase/supabase-js';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import ScheduleBoard from '$lib/components/schedules/stagemanager/ScheduleBoard.svelte';

	let currentUser: User | null = null;
	let loading = true;

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		currentUser = session?.user || null;

		supabase.auth.onAuthStateChange((_event, session) => {
			currentUser = session?.user || null;
		});
		
		loading = false;
	});
</script>

<svelte:head>
	<title>Stage Manager</title>
</svelte:head>

{#if !loading}
	{#if currentUser}
		<MainLayout pageTitle="Stage Manager">
			<ScheduleBoard {currentUser} />
		</MainLayout>
	{:else}
		<div class="w-full h-screen bg-gray1 overflow-hidden">
			<ScheduleBoard {currentUser} />
		</div>
	{/if}
{:else}
	<div class="w-full h-screen bg-gray1 flex items-center justify-center">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
	</div>
{/if}