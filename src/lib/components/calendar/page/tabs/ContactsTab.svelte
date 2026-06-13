<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { supabase } from '$lib/supabase';

	// Mirrors how the other tabs (e.g. DealsTab) receive their props.
	export let userRole = 'Email Only';
	export let event: any = null;
	export let viewedVersionNum: number = 1;

	interface Contact {
		id: string;
		settingsRef: string | null; // id of the source contact in calendar_settings (null for custom)
		role: string;
		fullName: string;
		email: string;
		phone: string;
		enabled: boolean;
		custom: boolean;
	}

	$: canEditAndManage = ['Editor', 'Admin', 'Global Admin'].includes(userRole);
	$: currentVersionNum = event?.calendar?.current_version || 1;
	$: isAlternateVersion = viewedVersionNum > 0 && viewedVersionNum !== currentVersionNum;
	$: isViewOnly = isAlternateVersion || !canEditAndManage;

	$: targetId = event?.calendar?.id || event?.group_id || event?.id;

	let contacts: Contact[] = [];
	let loading = true;
	let saveStatus: 'idle' | 'saving' | 'saved' = 'idle';

	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let savedTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(load);
	onDestroy(() => {
		if (saveTimer) clearTimeout(saveTimer);
		if (savedTimer) clearTimeout(savedTimer);
	});

	// Reload whenever the event or the viewed version changes.
	let lastKey = '';
	$: {
		const key = `${targetId || ''}:${viewedVersionNum}`;
		if (key !== lastKey && targetId) {
			lastKey = key;
			load();
		}
	}

	function normalizeSettingsContact(c: any): Contact {
		return {
			id: c.id || crypto.randomUUID(),
			settingsRef: c.id || null,
			role: c.role || '',
			fullName: c.fullName || '',
			email: c.email || '',
			phone: c.phone || '',
			enabled: c.enabled !== false,
			custom: false
		};
	}

	function normalizeStoredContact(c: any): Contact {
		return {
			id: c.id || crypto.randomUUID(),
			settingsRef: c.settingsRef ?? null,
			role: c.role || '',
			fullName: c.fullName || '',
			email: c.email || '',
			phone: c.phone || '',
			enabled: c.enabled !== false,
			custom: !!c.custom
		};
	}

	// Pull the enabled contacts from the global Calendar Settings "Contacts" CONFIG.
	async function loadSettingsContacts(): Promise<Contact[]> {
		const { data, error } = await supabase
			.from('calendar_settings')
			.select('setting_params')
			.eq('setting_type', 'CONFIG')
			.eq('setting_name', 'Contacts')
			.maybeSingle();

		if (error || !data) return [];
		const rows = data.setting_params?.contacts;
		if (!Array.isArray(rows)) return [];
		return rows.filter((c: any) => c?.enabled !== false).map(normalizeSettingsContact);
	}

	async function load() {
		loading = true;

		if (!targetId) {
			contacts = [];
			loading = false;
			return;
		}

		const { data, error } = await supabase
			.from('calendar_data')
			.select('contacts')
			.eq('calendar_id', targetId)
			.eq('version_number', viewedVersionNum)
			.maybeSingle();

		const stored = !error && data && Array.isArray(data.contacts) ? data.contacts : [];

		if (stored.length > 0) {
			// Already seeded/edited for this event -> use what's stored.
			contacts = stored.map(normalizeStoredContact);
		} else {
			// Empty -> seed from the enabled settings contacts and persist once.
			contacts = await loadSettingsContacts();
			if (contacts.length > 0 && !isViewOnly) {
				await persist(contacts);
			}
		}

		loading = false;
	}

	async function persist(rows: Contact[]) {
		if (!targetId || isViewOnly) return false;
		const { error } = await supabase
			.from('calendar_data')
			.update({ contacts: rows })
			.eq('calendar_id', targetId)
			.eq('version_number', viewedVersionNum);
		if (error) {
			console.error('❌ [ContactsTab] Failed to save contacts:', error);
			return false;
		}
		return true;
	}

	// Debounced real-time save — runs ~600ms after the last edit.
	function scheduleSave() {
		if (isViewOnly) return;
		saveStatus = 'saving';
		if (saveTimer) clearTimeout(saveTimer);
		if (savedTimer) clearTimeout(savedTimer);
		saveTimer = setTimeout(async () => {
			const ok = await persist(contacts);
			saveStatus = ok ? 'saved' : 'idle';
			if (ok) {
				savedTimer = setTimeout(() => {
					if (saveStatus === 'saved') saveStatus = 'idle';
				}, 1500);
			}
		}, 600);
	}

	function addContact() {
		contacts = [
			...contacts,
			{
				id: crypto.randomUUID(),
				settingsRef: null,
				role: '',
				fullName: '',
				email: '',
				phone: '',
				enabled: true,
				custom: true
			}
		];
		scheduleSave();
	}

	function removeContact(id: string) {
		contacts = contacts.filter((c) => c.id !== id);
		scheduleSave();
	}

	function toggleContact(id: string) {
		contacts = contacts.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c));
		scheduleSave();
	}
</script>

<div class="flex flex-col gap-6 px-8 pt-4 pb-24">
	<div class="flex items-start justify-between gap-4">
		<div>
			<h3 class="font-black uppercase tracking-wide text-gray3">Contacts</h3>
			<p class="text-xs text-gray2 mt-1 font-bold">
				Loaded from Calendar Settings. Toggle off or add event-specific contacts.
			</p>
		</div>
		<div class="flex items-center gap-3 shrink-0">
			{#if !isViewOnly}
				<span class="text-[11px] font-bold text-gray2 min-w-[80px] text-right">
					{#if saveStatus === 'saving'}
						<span in:fade={{ duration: 150 }} class="text-gray2">Saving…</span>
					{:else if saveStatus === 'saved'}
						<span in:fade={{ duration: 150 }} class="text-lime">All changes saved</span>
					{/if}
				</span>
				<button
					class="px-6 py-2 bg-lime text-black font-bold text-sm rounded-full hover:opacity-90 transition-opacity cursor-pointer"
					on:click={addContact}
				>
					+ Add Contact
				</button>
			{/if}
		</div>
	</div>

	<div class="bg-navbar rounded-2xl p-5">
		{#if loading}
			<div class="flex justify-center p-8">
				<div class="w-8 h-8 border-4 border-lime border-t-transparent rounded-full animate-spin"></div>
			</div>
		{:else if contacts.length === 0}
			<div class="p-8 border border-dashed border-gray2/30 rounded-2xl text-center">
				<p class="text-gray2 text-sm font-bold">No contacts for this event yet.</p>
				{#if !isViewOnly}
					<p class="text-gray2/60 text-xs font-bold mt-1">
						Add one above, or enable contacts in Calendar Settings.
					</p>
				{/if}
			</div>
		{:else}
			<!-- Column headers (md+ only) -->
			<div
				class="hidden md:grid md:grid-cols-[1.2fr_1.2fr_1.6fr_1.1fr_auto_auto] gap-3 px-2 pb-3 mb-2 border-b border-gray2/10 text-[10px] font-bold text-gray2 uppercase tracking-widest"
			>
				<span>Role</span>
				<span>Full Name</span>
				<span>Email</span>
				<span>Phone</span>
				<span class="text-center">On</span>
				<span></span>
			</div>

			<div class="flex flex-col gap-3">
				{#each contacts as contact (contact.id)}
					<div
						transition:slide={{ duration: 200 }}
						class="grid grid-cols-1 md:grid-cols-[1.2fr_1.2fr_1.6fr_1.1fr_auto_auto] gap-3 items-center px-2 {contact.enabled
							? ''
							: 'opacity-45'}"
					>
						<input
							type="text"
							bind:value={contact.role}
							on:input={scheduleSave}
							placeholder="Role"
							disabled={isViewOnly}
							class="w-full min-w-0 bg-black/30 rounded-full px-4 py-2.5 text-sm font-bold text-white placeholder-gray2/50 focus:ring-1 focus:ring-lime outline-none disabled:opacity-60"
						/>
						<input
							type="text"
							bind:value={contact.fullName}
							on:input={scheduleSave}
							placeholder="Full Name"
							disabled={isViewOnly}
							class="w-full min-w-0 bg-black/30 rounded-full px-4 py-2.5 text-sm font-bold text-white placeholder-gray2/50 focus:ring-1 focus:ring-lime outline-none disabled:opacity-60"
						/>
						<input
							type="email"
							bind:value={contact.email}
							on:input={scheduleSave}
							placeholder="Email"
							disabled={isViewOnly}
							class="w-full min-w-0 bg-black/30 rounded-full px-4 py-2.5 text-sm font-bold text-white placeholder-gray2/50 focus:ring-1 focus:ring-lime outline-none disabled:opacity-60"
						/>
						<input
							type="tel"
							bind:value={contact.phone}
							on:input={scheduleSave}
							placeholder="Phone"
							disabled={isViewOnly}
							class="w-full min-w-0 bg-black/30 rounded-full px-4 py-2.5 text-sm font-bold text-white placeholder-gray2/50 focus:ring-1 focus:ring-lime outline-none disabled:opacity-60"
						/>
						<button
							type="button"
							class="relative w-11 h-6 rounded-full transition-colors duration-200 justify-self-center shrink-0 {contact.enabled
								? 'bg-lime'
								: 'bg-gray2/30'} {isViewOnly ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}"
							on:click={() => toggleContact(contact.id)}
							aria-label="Toggle contact"
							aria-pressed={contact.enabled}
						>
							<div
								class="absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-200 shadow-sm {contact.enabled
									? 'translate-x-5 bg-black'
									: 'translate-x-0 bg-white'}"
							></div>
						</button>
						{#if !isViewOnly}
							<button
								type="button"
								class="text-gray2 hover:text-red-500 transition-colors p-2 justify-self-center cursor-pointer"
								on:click={() => removeContact(contact.id)}
								aria-label="Remove contact"
							>
								<svg
									class="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<polyline points="3 6 5 6 21 6"></polyline>
									<path
										d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
									></path>
								</svg>
							</button>
						{:else}
							<span></span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	{#if isViewOnly && !loading}
		<p class="text-xs text-gray2 italic font-bold">
			{isAlternateVersion
				? 'Viewing an alternate version — contacts are read-only here.'
				: 'You have read-only access to contacts.'}
		</p>
	{/if}
</div>