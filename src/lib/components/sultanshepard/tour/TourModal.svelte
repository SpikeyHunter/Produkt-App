<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import TourDateRangePicker from './TourDateRangePicker.svelte';
	import { createTour, updateTour, deleteTour } from '$lib/services/tourService';
	import type { SSTour } from '$lib/types/tour';

	export let isOpen = false;
	export let tour: SSTour | null = null;
	

	const dispatch = createEventDispatcher();

	let loading = false;
	let showDeleteConfirm = false;

	let name = '';
	let year: number | '' = new Date().getFullYear();
	let start_date = '';
	let end_date = '';
	let description = '';

	// Determines if we are editing an existing tour or creating a new one
	$: isEditMode = !!tour;

	// Reactively populate or reset the form when the modal opens
	$: if (isOpen) {
		if (tour) {
			name = tour.name;
			year = tour.year;
			start_date = tour.start_date;
			end_date = tour.end_date;
			description = tour.description || '';
		} else {
			resetForm();
		}
		showDeleteConfirm = false;
	}

	$: isYearValid = typeof year === 'number' && year >= 2010 && year <= 2100;
	$: isFormValid = name && isYearValid && start_date && end_date;

	function resetForm() {
		name = '';
		year = new Date().getFullYear();
		start_date = '';
		end_date = '';
		description = '';
		loading = false;
	}

	function closeModal() {
		dispatch('close');
		showDeleteConfirm = false;
		if (!isEditMode) resetForm();
	}

	async function handleSave() {
		if (!isFormValid || loading) return;

		try {
			loading = true;
			if (isEditMode && tour) {
				const updatedTour = await updateTour(tour.id, {
					name,
					year: Number(year),
					start_date,
					end_date,
					description
				});
				dispatch('save', { tour: updatedTour });
			} else {
				const newTour = await createTour({
					name,
					year: Number(year),
					start_date,
					end_date,
					description,
					maps_info: ''
				});
				dispatch('save', { tour: newTour }); // We use 'save' for both to simplify the parent component
			}
			closeModal();
		} catch (error) {
			console.error('Error saving tour:', error);
			alert('Failed to save tour');
		} finally {
			loading = false;
		}
	}

	async function handleDelete() {
		if (!tour) return;
		try {
			loading = true;
			await deleteTour(tour.id);
			dispatch('delete', { id: tour.id });
			closeModal();
		} catch (error) {
			console.error('Error deleting tour:', error);
		} finally {
			loading = false;
		}
	}
</script>

<Modal
	bind:isOpen
	title={isEditMode ? 'Edit Tour' : 'Create New Tour'}
	maxWidth="max-w-xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-4">
		<div>
			<p class="font-normal text-lime mb-2">Tour Name</p>
			<input
				type="text"
				class="w-full bg-gray1  rounded-3xl px-4 h-[50px] text-white placeholder-gray2 focus:ring-2 focus:ring-lime"
				placeholder="e.g. Forever, Now Tour"
				bind:value={name}
			/>
		</div>

		<div class="flex gap-4">
			<div class="w-1/3">
				<p class="font-normal text-lime mb-2">Year</p>
				<input
					type="number"
					min="2010"
					max="2100"
					class="w-full  bg-gray1 rounded-3xl px-4 h-[50px] text-white placeholder-gray2 focus:ring-2 focus:ring-lime "
					placeholder="YYYY"
					bind:value={year}
				/>
			</div>
			<div class="w-2/3">
				<p class="font-normal text-lime mb-2">Duration</p>
				<TourDateRangePicker
					bind:startDate={start_date}
					bind:endDate={end_date}
					tourYear={Number(year)}
					disabled={!isYearValid}
				/>
			</div>
		</div>

		<div>
			<p class="font-normal text-lime mb-2">
				Description <span class="text-gray2 text-xs font-normal ml-1">(Optional)</span>
			</p>
			<textarea
				class="w-full  bg-gray1  rounded-3xl p-4 text-white placeholder-gray2 outline-none focus:ring-2 focus:ring-lime shadow-none m-0 resize-none h-24 appearance-none"
				placeholder="Brief description of the tour"
				bind:value={description}
			></textarea>
		</div>

		{#if isEditMode && showDeleteConfirm}
			<div class="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mt-6">
				<div class="flex items-center gap-2 mb-2">
					<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"
						><path
							fill-rule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/></svg
					>
					<h4 class="text-red-400 font-bold text-sm">Confirm Deletion</h4>
				</div>
				<p class="text-red-300 text-sm mb-3">
					Are you sure you want to delete this tour? All associated dates will be permanently
					deleted.
				</p>
				<div class="flex gap-2">
					<button
						class="px-4 py-2 text-sm border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
						on:click={() => (showDeleteConfirm = false)}>Cancel</button
					>
					<button
						class="px-4 py-2 text-sm bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
						disabled={loading}
						on:click={handleDelete}>{loading ? 'Deleting...' : 'Delete'}</button
					>
				</div>
			</div>
		{/if}
	</div>

	<div slot="footer" class="flex gap-3 justify-between">
		{#if isEditMode && !showDeleteConfirm}
			<button
				class="px-6 py-3 border border-red-500 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
				disabled={loading}
				on:click={() => (showDeleteConfirm = true)}>Delete Tour</button
			>
		{:else}<div></div>{/if}

		<div class="flex gap-3">
			<button
				class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
				on:click={closeModal}>Cancel</button
			>
			<button
				class="px-6 py-3 rounded-full transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
				class:bg-lime={isFormValid && !loading}
				class:text-black={isFormValid && !loading}
				class:bg-gray1={!isFormValid || loading}
				class:text-gray2={!isFormValid || loading}
				class:hover:bg-lime={isFormValid && !loading}
				disabled={!isFormValid || loading || showDeleteConfirm}
				on:click={handleSave}
				>{loading
					? isEditMode
						? 'Saving...'
						: 'Creating...'
					: isEditMode
						? 'Save Changes'
						: 'Create Tour'}</button
			>
		</div>
	</div>
</Modal>
