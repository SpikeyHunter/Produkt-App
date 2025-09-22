<script lang="ts">
	import PromoterLetter from '$lib/components/advance/PromoterLetter.svelte';
	import { createDefaultLetterData } from '$lib/utils/letter-helpers';
	import type { Person } from '$lib/types/events'; // Assuming this type exists for the helper
	import type { PromoterLetterData } from '$lib/types/letter';

	// 1. Create a sample artist to generate letter data
	// The 'role' property has been added to match the 'Person' type.
	const sampleArtist: Person = {
		id: '123',
		firstName: 'Amelia',
		lastName: 'Chen',
		role: 'Artist' // Added missing 'role' property
	};
	
	// 2. Use your helper function to generate the base data
	// The function will automatically use today's date: September 18, 2025
	let letterData: PromoterLetterData = createDefaultLetterData(
		sampleArtist,
		'Autumn Equinox Festival',
		'2025-10-15', // Event date
		'P12345678' // Passport Number
	);

	// 3. Override and add specific details for a complete preview
	letterData = {
		...letterData,
		artistDob: 'May 20 1995',
		artistCitizenship: 'Australian',
		artistGender: 'female',
		showDuration: 1, // The component expects a number
		paymentCurrency: 'CAD',
		paymentAmount: '5,000', // The type definition expects a string
		stayDurationDays: 4,
		visaNumber: 'V987654321' // Providing a visa number will show the visa label
	};
</script>

<svelte:head>
	<title>Letter Preview</title>
</svelte:head>

<main class="page-background">
	<div class="document-container">
		<PromoterLetter data={letterData} />
	</div>
</main>

<style>
	/* Styles to make the preview look like a document on a desk */
	.page-background {
		background-color: #d1d5db; /* A neutral gray background */
		padding: 2rem;
		display: flex;
		justify-content: center;
		min-height: 100vh;
	}

	.document-container {
		width: 8.5in;
		min-height: 11in;
		box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.2);
	}
</style>