<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import Modal from './Modal.svelte';
	import { portal } from '$lib/utils/portalUtils.js';

	export let show = false;
	export let onSelect: (contact: LocalContact) => void;
	export let currentSelectedContact: string = ''; // Format: "First Name - Phone"

	const dispatch = createEventDispatcher();

	interface LocalContact {
		id: number;
		dj_name: string;
		first_name: string;
		last_name: string;
		email: string;
		phone: string;
	}

	let contacts: LocalContact[] = [];
	let filteredContacts: LocalContact[] = [];
	let searchQuery = '';
	let isEditing = false;
	let editingContact: LocalContact | null = null;
	let isAdding = false;
	let loading = false;
	let saving = false;

	// Form fields
	let formDjName = '';
	let formFirstName = '';
	let formLastName = '';
	let formEmail = '';
	let formPhone = '';

	onMount(() => {
		if (show) {
			fetchContacts();
		}
	});

	$: if (show) {
		fetchContacts();
	}

	$: {
		if (searchQuery.trim() === '') {
			filteredContacts = [...contacts];
		} else {
			const query = searchQuery.toLowerCase();
			filteredContacts = contacts.filter(
				(contact) =>
					contact.dj_name.toLowerCase().includes(query) ||
					contact.first_name.toLowerCase().includes(query) ||
					contact.last_name.toLowerCase().includes(query) ||
					contact.email.toLowerCase().includes(query) ||
					contact.phone.toLowerCase().includes(query)
			);
		}
		// Sort alphabetically by DJ name
		filteredContacts.sort((a, b) => a.dj_name.localeCompare(b.dj_name));
	}

	// Check if a contact is currently selected
	function isContactSelected(contact: LocalContact): boolean {
		const contactString = `${contact.first_name} - ${contact.phone}`;
		return currentSelectedContact === contactString;
	}

	async function fetchContacts() {
		loading = true;
		try {
			const { data, error } = await supabase
				.from('local_contacts')
				.select('*')
				.order('dj_name', { ascending: true });

			if (error) throw error;
			contacts = data || [];
		} catch (err) {
			console.error('Error fetching contacts:', err);
		} finally {
			loading = false;
		}
	}

	function handleAddNew() {
		isAdding = true;
		isEditing = false;
		editingContact = null;
		resetForm();
	}

	function handleEdit(contact: LocalContact) {
		isEditing = true;
		isAdding = false;
		editingContact = contact;
		formDjName = contact.dj_name;
		formFirstName = contact.first_name;
		formLastName = contact.last_name;
		formEmail = contact.email;
		formPhone = contact.phone;
	}

	function handleCancelEdit() {
		isEditing = false;
		isAdding = false;
		editingContact = null;
		resetForm();
	}

	function resetForm() {
		formDjName = '';
		formFirstName = '';
		formLastName = '';
		formEmail = '';
		formPhone = '';
	}

	async function handleSave() {
		if (!formDjName || !formEmail) {
			alert('DJ Name and Email are required');
			return;
		}

		saving = true;
		try {
			if (isEditing && editingContact) {
				// Update existing contact
				const { error } = await supabase
					.from('local_contacts')
					.update({
						dj_name: formDjName,
						first_name: formFirstName,
						last_name: formLastName,
						email: formEmail,
						phone: formPhone,
						updated_at: new Date().toISOString()
					})
					.eq('id', editingContact.id);

				if (error) throw error;
			} else {
				// Add new contact
				const { error } = await supabase.from('local_contacts').insert({
					dj_name: formDjName,
					first_name: formFirstName,
					last_name: formLastName,
					email: formEmail,
					phone: formPhone
				});

				if (error) throw error;
			}

			await fetchContacts();
			handleCancelEdit();
		} catch (err) {
			console.error('Error saving contact:', err);
			alert('Failed to save contact');
		} finally {
			saving = false;
		}
	}

	async function handleDelete(contact: LocalContact) {
		if (!confirm(`Are you sure you want to delete ${contact.dj_name}?`)) {
			return;
		}

		try {
			const { error } = await supabase.from('local_contacts').delete().eq('id', contact.id);

			if (error) throw error;
			await fetchContacts();
		} catch (err) {
			console.error('Error deleting contact:', err);
			alert('Failed to delete contact');
		}
	}

	function handleSelectContact(contact: LocalContact) {
		// If clicking the same contact, deselect it (clear)
		if (isContactSelected(contact)) {
			onSelect({ id: 0, dj_name: '', first_name: '', last_name: '', email: '', phone: '' });
		} else {
			onSelect(contact);
		}
		close();
	}

	function handleClearSelection() {
		onSelect({ id: 0, dj_name: '', first_name: '', last_name: '', email: '', phone: '' });
		close();
	}

	function close() {
		show = false;
		handleCancelEdit();
		dispatch('close');
	}
</script>

{#if show}
	<div use:portal>
		<Modal
			isOpen={true}
			title="Local Contacts"
			maxWidth="max-w-6xl"
			hasFooter={false}
			on:close={close}
		>
			<div class="space-y-4" style="min-height: 500px;">
				{#if isAdding || isEditing}
					<!-- Add/Edit Form -->
					<div class="space-y-4">
						<h3 class="text-lg font-semibold text-white">
							{isEditing ? 'Edit Contact' : 'Add New Contact'}
						</h3>
						<div class="space-y-3">
							<div>
								<label for="dj-name-input" class="block text-sm font-medium text-gray2 mb-1"
									>DJ Name *</label
								>
								<input
									id="dj-name-input"
									type="text"
									bind:value={formDjName}
									class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-lime"
									placeholder="Enter DJ name"
								/>
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label for="first-name-input" class="block text-sm font-medium text-gray2 mb-1"
										>First Name</label
									>
									<input
										id="first-name-input"
										type="text"
										bind:value={formFirstName}
										class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-lime"
										placeholder="Enter first name"
									/>
								</div>
								<div>
									<label for="last-name-input" class="block text-sm font-medium text-gray2 mb-1"
										>Last Name</label
									>
									<input
										id="last-name-input"
										type="text"
										bind:value={formLastName}
										class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-lime"
										placeholder="Enter last name"
									/>
								</div>
							</div>
							<div>
								<label for="email-input" class="block text-sm font-medium text-gray2 mb-1"
									>Email *</label
								>
								<input
									id="email-input"
									type="email"
									bind:value={formEmail}
									class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-lime"
									placeholder="Enter email"
								/>
							</div>
							<div>
								<label for="phone-input" class="block text-sm font-medium text-gray2 mb-1"
									>Phone</label
								>
								<input
									id="phone-input"
									type="tel"
									bind:value={formPhone}
									class="w-full bg-gray1 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-lime"
									placeholder="Enter phone number"
								/>
							</div>
						</div>
						<div class="flex gap-2 pt-2">
							<button
								on:click={handleSave}
								disabled={saving}
								class="px-4 py-2 bg-lime text-black rounded-full font-semibold hover:opacity-90 transition-colors disabled:opacity-50 text-sm cursor-pointer"
							>
								{saving ? 'Saving...' : 'Save'}
							</button>
							<button
								on:click={handleCancelEdit}
								class="px-4 py-2 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors text-sm cursor-pointer"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<!-- Search and Add Button -->
					<div class="flex gap-3 mb-4">
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Search contacts..."
							class="flex-1 bg-gray1 text-white rounded-3xl px-4 py-2 text-sm border border-gray-600 focus:outline-none focus:border-lime"
						/>
						{#if currentSelectedContact}
							<button
								on:click={handleClearSelection}
								class="px-4 py-2 border border-problem text-problem rounded-full hover:text-red-500 hover:border-red-500 transition-colors text-sm whitespace-nowrap cursor-pointer"
							>
								Clear Selection
							</button>
						{/if}
						<button
							on:click={handleAddNew}
							class="px-4 py-2 bg-lime text-black rounded-full font-semibold hover:opacity-90 transition-colors text-sm whitespace-nowrap cursor-pointer"
						>
							+ Add New
						</button>
					</div>

					<!-- Contacts List -->
					{#if loading}
						<div class="flex items-center justify-center text-gray2" style="height: 400px;">
							Loading...
						</div>
					{:else if filteredContacts.length === 0}
						<div class="flex items-center justify-center text-gray2" style="height: 400px;">
							{searchQuery ? 'No contacts found' : 'No contacts yet. Add one to get started.'}
						</div>
					{:else}
						<div class="space-y-2 overflow-y-auto pr-2" style="height: 400px;">
							<div
								class="grid grid-cols-[2fr_1.5fr_1.5fr_2.5fr_1.5fr_auto] gap-3 px-4 py-2 text-xs font-semibold text-gray2 border-b border-gray1 sticky top-0 bg-navbar z-10"
							>
								<div>DJ Name</div>
								<div>First Name</div>
								<div>Last Name</div>
								<div>Email</div>
								<div>Phone</div>
								<div class="w-20">Actions</div>
							</div>
							{#each filteredContacts as contact (contact.id)}
								<div
									class="grid grid-cols-[2fr_1.5fr_1.5fr_2.5fr_1.5fr_auto] gap-3 px-4 py-3 rounded-lg transition-colors text-sm items-center cursor-pointer {isContactSelected(
										contact
									)
										? 'bg-lime/20 border-2 border-lime'
										: 'bg-gray1 hover:bg-lime/20 border-2 border-transparent'}"
									on:click={() => handleSelectContact(contact)}
									role="button"
									tabindex="0"
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											handleSelectContact(contact);
										}
									}}
								>
									<div
										class="text-lime hover:underline font-medium truncate"
										title={contact.dj_name}
									>
										{contact.dj_name}
									</div>
									<div class="text-white truncate" title={contact.first_name}>
										{contact.first_name}
									</div>
									<div class="text-white truncate" title={contact.last_name}>
										{contact.last_name}
									</div>
									<div class="text-gray2 truncate text-xs" title={contact.email}>
										{contact.email || '-'}
									</div>
									<div class="text-gray2 truncate text-xs" title={contact.phone}>
										{contact.phone || '-'}
									</div>
									<div class="flex gap-1">
										<button
											on:click|stopPropagation={() => handleEdit(contact)}
											class="p-1.5 text-lime hover:bg-lime hover:text-black rounded transition-colors cursor-pointer"
											aria-label="Edit contact"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
												/>
											</svg>
										</button>
										<button
											on:click|stopPropagation={() => handleDelete(contact)}
											class="p-1.5 text-red-400 hover:bg-red-400 hover:text-white rounded transition-colors cursor-pointer"
											aria-label="Delete contact"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
												/>
											</svg>
										</button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</Modal>
	</div>
{/if}

<style lang="postcss">
	@tailwind base;
	@tailwind components;
	@tailwind utilities;
</style>
