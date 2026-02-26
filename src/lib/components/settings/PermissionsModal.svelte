<script lang="ts">
	import { portal } from '$lib/utils/portalUtils';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { supabase } from '$lib/supabase';

	export let isOpen = false;

	// Permissions mapped exactly from MainLayout.svelte
	const ROLES = ['Admin', 'User'];

	let MAIN_PERMISSIONS = [
		'Advance',
		'Booking',
		'Calendar',
		'Marketing',
		'NCGApp',
		'Production',
		'Schedule',
		'sultanshepard'
	].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
	let PAGE_PERMISSIONS = [
		'CompareHub',
		'CompTickets',
		'CustomersDB',
		'EventsInfo',
		'ShowBudget',
		'StageManager'
	].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

	let users: any[] = [];
	let selectedUser: any = null;
	let isLoading = false;
	let isSaving = false;
	let searchQuery = '';

	// Custom Dropdown states
	let roleDropdownOpen = false;
	let mainPermDropdownOpen = false;

	// Search and filter logic
	$: filteredUsers = users.filter((u) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
		const email = (u.email || '').toLowerCase();
		return fullName.includes(query) || email.includes(query);
	});

	// Fetch users when modal opens
	$: if (isOpen && users.length === 0) {
		fetchUsers();
	}

	async function fetchUsers() {
		isLoading = true;
		const { data, error } = await supabase.from('user_profiles').select('*').order('first_name');

		if (data && !error) {
			users = data;

			const permMap = new Map();
			MAIN_PERMISSIONS.forEach((p: string) => permMap.set(p.toLowerCase(), p));

			// Create a fast lookup to check if a permission is just a single page
			const pagePermsLower = new Set(PAGE_PERMISSIONS.map((p: string) => p.toLowerCase()));

			users.forEach((u: any) => {
				if (
					u.main_permission &&
					!permMap.has(u.main_permission.toLowerCase()) &&
					!pagePermsLower.has(u.main_permission.toLowerCase())
				) {
					permMap.set(u.main_permission.toLowerCase(), capitalize(u.main_permission));
				}
				if (Array.isArray(u.secondary_permission)) {
					u.secondary_permission.forEach((p: string) => {
						// Only add to MAIN_PERMISSIONS if it's NOT a specific page
						if (p && !permMap.has(p.toLowerCase()) && !pagePermsLower.has(p.toLowerCase())) {
							permMap.set(p.toLowerCase(), capitalize(p));
						}
					});
				}
			});

			MAIN_PERMISSIONS = Array.from(permMap.values()).sort((a, b) =>
				a.toLowerCase().localeCompare(b.toLowerCase())
			);
		} else {
			console.error('Failed to load users:', error);
		}
		isLoading = false;
	}

	function selectUser(user: any) {
		selectedUser = JSON.parse(JSON.stringify(user));

		// Grab all existing permissions to sort them properly
		const rawSecondary = selectedUser.secondary_permission || [];
		const rawPages = selectedUser.page_permissions || [];

		// Combine and deduplicate
		const allPerms = Array.from(new Set([...rawSecondary, ...rawPages]));

		const cleanSecondary: string[] = [];
		const cleanPages: string[] = [];

		// Sort them into the correct buckets based on the PAGE_PERMISSIONS list
		const pagePermsLower = new Set(PAGE_PERMISSIONS.map((p: string) => p.toLowerCase()));

		allPerms.forEach((p: string) => {
			if (pagePermsLower.has(p.toLowerCase())) {
				cleanPages.push(p);
			} else {
				// If it's not a specific page, it belongs in secondary (route/department)
				cleanSecondary.push(p);
			}
		});

		// Apply the clean, separated arrays back to the selected user
		selectedUser.secondary_permission = cleanSecondary;
		selectedUser.page_permissions = cleanPages;

		roleDropdownOpen = false;
		mainPermDropdownOpen = false;
	}

	function selectRole(role: string) {
		if (selectedUser) {
			selectedUser.role = role;
			roleDropdownOpen = false;
		}
	}

	function selectMainPerm(perm: string) {
		if (selectedUser) {
			selectedUser.main_permission = perm;
			mainPermDropdownOpen = false;

			// If newly selected main perm is in secondary, remove it from secondary to prevent duplicates
			if (selectedUser.secondary_permission.includes(perm)) {
				selectedUser.secondary_permission = selectedUser.secondary_permission.filter(
					(p: string) => p !== perm
				);
			}
		}
	}

	function toggleSecondary(perm: string) {
		if (selectedUser.secondary_permission.includes(perm)) {
			selectedUser.secondary_permission = selectedUser.secondary_permission.filter(
				(p: string) => p !== perm
			);
		} else {
			selectedUser.secondary_permission = [...selectedUser.secondary_permission, perm];
		}
	}

	function togglePagePerm(perm: string) {
		if (selectedUser.page_permissions.includes(perm)) {
			selectedUser.page_permissions = selectedUser.page_permissions.filter(
				(p: string) => p !== perm
			);
		} else {
			selectedUser.page_permissions = [...selectedUser.page_permissions, perm];
		}
	}

	function capitalize(str: string) {
		if (!str) return '';
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	async function saveUser() {
		if (!selectedUser) return;
		isSaving = true;

		// Double-check no duplicates are saved to the DB
		const uniqueSecondary = Array.from(new Set(selectedUser.secondary_permission));
		const uniquePage = Array.from(new Set(selectedUser.page_permissions));

		const { error } = await supabase
			.from('user_profiles')
			.update({
				role: selectedUser.role,
				main_permission: selectedUser.main_permission,
				secondary_permission: uniqueSecondary,
				page_permissions: uniquePage,
				updated_at: new Date().toISOString()
			})
			.eq('id', selectedUser.id);

		if (!error) {
			const index = users.findIndex((u) => u.id === selectedUser.id);
			if (index !== -1) {
				// Update local state with the cleaned arrays
				selectedUser.secondary_permission = uniqueSecondary;
				selectedUser.page_permissions = uniquePage;
				users[index] = { ...selectedUser };
			}
		} else {
			console.error('Failed to save user:', error);
		}

		isSaving = false;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.role-dropdown-container')) {
			roleDropdownOpen = false;
		}
		if (!target.closest('.mainperm-dropdown-container')) {
			mainPermDropdownOpen = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

{#if isOpen}
	<div use:portal>
		<Modal
			bind:isOpen
			title="Manage Permissions"
			maxWidth="max-w-5xl"
			on:close={() => (isOpen = false)}
		>
			<div class="flex h-[700px] border border-gray1 rounded-xl overflow-hidden -mx-2 -mb-2 mt-2">
				<div class="w-1/3 border-r border-gray1 flex flex-col bg-[#1a1a1a]">
					<div class="p-4 border-b border-gray1 shrink-0">
						<div class="relative">
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Search by name or email..."
								class="w-full bg-navbar border border-gray1 text-white px-4 py-2 rounded-xl text-sm focus:outline-none focus:border-lime transition-colors"
							/>
							<svg
								class="w-4 h-4 text-gray2 absolute right-3 top-1/2 transform -translate-y-1/2"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="11" cy="11" r="8"></circle>
								<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
							</svg>
						</div>
					</div>

					<div class="overflow-y-auto flex-1">
						{#if isLoading}
							<div class="flex justify-center items-center h-full">
								<div
									class="w-8 h-8 border-2 border-lime border-t-transparent rounded-full animate-spin"
								></div>
							</div>
						{:else if filteredUsers.length === 0}
							<div class="p-6 text-center text-gray2 text-sm">No users found.</div>
						{:else}
							{#each filteredUsers as user}
								<button
									class="w-full text-left p-4 border-b border-gray1 transition-colors hover:bg-white/5 cursor-pointer
										{selectedUser?.id === user.id
										? 'bg-lime/10 border-l-4 border-l-lime'
										: 'border-l-4 border-l-transparent'}"
									on:click={() => selectUser(user)}
								>
									<div class="font-bold text-white text-sm">
										{user.first_name || 'No Name'}
										{user.last_name || ''}
									</div>
									<div class="text-xs text-gray2 truncate">{user.email}</div>
									<div
										class="text-xs mt-1 inline-block px-2 py-0.5 rounded-full {user.role === 'Admin'
											? 'bg-lime/20 text-lime'
											: 'bg-gray1 text-gray2'}"
									>
										{user.role || 'User'}
									</div>
								</button>
							{/each}
						{/if}
					</div>
				</div>

				<div class="w-2/3 p-6 overflow-y-auto bg-navbar relative">
					{#if selectedUser}
						<div class="mb-6 pb-4 border-b border-gray1 flex justify-between items-start">
							<div>
								<h3 class="text-xl font-bold text-white">
									{selectedUser.first_name}
									{selectedUser.last_name}
								</h3>
								<p class="text-sm text-gray2">{selectedUser.email}</p>
							</div>
						</div>

						<div class="space-y-8">
							<div class="flex gap-6">
								<div class="flex-1">
									<span class="block text-sm font-semibold text-gray2 mb-2">App Role</span>
									<div class="role-dropdown-container relative">
										<button
											type="button"
											class="bg-navbar border-2 border-gray1 text-gray2 rounded-3xl px-4 py-2.5 font-bold text-sm hover:bg-lime hover:text-black transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 w-full"
											on:click={() => {
												roleDropdownOpen = !roleDropdownOpen;
												mainPermDropdownOpen = false;
											}}
										>
											<span>{selectedUser.role || 'Select Role'}</span>
											<svg
												class="w-4 h-4 transition-transform {roleDropdownOpen ? 'rotate-180' : ''}"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<path d="M6 9l6 6 6-6" />
											</svg>
										</button>

										{#if roleDropdownOpen}
											<div
												class="absolute top-full left-0 mt-1 bg-navbar border border-lime rounded-3xl shadow-xl z-[99] min-w-full overflow-hidden"
											>
												{#each ROLES as role}
													<button
														type="button"
														class="block w-full px-4 py-2 text-left cursor-pointer border-b border-gray1 last:border-b-0 text-sm font-bold whitespace-nowrap
															{selectedUser.role === role
															? 'bg-lime text-black'
															: 'text-white hover:bg-lime hover:text-black transition-colors'}"
														on:click={() => selectRole(role)}
													>
														{role}
													</button>
												{/each}
											</div>
										{/if}
									</div>
								</div>

								<div class="flex-1">
									<span class="block text-sm font-semibold text-gray2 mb-2"
										>Primary Permissions</span
									>
									<div class="mainperm-dropdown-container relative">
										<button
											type="button"
											class="bg-navbar border-2 border-gray1 text-gray2 rounded-3xl px-4 py-2.5 font-bold text-sm hover:bg-lime hover:text-black transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 w-full"
											on:click={() => {
												mainPermDropdownOpen = !mainPermDropdownOpen;
												roleDropdownOpen = false;
											}}
										>
											<span
												>{selectedUser.main_permission
													? capitalize(selectedUser.main_permission)
													: 'Select Permissions'}</span
											>
											<svg
												class="w-4 h-4 transition-transform {mainPermDropdownOpen
													? 'rotate-180'
													: ''}"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<path d="M6 9l6 6 6-6" />
											</svg>
										</button>

										{#if mainPermDropdownOpen}
											<div
												class="absolute top-full left-0 mt-1 bg-navbar border border-lime rounded-3xl shadow-xl z-[99] min-w-full overflow-hidden"
											>
												<button
													type="button"
													class="block w-full px-4 py-2 text-left cursor-pointer border-b border-gray1 text-sm font-bold whitespace-nowrap
														{!selectedUser.main_permission
														? 'bg-lime text-black'
														: 'text-white hover:bg-lime hover:text-black transition-colors'}"
													on:click={() => selectMainPerm('')}
												>
													None
												</button>
												{#each MAIN_PERMISSIONS as perm}
													<button
														type="button"
														class="block w-full px-4 py-2 text-left cursor-pointer border-b border-gray1 last:border-b-0 text-sm font-bold whitespace-nowrap
															{selectedUser.main_permission === perm
															? 'bg-lime text-black'
															: 'text-white hover:bg-lime hover:text-black transition-colors'}"
														on:click={() => selectMainPerm(perm)}
													>
														{capitalize(perm)}
													</button>
												{/each}
											</div>
										{/if}
									</div>
								</div>
							</div>

							<div>
								<span class="block text-sm font-semibold text-gray2 mb-2"
									>Secondary Permissions</span
								>
								<div class="flex flex-wrap gap-2">
									{#each MAIN_PERMISSIONS.filter((p) => p !== selectedUser.main_permission) as perm}
										<button
											type="button"
											on:click={() => toggleSecondary(perm)}
											class="px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer
												{selectedUser.secondary_permission?.includes(perm)
												? 'bg-lime text-black border-lime'
												: 'bg-transparent text-gray2 border-gray1 hover:border-gray2 hover:text-white'}"
										>
											{capitalize(perm)}
										</button>
									{/each}
									{#if MAIN_PERMISSIONS.filter((p) => p !== selectedUser.main_permission).length === 0}
										<span class="text-sm text-gray2 italic">No other departments available.</span>
									{/if}
								</div>
							</div>

							<div>
								<span class="block text-sm font-semibold text-gray2 mb-2">Specific Page Access</span
								>
								<div class="flex flex-wrap gap-2">
									{#each PAGE_PERMISSIONS as perm}
										<button
											type="button"
											on:click={() => togglePagePerm(perm)}
											class="px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer
												{selectedUser.page_permissions?.includes(perm)
												? 'bg-lime text-black border-lime'
												: 'bg-transparent text-gray2 border-gray1 hover:border-gray2 hover:text-white'}"
										>
											{capitalize(perm)}
										</button>
									{/each}
								</div>
							</div>
						</div>

						<div class="mt-8 pt-4 border-t border-gray1 flex justify-end">
							<button
								on:click={saveUser}
								disabled={isSaving}
								class="bg-lime text-black font-bold py-2.5 px-8 rounded-full cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
							>
								{#if isSaving}
									<div
										class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"
									></div>
									Saving...
								{:else}
									Save Changes
								{/if}
							</button>
						</div>
					{:else}
						<div class="h-full flex flex-col items-center justify-center text-gray2">
							<svg
								class="w-16 h-16 mb-4 opacity-20"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
								></path></svg
							>
							<p>Select a user from the list to manage their permissions</p>
						</div>
					{/if}
				</div>
			</div>
		</Modal>
	</div>
{/if}
