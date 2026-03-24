<script lang="ts">
	import { portal } from '$lib/utils/portalUtils';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { supabase } from '$lib/supabase';

	export let isOpen = false;

	const MAIN_PERMISSIONS_LIST = ['Advance', 'Booking', 'Production', 'Marketing', 'Corpo', 'Schedule'];

	let updates: any[] = [];
	let users: any[] = [];
	let uniqueSecondaryPerms: string[] = [];
	let isLoading = false;
	let isSaving = false;

	let viewingUpdate: any = null;

	// Form State
	let currentVersion = '0.0.1';
	let title = '';
	let sections: { title: string; items: string[] }[] = [{ title: '', items: [''] }];
	let targetUsers: string[] = [];
	let targetMain: string[] = [];
	let targetSecondary: string[] = [];
	let isAll = false;

	// Dropdown states
	let secondaryDropdownOpen = false;
	let usersDropdownOpen = false;

	$: if (isOpen) {
		fetchData();
	}

	async function fetchData() {
		isLoading = true;
		
		// Fetch History
		const { data: updateData } = await supabase
			.from('app_updates')
			.select('*')
			.order('created_at', { ascending: false });
		if (updateData) {
			updates = updateData;
			calculateNextVersion();
		}

		// Fetch Users & Options
		const { data: userData } = await supabase.from('user_profiles').select('*').order('first_name');
		if (userData) {
			users = userData;
			const secPerms = new Set<string>();
			userData.forEach(u => {
				if (Array.isArray(u.secondary_permission)) {
					u.secondary_permission.forEach((p: string) => {
						if (p) secPerms.add(p);
					});
				}
			});
			uniqueSecondaryPerms = Array.from(secPerms).sort();
		}

		isLoading = false;
	}

	function calculateNextVersion() {
		if (updates.length > 0) {
			const latest = updates[0].version;
			const parts = latest.replace('Update ', '').split('.');
			if (parts.length === 3) {
				const minor = parseInt(parts[2]) || 0;
				currentVersion = `${parts[0]}.${parts[1]}.${minor + 1}`;
			} else {
				currentVersion = '0.0.1';
			}
		} else {
			currentVersion = '0.0.1';
		}
	}

	function resetForm() {
		viewingUpdate = null;
		title = '';
		sections = [{ title: '', items: [''] }];
		targetUsers = [];
		targetMain = [];
		targetSecondary = [];
		isAll = false;
		secondaryDropdownOpen = false;
		usersDropdownOpen = false;
		calculateNextVersion();
	}

	function addSection() {
		sections = [...sections, { title: '', items: [''] }];
	}
	
	function removeSection(index: number) {
		sections = sections.filter((_, i) => i !== index);
	}

	function addItem(sectionIndex: number) {
		sections[sectionIndex].items = [...sections[sectionIndex].items, ''];
	}

	function removeItem(sectionIndex: number, itemIndex: number) {
		sections[sectionIndex].items = sections[sectionIndex].items.filter((_, i) => i !== itemIndex);
	}

	function toggleArrayItem(arr: string[], item: string) {
		return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
	}

	async function deployUpdate() {
		if (!title || isSaving) return;
		isSaving = true;

		// Clean up empty items (Ensures we don't save empty lines)
		const cleanedSections = sections.map(s => ({
			title: s.title,
			items: s.items.filter(i => i.trim() !== '')
		})).filter(s => s.title.trim() !== '' || s.items.length > 0);

		// Build the target JSONB array by computing all matching users
		const targetedUsersMap = new Map();

		if (isAll) {
			users.forEach(u => {
				if (u.main_permission !== 'Schedule') {
					targetedUsersMap.set(u.id, { id: u.id, name: `${u.first_name} ${u.last_name}`, seen: false });
				}
			});
		} else {
			// Specific users
			targetUsers.forEach(id => {
				const u = users.find(user => user.id === id);
				if (u) targetedUsersMap.set(u.id, { id: u.id, name: `${u.first_name} ${u.last_name}`, seen: false });
			});
			// Main Permissions
			targetMain.forEach(perm => {
				users.filter(u => u.main_permission === perm).forEach(u => {
					targetedUsersMap.set(u.id, { id: u.id, name: `${u.first_name} ${u.last_name}`, seen: false });
				});
			});
			// Secondary Permissions
			targetSecondary.forEach(perm => {
				users.filter(u => u.secondary_permission?.includes(perm)).forEach(u => {
					targetedUsersMap.set(u.id, { id: u.id, name: `${u.first_name} ${u.last_name}`, seen: false });
				});
			});
		}

		const finalTargetUsers = Array.from(targetedUsersMap.values());

		if (finalTargetUsers.length === 0) {
			alert('No users match these targeting criteria. Please select at least one target.');
			isSaving = false;
			return;
		}

		const payload = {
			version: `Update ${currentVersion}`,
			title,
			content: cleanedSections,
			target_users: finalTargetUsers
		};

		const { error } = await supabase.from('app_updates').insert(payload);

		if (!error) {
			resetForm();
			await fetchData();
		} else {
			alert('Failed to push update: ' + error.message);
		}
		isSaving = false;
	}

	function getSeenCount(update: any) {
		if (!update.target_users || !Array.isArray(update.target_users)) return 0;
		return update.target_users.filter((u: any) => u.seen).length;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.secondary-dropdown-container')) {
			secondaryDropdownOpen = false;
		}
		if (!target.closest('.users-dropdown-container')) {
			usersDropdownOpen = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

{#if isOpen}
	<div use:portal>
		<Modal bind:isOpen title="Update Pusher" maxWidth="max-w-[85vw]" on:close={() => (isOpen = false)}>
			<div class="flex h-[75vh] bg-[#141414] rounded-3xl overflow-hidden mt-4 shadow-2xl">
				
				<div class="w-1/4 flex flex-col bg-[#1a1a1a] rounded-l-3xl p-4">
					<div class="shrink-0 mb-4">
						<button on:click={resetForm} class="w-full bg-lime text-black font-bold py-3 rounded-3xl hover:opacity-90 transition-opacity cursor-pointer">
							+ Compose New Update
						</button>
					</div>
					<div class="overflow-y-auto flex-1 space-y-2 pr-2 custom-scrollbar">
						{#if isLoading}
							<div class="text-center text-gray2 py-4 text-sm">Loading...</div>
						{/if}
						{#each updates as update}
							<button 
								class="w-full text-left p-4 rounded-3xl transition-colors cursor-pointer {viewingUpdate?.id === update.id ? 'bg-white/10' : 'bg-black/20 hover:bg-white/5'}"
								on:click={() => viewingUpdate = update}
							>
								<div class="font-bold text-white text-sm mb-1 uppercase tracking-wider">{update.version}</div>
								<div class="text-xs text-gray2 truncate mb-2 uppercase">{update.title}</div>
								<div class="text-[10px] text-lime/80 font-medium">
									Seen by: {getSeenCount(update)} / {update.target_users?.length || 0} users
								</div>
							</button>
						{/each}
					</div>
				</div>

				<div class="w-2/4 p-8 overflow-y-auto bg-navbar flex flex-col custom-scrollbar">
					{#if viewingUpdate}
						<div class="flex-1">
							<div class="inline-block bg-lime/20 text-lime font-bold px-4 py-1.5 rounded-3xl text-sm mb-4 uppercase tracking-wider">{viewingUpdate.version}</div>
							<h3 class="text-3xl font-bold text-white mb-8 uppercase tracking-wide">{viewingUpdate.title}</h3>
							
							<div class="space-y-6">
								{#each viewingUpdate.content as section}
									<div class="bg-black/20 p-6 rounded-3xl">
										{#if section.title}
											<h4 class="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-wide">
												<div class="w-1.5 h-4 bg-lime rounded-full"></div>
												{section.title}
											</h4>
										{/if}
										<ul class="space-y-2">
											{#each section.items as item}
												<li class="flex items-start gap-3 text-gray2 text-sm">
													<svg class="w-4 h-4 text-lime shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
														<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
													</svg>
													<span>{item}</span>
												</li>
											{/each}
										</ul>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<div class="flex-1 space-y-6">
							<div>
								<span class="block text-sm font-semibold text-gray2 mb-2 ml-1">Version</span>
								<div class="text-lime font-bold bg-black/20 px-6 py-3 rounded-3xl inline-block uppercase tracking-wider">Update {currentVersion}</div>
							</div>

							<div>
								<label for="update-title" class="block text-sm font-semibold text-gray2 mb-2 ml-1">Update Title</label>
								<input id="update-title" type="text" bind:value={title} placeholder="enter title here" class="w-full bg-black/30 text-white px-6 py-4 rounded-3xl text-sm focus:outline-none transition-colors uppercase font-bold tracking-wide placeholder-gray2" />
							</div>

							<div class="space-y-4">
								<span class="block text-sm font-semibold text-gray2 ml-1">Sections & Items</span>
								{#each sections as section, sIdx}
									<div class="bg-black/20 p-6 rounded-3xl relative group transition-all">
										
										<div class="relative flex items-center mb-4">
											<input type="text" bind:value={section.title} placeholder="SECTION TITLE (E.G. BUG FIXES)" class="w-full bg-white/5 text-white pl-4 pr-12 py-3 rounded-2xl text-sm focus:outline-none transition-colors font-bold uppercase tracking-wide placeholder-gray2" aria-label="Section Title" />
											<button on:click={() => removeSection(sIdx)} class="absolute right-2 text-red-500/50 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-all bg-red-500/10 hover:bg-red-500 rounded-full w-8 h-8 flex items-center justify-center shrink-0" aria-label="Remove section">
												<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
											</button>
										</div>
										
										<div class="space-y-3">
											{#each section.items as item, iIdx}
												<div class="flex gap-3 items-center group/item">
													<div class="w-1.5 h-1.5 rounded-full bg-lime shrink-0"></div>
													<input type="text" bind:value={section.items[iIdx]} on:keydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(sIdx); } }} placeholder="Line item description" class="flex-1 bg-transparent text-lime font-medium py-1 text-sm focus:outline-none placeholder-gray2 transition-colors" aria-label="Line item" />
													<button on:click={() => removeItem(sIdx, iIdx)} class="text-red-500/50 hover:text-white cursor-pointer opacity-0 group-hover/item:opacity-100 transition-all bg-red-500/10 hover:bg-red-500 rounded-full w-6 h-6 flex items-center justify-center shrink-0" aria-label="Remove item">
														<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
													</button>
												</div>
											{/each}
										</div>
										<button on:click={() => addItem(sIdx)} class="text-xs text-lime font-bold mt-6 px-3 py-1.5 rounded-3xl hover:bg-lime/10 transition-colors cursor-pointer">+ Add Item</button>
									</div>
								{/each}
								<button on:click={addSection} class="text-sm text-lime font-bold bg-lime/10 hover:bg-lime/20 py-4 rounded-3xl transition-colors w-full cursor-pointer">+ Add New Section</button>
							</div>
						</div>

						<div class="mt-8 pt-6 flex justify-end gap-4">
							<button on:click={() => isOpen = false} class="px-8 py-3 rounded-3xl text-white font-bold hover:bg-white/5 transition-colors cursor-pointer">Cancel</button>
							<button on:click={deployUpdate} disabled={isSaving || !title} class="bg-lime text-black font-bold py-3 px-10 rounded-3xl hover:opacity-90 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-transform active:scale-95">
								{#if isSaving}
									<div class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
								{/if}
								Deploy Update
							</button>
						</div>
					{/if}
				</div>

				<div class="w-1/4 p-6 overflow-y-auto bg-[#1a1a1a] rounded-r-3xl custom-scrollbar">
					<h3 class="text-white font-bold text-lg mb-6">Targeting Options</h3>
					
					{#if viewingUpdate}
						<div class="text-sm text-lime font-medium bg-lime/10 px-4 py-2 rounded-3xl mb-6">Read-only for deployed updates.</div>
						<div class="space-y-3">
							<h4 class="text-sm font-semibold text-gray2 ml-1">Targeted Users</h4>
							<ul class="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
								{#each viewingUpdate.target_users as u}
									<li class="flex justify-between items-center bg-black/20 px-4 py-3 rounded-3xl">
										<span class="text-white text-sm truncate pr-2">{u.name}</span>
										<span class="text-xs font-bold px-2 py-1 rounded-3xl {u.seen ? 'bg-lime/20 text-lime' : 'bg-white/10 text-gray2'}">{u.seen ? 'Seen' : 'Pending'}</span>
									</li>
								{/each}
							</ul>
						</div>
					{:else}
						<div class="space-y-8">
							
							<div>
								<button 
									on:click={() => isAll = !isAll}
									class="w-full py-4 px-6 rounded-3xl font-bold transition-all cursor-pointer flex justify-between items-center {isAll ? 'bg-lime text-black' : 'bg-black/30 text-white hover:bg-black/50'}"
								>
									<span>Send to ALL Users</span>
									{#if isAll}
										<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
									{/if}
								</button>
								<p class="text-xs text-gray2 mt-2 ml-2 italic">Excludes users with Main Permission "Schedule"</p>
							</div>

							{#if !isAll}
								<div class="users-dropdown-container">
									<h4 class="text-sm font-semibold text-gray2 mb-3 ml-1">Specific Users</h4>
									<div class="relative">
										<button
											on:click={() => { usersDropdownOpen = !usersDropdownOpen; secondaryDropdownOpen = false; }}
											class="w-full bg-black/30 text-white rounded-3xl px-5 py-3 font-bold text-sm hover:bg-black/50 transition-colors cursor-pointer flex items-center justify-between"
										>
											<span class="truncate">{targetUsers.length ? `${targetUsers.length} selected` : 'Select Users'}</span>
											<svg class="w-4 h-4 transition-transform {usersDropdownOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
										</button>

										{#if usersDropdownOpen}
											<div class="absolute top-full left-0 mt-2 bg-[#2a2a2a] rounded-3xl shadow-xl z-50 min-w-full overflow-hidden py-2 border border-white/5">
												<div class="max-h-56 overflow-y-auto custom-scrollbar">
													{#each users as u}
														<label class="flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 cursor-pointer transition-colors">
															<input type="checkbox" checked={targetUsers.includes(u.id)} on:change={() => targetUsers = toggleArrayItem(targetUsers, u.id)} class="accent-lime w-4 h-4 cursor-pointer" />
															<span class="text-sm text-white font-medium truncate">{u.first_name} {u.last_name}</span>
														</label>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								</div>
                                <div class="secondary-dropdown-container">
									<h4 class="text-sm font-semibold text-gray2 mb-3 ml-1">Secondary Permissions</h4>
									<div class="relative">
										<button
											on:click={() => { secondaryDropdownOpen = !secondaryDropdownOpen; usersDropdownOpen = false; }}
											class="w-full bg-black/30 text-white rounded-3xl px-5 py-3 font-bold text-sm hover:bg-black/50 transition-colors cursor-pointer flex items-center justify-between"
										>
											<span class="truncate">{targetSecondary.length ? `${targetSecondary.length} selected` : 'Select Permissions'}</span>
											<svg class="w-4 h-4 transition-transform {secondaryDropdownOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
										</button>

										{#if secondaryDropdownOpen}
											<div class="absolute top-full left-0 mt-2 bg-[#2a2a2a] rounded-3xl shadow-xl z-50 min-w-full overflow-hidden py-2 border border-white/5">
												<div class="max-h-48 overflow-y-auto custom-scrollbar">
													{#each uniqueSecondaryPerms as perm}
														<label class="flex items-center gap-3 px-5 py-2.5 hover:bg-white/5 cursor-pointer transition-colors">
															<input type="checkbox" checked={targetSecondary.includes(perm)} on:change={() => targetSecondary = toggleArrayItem(targetSecondary, perm)} class="accent-lime w-4 h-4 cursor-pointer" />
															<span class="text-sm text-white font-medium">{perm}</span>
														</label>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								</div>
								<div>
									<h4 class="text-sm font-semibold text-gray2 mb-3 ml-1">Main Permissions</h4>
									<div class="grid grid-cols-2 gap-2">
										{#each MAIN_PERMISSIONS_LIST as perm}
											<button 
												on:click={() => targetMain = toggleArrayItem(targetMain, perm)}
												class="w-full px-4 py-3 rounded-3xl text-xs font-bold transition-colors cursor-pointer text-center {targetMain.includes(perm) ? 'bg-lime text-black' : 'bg-black/30 text-gray2 hover:text-white hover:bg-black/50'}"
											>
												{perm}
											</button>
										{/each}
									</div>
								</div>

								
							{/if}
						</div>
					{/if}
				</div>

			</div>
		</Modal>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(204, 255, 0, 0.5); 
	}
</style>