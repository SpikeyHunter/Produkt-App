<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import type { EventAdvance } from '$lib/services/eventsService';
	import { updateEventColumn } from '$lib/services/eventsService';
	import { productionContactMap } from '$lib/components/settings/AdvanceVariables';
	import Modal from '$lib/components/modals/Modal.svelte';

	export let isOpen = false;
	export let event: EventAdvance;
	const dispatch = createEventDispatcher();

	// Local state to stage changes before saving
	let localSettings: { ProdContact_Enabled?: boolean; ProdContact?: string } = {};
	let isSaving = false;

	// UI state is derived from localSettings for reactivity
	$: isProdContactEnabled = localSettings.ProdContact_Enabled === true;
	$: selectedProdContact = localSettings.ProdContact || '';
	const prodContactOptions = Object.keys(productionContactMap);

	onMount(() => {
		// Create a deep copy to work with, preserving the original event object
		if (event.custom_settings && typeof event.custom_settings === 'object') {
			localSettings = JSON.parse(JSON.stringify(event.custom_settings));
		}
	});

	// --- UI Handlers that only modify the local state ---

	function handleToggleProdContact(e: Event) {
		const isEnabled = (e.target as HTMLInputElement).checked;
		localSettings.ProdContact_Enabled = isEnabled;

		if (isEnabled) {
			// If enabling, default to 'Danny' if no contact is already set
			if (!localSettings.ProdContact) {
				localSettings.ProdContact = 'Danny';
			}
		} else {
			// If disabling, completely remove the contact data key from the JSON
			delete localSettings.ProdContact;
		}
		// Trigger Svelte's reactivity by reassigning the object
		localSettings = { ...localSettings };
	}

	function handleProdContactSelect(selectedValue: string) {
		if (isProdContactEnabled) {
			localSettings.ProdContact = selectedValue;
			localSettings = { ...localSettings };
		}
		showDropdown = false;
	}

	// --- Save and Close Handlers ---

	async function handleSave() {
		isSaving = true;
		try {
			await updateEventColumn(event.id, 'custom_settings', localSettings);
			dispatch('change', localSettings); // Notify parent of successful save
			handleClose(); // Close modal after saving
		} catch (error) {
			console.error('Failed to save custom settings:', error);
		} finally {
			isSaving = false;
		}
	}

	function handleClose() {
		dispatch('close');
	}

	// --- Embedded Dropdown Logic ---
	let showDropdown = false;
	let dropdownElement: HTMLDivElement;

	function toggleDropdown() {
		if (!isSaving) {
			showDropdown = !showDropdown;
		}
	}

	function handleClickOutside(event: MouseEvent) {
		if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
			showDropdown = false;
		}
	}

	onMount(() => {
		if (browser) window.addEventListener('click', handleClickOutside);
	});

	onDestroy(() => {
		if (browser) window.removeEventListener('click', handleClickOutside);
	});
</script>

<Modal {isOpen} title="Custom Settings" on:close={handleClose} hasFooter={true} maxWidth="max-w-xl">
	<div class="space-y-3 text-m text-gray3">
		<div class="flex border-b border-gray1 pb-2">
			<div class="w-3/5 font-bold text-left">SETTING</div>
			<div class="w-2/5 font-bold text-left">STATUS</div>
			<div class="w-3/5 font-bold text-left">DATA</div>
		</div>

		<div class="flex min-h-[44px] items-center">
			<div class="w-3/5">Production Contact</div>
			<div class="w-2/5 flex justify-start">
				<label class="relative inline-flex cursor-pointer items-center">
					<input
						type="checkbox"
						class="peer sr-only"
						checked={isProdContactEnabled}
						on:change={handleToggleProdContact}
					/>
					<div
						class="peer h-6 w-11 rounded-full bg-gray2 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-lime peer-checked:after:translate-x-full peer-checked:after:border-transparent peer-checked:after:bg-navbar"
					></div>
				</label>
			</div>
			<div class="w-3/5 flex justify-start">
				{#if isProdContactEnabled}
					<div class="relative w-32" bind:this={dropdownElement}>
						<button
							type="button"
							class="flex w-full items-center justify-between gap-2 rounded-2xl border border-transparent bg-gray1 px-4 py-2 text-left text-sm text-gray3 transition-colors hover:cursor-pointer hover:bg-lime hover:text-black focus:border-lime focus:outline-none"
							on:click={toggleDropdown}
						>
							<span>{selectedProdContact || 'Select...'}</span>
							<svg
								class="h-3 w-3 flex-shrink-0 text-gray-400 transition-transform {showDropdown ? 'rotate-180' : ''}"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3"
							>
								<path d="M6 9l6 6 6-6" />
							</svg>
						</button>

						{#if showDropdown}
							<div
								class="absolute top-full left-0 z-[9999] mt-1 w-full overflow-hidden rounded-lg border border-lime bg-navbar shadow-xl"
							>
								{#each prodContactOptions as option}
									<button
										type="button"
										class="block w-full border-b border-gray1 px-3 py-1.5 text-left font-bold text-white transition-colors last:border-b-0 hover:cursor-pointer hover:bg-lime hover:text-black"
										on:click={() => handleProdContactSelect(option)}
									>
										{option}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div slot="footer" class="flex justify-end gap-3">
		<button
			on:click={handleClose}
			class="rounded-3xl border-gray2 border-1 px-4 py-2 text-white transition-colors hover hover:bg-gray3 hover:text-black hover:cursor-pointer"
		>
			Cancel
		</button>
		<button
			on:click={handleSave}
			disabled={isSaving}
			class="rounded-3xl bg-gray3 px-4 py-2 font-bold text-black transition-colors hover hover:bg-lime hover:text-black hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if isSaving}
				Applying...
			{:else}
				Apply Settings
			{/if}
		</button>
	</div>
</Modal>