<script lang="ts">
	import { onMount } from 'svelte';

	// Your long Supabase URL
	const vcfUrl = 'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/contact_card/Produkt%20Calendar.vcf';

	onMount(() => {
		// As soon as the page loads, redirect the browser to the file
		// This triggers the download automatically on mobile and desktop
		window.location.href = vcfUrl;
	});
</script>

<div class="flex items-center justify-center min-h-screen bg-black w-full">
	<div class="bg-gray1 p-8 rounded-3xl max-w-sm w-full text-center border border-gray2/20 shadow-2xl">
		<svg class="w-12 h-12 text-lime animate-spin mx-auto mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
		
		<h1 class="text-white text-xl font-bold mb-3">Downloading Contact...</h1>
		<p class="text-gray3 mb-6 text-sm">Please wait while the file downloads to your device.</p>
		
		<p class="text-xs text-gray3">
			If it doesn't start automatically, 
			<a href={vcfUrl} class="text-lime hover:underline font-bold">click here</a>.
		</p>
	</div>
</div>