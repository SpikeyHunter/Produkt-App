<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import MainLayout from '$lib/components/MainLayout.svelte';

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
	let mounted = false;

	// Form fields
	let formDjName = '';
	let formFirstName = '';
	let formLastName = '';
	let formEmail = '';
	let formPhone = '';

	onMount(() => {
		fetchContacts();
		setTimeout(() => (mounted = true), 150);
	});

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
		if (!formDjName || !formFirstName || !formLastName) {
			alert('DJ Name, First Name, and Last Name are required');
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
</script>

<svelte:head>
	<title>Local Artists - NCG</title>
</svelte:head>

<MainLayout pageTitle="Local Artists" requiredPermission="LocalArtists">
	<div class="fade-in {mounted ? 'mounted' : ''}">
		<div class="max-w-7xl mx-auto">
			<div class="mb-6">
				<h1 class="text-3xl font-bold text-white">Local Artists</h1>
				<p class="text-gray2 mt-1">Manage your local artist contacts database</p>
			</div>

			<div class="bg-navbar rounded-lg p-6 shadow-lg">
				{#if isAdding || isEditing}
					<!-- Add/Edit Form -->
					<div class="space-y-4">
						<div class="flex items-center justify-between mb-4">
							<h3 class="text-xl font-semibold text-white">
								{isEditing ? 'Edit Contact' : 'Add New Contact'}
							</h3>
						</div>
						<div class="space-y-4">
							<div>
								<label for="dj-name-input" class="block text-sm font-medium text-gray2 mb-1"
									>DJ Name *</label
								>
								<input
									id="dj-name-input"
									type="text"
									bind:value={formDjName}
									class="w-full bg-gray1 text-white rounded-lg px-4 py-2.5 text-sm border border-gray-600 focus:outline-none focus:border-lime"
									placeholder="Enter DJ name"
								/>
							</div>
							<div class="grid grid-cols-2 gap-4">
								<div>
									<label for="first-name-input" class="block text-sm font-medium text-gray2 mb-1"
										>First Name *</label
									>
									<input
										id="first-name-input"
										type="text"
										bind:value={formFirstName}
										class="w-full bg-gray1 text-white rounded-lg px-4 py-2.5 text-sm border border-gray-600 focus:outline-none focus:border-lime"
										placeholder="Enter first name"
									/>
								</div>
								<div>
									<label for="last-name-input" class="block text-sm font-medium text-gray2 mb-1"
										>Last Name *</label
									>
									<input
										id="last-name-input"
										type="text"
										bind:value={formLastName}
										class="w-full bg-gray1 text-white rounded-lg px-4 py-2.5 text-sm border border-gray-600 focus:outline-none focus:border-lime"
										placeholder="Enter last name"
									/>
								</div>
							</div>
							<div>
								<label for="email-input" class="block text-sm font-medium text-gray2 mb-1"
									>Email</label
								>
								<input
									id="email-input"
									type="email"
									bind:value={formEmail}
									class="w-full bg-gray1 text-white rounded-lg px-4 py-2.5 text-sm border border-gray-600 focus:outline-none focus:border-lime"
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
									class="w-full bg-gray1 text-white rounded-lg px-4 py-2.5 text-sm border border-gray-600 focus:outline-none focus:border-lime"
									placeholder="Enter phone number"
								/>
							</div>
						</div>
						<div class="flex gap-3 pt-2">
							<button
								on:click={handleSave}
								disabled={saving}
								class="px-6 py-2.5 bg-lime text-black rounded-full font-semibold hover:opacity-90 transition-colors disabled:opacity-50 text-sm cursor-pointer"
							>
								{saving ? 'Saving...' : 'Save'}
							</button>
							<button
								on:click={handleCancelEdit}
								class="px-6 py-2.5 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors text-sm cursor-pointer"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<!-- Search and Add Button -->
					<div class="flex gap-3 mb-6">
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Search contacts..."
							class="flex-1 bg-gray1 text-white rounded-full px-5 py-2.5 text-sm border border-gray-600 focus:outline-none focus:border-lime"
						/>
						<button
							on:click={handleAddNew}
							class="px-6 py-2.5 bg-lime text-black rounded-full font-semibold hover:opacity-90 transition-colors text-sm whitespace-nowrap cursor-pointer"
						>
							+ Add New
						</button>
					</div>

					<!-- Contacts List -->
					{#if loading}
						<div class="flex items-center justify-center text-gray2 py-20">
							<div class="text-center">
								<div
									class="w-12 h-12 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-3"
								></div>
								<p>Loading contacts...</p>
							</div>
						</div>
					{:else if filteredContacts.length === 0}
						<div class="flex items-center justify-center text-gray2 py-20">
							<div class="text-center">
								<svg
									class="w-16 h-16 mx-auto mb-4 text-gray-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
									/>
								</svg>
								<p class="text-lg">
									{searchQuery ? 'No contacts found' : 'No contacts yet. Add one to get started.'}
								</p>
							</div>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<div class="min-w-full">
								<div
									class="grid grid-cols-[2fr_1.5fr_1.5fr_2.5fr_1.5fr_auto] gap-4 px-5 py-3 text-xs font-semibold text-gray2 border-b border-gray1 bg-navbar"
								>
									<div>DJ Name</div>
									<div>First Name</div>
									<div>Last Name</div>
									<div>Email</div>
									<div>Phone</div>
									<div class="w-24">Actions</div>
								</div>
								<div class="space-y-2 mt-2">
									{#each filteredContacts as contact (contact.id)}
										<div
											class="grid grid-cols-[2fr_1.5fr_1.5fr_2.5fr_1.5fr_auto] gap-4 px-5 py-4 rounded-lg transition-colors text-sm items-center bg-gray1 hover:bg-lime/10 border border-transparent hover:border-lime/30"
										>
											<div class="text-lime font-medium truncate" title={contact.dj_name}>
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
											<div class="flex gap-2">
												<button
													on:click={() => handleEdit(contact)}
													class="p-2 text-lime hover:bg-lime hover:text-black rounded transition-colors cursor-pointer"
													aria-label="Edit contact"
												>
													<svg
														class="w-4 h-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
														/>
													</svg>
												</button>
												<button
													on:click={() => handleDelete(contact)}
													class="p-2 text-red-400 hover:bg-red-400 hover:text-white rounded transition-colors cursor-pointer"
													aria-label="Delete contact"
												>
													<svg
														class="w-4 h-4"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
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
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
</MainLayout>

<style>
	.fade-in {
		opacity: 0;
		transform: translateY(20px);
		transition:
			opacity 0.6s ease-out,
			transform 0.6s ease-out;
	}

	.fade-in.mounted {
		opacity: 1;
		transform: translateY(0);
	}
</style>