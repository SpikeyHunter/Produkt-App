<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';

	/**
	 * @prop {boolean} isOpen - Controls the visibility of the modal.
	 */
	export let isOpen = false;

	/**
	 * @prop {string} fileUrl - The URL of the image to display.
	 */
	export let fileUrl = '';

	/**
	 * @prop {string} fileName - The title for the modal header.
	 */
	export let fileName = 'Passport - Full Size View';

	const dispatch = createEventDispatcher();

	function closeModal() {
		dispatch('close');
	}
</script>

<Modal
	bind:isOpen
	title={fileName}
	maxWidth="max-w-6xl"
	showCloseButton={false}
	on:close={closeModal}
>
	<!-- Custom Lime Close Button -->
	<button
		on:click={closeModal}
		class="absolute top-5 right-5 z-20 w-9 h-9 flex items-center justify-center text-gray2 hover:text-white hover:bg-gray1 rounded-lg transition-colors cursor-pointer"
		aria-label="Close preview"
	>
		<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
			<line x1="18" y1="6" x2="6" y2="18" />
			<line x1="6" y1="6" x2="18" y2="18" />
		</svg>
	</button>

	<!-- Image Container -->
	<div
		class="relative w-full bg-gray1 rounded-lg overflow-hidden"
		style="height: min(80vh, calc(100vh - 200px));"
	>
		<img
			src={fileUrl}
			alt="Passport full-size preview"
			class="w-full h-full object-contain"
		/>
	</div>
</Modal>
