<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import DatePicker from '$lib/components/buttons/DatePicker.svelte';
	import { createSSShow } from '$lib/services/ssShowService';

	export let isOpen = false;

	const dispatch = createEventDispatcher();

	let loading = false;
	
	// Form State
	let show_date = '';
	let show_venue = '';
	let venue_address = ''; 
	let show_city = '';
	let show_country = '';

    // Validation: Address is NOT required
	$: isFormValid = show_date && show_venue;

	function resetForm() {
		show_date = '';
		show_venue = '';
		venue_address = '';
		show_city = '';
		show_country = '';
		loading = false;
	}

	function closeModal() {
		dispatch('close');
		resetForm();
	}

	async function handleSubmit() {
		if (!isFormValid || loading) return;

		try {
			loading = true;
			await createSSShow({
				show_date,
				show_venue,
				venue_address, // Optional
				show_city,
				show_country
			});
			dispatch('success');
			closeModal();
		} catch (error) {
			console.error('Error creating show:', error);
			alert('Failed to create show');
		} finally {
			loading = false;
		}
	}
</script>

<Modal
	bind:isOpen
	title="Add New SS Show"
	maxWidth="max-w-xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-4">
		<div>
			<p class="font-normal text-lime mb-2">Show Date</p>
			<DatePicker 
                bind:value={show_date} 
                placeholder="Select date" 
                variant="input"
                format="yyyy-mm-dd"
                width="w-full"
                height="h-[50px]"
            />
		</div>

		<div>
			<p class="font-normal text-lime mb-2">Venue Name</p>
			<input
				type="text"
				class="w-full bg-transparent border border-lime rounded-full px-4 h-[50px] text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
				placeholder="e.g. New City Gas"
				bind:value={show_venue}
			/>
		</div>

        <div>
			<p class="font-normal text-lime mb-2">Venue Address <span class="text-gray2 text-xs font-normal ml-1">(Optional)</span></p>
			<input
				type="text"
				class="w-full bg-transparent border border-lime rounded-full px-4 h-[50px] text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
				placeholder="e.g. 950 Ottawa St"
				bind:value={venue_address}
			/>
		</div>

		<div class="flex gap-4">
			<div class="flex-1">
				<p class="font-normal text-lime mb-2">City</p>
				<input
					type="text"
					class="w-full bg-transparent border border-lime rounded-full px-4 h-[50px] text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
					placeholder="e.g. Montreal"
					bind:value={show_city}
				/>
			</div>
			<div class="flex-1">
				<p class="font-normal text-lime mb-2">Country</p>
				<input
					type="text"
					class="w-full bg-transparent border border-lime rounded-full px-4 h-[50px] text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
					placeholder="e.g. Canada"
					bind:value={show_country}
				/>
			</div>
		</div>
	</div>

	<div slot="footer" class="flex gap-3 justify-end">
		<button
			class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
			on:click={closeModal}
		>
			Cancel
		</button>
		<button
			class="px-6 py-3 rounded-full transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
			class:bg-lime={isFormValid && !loading}
			class:text-black={isFormValid && !loading}
			class:bg-gray1={!isFormValid || loading}
			class:text-gray2={!isFormValid || loading}
			class:hover:bg-lime={isFormValid && !loading}
			disabled={!isFormValid || loading}
			on:click={handleSubmit}
		>
			{loading ? 'Creating...' : 'Create Show'}
		</button>
	</div>
</Modal>