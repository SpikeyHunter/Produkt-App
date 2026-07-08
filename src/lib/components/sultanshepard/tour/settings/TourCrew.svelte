<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import type { ActionReturn } from 'svelte/action';
	import type { SSCrew, CrewType, SalaryCurrency } from '$lib/types/tour';
	import { createCrew, updateCrew, deleteCrew } from '$lib/services/tourService';
	import { getAccessToken } from '$lib/stores/auth';
	import { countries } from '$lib/utils/passport/countries';
	import Toggle from '../ui/Toggle.svelte';

	// Kept in sync with the page so other components (sections) see fresh data
	export let crew: SSCrew[] = [];

	// Export state and action so the SettingsModal can manage the "Add Member" button
	export let isEditing = false;
	export function triggerNew() {
		newCrewMember();
	}

	const dispatch = createEventDispatcher();

	interface PassportDraft {
		number?: string;
		country?: string; // citizenship
		expiry?: string;
		photo_url?: string;
		given_names?: string;
		last_names?: string;
		date_of_birth?: string;
		country_birth?: string;
	}
	interface CrewDraft {
		id: string;
		first_name: string;
		last_name: string;
		role: string;
		crew_type: CrewType;
		salary: number;
		salary_currency: SalaryCurrency;
		email: string;
		phone: string;
		passport: PassportDraft;
		airlines: NonNullable<SSCrew['airlines']>;
		seat_preference: 'window' | 'aisle';
		is_active: boolean;
	}

	const SEATS: { v: 'window' | 'aisle'; l: string }[] = [
		{ v: 'window', l: 'Window' },
		{ v: 'aisle', l: 'Aisle' }
	];
	const AIRLINES: { k: 'air_canada' | 'united' | 'delta'; l: string }[] = [
		{ k: 'air_canada', l: 'Air Canada' },
		{ k: 'united', l: 'United' },
		{ k: 'delta', l: 'Delta' }
	];
	const SALARY_CURRENCIES: SalaryCurrency[] = ['CAD', 'USD'];
	const CREW_TYPES: { value: CrewType; label: string }[] = [
		{ value: 'artist', label: 'Artist' },
		{ value: 'prod', label: 'Production' },
		{ value: 'singer', label: 'Singer' },
		{ value: 'management', label: 'Management' },
		{ value: 'media', label: 'Media' }
	];

	// Shared input/label styling — borderless, rounded-full
	const inputCls =
		'w-full bg-black/40 rounded-full px-4 py-2 text-sm text-white placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime transition';
	const labelCls = 'text-[10px] uppercase tracking-wider text-gray2';

	let editingCrew: CrewDraft | null = null;
	let isNewCrew = false;
	let saving = false;
	let originalPhotoUrl = '';

	let memberToDelete: {
		id: string;
		name?: string;
		first_name?: string;
		last_name?: string;
	} | null = null;
	let isDeleting = false; // Optional: prevents multiple clicks while deleting

	// Sync isEditing boolean up to parent so it knows when to hide its button
	$: isEditing = !!editingCrew;

	// passport upload / OCR
	let pendingFile: File | null = null;
	let fileInput: HTMLInputElement;
	let isDragOver = false;
	let dragCounter = 0;
	let isDetecting = false;
	let detectionError = '';

	// segmented airline-loyalty selector
	let airlineSel: 'air_canada' | 'united' | 'delta' = 'air_canada';

	// custom dropdowns
	let openMenu: 'type' | 'citizenship' | 'birth' | null = null;
	let citizenshipSearch = '';
	let birthSearch = '';
	$: citizenshipList = countries.filter((c) =>
		c.toLowerCase().includes(citizenshipSearch.toLowerCase())
	);
	$: birthList = countries.filter((c) => c.toLowerCase().includes(birthSearch.toLowerCase()));

	// Validation mapping for required fields
	$: isValid = editingCrew
		? !!(
				editingCrew.first_name.trim() &&
				editingCrew.last_name.trim() &&
				editingCrew.role.trim() &&
				editingCrew.crew_type &&
				editingCrew.email.trim() &&
				editingCrew.phone.trim()
			)
		: false;

	// Typed so `on:outclick` is recognised by svelte-check
	function clickOutside(
		node: HTMLElement
	): ActionReturn<undefined, { 'on:outclick': (e: CustomEvent) => void }> {
		const handler = (e: MouseEvent) => {
			if (!node.contains(e.target as Node)) node.dispatchEvent(new CustomEvent('outclick'));
		};
		document.addEventListener('click', handler, true);
		return { destroy: () => document.removeEventListener('click', handler, true) };
	}

	// ---------- list / draft setup ----------
	function blankCrew(): CrewDraft {
		return {
			id: '',
			first_name: '',
			last_name: '',
			role: '',
			crew_type: 'prod',
			salary: 0,
			salary_currency: 'CAD',
			email: '',
			phone: '',
			passport: {},
			airlines: {},
			seat_preference: 'window',
			is_active: true
		};
	}

	function editCrewMember(c: SSCrew) {
		const copy: any = structuredClone(c);
		const [fnFromName, ...rest] = (copy.name || '').trim().split(' ');
		editingCrew = {
			id: copy.id,
			first_name: fnFromName ?? '',
			last_name: rest.join(' '),
			role: copy.role ?? '',
			crew_type: copy.crew_type ?? 'prod',
			salary: copy.salary ?? 0,
			salary_currency: copy.salary_currency ?? 'CAD',
			email: copy.email ?? '',
			phone: copy.phone ?? '',
			passport: {
				number: copy.passport?.number ?? '',
				country: copy.passport?.country ?? '',
				expiry: copy.passport?.expiry ?? '',
				photo_url: copy.passport?.photo_url ?? '',
				given_names: copy.passport?.given_names ?? '',
				last_names: copy.passport?.last_names ?? '',
				date_of_birth: copy.passport?.date_of_birth ?? '',
				country_birth: copy.passport?.country_birth ?? ''
			},
			airlines: copy.airlines ?? {},
			seat_preference: copy.seat_preference ?? 'window',
			is_active: copy.is_active ?? true
		};
		originalPhotoUrl = editingCrew.passport.photo_url ?? '';
		isNewCrew = false;
		resetTransientState();
	}

	function newCrewMember() {
		editingCrew = blankCrew();
		originalPhotoUrl = '';
		isNewCrew = true;
		resetTransientState();
	}

	function resetTransientState() {
		pendingFile = null;
		detectionError = '';
		openMenu = null;
		citizenshipSearch = '';
		birthSearch = '';
		airlineSel = 'air_canada';
	}

	function cancelEdit() {
		cleanupBlob();
		editingCrew = null;
		pendingFile = null;
	}

	// ---------- null-safe field handlers ----------
	function selectCrewType(v: CrewType) {
		if (editingCrew) editingCrew.crew_type = v;
		openMenu = null;
	}
	function selectCitizenship(country: string) {
		if (editingCrew) editingCrew.passport.country = country;
		openMenu = null;
		citizenshipSearch = '';
	}
	function selectCountryBirth(country: string) {
		if (editingCrew) editingCrew.passport.country_birth = country;
		openMenu = null;
		birthSearch = '';
	}
	function selectSeat(v: 'window' | 'aisle') {
		if (editingCrew) editingCrew.seat_preference = v;
	}
	function selectSalaryCurrency(v: SalaryCurrency) {
		if (editingCrew) editingCrew.salary_currency = v;
	}
	function setAirlineNumber(v: string) {
		if (!editingCrew) return;
		editingCrew.airlines = { ...editingCrew.airlines, [airlineSel]: v };
	}

	// ---------- passport image ----------
	function triggerFileInput() {
		fileInput?.click();
	}

	function processFile(file: File) {
		if (!editingCrew) return;
		const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
		if (!allowed.includes(file.type)) {
			detectionError = 'Invalid file type. Upload a PDF, JPG, JPEG, or PNG.';
			return;
		}
		if (file.size > 10 * 1024 * 1024) {
			detectionError = 'File too large. Maximum size is 10MB.';
			return;
		}
		cleanupBlob();
		pendingFile = file;
		editingCrew.passport.photo_url = URL.createObjectURL(file);
		editingCrew = editingCrew;
		detectionError = '';
	}

	function handleFileSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) processFile(file);
		if (fileInput) fileInput.value = '';
	}

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		dragCounter++;
		if (e.dataTransfer?.types.includes('Files')) isDragOver = true;
	}
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
	}
	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		dragCounter--;
		if (dragCounter === 0) isDragOver = false;
	}
	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		dragCounter = 0;
		const file = e.dataTransfer?.files?.[0];
		if (file) processFile(file);
	}

	function removePassportImage() {
		cleanupBlob();
		if (editingCrew) editingCrew.passport.photo_url = '';
		pendingFile = null;
		editingCrew = editingCrew;
	}

	function cleanupBlob() {
		const u = editingCrew?.passport.photo_url;
		if (u && u.startsWith('blob:')) URL.revokeObjectURL(u);
	}

	function blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	// ---------- OCR ----------
	async function handleAutoDetect() {
		const ec = editingCrew;
		if (!ec?.passport.photo_url) return;
		try {
			isDetecting = true;
			detectionError = '';
			const token = await getAccessToken();
			if (!token) throw new Error('Not authenticated.');

			let imageData = ec.passport.photo_url;
			if (imageData.startsWith('blob:')) {
				const blob = await (await fetch(imageData)).blob();
				imageData = await blobToBase64(blob);
			}

			const response = await fetch('/api/passport-ocr', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					imageUrl: imageData,
					nameHints: { expectedFirstName: ec.first_name, expectedLastName: ec.last_name }
				})
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				throw new Error(err.error || 'OCR detection failed.');
			}
			const result = await response.json();
			if (!result.success || !result.detectedInfo)
				throw new Error('Failed to detect passport information.');

			const ocr = result.detectedInfo;
			const p = ec.passport;
			if (ocr.givenName) p.given_names = ocr.givenName;
			if (ocr.lastName) p.last_names = ocr.lastName;
			if (ocr.dateOfBirth) p.date_of_birth = ocr.dateOfBirth;
			if (ocr.country) p.country = ocr.country; // citizenship
			if (ocr.country_birth) p.country_birth = ocr.country_birth;
			if (ocr.passportNumber) p.number = ocr.passportNumber;
			editingCrew = ec;
		} catch (error) {
			console.error('Passport auto-detect failed:', error);
			detectionError = error instanceof Error ? error.message : 'Failed to detect info.';
		} finally {
			isDetecting = false;
		}
	}

	async function uploadPassportImage(file: File, safeName: string): Promise<string> {
		const token = await getAccessToken();
		if (!token) throw new Error('Not authenticated.');
		const formData = new FormData();
		formData.append('file', file);
		formData.append('filePath', `passports/Passport - ${safeName}.png`);
		formData.append('bucket', 'documents');

		const res = await fetch('/api/upload', {
			method: 'POST',
			credentials: 'include',
			headers: { Authorization: `Bearer ${token}` },
			body: formData
		});

		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error(err.error || `Upload failed (${res.status})`);
		}
		return (await res.json()).publicUrl;
	}

	// ---------- save / delete ----------
	async function saveCrewMember() {
		const ec = editingCrew;
		if (!ec || !isValid) return;
		saving = true;
		try {
			const safeName = `${ec.first_name || 'Unknown'} ${ec.last_name || 'Crew'}`.trim();

			let photo_url = ec.passport.photo_url || '';
			if (pendingFile) {
				try {
					photo_url = await uploadPassportImage(pendingFile, safeName);
				} catch (e) {
					console.error('Passport image upload failed:', e);
					photo_url = originalPhotoUrl;
				}
			} else if (photo_url.startsWith('blob:')) {
				photo_url = originalPhotoUrl;
			}

			const payload: Omit<SSCrew, 'id'> = {
				name: `${ec.first_name} ${ec.last_name}`.trim(),
				role: ec.role,
				crew_type: ec.crew_type,
				salary: ec.salary,
				salary_currency: ec.salary_currency,
				email: ec.email,
				phone: ec.phone,
				passport: { ...ec.passport, photo_url },
				airlines: ec.airlines,
				seat_preference: ec.seat_preference,
				is_active: ec.is_active
			};

			if (isNewCrew) {
				const created = await createCrew(payload);
				crew = [...crew, created];
			} else {
				const updated = await updateCrew(ec.id, payload);
				crew = crew.map((c) => (c.id === updated.id ? updated : c));
			}
			cleanupBlob();
			editingCrew = null;
			pendingFile = null;
			dispatch('saved');
		} catch (e) {
			console.error('Failed to save crew member', e);
		} finally {
			saving = false;
		}
	}

	function removeCrewMember(c: {
		id: string;
		name?: string;
		first_name?: string;
		last_name?: string;
	}) {
		// Just open the custom modal instead of the native confirm
		memberToDelete = c;
	}

	function cancelDelete() {
		memberToDelete = null;
	}

	async function confirmDelete() {
		if (!memberToDelete) return;

		isDeleting = true;
		try {
			await deleteCrew(memberToDelete.id);
			crew = crew.filter((x) => x.id !== memberToDelete!.id);

			if (editingCrew?.id === memberToDelete.id) {
				editingCrew = null;
			}
		} catch (e) {
			console.error('Failed to delete crew member', e);
		} finally {
			isDeleting = false;
			memberToDelete = null; // Close the modal
		}
	}

	onDestroy(cleanupBlob);
</script>

<input
	bind:this={fileInput}
	type="file"
	accept=".pdf,.jpg,.jpeg,.png"
	on:change={handleFileSelect}
	class="hidden"
/>

{#if !editingCrew}
	<div class="space-y-8">
		{#each [{ label: 'Artist & Singers', keys: ['artist', 'singer'] }, { label: 'Production', keys: ['prod'] }, { label: 'Management', keys: ['management'] }, { label: 'Media', keys: ['media'] }] as section}
			{@const members = crew.filter((c) => section.keys.includes(c.crew_type))}
			{#if members.length > 0}
				<div>
					<h3 class="text-xs font-bold text-gray2 mb-3 uppercase tracking-wider">
						{section.label}
					</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
						{#each members as c (c.id)}
							<div
								class="bg-black/30 hover:bg-black/40 transition rounded-2xl p-4 relative group cursor-pointer"
								on:click={() => editCrewMember(c)}
								role="button"
								tabindex="0"
								on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && editCrewMember(c)}
							>
								<div
									class="text-[10px] font-black uppercase tracking-wider text-lime mb-1 truncate pr-6"
								>
									{c.role || 'NO ROLE'}
									{#if c.is_active === false}<span
											class="text-gray2 opacity-70 ml-1 font-normal capitalize">(Inactive)</span
										>{/if}
								</div>

								<div class="text-sm font-bold text-white mb-2 truncate pr-6">
									{c.name}
									<span class="text-gray2 font-normal uppercase text-[10px] tracking-wider ml-1"
									></span>
								</div>

								<div class="text-xs text-gray3 mb-1">
									Salary: <span class="text-lime"
										>${c.salary ?? 0} {c.salary_currency ?? 'CAD'}/show</span
									>
								</div>

								<div class="text-xs text-gray3 truncate">
									{c.email || 'No email'} · {c.phone || 'No phone'}
								</div>

								<button
									class="cursor-pointer absolute top-3 right-3 text-gray2 hover:text-lime transition opacity-0 group-hover:opacity-100"
									on:click|stopPropagation={() => editCrewMember(c)}
									aria-label="Edit"
								>
									<svg
										class="w-4 h-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
										<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
									</svg>
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/each}

		{#if crew.length === 0}
			<div
				class="flex flex-col items-center justify-center py-12 text-center border border-dashed border-gray1 rounded-2xl"
			>
				<p class="text-sm text-gray2 italic mb-3">No crew yet — add your first member.</p>
				<button
					class="cursor-pointer px-4 py-2 rounded-full bg-lime text-black text-xs font-bold hover:opacity-90 transition"
					on:click={newCrewMember}
				>
					+ Add Crew Member
				</button>
			</div>
		{/if}
	</div>
{:else}
	<div>
		<button
			class="cursor-pointer text-xs text-black hover:text-black bg-gray3 py-1 px-2.5 rounded-full transition mb-6"
			on:click={cancelEdit}>← Back to list</button
		>

		<div class="mt-4 grid grid-cols-2 gap-x-6 gap-y-0 items-start">
			<div style="grid-column:1; grid-row:1;" class="grid grid-cols-2 gap-3 pb-2">
				<label class="block">
					<span class={labelCls}>First Name *</span>
					<input class="mt-1 {inputCls}" bind:value={editingCrew.first_name} />
				</label>
				<label class="block">
					<span class={labelCls}>Last Name *</span>
					<input class="mt-1 {inputCls}" bind:value={editingCrew.last_name} />
				</label>
			</div>

			<label class="block pb-2" style="grid-column:1; grid-row:2;">
				<span class={labelCls}>Role *</span>
				<input
					class="mt-1 {inputCls}"
					placeholder="Tour Manager, FOH, LD…"
					bind:value={editingCrew.role}
				/>
			</label>

			<div class="pb-2" style="grid-column:1; grid-row:3;">
				<span class={labelCls}>Crew Type *</span>
				<div
					class="relative mt-1"
					use:clickOutside
					on:outclick={() => openMenu === 'type' && (openMenu = null)}
				>
					<button
						type="button"
						class="cursor-pointer {inputCls} flex items-center justify-between text-left"
						on:click={() => (openMenu = openMenu === 'type' ? null : 'type')}
					>
						<span
							>{CREW_TYPES.find((t) => t.value === editingCrew?.crew_type)?.label ??
								'Select…'}</span
						>
						<svg
							class="w-4 h-4 text-gray2 shrink-0"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
						>
					</button>
					{#if openMenu === 'type'}
						<div class="absolute z-30 mt-2 w-full bg-[#1a1a1a] rounded-2xl p-1.5 shadow-xl">
							{#each CREW_TYPES as t}
								<button
									type="button"
									class="cursor-pointer w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/10 transition {editingCrew?.crew_type ===
									t.value
										? 'text-lime font-bold'
										: 'text-white'}"
									on:click={() => selectCrewType(t.value)}
								>
									{t.label}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<label class="block pb-2" style="grid-column:1; grid-row:4;">
				<span class={labelCls}>Salary / show</span>
				<div class="mt-1 flex gap-2">
					<div class="relative flex-1">
						<span
							class="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray2 pointer-events-none"
							>{editingCrew.salary_currency === 'USD' ? 'USD$' : 'CAD$'}</span
						>
						<input type="number" class="{inputCls} pl-16" bind:value={editingCrew.salary} />
					</div>
					<div class="flex rounded-full overflow-hidden bg-black/40 p-0.5 shrink-0">
						{#each SALARY_CURRENCIES as cur}
							<button
								type="button"
								class="cursor-pointer px-3 py-1.5 text-xs font-bold rounded-full transition {editingCrew?.salary_currency ===
								cur
									? 'bg-lime text-black'
									: 'text-gray2 hover:text-white'}"
								on:click={() => selectSalaryCurrency(cur)}
							>
								{cur}
							</button>
						{/each}
					</div>
				</div>
			</label>

			<label class="block pb-2" style="grid-column:1; grid-row:5;">
				<span class={labelCls}>Email *</span>
				<input type="email" class="mt-1 {inputCls}" bind:value={editingCrew.email} />
			</label>

			<label class="block pb-2" style="grid-column:1; grid-row:6;">
				<span class={labelCls}>Phone *</span>
				<input class="mt-1 {inputCls}" bind:value={editingCrew.phone} />
			</label>

			<div class="pb-2" style="grid-column:1; grid-row:7;">
				<span class="text-xs font-black uppercase tracking-wider text-gray3"
					>Airline Loyalty Numbers</span
				>
				<div class="flex rounded-full overflow-hidden bg-black/40 p-0.5 mt-1">
					{#each AIRLINES as a}
						<button
							type="button"
							class="cursor-pointer flex-1 px-2 py-1.5 text-xs font-bold rounded-full transition {airlineSel ===
							a.k
								? 'bg-lime text-black'
								: 'text-gray2 hover:text-white'}"
							on:click={() => (airlineSel = a.k)}
						>
							{a.l}
						</button>
					{/each}
				</div>
				<input
					class="mt-2 {inputCls}"
					placeholder="{AIRLINES.find((a) => a.k === airlineSel)?.l} loyalty number"
					value={editingCrew?.airlines?.[airlineSel] ?? ''}
					on:input={(e) => setAirlineNumber(e.currentTarget.value)}
				/>
			</div>

			<div class="pb-2" style="grid-column:1; grid-row:8;">
				<span class={labelCls}>Seat preference</span>
				<div class="flex gap-2 mt-1">
					{#each SEATS as s}
						<button
							type="button"
							class="cursor-pointer flex-1 py-2 text-sm font-bold border rounded-full transition {editingCrew?.seat_preference ===
							s.v
								? 'border-lime text-black bg-lime'
								: 'border-gray2/30 text-gray2 hover:border-gray2'}"
							on:click={() => selectSeat(s.v)}
						>
							{s.l}
						</button>
					{/each}
				</div>
			</div>

			<div style="grid-column:2; grid-row:1 / span 4;" class="pb-2">
				<span class="text-xs font-black uppercase tracking-wider text-gray3">Passport</span>
				{#if editingCrew.passport.photo_url}
					<div class="space-y-3 mt-1">
						<div class="w-full bg-gray1 rounded-2xl overflow-hidden" style="height: 220px;">
							<img
								src={editingCrew.passport.photo_url}
								alt="Passport"
								class="w-full h-full object-cover"
							/>
						</div>
						<div class="flex items-center gap-2">
							<button
								type="button"
								class="cursor-pointer px-3 py-1.5 rounded-full bg-lime text-black font-bold text-xs hover:opacity-90 transition disabled:opacity-50"
								on:click={handleAutoDetect}
								disabled={isDetecting}
							>
								{isDetecting ? 'Detecting…' : 'Auto Detect'}
							</button>
							<button
								type="button"
								class="cursor-pointer px-3 py-1.5 rounded-full bg-black/40 text-gray2 font-bold text-xs hover:text-white transition"
								on:click={triggerFileInput}
							>
								Replace
							</button>
							<button
								type="button"
								class="cursor-pointer ml-auto px-3 py-1.5 rounded-full bg-black/40 text-problem font-bold text-xs hover:opacity-80 transition"
								on:click={removePassportImage}
							>
								Remove
							</button>
						</div>
					</div>
				{:else}
					<div
						class="cursor-pointer rounded-2xl p-8 mt-1 text-center transition-all duration-200 bg-black/40 ring-1 flex flex-col items-center justify-center {isDragOver
							? 'ring-lime'
							: 'ring-transparent hover:ring-gray2'}"
						style="min-height: 220px;"
						role="button"
						tabindex="0"
						aria-label="Upload passport image"
						on:click={triggerFileInput}
						on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && triggerFileInput()}
						on:dragenter={handleDragEnter}
						on:dragover={handleDragOver}
						on:dragleave={handleDragLeave}
						on:drop={handleDrop}
					>
						<svg
							class="w-10 h-10 mx-auto mb-3 text-gray2"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
							/>
						</svg>
						<p class="text-white font-bold text-sm">
							{isDragOver ? 'Drop passport here' : 'Drop passport, or click to browse'}
						</p>
						<p class="text-xs text-gray2 mt-1">PDF, JPG, JPEG, PNG up to 10MB</p>
					</div>
				{/if}
				{#if detectionError}
					<p class="text-problem text-xs mt-1">{detectionError}</p>
				{/if}
			</div>

			<div style="grid-column:2; grid-row:5;" class="grid grid-cols-2 gap-3 pb-2">
				<label class="block">
					<span class={labelCls}>Given Names</span>
					<input class="mt-1 {inputCls}" bind:value={editingCrew.passport.given_names} />
				</label>
				<label class="block">
					<span class={labelCls}>Last Names</span>
					<input class="mt-1 {inputCls}" bind:value={editingCrew.passport.last_names} />
				</label>
			</div>

			<div style="grid-column:2; grid-row:6;" class="grid grid-cols-2 gap-3 pb-2">
				<div>
					<span class={labelCls}>Citizenship</span>
					<div
						class="relative mt-1"
						use:clickOutside
						on:outclick={() => openMenu === 'citizenship' && (openMenu = null)}
					>
						<button
							type="button"
							class="cursor-pointer {inputCls} flex items-center justify-between text-left"
							on:click={() => (openMenu = openMenu === 'citizenship' ? null : 'citizenship')}
						>
							<span class={editingCrew?.passport.country ? 'text-white' : 'text-gray2 truncate'}
								>{editingCrew?.passport.country || 'Select…'}</span
							>
							<svg
								class="w-4 h-4 text-gray2 shrink-0"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
							>
						</button>
						{#if openMenu === 'citizenship'}
							<div
								class="absolute z-30 mt-2 w-[200%] max-w-sm bg-[#1a1a1a] rounded-2xl p-1.5 shadow-xl"
							>
								<input
									class="w-full bg-black/40 rounded-full px-3 py-1.5 text-sm text-white placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime mb-1"
									placeholder="Search…"
									bind:value={citizenshipSearch}
								/>
								<div class="max-h-48 overflow-y-auto">
									{#each citizenshipList as country}
										<button
											type="button"
											class="cursor-pointer w-full text-left px-3 py-1.5 rounded-xl text-sm hover:bg-white/10 transition {editingCrew
												?.passport.country === country
												? 'text-lime font-bold'
												: 'text-white'}"
											on:click={() => selectCitizenship(country)}
										>
											{country}
										</button>
									{:else}
										<p class="px-3 py-2 text-xs text-gray2">No matches</p>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>

				<div>
					<span class={labelCls}>Country of Birth</span>
					<div
						class="relative mt-1"
						use:clickOutside
						on:outclick={() => openMenu === 'birth' && (openMenu = null)}
					>
						<button
							type="button"
							class="cursor-pointer {inputCls} flex items-center justify-between text-left"
							on:click={() => (openMenu = openMenu === 'birth' ? null : 'birth')}
						>
							<span
								class={editingCrew?.passport.country_birth ? 'text-white' : 'text-gray2 truncate'}
								>{editingCrew?.passport.country_birth || 'Select…'}</span
							>
							<svg
								class="w-4 h-4 text-gray2 shrink-0"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"><path d="M6 9l6 6 6-6" /></svg
							>
						</button>
						{#if openMenu === 'birth'}
							<div
								class="absolute z-30 right-0 mt-2 w-[200%] max-w-sm bg-[#1a1a1a] rounded-2xl p-1.5 shadow-xl"
							>
								<input
									class="w-full bg-black/40 rounded-full px-3 py-1.5 text-sm text-white placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime mb-1"
									placeholder="Search…"
									bind:value={birthSearch}
								/>
								<div class="max-h-48 overflow-y-auto">
									{#each birthList as country}
										<button
											type="button"
											class="cursor-pointer w-full text-left px-3 py-1.5 rounded-xl text-sm hover:bg-white/10 transition {editingCrew
												?.passport.country_birth === country
												? 'text-lime font-bold'
												: 'text-white'}"
											on:click={() => selectCountryBirth(country)}
										>
											{country}
										</button>
									{:else}
										<p class="px-3 py-2 text-xs text-gray2">No matches</p>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div style="grid-column:2; grid-row:7;" class="grid grid-cols-2 gap-3 pb-2">
				<label class="block">
					<span class={labelCls}>Date of Birth</span>
					<input
						class="mt-1 {inputCls}"
						placeholder="YYYY-MM-DD"
						bind:value={editingCrew.passport.date_of_birth}
					/>
				</label>
				<label class="block">
					<span class={labelCls}>Passport Number</span>
					<input class="mt-1 {inputCls}" bind:value={editingCrew.passport.number} />
				</label>
			</div>

			<div class="flex items-center justify-between pb-2" style="grid-column:2; grid-row:8;">
				<span class="text-sm text-gray3"
					>Active <span class="text-gray2">(shows up in crew pickers)</span></span
				>
				<Toggle bind:checked={editingCrew.is_active} />
			</div>
		</div>

		<div class="flex items-center justify-between pt-6">
			<div>
				{#if !isNewCrew}
					<button
						type="button"
						class="cursor-pointer px-4 py-2.5 rounded-full bg-problem/10 text-problem text-sm font-bold hover:bg-problem hover:text-black transition"
						on:click={() => removeCrewMember(editingCrew!)}
					>
						Delete Member
					</button>
				{/if}
			</div>
			<div class="flex gap-3">
				<button
					class="cursor-pointer px-4 py-2.5 rounded-full bg-gray3 text-black text-sm font-bold hover:opacity-90 transition"
					on:click={cancelEdit}
				>
					Cancel
				</button>
				<button
					class="cursor-pointer px-5 py-2.5 rounded-full bg-lime text-black text-sm font-bold hover:opacity-90 transition disabled:opacity-40"
					disabled={saving || !isValid}
					on:click={saveCrewMember}
				>
					{saving ? 'Saving…' : isNewCrew ? 'Create member' : 'Save changes'}
				</button>
			</div>
		</div>
	</div>
{/if}
{#if memberToDelete}
    <div transition:fade={{ duration: 200 }} class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        
        <div class="absolute inset-0" on:click={cancelDelete} on:keydown={(e) => e.key === 'Escape' && cancelDelete()} role="button" tabindex="0" aria-label="Close modal"></div>
        
        <div transition:fly={{ y: 30, duration: 300 }} class="relative bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl z-10">
            <h3 class="text-sm font-black uppercase tracking-wider text-problem mb-3">Confirm Deletion</h3>
            
            <p class="text-sm text-gray2 mb-6">
                Are you sure you want to remove <strong class="text-white">{memberToDelete.name || `${memberToDelete.first_name} ${memberToDelete.last_name}`.trim()}</strong> from the crew list? This action cannot be undone.
            </p>
            
            <div class="flex items-center justify-end gap-3">
                <button 
                    type="button"
                    class="cursor-pointer px-4 py-2.5 rounded-full bg-gray3 text-black text-sm font-bold hover:opacity-90 transition" 
                    on:click={cancelDelete}
                    disabled={isDeleting}
                >
                    Cancel
                </button>
                <button 
                    type="button"
                    class="cursor-pointer px-5 py-2.5 rounded-full bg-problem text-black text-sm font-bold hover:opacity-90 transition disabled:opacity-40" 
                    on:click={confirmDelete}
                    disabled={isDeleting}
                >
                    {isDeleting ? 'Deleting...' : 'Delete Member'}
                </button>
            </div>
        </div>
    </div>
{/if}