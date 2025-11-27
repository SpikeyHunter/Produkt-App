<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import DatePicker from '$lib/components/buttons/DatePicker.svelte';
	import { updateSSShow, deleteSSShow } from '$lib/services/ssShowService';
	import type { SSShow } from '$lib/services/ssShowService';

	export let isOpen = false;
	export let show: SSShow | null = null;

	const dispatch = createEventDispatcher();

	let loading = false;
	let showDeleteConfirm = false;

	// Form State
	let show_date = '';
	let show_venue = '';
	let show_city = '';
	let show_country = '';

	// Initialize form when show changes
	$: if (isOpen && show) {
		show_date = show.show_date;
		show_venue = show.show_venue || '';
		show_city = show.show_city || '';
		show_country = show.show_country || '';
		showDeleteConfirm = false;
	}

	$: isFormValid = show_date && show_venue;

	function closeModal() {
		dispatch('close');
		showDeleteConfirm = false;
	}

	async function handleSave() {
		if (!show || !isFormValid || loading) return;

		try {
			loading = true;
			const updatedShow = await updateSSShow(show.id, {
				show_date,
				show_venue,
				show_city,
				show_country
			});
			
			dispatch('save', { show: updatedShow });
			closeModal();
		} catch (error) {
			console.error('Error updating show:', error);
			alert('Failed to update show');
		} finally {
			loading = false;
		}
	}

	async function handleDelete() {
		if (!show) return;
		
		try {
			loading = true;
			await deleteSSShow(show.id);
			dispatch('delete', { id: show.id });
			closeModal();
		} catch (error) {
			console.error('Error deleting show:', error);
			alert('Failed to delete show');
		} finally {
			loading = false;
		}
	}
</script>

<Modal
	bind:isOpen
	title="Edit SS Show"
	maxWidth="max-w-xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-4">
		{#if show}
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
					bind:value={show_venue}
				/>
			</div>

			<div class="flex gap-4">
				<div class="flex-1">
					<p class="font-normal text-lime mb-2">City</p>
					<input
						type="text"
						class="w-full bg-transparent border border-lime rounded-full px-4 h-[50px] text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
						bind:value={show_city}
					/>
				</div>
				<div class="flex-1">
					<p class="font-normal text-lime mb-2">Country</p>
					<input
						type="text"
						class="w-full bg-transparent border border-lime rounded-full px-4 h-[50px] text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
						bind:value={show_country}
					/>
				</div>
			</div>

			{#if showDeleteConfirm}
				<div class="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mt-6">
					<div class="flex items-center gap-2 mb-2">
						<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
						</svg>
						<h4 class="text-red-400 font-bold text-sm">Confirm Deletion</h4>
					</div>
					<p class="text-red-300 text-sm mb-3">
						Are you sure you want to delete this show? This action cannot be undone.
					</p>
					<div class="flex gap-2">
						<button
							class="px-4 py-2 text-sm border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
							on:click={() => showDeleteConfirm = false}
						>
							Cancel
						</button>
						<button
							class="px-4 py-2 text-sm bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
							disabled={loading}
							on:click={handleDelete}
						>
							{loading ? 'Deleting...' : 'Delete'}
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<div slot="footer" class="flex gap-3 justify-between">
		{#if !showDeleteConfirm}
			<button
				class="px-6 py-3 border border-red-500 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
				disabled={loading}
				on:click={() => showDeleteConfirm = true}
			>
				Delete Show
			</button>
		{:else}
			<div></div>
		{/if}

		<div class="flex gap-3">
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
				disabled={!isFormValid || loading || showDeleteConfirm}
				on:click={handleSave}
			>
				{loading ? 'Saving...' : 'Save Changes'}
			</button>
		</div>
	</div>
</Modal>