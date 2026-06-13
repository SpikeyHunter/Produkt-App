<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { portal } from '$lib/utils/portalUtils';
	import { supabase } from '$lib/supabase';
	import VenueSettingsModal from '$lib/components/calendar/VenueSettingsModal.svelte';

	export let isOpen = false;

	let venues: any[] = [];
	let loading = true;

	let showVenueModal = false;
	let selectedVenueId: string | null = null;

	// SMS Template state
	let smsTemplate = '';
	let isSavingSms = false;
	let showSavedState = false;

	// Default Confirmation States
	let defaultEmailEnabled = true;
	let defaultSmsEnabled = true;
	let emailSettingId: string | null = null;
	let smsSettingId: string | null = null;
	let isTogglingEmail = false;
	let isTogglingSms = false;

	// Schedule Tech Sync State
	const availableTypes = [
		'Corpo',
		'Bazart Nuits',
		'Moet City',
		'NCG Show',
		'NCG 360',
		'DSTRKT',
		'Tour Prod',
		'Other'
	];

	const typeColors: Record<string, string> = {
		Corpo: '#d7b8e8',
		'Bazart Nuits': '#ffe089',
		'Moet City': '#f1e5cb',
		'NCG Show': '#c4ef9b',
		'NCG 360': '#fa7a90',
		DSTRKT: '#afd3e9',
		'Tour Prod': '#aec5d5',
		Other: '#828282'
	};

	let techSyncSettingId: string | null = null;
	let techSyncEnabled = false;
	let techSyncVenues: string[] = [];
	let techSyncTypes: string[] = [];
	let isTogglingTechSync = false;

	// Contacts State (stored as a single global CONFIG setting)
	interface ContactRow {
		id: string;
		role: string;
		fullName: string;
		email: string;
		phone: string;
		enabled: boolean;
	}
	let contacts: ContactRow[] = [];
	let contactsSettingId: string | null = null;
	let isSavingContacts = false;
	let contactsSavedState = false;

	async function fetchSettings() {
		loading = true;

		// Fetch Venues, SMS Template, and Configs concurrently
		const [venuesRes, templateRes, configRes] = await Promise.all([
			supabase
				.from('calendar_settings')
				.select('*')
				.eq('setting_type', 'VENUE')
				.order('setting_name', { ascending: true }),
			supabase
				.from('calendar_settings')
				.select('*')
				.eq('setting_type', 'TEMPLATE')
				.eq('setting_name', 'SMS')
				.maybeSingle(),
			supabase
				.from('calendar_settings')
				.select('*')
				.eq('setting_type', 'CONFIG')
				.in('setting_name', [
					'Default Email Confirmation',
					'Default SMS Confirmation',
					'Schedule Tech Sync',
					'Contacts'
				])
		]);

		if (!venuesRes.error && venuesRes.data) {
			venues = venuesRes.data;
		}

		if (!templateRes.error && templateRes.data) {
			smsTemplate = templateRes.data.setting_params?.body || '';
			smsSettingId = templateRes.data.id;
		} else {
			smsTemplate =
				'{eventTitle} - [{eventType}]\n\n📅 {eventDate}\n📍 {venueName}\n\n{actionLabel} by {authUserName}';
			smsSettingId = null;
		}

		// Process CONFIG values
		if (!configRes.error && configRes.data) {
			const emailSetting = configRes.data.find(
				(s) => s.setting_name === 'Default Email Confirmation'
			);
			const smsSetting = configRes.data.find((s) => s.setting_name === 'Default SMS Confirmation');
			const techSyncSetting = configRes.data.find((s) => s.setting_name === 'Schedule Tech Sync'); // NEW

			if (emailSetting) {
				emailSettingId = emailSetting.id;
				defaultEmailEnabled = emailSetting.setting_params?.value ?? true;
			}
			if (smsSetting) {
				smsSettingId = smsSetting.id;
				defaultSmsEnabled = smsSetting.setting_params?.value ?? true;
			}
			// NEW TECH SYNC PARSING
			if (techSyncSetting) {
				techSyncSettingId = techSyncSetting.id;
				const params = techSyncSetting.setting_params || {};
				techSyncEnabled = params.enabled ?? false;
				techSyncVenues = params.venues ?? [];
				techSyncTypes = params.types ?? [];
			}

			const contactsSetting = configRes.data.find((s) => s.setting_name === 'Contacts');
			if (contactsSetting) {
				contactsSettingId = contactsSetting.id;
				const rows = contactsSetting.setting_params?.contacts;
				contacts = Array.isArray(rows)
					? rows.map((c: any) => ({
							id: c.id || crypto.randomUUID(),
							role: c.role || '',
							fullName: c.fullName || '',
							email: c.email || '',
							phone: c.phone || '',
							enabled: c.enabled !== false
						}))
					: [];
			} else {
				contactsSettingId = null;
				contacts = [];
			}
		}

		loading = false;
	}

	$: if (isOpen) {
		fetchSettings();
	}

	function getVenueColor(venue: any) {
		const stages = venue?.setting_params?.stages;
		if (stages && Array.isArray(stages) && stages.length > 0 && stages[0].color) {
			return stages[0].color;
		}
		return '#BDBDBB'; // Default fallback color
	}

	function openVenueModal(id: string | null = null) {
		selectedVenueId = id;
		// By NOT closing the parent modal and letting this stack on top,
		// we completely eliminate the flickering/glitching effect.
		showVenueModal = true;
	}

	function handleVenueSuccess() {
		fetchSettings();
	}

	async function saveSmsTemplate() {
		isSavingSms = true;
		showSavedState = false; // Reset just in case

		const payload = {
			setting_type: 'TEMPLATE',
			setting_name: 'SMS',
			setting_params: { body: smsTemplate }
		};

		if (smsSettingId) {
			await supabase.from('calendar_settings').update(payload).eq('id', smsSettingId);
		} else {
			const { data, error } = await supabase
				.from('calendar_settings')
				.insert([payload])
				.select()
				.single();
			if (!error && data) {
				smsSettingId = data.id;
			}
		}

		isSavingSms = false;
		showSavedState = true; // Trigger success state

		// Revert back to normal after 1.5 seconds
		setTimeout(() => {
			showSavedState = false;
		}, 1500);
	}

	async function toggleConfig(type: 'email' | 'sms') {
		const isEmail = type === 'email';
		const settingId = isEmail ? emailSettingId : smsSettingId;
		const settingName = isEmail ? 'Default Email Confirmation' : 'Default SMS Confirmation';
		const currentValue = isEmail ? defaultEmailEnabled : defaultSmsEnabled;
		const newValue = !currentValue;

		// Optimistic UI update & loading state
		if (isEmail) {
			isTogglingEmail = true;
			defaultEmailEnabled = newValue;
		} else {
			isTogglingSms = true;
			defaultSmsEnabled = newValue;
		}

		const payload = {
			setting_type: 'CONFIG',
			setting_name: settingName,
			setting_params: { value: newValue }
		};

		if (settingId) {
			await supabase.from('calendar_settings').update(payload).eq('id', settingId);
		} else {
			const { data } = await supabase.from('calendar_settings').insert([payload]).select().single();
			if (data) {
				if (isEmail) emailSettingId = data.id;
				else smsSettingId = data.id;
			}
		}

		if (isEmail) isTogglingEmail = false;
		else isTogglingSms = false;
	}

	async function saveTechSyncState(newParams: any) {
		isTogglingTechSync = true;

		const payload = {
			setting_type: 'CONFIG',
			setting_name: 'Schedule Tech Sync',
			setting_params: {
				enabled: techSyncEnabled,
				venues: techSyncVenues,
				types: techSyncTypes,
				...newParams
			}
		};

		if (techSyncSettingId) {
			await supabase.from('calendar_settings').update(payload).eq('id', techSyncSettingId);
		} else {
			const { data } = await supabase.from('calendar_settings').insert([payload]).select().single();
			if (data) techSyncSettingId = data.id;
		}

		isTogglingTechSync = false;
	}

	function toggleTechSync() {
		techSyncEnabled = !techSyncEnabled;
		saveTechSyncState({ enabled: techSyncEnabled });
	}

	function toggleTechSyncVenue(venueId: string) {
		if (techSyncVenues.includes(venueId)) {
			techSyncVenues = techSyncVenues.filter((id) => id !== venueId);
		} else {
			techSyncVenues = [...techSyncVenues, venueId];
		}
		saveTechSyncState({ venues: techSyncVenues });
	}

	function toggleTechSyncType(type: string) {
		if (techSyncTypes.includes(type)) {
			techSyncTypes = techSyncTypes.filter((t) => t !== type);
		} else {
			techSyncTypes = [...techSyncTypes, type];
		}
		saveTechSyncState({ types: techSyncTypes });
	}

	function addContact() {
		contacts = [
			...contacts,
			{ id: crypto.randomUUID(), role: '', fullName: '', email: '', phone: '', enabled: true }
		];
	}

	function removeContact(id: string) {
		contacts = contacts.filter((c) => c.id !== id);
	}

	function toggleContact(id: string) {
		contacts = contacts.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c));
	}

	async function saveContacts() {
		isSavingContacts = true;
		contactsSavedState = false;

		const payload = {
			setting_type: 'CONFIG',
			setting_name: 'Contacts',
			setting_params: { contacts }
		};

		if (contactsSettingId) {
			await supabase.from('calendar_settings').update(payload).eq('id', contactsSettingId);
		} else {
			const { data, error } = await supabase
				.from('calendar_settings')
				.insert([payload])
				.select()
				.single();
			if (!error && data) contactsSettingId = data.id;
		}

		isSavingContacts = false;
		contactsSavedState = true;
		setTimeout(() => (contactsSavedState = false), 1500);
	}

	function closeModal() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<div use:portal class="fixed inset-0 z-[90] flex items-center justify-center p-4">
		<div
			class="absolute inset-0 bg-black/80 backdrop-blur-sm"
			transition:fade|local={{ duration: 200 }}
			on:click={closeModal}
			aria-hidden="true"
		></div>

		<div
			class="bg-gray1 border border-gray2/20 rounded-3xl shadow-2xl w-full max-w-4xl relative z-10 flex flex-col max-h-[90vh]"
			in:fly|local={{ y: 20, duration: 250, easing: cubicOut }}
			out:fly|local={{ y: 20, duration: 200, easing: cubicIn }}
		>
			<div class="flex items-center justify-between p-6 border-b border-gray2/10 shrink-0">
				<h2 class="text-xl font-black text-white tracking-wide">Calendar Settings</h2>
				<button
					class="text-gray2 hover:text-white transition-colors cursor-pointer"
					on:click={closeModal}
					aria-label="Close modal"
				>
					<svg
						class="w-6 h-6"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-8">
				<section class="space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-black text-lime uppercase tracking-widest">Venues</h3>
						<button
							class="px-4 py-2 bg-lime text-black font-bold text-xs rounded-full hover:bg-lime/90 transition-all cursor-pointer"
							on:click={() => openVenueModal(null)}
						>
							+ Add Venue
						</button>
					</div>

					{#if loading}
						<div class="flex justify-center p-8">
							<div
								class="w-8 h-8 border-4 border-lime border-t-lime rounded-full animate-spin"
							></div>
						</div>
					{:else if venues.length === 0}
						<div class="p-8 border border-dashed border-gray2/30 rounded-2xl text-center">
							<p class="text-gray2 text-sm font-bold">No venues configured yet.</p>
						</div>
					{:else}
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							{#each venues as venue}
								<button
									type="button"
									class="w-full text-left bg-black/30 border-2 border-black/0 rounded-2xl p-4 flex items-center justify-between hover:border-lime transition-colors cursor-pointer group"
									on:click={() => openVenueModal(venue.id)}
								>
									<div class="flex items-center gap-4">
										<div
											class="w-5 h-5 rounded-full shadow-sm transition-transform group-hover:scale-110"
											style="background-color: {getVenueColor(venue)}"
										></div>
										<div>
											<p class="text-white font-bold text-sm">{venue.setting_name}</p>
											<p class="text-gray2 text-xs">
												{venue.setting_params?.location?.city || 'No Location'}
											</p>
										</div>
									</div>
									<div class="text-gray2 group-hover:text-white transition-colors p-2">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
											/>
										</svg>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</section>

				<section class="space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-black text-lime uppercase tracking-widest">Contacts</h3>
						<button
							class="px-4 py-2 bg-lime text-black font-bold text-xs rounded-full hover:bg-lime/90 transition-all cursor-pointer"
							on:click={addContact}
						>
							+ Add Contact
						</button>
					</div>

					<div class="bg-black/30 rounded-2xl p-4 space-y-3">
						{#if contacts.length === 0}
							<div class="p-6 border border-dashed border-gray2/30 rounded-2xl text-center">
								<p class="text-gray2 text-sm font-bold">No contacts added yet.</p>
							</div>
						{:else}
							<!-- Column headers (md+ only) -->
							<div
								class="hidden md:grid md:grid-cols-[1fr_1fr_1.4fr_1fr_auto_auto] gap-2 px-1 text-[10px] font-bold text-gray2 uppercase tracking-widest"
							>
								<span>Role</span>
								<span>Full Name</span>
								<span>Email</span>
								<span>Phone</span>
								<span class="text-center">On</span>
								<span></span>
							</div>

							{#each contacts as contact (contact.id)}
								<div
									class="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.4fr_1fr_auto_auto] gap-2 items-center {contact.enabled
										? ''
										: 'opacity-50'}"
								>
									<input
										type="text"
										bind:value={contact.role}
										placeholder="Role"
										class="w-full min-w-0 bg-black/20 rounded-xl px-3 py-2 text-sm font-bold text-white placeholder-gray2/50 focus:ring-1 focus:ring-lime outline-none"
									/>
									<input
										type="text"
										bind:value={contact.fullName}
										placeholder="Full Name"
										class="w-full min-w-0 bg-black/20 rounded-xl px-3 py-2 text-sm font-bold text-white placeholder-gray2/50 focus:ring-1 focus:ring-lime outline-none"
									/>
									<input
										type="email"
										bind:value={contact.email}
										placeholder="Email"
										class="w-full min-w-0 bg-black/20 rounded-xl px-3 py-2 text-sm font-bold text-white placeholder-gray2/50 focus:ring-1 focus:ring-lime outline-none"
									/>
									<input
										type="tel"
										bind:value={contact.phone}
										placeholder="Phone"
										class="w-full min-w-0 bg-black/20 rounded-xl px-3 py-2 text-sm font-bold text-white placeholder-gray2/50 focus:ring-1 focus:ring-lime outline-none"
									/>
									<button
										type="button"
										class="relative w-11 h-6 rounded-full transition-colors duration-200 justify-self-center shrink-0 {contact.enabled
											? 'bg-lime'
											: 'bg-gray2/30'} cursor-pointer"
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
									<button
										type="button"
										class="text-gray2 hover:text-red-500 transition-colors p-2 justify-self-center cursor-pointer"
										on:click={() => removeContact(contact.id)}
										aria-label="Remove contact"
									>
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<polyline points="3 6 5 6 21 6"></polyline>
											<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
										</svg>
									</button>
								</div>
							{/each}

							<div class="flex justify-end pt-1">
								<button
									class="px-5 py-2.5 font-bold text-xs rounded-full transition-all duration-300 flex items-center justify-center min-w-[140px] cursor-pointer disabled:cursor-not-allowed {contactsSavedState
										? 'bg-gray3 text-black'
										: 'bg-lime text-black hover:bg-lime/90'} {isSavingContacts ? 'opacity-50' : ''}"
									on:click={saveContacts}
									disabled={isSavingContacts || contactsSavedState}
								>
									{#if isSavingContacts}
										<div in:fade={{ duration: 150 }}>Saving...</div>
									{:else if contactsSavedState}
										<div in:fade={{ duration: 150 }} class="flex items-center">
											<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
											</svg>
											Saved!
										</div>
									{:else}
										<div in:fade={{ duration: 150 }}>Save Contacts</div>
									{/if}
								</button>
							</div>
						{/if}
					</div>
				</section>

				<section class="space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-black text-lime uppercase tracking-widest">
							EVENT - SMS Template
						</h3>
					</div>
					<div class="bg-black/30 rounded-2xl p-4 space-y-4">
						<p class="text-xs text-gray2 leading-relaxed">
							Customize the body of the text message. Use these exact tags to insert dynamic data: <br
							/>
							<code class="text-white bg-white/10 px-1.5 py-0.5 rounded-full mr-1"
								>{'{eventTitle}'}</code
							>
							<code class="text-white bg-white/10 px-1.5 py-0.5 rounded-full mr-1"
								>{'{eventType}'}</code
							>
							<code class="text-white bg-white/10 px-1.5 py-0.5 rounded-full mr-1"
								>{'{eventDate}'}</code
							>
							<code class="text-white bg-white/10 px-1.5 py-0.5 rounded-full mr-1"
								>{'{venueName}'}</code
							>
							<code class="text-white bg-white/10 px-1.5 py-0.5 rounded-full mr-1"
								>{'{actionLabel}'}</code
							>
							<code class="text-white bg-white/10 px-1.5 py-0.5 rounded-full mr-1"
								>{'{authUserName}'}</code
							>
						</p>
						<textarea
							bind:value={smsTemplate}
							class="w-full bg-black/20 rounded-xl p-3 text-white text-sm focus:border-lime/50 outline-none resize-y min-h-[160px] custom-scrollbar placeholder-gray2/50"
							placeholder="Enter your SMS template here..."
						></textarea>
						<div class="flex justify-end relative">
							<button
								class="px-5 py-2.5 font-bold text-xs rounded-full transition-all duration-300 flex items-center justify-center min-w-[140px] cursor-pointer disabled:cursor-not-allowed {showSavedState
									? 'bg-gray3 text-black'
									: 'bg-lime text-black'} {!showSavedState && !isSavingSms
									? 'hover:bg-lime/90'
									: ''} {isSavingSms || loading ? 'opacity-50' : ''}"
								on:click={saveSmsTemplate}
								disabled={isSavingSms || loading || showSavedState}
							>
								{#if isSavingSms}
									<div in:fade={{ duration: 150 }} class="flex items-center">
										<svg
											class="animate-spin -ml-1 mr-2 h-4 w-4 text-black"
											xmlns="http://www.w3.org/2000/svg"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle
												class="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												stroke-width="4"
											></circle>
											<path
												class="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											></path>
										</svg>
										Saving...
									</div>
								{:else if showSavedState}
									<div in:fade={{ duration: 150 }} class="flex items-center">
										<svg
											class="w-4 h-4 mr-1.5"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="3"
												d="M5 13l4 4L19 7"
											></path>
										</svg>
										Saved!
									</div>
								{:else}
									<div in:fade={{ duration: 150 }}>Save Template</div>
								{/if}
							</button>
						</div>
					</div>
				</section>
				<section class="space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-black text-lime uppercase tracking-widest">
							Default Confirmation
						</h3>
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div
							class="bg-black/30 rounded-2xl p-5 flex items-center justify-between border border-gray2/5"
						>
							<div>
								<p class="text-sm font-bold text-white">Email Confirmation</p>
								<p class="text-xs text-gray2 mt-1">
									This option will be pre-selected when confirming a show
								</p>
							</div>
							<button
								class="relative w-12 h-6 rounded-full transition-colors duration-300 {defaultEmailEnabled
									? 'bg-lime'
									: 'bg-gray2/30'} cursor-pointer {isTogglingEmail
									? 'opacity-50 pointer-events-none'
									: ''}"
								on:click={() => toggleConfig('email')}
								aria-label="Toggle default email confirmation"
							>
								<div
									class="absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 shadow-sm {defaultEmailEnabled
										? 'translate-x-6 bg-black'
										: 'translate-x-0 bg-white'}"
								></div>
							</button>
						</div>

						<div
							class="bg-black/30 rounded-2xl p-5 flex items-center justify-between border border-gray2/5"
						>
							<div>
								<p class="text-sm font-bold text-white">SMS Confirmation</p>
								<p class="text-xs text-gray2 mt-1">
									This option will be pre-selected when confirming a show
								</p>
							</div>
							<button
								class="relative w-12 h-6 rounded-full transition-colors duration-300 {defaultSmsEnabled
									? 'bg-lime'
									: 'bg-gray2/30'} cursor-pointer {isTogglingSms
									? 'opacity-50 pointer-events-none'
									: ''}"
								on:click={() => toggleConfig('sms')}
								aria-label="Toggle default SMS confirmation"
							>
								<div
									class="absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 shadow-sm {defaultSmsEnabled
										? 'translate-x-6 bg-black'
										: 'translate-x-0 bg-white'}"
								></div>
							</button>
						</div>
					</div>
				</section>

				<section class="space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-black text-lime uppercase tracking-widest">
							Schedule Tech Sync
						</h3>
					</div>
					<div class="bg-black/30 rounded-2xl p-5 border border-gray2/5 flex flex-col gap-5">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-bold text-white">Sync to Schedule Tech</p>
								<p class="text-xs text-gray2 mt-1">
									Sync by default any confirmed event to schedule tech based on matching criteria
									below.
								</p>
							</div>
							<button
								class="relative w-12 h-6 rounded-full transition-colors duration-300 shrink-0 {techSyncEnabled
									? 'bg-lime'
									: 'bg-gray2/30'} cursor-pointer {isTogglingTechSync
									? 'opacity-50 pointer-events-none'
									: ''}"
								on:click={toggleTechSync}
								aria-label="Toggle schedule tech sync"
							>
								<div
									class="absolute top-1 left-1 w-4 h-4 rounded-full transition-transform duration-300 shadow-sm {techSyncEnabled
										? 'translate-x-6 bg-black'
										: 'translate-x-0 bg-white'}"
								></div>
							</button>
						</div>

						<div
							class="flex flex-col gap-4 border-t border-gray2/10 pt-4 {techSyncEnabled
								? ''
								: 'opacity-40 pointer-events-none transition-opacity duration-300'}"
						>
							<div>
								<p class="text-xs font-bold text-gray2 uppercase tracking-widest mb-2">
									Match Venues
								</p>
								<div class="flex flex-wrap gap-2">
									{#each venues as venue}
										{@const isSelected = techSyncVenues.includes(venue.id)}
										{@const vColor = getVenueColor(venue)}
										<button
											class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all hover:cursor-pointer {isSelected
												? 'bg-white/10 text-white'
												: 'bg-black/40 text-gray2 hover:bg-white/5 hover:text-white'}"
											style="border-color: {isSelected ? vColor : 'transparent'};"
											on:click={() => toggleTechSyncVenue(venue.id)}
										>
											<div
												class="w-2.5 h-2.5 rounded-full shadow-sm"
												style="background-color: {vColor}"
											></div>
											{venue.setting_name}
										</button>
									{/each}
									{#if venues.length === 0}
										<span class="text-xs text-gray2 italic">No venues available.</span>
									{/if}
								</div>
							</div>

							<div>
								<p class="text-xs font-bold text-gray2 uppercase tracking-widest mb-2">
									Match Event Types
								</p>
								<div class="flex flex-wrap gap-2">
									{#each availableTypes as type}
										{@const isSelected = techSyncTypes.includes(type)}
										{@const tColor = typeColors[type] || typeColors['Other']}
										<button
											class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer {isSelected
												? 'bg-white/10 text-white'
												: 'bg-black/40 text-gray2 hover:bg-white/5 hover:text-white'}"
											style="border-color: {isSelected ? tColor : 'transparent'};"
											on:click={() => toggleTechSyncType(type)}
										>
											<div
												class="w-2.5 h-2.5 rounded-full shadow-sm"
												style="background-color: {tColor}"
											></div>
											{type}
										</button>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>
	</div>
{/if}

<VenueSettingsModal
	bind:isOpen={showVenueModal}
	venueId={selectedVenueId}
	on:success={handleVenueSuccess}
/>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(189, 189, 187, 0.15);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--color-lime);
	}
</style>