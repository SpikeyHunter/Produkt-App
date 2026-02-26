<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import TechRiderForm from '$lib/components/production/techrider/TechRiderForm.svelte';
	import { supabase } from '$lib/supabase';

	let techRider: any = null;
	let isLoading = true;
	let realtimeChannel: any;
    
	// NEW: Flag to track if we are the ones updating
	let isLocalSave = false;
	let ignoreEchoTimeout: any;

	// Load initial data
	async function loadTechRider() {
		const { data, error } = await supabase
			.from('tech_riders')
			.select('*')
			.limit(1)
			.single();

		if (error) {
			console.error('Error loading tech rider:', error);
		} else {
			techRider = data;
		}
		isLoading = false;
	}

	// Save updates to Supabase
	async function handleSave(updatedData: any) {
		if (!techRider) return;
		techRider.document_data = updatedData;
        
		// Set the flag to true so we ignore the incoming Realtime echo
		isLocalSave = true;
		clearTimeout(ignoreEchoTimeout);

		const { error } = await supabase
			.from('tech_riders')
			.update({ document_data: updatedData, updated_at: new Date().toISOString() })
			.eq('id', techRider.id);

		if (error) console.error('Error saving:', error);
        
		// Clear the flag after 1.5 seconds (gives the Supabase echo enough time to pass)
		ignoreEchoTimeout = setTimeout(() => {
			isLocalSave = false;
		}, 1500);
	}

	onMount(() => {
		loadTechRider();

		// Set up Realtime listener
		realtimeChannel = supabase.channel('tech-rider-updates')
			.on(
				'postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'tech_riders' },
				(payload: any) => {
					// NEW: If we just saved locally, ignore this payload so it doesn't interrupt typing
					if (isLocalSave) return; 

					// Update local state when someone else modifies the database
					if (techRider && payload.new.id === techRider.id) {
						techRider = payload.new;
					}
				}
			)
			.subscribe();
	});

	onDestroy(() => {
		if (realtimeChannel) supabase.removeChannel(realtimeChannel);
		clearTimeout(ignoreEchoTimeout);
	});
</script>

<svelte:head>
	<title>Tech Rider — Produkt App</title>
</svelte:head>

<MainLayout pageTitle="Technical Rider">
	<div class="h-full w-full max-w-[1100px] mx-auto px-4 py-6 flex flex-col">
		{#if isLoading}
			<div class="flex-1 flex items-center justify-center">
				<div class="w-12 h-12 border-4 border-lime border-t-transparent rounded-full animate-spin"></div>
			</div>
		{:else if techRider}
			<TechRiderForm 
				documentData={techRider.document_data} 
				onSave={handleSave} 
			/>
		{:else}
			<div class="text-gray2 text-center mt-10">No Tech Rider found in database.</div>
		{/if}
	</div>
</MainLayout>