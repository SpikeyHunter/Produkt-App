<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	
	let status: 'loading' | 'success' | 'error' = 'loading';
	
	onMount(async () => {
		const userId = $page.url.searchParams.get('id');
		
		if (!userId) {
			status = 'error';
			return;
		}

		try {
			const { error } = await supabase
				.from('calendar_users')
				.update({ confirmation_email: false })
				.eq('id', userId);
				
			if (error) throw error;
			status = 'success';
		} catch (err) {
			console.error("Unsubscribe failed", err);
			status = 'error';
		}
	});
</script>

<div class="min-h-screen bg-gray1 flex items-center justify-center p-4 text-center">
	<div class="bg-[#1e1e1e] border border-gray2/20 rounded-3xl p-10 max-w-md w-full shadow-2xl">
		<img src="/images/ProduktXX_LOGO1.png" alt="Produkt" class="h-8 mx-auto mb-8" />
		
		{#if status === 'loading'}
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime mx-auto mb-4"></div>
			<p class="text-gray2 font-bold">Processing your request...</p>
			
		{:else if status === 'success'}
			<div class="w-16 h-16 bg-lime/10 rounded-full flex items-center justify-center mx-auto mb-6">
				<svg class="w-8 h-8 text-lime" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
				</svg>
			</div>
			<h1 class="text-2xl font-black text-white mb-4">Unsubscribed</h1>
			<p class="text-gray2">
				You've been unsubscribed from Produkt App - Calendar.<br/>
				You will not receive these emails from us anymore. Thank you!
			</p>
			
		{:else}
			<div class="w-16 h-16 bg-problem/10 rounded-full flex items-center justify-center mx-auto mb-6">
				<svg class="w-8 h-8 text-problem" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
				</svg>
			</div>
			<h1 class="text-2xl font-black text-white mb-4">Oops!</h1>
			<p class="text-gray2">
				We couldn't process your request. The link might be invalid or expired.
			</p>
		{/if}
	</div>
</div>