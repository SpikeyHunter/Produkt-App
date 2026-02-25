<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { portal } from '$lib/utils/portalUtils';
	import { fade, fly } from 'svelte/transition';

	let members: any[] = [];
	let isLoading = true;
	const dispatch = createEventDispatcher();
	let showForm = false;
	let isEditMode = false;
	let passwordWasReset = false;
	let dropdownOpen = false;
	let isSubmitting = false;
	let realtimeChannel: any;

	// Custom Delete Modal State
	let memberToDelete: any = null;
	let memberToInvite: any = null;

	// Search Query
	let searchQuery = '';

	$: sortedMembers = [...members]
		.filter((m) => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			return (
				(m.name || '').toLowerCase().includes(q) ||
				(m.email || '').toLowerCase().includes(q) ||
				(m.phone || '').toLowerCase().includes(q) ||
				(m.job || '').toLowerCase().includes(q) ||
				(m.role || '').toLowerCase().includes(q)
			);
		})
		.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

	const DEFAULT_PASSWORD = 'Produkt2026$';
	const ROLE_OPTIONS = ['Email Only', 'View Only', 'Manager', 'Editor', 'Admin'];

	interface MemberFormData {
		id: string | null;
		name: string;
		email: string;
		phone: string;
		job: string;
		role: string;
		password: string;
		confirmation_email: boolean;
		confirmation_phone: boolean;
		reset_password?: boolean;
	}

	let formData: MemberFormData = {
		id: null,
		name: '',
		email: '',
		phone: '',
		job: '',
		role: '',
		password: DEFAULT_PASSWORD,
		confirmation_email: false,
		confirmation_phone: false
	};

	$: isFormValid = !!(
		formData.name?.trim() &&
		formData.email?.trim() &&
		formData.job?.trim() &&
		formData.role?.trim()
	);

	function formatPhone(phone: string) {
		if (!phone) return '-';
		const cleaned = phone.replace(/\D/g, '');
		if (cleaned.length === 10) {
			return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
		} else if (cleaned.length === 11 && cleaned.startsWith('1')) {
			return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
		}
		return phone;
	}

	// Added isInitialLoad flag to prevent UI flickering on realtime updates
	async function fetchMembers(isInitialLoad = true) {
		if (isInitialLoad) isLoading = true;
		try {
			const { data, error } = await supabase.from('calendar_users').select('*').order('name');
			if (error) throw error;
			members = data || [];
		} catch (error) {
			console.error('Error fetching members:', error);
		} finally {
			if (isInitialLoad) isLoading = false;
		}
	}

	onMount(() => {
		fetchMembers(true);
		realtimeChannel = supabase
			.channel('calendar_users_changes')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_users' }, () => {
				// Fetch without triggering the loading UI state
				fetchMembers(false);
			})
			.subscribe();
	});

	onDestroy(() => {
		if (realtimeChannel) supabase.removeChannel(realtimeChannel);
	});

	function cancelForm() {
		showForm = false;
	}

	function openAddForm() {
		isEditMode = false;
		passwordWasReset = false;
		formData = {
			id: null,
			name: '',
			email: '',
			phone: '',
			job: '',
			role: '',
			password: DEFAULT_PASSWORD,
			confirmation_email: true,
			confirmation_phone: false
		};
		showForm = true;
	}

	function openEditForm(member: any) {
		isEditMode = true;
		passwordWasReset = false;
		formData = { ...member };
		formData.password = '••••••••••••';
		showForm = true;
	}

	function resetPassword() {
		formData.password = DEFAULT_PASSWORD;
		passwordWasReset = true;
	}

	async function checkUserProfilesForEmail(email: string): Promise<boolean> {
		const { data, error } = await supabase
			.from('user_profiles')
			.select('email')
			.eq('email', email)
			.limit(1);
		return data !== null && data.length > 0;
	}

	async function saveMember() {
		if (!isFormValid || isSubmitting) return;
		isSubmitting = true;
		try {
			const existsInProfiles = await checkUserProfilesForEmail(formData.email);
			const applyDefaultPassword = formData.password === DEFAULT_PASSWORD && !existsInProfiles;
			const defaultInviteStatus = applyDefaultPassword ? 'Invite' : 'Joined';

			if (isEditMode) {
				const updates: any = {
					name: formData.name,
					email: formData.email,
					phone: formData.phone,
					job: formData.job,
					role: formData.role,
					confirmation_email: formData.confirmation_email,
					confirmation_phone: formData.confirmation_phone
				};
				if (passwordWasReset) {
					updates.password = DEFAULT_PASSWORD;
					updates.has_default_password = applyDefaultPassword;
					updates.invite_status = defaultInviteStatus;
				}

				const { data, error } = await supabase
					.from('calendar_users')
					.update(updates)
					.eq('id', formData.id)
					.select();
				if (error) throw error;
				if (data && data.length > 0) {
					members = members.map((m) => (m.id === formData.id ? data[0] : m));
				}
			} else {
				const { data, error } = await supabase
					.from('calendar_users')
					.insert([
						{
							name: formData.name,
							email: formData.email,
							phone: formData.phone,
							job: formData.job,
							role: formData.role,
							confirmation_email: formData.confirmation_email,
							confirmation_phone: formData.confirmation_phone,
							password: formData.password,
							has_default_password: applyDefaultPassword,
							invite_status: defaultInviteStatus
						}
					])
					.select();
				if (error) throw error;
				if (data && data.length > 0) {
					members = [...members, data[0]];
				}
			}

			showForm = false;
			invalidateAll();
		} catch (error: any) {
			console.error('Failed to save member:', error);
			alert('Database Error: ' + error.message);
		} finally {
			isSubmitting = false;
		}
	}

	async function sendPhoneInvite(member: any, event: Event) {
		const button = event.target as HTMLButtonElement;
		const originalText = button.innerText;
		button.innerText = 'Sending SMS...';
		button.disabled = true;

		try {
			if (!member.phone) throw new Error("This user doesn't have a phone number.");

			const res = await fetch('/api/calendar-invite-phone', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ phone: member.phone, name: member.name })
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.message);

			// Update the database to reflect the "Pending" status
			await supabase
				.from('calendar_users')
				.update({ invite_status: 'Pending' })
				.eq('id', member.id);

			// Update UI Locally immediately removing the button and replacing it with the badge
			members = members.map((m) => (m.id === member.id ? { ...m, invite_status: 'Pending' } : m));

			// Close the modal
			memberToInvite = null;
		} catch (error: any) {
			console.error('Failed to send SMS invite:', error);
			button.innerText = 'Failed';
			button.classList.add('border-problem', 'text-problem', 'bg-problem/20');
			alert(error.message);

			setTimeout(() => {
				button.innerText = originalText;
				button.classList.remove('border-problem', 'text-problem', 'bg-problem/20');
				button.disabled = false;
			}, 3000);
		}
	}

	async function sendInvite(member: any, event: Event) {
		const button = event.target as HTMLButtonElement;
		const originalText = button.innerText;
		button.innerText = 'Sending...';
		button.disabled = true;

		try {
			const res = await fetch('/api/calendar-invite-mail', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: member.email, name: member.name })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message);

			// ONLY update to 'Pending' if they aren't already 'Joined'
			if (member.invite_status !== 'Joined') {
				// Update the database to reflect the "Pending" status
				await supabase
					.from('calendar_users')
					.update({ invite_status: 'Pending' })
					.eq('id', member.id);

				// Update UI Locally immediately removing the button and replacing it with the badge
				members = members.map((m) => (m.id === member.id ? { ...m, invite_status: 'Pending' } : m));
			}

			// Revert button text on success if it's a re-invite
			button.innerText = originalText;
			button.disabled = false;
		} catch (error) {
			console.error('Failed to send invite:', error);
			button.innerText = 'Failed';
			button.classList.add('border-problem', 'text-problem');
			setTimeout(() => {
				button.innerText = originalText;
				button.classList.remove('border-problem', 'text-problem');
				button.disabled = false;
			}, 3000);
		}
	}

	async function updateInlinePhoneConfirmation(member: any, event: Event) {
		const target = event.target as HTMLInputElement;
		const newStatus = target.checked;

		// Optimistic UI update
		members = members.map((m) =>
			m.id === member.id ? { ...m, confirmation_phone: newStatus } : m
		);

		try {
			const { error } = await supabase
				.from('calendar_users')
				.update({ confirmation_phone: newStatus })
				.eq('id', member.id);

			if (error) throw error;
		} catch (error) {
			console.error('Failed to update inline phone confirmation:', error);
			// Rollback on failure
			members = members.map((m) =>
				m.id === member.id ? { ...m, confirmation_phone: !newStatus } : m
			);
		}
	}

	async function updateInlineConfirmation(member: any, event: Event) {
		const target = event.target as HTMLInputElement;
		const newStatus = target.checked;

		// Optimistic UI update
		members = members.map((m) =>
			m.id === member.id ? { ...m, confirmation_email: newStatus } : m
		);
		try {
			const { error } = await supabase
				.from('calendar_users')
				.update({ confirmation_email: newStatus })
				.eq('id', member.id);

			if (error) throw error;
		} catch (error) {
			console.error('Failed to update inline:', error);
			// Rollback on failure
			members = members.map((m) =>
				m.id === member.id ? { ...m, confirmation_email: !newStatus } : m
			);
		}
	}

	function promptDelete(member: any) {
		memberToDelete = member;
	}

	async function executeDelete() {
		if (!memberToDelete) return;

		const id = memberToDelete.id;
		members = members.filter((m) => m.id !== id);
		memberToDelete = null;

		try {
			const { error } = await supabase.from('calendar_users').delete().eq('id', id);
			if (error) throw error;
		} catch (error) {
			console.error('Failed to delete member:', error);
			fetchMembers(false);
			// Fetch silently on failure
		}
	}

	function downloadCSV() {
		if (sortedMembers.length === 0) return;
		const headers = [
			'Name',
			'Email',
			'Phone',
			'Job',
			'Role',
			'Confirmation Email',
			'Confirmation Phone'
		];
		const rows = sortedMembers.map((m) => [
			`"${m.name || ''}"`,
			`"${m.email || ''}"`,
			`"${m.phone || ''}"`,
			`"${m.job || ''}"`,
			`"${m.role || ''}"`,
			m.confirmation_email ? 'Yes' : 'No',
			m.confirmation_phone ? 'Yes' : 'No'
		]);
		let csvContent =
			'data:text/csv;charset=utf-8,' +
			headers.join(',') +
			'\n' +
			rows.map((e) => e.join(',')).join('\n');
		const encodedUri = encodeURI(csvContent);
		const link = document.createElement('a');
		link.setAttribute('href', encodedUri);
		link.setAttribute('download', 'calendar_users.csv');
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	function handleWindowClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('#custom-role-dropdown')) {
			dropdownOpen = false;
		}
	}
</script>

<svelte:window on:click={handleWindowClick} />

<div class="flex flex-col h-full w-full bg-transparent text-sm relative">
	{#if memberToDelete}
		<div use:portal class="fixed inset-0 z-[99999] flex items-center justify-center">
			<div
				class="absolute inset-0 bg-black/80"
				transition:fade={{ duration: 200 }}
				on:click={() => (memberToDelete = null)}
				aria-hidden="true"
			></div>

			<div
				class="bg-gray1 p-8 rounded-3xl max-w-lg w-full text-center border border-gray2/20 shadow-2xl relative z-10"
				transition:fly={{ y: 30, duration: 300 }}
			>
				<h3 class="text-problem text-xl font-bold mb-3">REMOVE THIS USER</h3>
				<p class="text-gray3 mb-8">
					Are you sure you want to delete <strong class="text-white">{memberToDelete.name}</strong>?
					This action cannot be undone.
				</p>
				<div class="flex gap-4 justify-center">
					<button
						class="px-4 py-2.5 border-2 border-gray3 text-gray3 font-bold rounded-full hover:bg-gray3 hover:text-black transition-opacity cursor-pointer w-full"
						on:click={() => (memberToDelete = null)}>Cancel</button
					>
					<button
						class="px-4 py-2.5 bg-problem text-black font-bold rounded-full hover:bg-red-500 hover:text-white transition-opacity cursor-pointer w-full"
						on:click={executeDelete}>Confirm</button
					>
				</div>
			</div>
		</div>
	{/if}
	{#if memberToInvite}
		<div use:portal class="fixed inset-0 z-[99999] flex items-center justify-center">
			<div
				class="absolute inset-0 bg-black/80"
				transition:fade={{ duration: 200 }}
				on:click={() => (memberToInvite = null)}
				aria-hidden="true"
			></div>

			<div
				class="bg-gray1 p-8 rounded-3xl max-w-sm w-full text-center border border-gray2/20 shadow-2xl relative z-10"
				transition:fly={{ y: 30, duration: 300 }}
			>
				<h3 class="text-lime text-xl font-bold mb-3">SEND INVITE</h3>
				<p class="text-gray3 mb-8">
					How would you like to invite <strong class="text-white">{memberToInvite.name}</strong>?
				</p>
				<div class="flex flex-col gap-4 justify-center">
					<button
						class="px-4 py-2.5 bg-lime text-black font-bold rounded-full hover:bg-lime/80 transition-opacity cursor-pointer w-full"
						on:click={(e) => {
							sendInvite(memberToInvite, e);
							memberToInvite = null;
						}}>Send by Email</button
					>
					<button
						class="px-4 py-2.5 bg-gray2/20 text-white font-bold rounded-full hover:bg-gray2/40 transition-opacity cursor-pointer w-full"
						on:click={(e) => {
							sendPhoneInvite(memberToInvite, e);
						}}>Send by Phone</button
					>
					<button
						class="px-4 py-2.5 mt-2 border-2 border-gray3 text-gray3 font-bold rounded-full hover:bg-gray3 hover:text-black transition-opacity cursor-pointer w-full"
						on:click={() => (memberToInvite = null)}>Cancel</button
					>
				</div>
			</div>
		</div>
	{/if}

	<div
		class="p-6 flex-1 {showForm ? 'relative z-20' : 'overflow-hidden relative z-0 flex flex-col'}"
	>
		{#if showForm}
			<div class="grid grid-cols-2 gap-x-12 gap-y-8">
				<div class="flex flex-col gap-5">
					<div class="flex flex-col gap-2">
						<label for="name-input" class="text-white font-bold text-xs">Name *</label>
						<input
							id="name-input"
							type="text"
							class="bg-gray2/20 border border-transparent text-white rounded-full px-5 py-3.5 focus:outline-none focus:border-lime transition-all cursor-pointer placeholder:text-gray2"
							bind:value={formData.name}
							placeholder="Enter name"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<label for="job-input" class="text-white font-bold text-xs">Job *</label>
						<input
							id="job-input"
							type="text"
							class="bg-gray2/20 border border-transparent text-white rounded-full px-5 py-3.5 focus:outline-none focus:border-lime transition-all cursor-pointer placeholder:text-gray2"
							bind:value={formData.job}
							placeholder="Enter job title"
						/>
					</div>
					<div class="flex flex-col gap-2 relative">
						<span class="text-white font-bold text-xs">Role *</span>

						<div class="relative w-full" id="custom-role-dropdown">
							<button
								type="button"
								class="w-full bg-gray2/20 border {dropdownOpen
									? 'border-lime'
									: 'border-transparent'} text-left text-base rounded-full px-5 py-3.5 focus:outline-none focus:border-lime transition-all cursor-pointer flex justify-between items-center"
								on:click={() => (dropdownOpen = !dropdownOpen)}
							>
								<span class={formData.role ? 'text-white font-bold' : 'text-gray2 font-bold'}>
									{formData.role || 'Select Role'}
								</span>
								<svg
									class="w-4 h-4 text-gray2 transition-transform {dropdownOpen ? 'rotate-180' : ''}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</button>

							{#if dropdownOpen}
								<div
									class="absolute top-full left-0 w-full mt-2 bg-[#2a2a2a] border border-[#333333] rounded-2xl shadow-2xl overflow-y-auto max-h-[364px] z-50"
								>
									{#each ROLE_OPTIONS as role}
										<button
											type="button"
											class="w-full text-left px-5 py-3.5 text-base text-white hover:bg-lime hover:text-black transition-colors cursor-pointer font-bold border-b border-[#333333] last:border-0"
											on:click={() => {
												formData.role = role;
												dropdownOpen = false;
											}}
										>
											{role}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>

				<div class="flex flex-col gap-5">
					<div class="flex flex-col gap-2">
						<label for="email-input" class="text-white font-bold text-xs">Email *</label>
						<input
							id="email-input"
							type="email"
							class="bg-gray2/20 border border-transparent text-white rounded-full px-5 py-3.5 focus:outline-none focus:border-lime transition-all cursor-pointer placeholder:text-gray2"
							bind:value={formData.email}
							placeholder="Enter email"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<label for="phone-input" class="text-white font-bold text-xs">Phone Number</label>
						<input
							id="phone-input"
							type="text"
							class="bg-gray2/20 border border-transparent text-white rounded-full px-5 py-3.5 focus:outline-none focus:border-lime transition-all cursor-pointer placeholder:text-gray2"
							bind:value={formData.phone}
							placeholder="Enter phone"
						/>
					</div>
					<div class="flex flex-col gap-2">
						<label for="password-input" class="text-white font-bold text-xs">Password</label>
						<input
							id="password-input"
							type="text"
							disabled
							class="bg-gray2/20 border border-transparent text-gray2 rounded-full px-5 py-3.5 opacity-60 cursor-not-allowed select-none font-mono placeholder:text-gray2"
							bind:value={formData.password}
						/>
						{#if isEditMode}
							<button
								type="button"
								class="text-left text-xs text-lime font-medium pl-4 mt-1 hover:underline w-fit cursor-pointer"
								on:click={resetPassword}
							>
								Reset to default password
							</button>
						{/if}
					</div>
				</div>
			</div>

			<div class="mt-8 flex items-center justify-between border-t border-gray2/20 pt-6">
				<div class="flex items-center gap-6">
					<div class="flex items-center gap-3">
						<div
							class="relative flex items-center justify-center w-5 h-5 bg-gray2/20 border border-transparent rounded cursor-pointer has-[:checked]:bg-lime has-[:checked]:border-lime transition-colors"
						>
							<input
								id="confirm-email-checkbox"
								type="checkbox"
								class="appearance-none w-full h-full absolute inset-0 cursor-pointer peer"
								bind:checked={formData.confirmation_email}
							/>
							<svg
								class="w-3.5 h-3.5 text-black opacity-0 peer-checked:opacity-100 pointer-events-none z-10"
								viewBox="0 0 14 10"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M1 5L4.5 8.5L13 1"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</div>
						<label for="confirm-email-checkbox" class="text-white font-bold cursor-pointer text-sm"
							>Confirmation Email</label
						>
					</div>

					<div class="flex items-center gap-3">
						<div
							class="relative flex items-center justify-center w-5 h-5 bg-gray2/20 border border-transparent rounded cursor-pointer has-[:checked]:bg-lime has-[:checked]:border-lime transition-colors"
						>
							<input
								id="confirm-phone-checkbox"
								type="checkbox"
								class="appearance-none w-full h-full absolute inset-0 cursor-pointer peer"
								bind:checked={formData.confirmation_phone}
							/>
							<svg
								class="w-3.5 h-3.5 text-black opacity-0 peer-checked:opacity-100 pointer-events-none z-10"
								viewBox="0 0 14 10"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M1 5L4.5 8.5L13 1"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</div>
						<label for="confirm-phone-checkbox" class="text-white font-bold cursor-pointer text-sm"
							>Confirmation Phone</label
						>
					</div>
				</div>

				<div class="flex gap-4 items-center">
					<button
						type="button"
						class="px-6 py-3 bg-[#e4e4e4] text-black font-bold rounded-full transition-opacity hover:opacity-80 cursor-pointer"
						on:click={cancelForm}>Cancel</button
					>
					<button
						type="button"
						class="px-6 py-3 bg-lime text-black font-bold rounded-full transition-all {isFormValid &&
						!isSubmitting
							? 'hover:opacity-80 cursor-pointer'
							: 'opacity-50 cursor-not-allowed'}"
						on:click={saveMember}
						disabled={!isFormValid || isSubmitting}>Save User</button
					>
				</div>
			</div>
		{:else if isLoading}
			<div class="py-12 text-center text-gray2 font-medium">Loading members...</div>
		{:else}
			<div class="mb-6 flex items-center justify-between gap-4 shrink-0 flex-wrap">
				<div class="relative w-full max-w-md">
					<svg
						class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray2"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search by name, email, role"
						class="w-full bg-white/5 border-2 border-transparent text-white rounded-full pl-11 pr-5 py-2.5 focus:outline-none focus:border-lime transition-all placeholder:text-gray2/50"
					/>
				</div>

				<div class="flex gap-4 items-center shrink-0">
					<button
						type="button"
						class="flex items-center gap-2 px-6 py-2.5 bg-[#e4e4e4] text-black font-bold rounded-full transition-all {sortedMembers.length >
						0
							? 'hover:opacity-80 cursor-pointer'
							: 'opacity-50 cursor-not-allowed'}"
						on:click={downloadCSV}
						disabled={sortedMembers.length === 0}
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
							/>
						</svg>
						CSV
					</button>
					<button
						type="button"
						class="px-6 py-2.5 border border-lime text-lime font-bold rounded-full hover:bg-lime hover:text-black transition-all cursor-pointer"
						on:click={openAddForm}
					>
						+ Add User
					</button>
				</div>
			</div>

			<div class="w-full overflow-y-auto overflow-x-auto h-[508px] relative">
				<table
					class="w-full text-left whitespace-nowrap"
					style="border-spacing: 0; border-collapse: separate;"
				>
					<thead>
						<tr class="text-gray2 text-xs uppercase tracking-wider">
							<th
								class="sticky top-0 z-[50] bg-[#1e1e1e] py-4 px-3 rounded-tl-xl w-8 shadow-[0_1px_0_rgba(255,255,255,0.05)]"
							></th>
							<th
								class="sticky top-0 z-[50] bg-[#1e1e1e] py-4 px-4 font-bold shadow-[0_1px_0_rgba(255,255,255,0.05)]"
								>Name</th
							>
							<th
								class="sticky top-0 z-[50] bg-[#1e1e1e] py-4 px-4 font-bold shadow-[0_1px_0_rgba(255,255,255,0.05)]"
								>Email</th
							>
							<th
								class="sticky top-0 z-[50] bg-[#1e1e1e] py-4 px-4 font-bold shadow-[0_1px_0_rgba(255,255,255,0.05)]"
								>Phone</th
							>
							<th
								class="sticky top-0 z-[50] bg-[#1e1e1e] py-4 px-4 font-bold shadow-[0_1px_0_rgba(255,255,255,0.05)]"
								>Job</th
							>
							<th
								class="sticky top-0 z-[50] bg-[#1e1e1e] py-4 px-4 font-bold shadow-[0_1px_0_rgba(255,255,255,0.05)]"
								>Role</th
							>
							<th
								class="sticky top-0 z-[50] bg-[#1e1e1e] py-4 px-4 font-bold shadow-[0_1px_0_rgba(255,255,255,0.05)] text-center leading-tight"
								>Mail<br />Confirm</th
							>
							<th
								class="sticky top-0 z-[50] bg-[#1e1e1e] py-4 px-4 font-bold shadow-[0_1px_0_rgba(255,255,255,0.05)] text-center leading-tight"
								>Phone<br />Confirm</th
							>
							<th
								class="sticky top-0 z-[50] bg-[#1e1e1e] py-4 px-4 font-bold rounded-tr-xl shadow-[0_1px_0_rgba(255,255,255,0.05)] pr-8"
								>Actions</th
							>
						</tr>
					</thead>
					<tbody class="text-gray3">
						{#each sortedMembers as member (member.id)}
							<tr class="hover:bg-white/5 transition-colors">
								<td class="py-5 px-3 text-center align-middle">
									{#if member.role === 'Admin'}
										<svg
											class="w-4 h-4 text-lime inline-block"
											fill="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
											/>
										</svg>
									{/if}
								</td>
								<td
									class="py-5 px-4 font-bold {member.role === 'Admin' ? 'text-lime' : 'text-white'}"
								>
									{member.name}
								</td>
								<td class="py-5 px-4 max-w-[180px] truncate" title={member.email}
									>{member.email || '-'}</td
								>
								<td class="py-5 px-4 text-gray3">{formatPhone(member.phone)}</td>
								<td class="py-5 px-4 max-w-[140px] truncate" title={member.job}>{member.job}</td>
								<td class="py-5 px-4 text-lime font-bold">{member.role}</td>
								<td class="py-5 px-4">
									<div class="flex justify-center">
										<div
											class="relative flex items-center justify-center w-5 h-5 bg-gray2/20 border border-transparent rounded cursor-pointer has-[:checked]:bg-lime has-[:checked]:border-lime transition-colors"
										>
											<input
												type="checkbox"
												class="appearance-none w-full h-full absolute inset-0 cursor-pointer peer"
												checked={member.confirmation_email}
												on:change={(e) => updateInlineConfirmation(member, e)}
											/>
											<svg
												class="w-3.5 h-3.5 text-black opacity-0 peer-checked:opacity-100 pointer-events-none z-10"
												viewBox="0 0 14 10"
												fill="none"
												xmlns="http://www.w3.org/2000/svg"
											>
												<path
													d="M1 5L4.5 8.5L13 1"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
											</svg>
										</div>
									</div>
								</td>

								<td class="py-5 px-4">
									<div class="flex justify-center">
										<div
											class="relative flex items-center justify-center w-5 h-5 bg-gray2/20 border border-transparent rounded cursor-pointer has-[:checked]:bg-lime has-[:checked]:border-lime transition-colors"
										>
											<input
												type="checkbox"
												class="appearance-none w-full h-full absolute inset-0 cursor-pointer peer"
												checked={member.confirmation_phone}
												on:change={(e) => updateInlinePhoneConfirmation(member, e)}
											/>
											<svg
												class="w-3.5 h-3.5 text-black opacity-0 peer-checked:opacity-100 pointer-events-none z-10"
												viewBox="0 0 14 10"
												fill="none"
												xmlns="http://www.w3.org/2000/svg"
											>
												<path
													d="M1 5L4.5 8.5L13 1"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
												/>
											</svg>
										</div>
									</div>
								</td>

								<td class="py-5 px-4 pr-8">
									<div class="flex justify-start items-center gap-2">
										<div class="w-[76px] shrink-0">
											{#if member.invite_status === 'Pending'}
												<span
													class="w-full inline-block text-center text-xs font-bold py-1.5 rounded-full border border-yellow-500 text-yellow-500"
												>
													Pending
												</span>
											{:else if member.invite_status === 'Joined'}
												<button
													type="button"
													class="w-full text-xs font-bold py-1.5 rounded-full border border-question text-question hover:bg-question hover:text-black transition-colors cursor-pointer"
													on:click={() => (memberToInvite = member)}
												>
													Re-Invite
												</button>
											{:else if member.has_default_password}
												<button
													type="button"
													class="w-full text-xs font-bold py-1.5 rounded-full border border-lime text-lime hover:bg-lime hover:text-black transition-colors cursor-pointer"
													on:click={() => (memberToInvite = member)}
												>
													Invite
												</button>
											{/if}
										</div>
										<button
											type="button"
											class="text-xs font-bold px-4 py-1.5 rounded-full bg-gray2/20 text-white hover:bg-gray2/40 transition-colors cursor-pointer shrink-0"
											on:click={() => openEditForm(member)}
										>
											Edit
										</button>
										<button
											type="button"
											class="text-xs font-bold px-4 py-1.5 rounded-full bg-problem/10 text-problem hover:bg-problem hover:text-black transition-colors cursor-pointer shrink-0"
											on:click={() => promptDelete(member)}
										>
											Delete
										</button>
									</div>
								</td>
							</tr>
						{/each}
						{#if sortedMembers.length === 0}
							<tr>
								<td colspan="9" class="py-16 text-center text-gray2 font-medium">
									{searchQuery ? 'No members match your search.' : 'No members found.'}
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<style>
	/* CLEANED UP SCROLLBAR STYLES: So you can actually see the horizontal scrollbar! */
	::-webkit-scrollbar {
		width: 8px;
		height: 8px; /* Restored height so horizontal scroll is visible */
	}
	::-webkit-scrollbar-track {
		background: transparent;
	}
	::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 10px;
	}
	::-webkit-scrollbar-thumb:hover {
		background: rgba(225, 255, 0, 0.5);
	}
	* {
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
	}
</style>
