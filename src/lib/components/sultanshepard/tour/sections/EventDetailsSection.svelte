<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type {
		EventDetailsData,
		SSCrew,
		SSTourDate,
		SetTimeRow,
		MediaCrewRow
	} from '$lib/types/tour';
	import Field from '../ui/Field.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import CrewPickerModal from './CrewPickerModal.svelte';
	import { countCrew } from '../progress';

	export let data: EventDetailsData = {};
	export let crew: SSCrew[] = [];
	export let tourDate: SSTourDate | null = null;

	// Non-artist crew assigned — the artist is always auto-present, so
	// they never count toward the "2+ crew" requirement or its display.
	$: nonArtistCrewCount = countCrew(data.crew_ids, crew, { exclude: ['artist'] });

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);

	// By reassigning the data object here, Svelte fires cross-component reactivity, syncing progress real-time with TourTabsPanel.
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	// ============================================================
	// AUTOSIZE — textareas keep a min height and grow with content
	// ============================================================
	function autosize(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		node.addEventListener('input', resize);
		requestAnimationFrame(resize);
		return {
			destroy() {
				node.removeEventListener('input', resize);
			}
		};
	}

	const textareaClasses =
		'w-full bg-gray1 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60 resize-none min-h-[110px] overflow-hidden transition-colors';
	const inputClasses =
		'w-full bg-gray1 rounded-xl px-3 h-9 text-sm text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60';
	const addButtonCls =
		'cursor-pointer px-3 py-1 rounded-full bg-lime text-black text-xs font-bold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed';
	const crewGridCls = 'grid-cols-[85px_1fr_1.2fr_100px_28px]';

	// ============================================================
	// PER-SECTION RESET — small reusable triple-confirm state machine.
	// ============================================================
	const RESET_LABELS = ['Reset', 'Are you sure?', 'Confirm'];
	let contactsResetStage: 0 | 1 | 2 = 0;
	let crewResetStage: 0 | 1 | 2 = 0;
	let singersResetStage: 0 | 1 | 2 = 0;
	let mediaResetStage: 0 | 1 | 2 = 0;
	let runOfShowResetStage: 0 | 1 | 2 = 0;

	let contactsResetTimer: ReturnType<typeof setTimeout>;
	let crewResetTimer: ReturnType<typeof setTimeout>;
	let singersResetTimer: ReturnType<typeof setTimeout>;
	let mediaResetTimer: ReturnType<typeof setTimeout>;
	let runOfShowResetTimer: ReturnType<typeof setTimeout>;

	function clickReset(section: 'contacts' | 'crew' | 'singers' | 'media' | 'runOfShow') {
		const getStage = () =>
			section === 'contacts'
				? contactsResetStage
				: section === 'crew'
					? crewResetStage
					: section === 'singers'
						? singersResetStage
						: section === 'media'
							? mediaResetStage
							: runOfShowResetStage;

		const setStage = (v: 0 | 1 | 2) => {
			if (section === 'contacts') contactsResetStage = v;
			else if (section === 'crew') crewResetStage = v;
			else if (section === 'singers') singersResetStage = v;
			else if (section === 'media') mediaResetStage = v;
			else runOfShowResetStage = v;
		};

		const clearTimer = () => {
			if (section === 'contacts') clearTimeout(contactsResetTimer);
			else if (section === 'crew') clearTimeout(crewResetTimer);
			else if (section === 'singers') clearTimeout(singersResetTimer);
			else if (section === 'media') clearTimeout(mediaResetTimer);
			else clearTimeout(runOfShowResetTimer);
		};

		const setTimer = (t: ReturnType<typeof setTimeout>) => {
			if (section === 'contacts') contactsResetTimer = t;
			else if (section === 'crew') crewResetTimer = t;
			else if (section === 'singers') singersResetTimer = t;
			else if (section === 'media') mediaResetTimer = t;
			else runOfShowResetTimer = t;
		};

		clearTimer();
		const current = getStage();
		if (current < 2) {
			setStage((current + 1) as 1 | 2);
			setTimer(setTimeout(() => setStage(0), 4000));
			return;
		}

		setStage(0);
		if (section === 'contacts') resetContacts();
		else if (section === 'crew') resetCrewList();
		else if (section === 'singers') resetSingers();
		else if (section === 'media') resetMedia();
		else resetRunOfShow();
	}

	function resetContacts() {
		data.contacts = [];
		data.contacts_initialized = false;
		changed();
	}
	function resetCrewList() {
		data.crew_ids = activeCrew.filter((c) => c.crew_type === 'artist').map((c) => c.id);
		changed();
	}
	function resetSingers() {
		data.singers_enabled = false;
		data.singer_crew_ids = [];
		changed();
	}
	function resetMedia() {
		data.media_crew_enabled = false;
		data.media_crew = [];
		changed();
	}
	function resetRunOfShow() {
		data.set_times = [];
		changed();
	}

	onDestroy(() => {
		clearTimeout(contactsResetTimer);
		clearTimeout(crewResetTimer);
		clearTimeout(singersResetTimer);
		clearTimeout(mediaResetTimer);
		clearTimeout(runOfShowResetTimer);
	});

	// ============================================================
	// CONTACTS
	// ============================================================
	const DEFAULT_CONTACT_ROLES = ['Main Contact', 'Production', 'Hospitality', 'Runner'];

	$: if (!data.contacts_initialized && !(data.contacts || []).length) {
		data.contacts = DEFAULT_CONTACT_ROLES.map((role) => ({
			role,
			name: '',
			email: '',
			phone: ''
		}));
		data.contacts_initialized = true;
		changed();
	}

	function addContact() {
		data.contacts = [...(data.contacts || []), { role: '', name: '', email: '', phone: '' }];
		changed();
	}
	function removeContact(i: number) {
		data.contacts = (data.contacts || []).filter((_, idx) => idx !== i);
		changed();
	}

	// ============================================================
	// CREW LIST
	// ============================================================
	const CREW_TYPE_ORDER: Record<string, number> = { artist: 0, management: 1, prod: 2, media: 3 };
	const CREW_TYPE_LABEL: Record<string, string> = {
		artist: 'Artist',
		management: 'Management',
		prod: 'Production',
		media: 'Media'
	};

	$: activeCrew = crew.filter((c) => c.is_active !== false);

	$: if (!data.crew_ids && activeCrew.length) {
		data.crew_ids = activeCrew.filter((c) => c.crew_type === 'artist').map((c) => c.id);
		changed();
	}

	$: assignedCrew = (data.crew_ids || [])
		.map((id) => activeCrew.find((c) => c.id === id))
		.filter((c): c is SSCrew => !!c)
		.sort(
			(a, b) =>
				(CREW_TYPE_ORDER[a.crew_type] ?? 9) - (CREW_TYPE_ORDER[b.crew_type] ?? 9) ||
				(a.sort_order ?? 0) - (b.sort_order ?? 0) ||
				a.name.localeCompare(b.name)
		);

	$: crewPickerOptions = activeCrew.filter((c) => c.crew_type !== 'singer');

	let showCrewPicker = false;

	function addCrewMember(member: SSCrew) {
		data.crew_ids = [...(data.crew_ids || []), member.id];
		changed();
	}
	function removeCrewMember(id: string) {
		data.crew_ids = (data.crew_ids || []).filter((c) => c !== id);
		changed();
	}

	// ============================================================
	// SET TIMES
	// ============================================================
	const DEFAULT_SET_TIMES = [
		'Load In', 'Setup', 'Lunch', 'Programming', 'Video Check',
		'Soundcheck S+S', 'Soundcheck Singers', 'Diner', 'Doors',
		'Support Show', 'S+S Show', 'Curfew', 'Tear Down', 'Load Out'
	];

	function loadSetTimesTemplate() {
		data.set_times = DEFAULT_SET_TIMES.map((label) => ({ id: uid(), label, time: '' }));
		changed();
	}
	function addSetTime() {
		data.set_times = [...(data.set_times || []), { id: uid(), label: '', time: '' }];
		changed();
	}
	function removeSetTime(row: SetTimeRow) {
		data.set_times = (data.set_times || []).filter((r) => r.id !== row.id);
		recalcLengths();
		changed();
	}

	function parseTime(timeStr: string): { hours: number; minutes: number } | null {
		const match = (timeStr || '').match(/^(\d{1,2}):(\d{2})(AM|PM)$/i);
		if (!match) return null;
		let hours = parseInt(match[1]);
		const minutes = parseInt(match[2]);
		const period = match[3].toUpperCase();
		if (period === 'PM' && hours !== 12) hours += 12;
		if (period === 'AM' && hours === 12) hours = 0;
		return { hours, minutes };
	}

	function formatTime(input: string): string | null {
		const cleaned = (input || '').replace(/\s/g, '').toUpperCase();
		const patterns = [/^(\d{1,2}):?(\d{2})?(AM|PM)?$/, /^(\d{1,2})(AM|PM)$/];

		for (const pattern of patterns) {
			const match = cleaned.match(pattern);
			if (match) {
				let hours = parseInt(match[1]);
				const minutes = match[2] && /^\d+$/.test(match[2]) ? parseInt(match[2]) : 0;
				let period = match[3] || (match[2] && !/^\d+$/.test(match[2]) ? match[2] : '') || '';
				if (!period.includes('AM') && !period.includes('PM')) {
					if (hours >= 8 && hours <= 11) period = 'AM';
					else if (hours === 12) period = 'PM';
					else period = 'PM';
				}
				if (hours === 0) hours = 12;
				if (hours > 12) {
					hours -= 12;
					period = 'PM';
				}
				return `${hours}:${minutes.toString().padStart(2, '0')}${period}`;
			}
		}
		return null;
	}

	function toDisplay(totalMinutes: number): string {
		const m = ((totalMinutes % 1440) + 1440) % 1440;
		let hours = Math.floor(m / 60);
		const minutes = m % 60;
		const period = hours >= 12 ? 'PM' : 'AM';

		hours = hours % 12;
		if (hours === 0) hours = 12;
		return `${hours}:${minutes.toString().padStart(2, '0')}${period}`;
	}

	function adjustTime(row: SetTimeRow, direction: 'up' | 'down') {
		const parsed = parseTime(row.time) ?? { hours: 12, minutes: 0 };
		const total = parsed.hours * 60 + parsed.minutes + (direction === 'up' ? 15 : -15);
		row.time = toDisplay(total);
		recalcLengths();
		changed();
	}

	function formatTimeInput(row: SetTimeRow) {
		const formatted = formatTime(row.time);
		if (formatted) row.time = formatted;
		recalcLengths();
		changed();
	}

	function recalcLengths() {
		const rows = data.set_times || [];
		for (let i = 0; i < rows.length; i++) {
			if (i === rows.length - 1) {
				rows[i].length = '';
				continue;
			}
			const cur = parseTime(rows[i].time);
			const next = parseTime(rows[i + 1].time);
			if (!cur || !next) {
				rows[i].length = '';
				continue;
			}
			let diff = next.hours * 60 + next.minutes - (cur.hours * 60 + cur.minutes);
			if (diff < 0) diff += 1440;
			const hours = Math.floor(diff / 60);
			const mins = diff % 60;

			if (hours > 0 && mins > 0) rows[i].length = `${hours}h ${mins}m`;
			else if (hours > 0) rows[i].length = `${hours}h`;
			else rows[i].length = `${mins}m`;
		}
		data.set_times = [...rows];
	}

	// drag & drop
	let draggedIndex: number | null = null;
	let dragOverIndex: number | null = null;

	function handleDragStart(e: DragEvent, index: number) {
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', 'dragging');
			e.dataTransfer.effectAllowed = 'move';
		}
		draggedIndex = index;
	}
	function handleDragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverIndex = index;
	}
	function handleDragLeave() {
		dragOverIndex = null;
	}
	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();
		if (draggedIndex === null || draggedIndex === dropIndex) {
			draggedIndex = null;
			dragOverIndex = null;
			return;
		}
		const rows = [...(data.set_times || [])];
		const [item] = rows.splice(draggedIndex, 1);
		rows.splice(dropIndex, 0, item);
		data.set_times = rows;
		draggedIndex = null;
		dragOverIndex = null;
		recalcLengths();
		changed();
	}
	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	// ============================================================
	// SINGERS
	// ============================================================
	$: singerCrew = activeCrew.filter((c) => c.crew_type === 'singer');
	$: assignedSingers = (data.singer_crew_ids || [])
		.map((id) => singerCrew.find((c) => c.id === id))
		.filter((c): c is SSCrew => !!c);

	let showSingerPicker = false;

	function addSinger(member: SSCrew) {
		data.singer_crew_ids = [...(data.singer_crew_ids || []), member.id];
		changed();
	}
	function removeSinger(id: string) {
		data.singer_crew_ids = (data.singer_crew_ids || []).filter((s) => s !== id);
		changed();
	}

	// ============================================================
	// MEDIA CREW
	// ============================================================
	$: mediaSelectableCrew = activeCrew
		.filter((c) => c.crew_type === 'media')
		.sort((a, b) => a.name.localeCompare(b.name));

	let showMediaPicker = false;

	function addMediaRow(member: SSCrew) {
		data.media_crew = [
			...(data.media_crew || []),
			{ id: uid(), role: member.role || 'Media', crew_id: member.id }
		];
		changed();
	}
	function removeMediaCrew(row: MediaCrewRow) {
		data.media_crew = (data.media_crew || []).filter((r) => r.id !== row.id);
		changed();
	}

	function resetBtnCls(stage: 0 | 1 | 2) {
		const base =
			'cursor-pointer px-2.5 py-1 rounded-full border text-[12px] font-bold transition-all';
		if (stage === 0)
			return `${base} border-gray3/40 text-gray3 hover:border-problem hover:text-problem`;
		if (stage === 1) return `${base} border-problem/60 text-problem`;
		return `${base} border-problem bg-problem text-black`;
	}
</script>

<div class="space-y-7">

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div class="bg-gray1/30 rounded-xl p-4 space-y-3">
			<div class="flex items-baseline gap-2">
				<span class="text-[12px] font-bold uppercase tracking-wider text-lime w-16 shrink-0">Date</span>
				<span class="text-sm text-white font-bold">{tourDate?.date || '—'}</span>
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-[12px] font-bold uppercase tracking-wider text-lime w-16 shrink-0">Venue</span>
				<span class="text-sm text-white font-bold">{tourDate?.venue || '—'}</span>
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-[12px] font-bold uppercase tracking-wider text-lime w-16 shrink-0">Address</span>
				<span class="text-sm text-white">{tourDate?.address?.full_address || '—'}</span>
			</div>
		</div>

		<div class="bg-gray1/30 rounded-xl p-4 flex flex-col gap-3 h-full">
			<div class="flex flex-col flex-1">
				<span class="block text-[12px] font-bold uppercase tracking-wider text-lime mb-1.5">
					Artist Entrance / Accreditation
				</span>
				<input
					class="{inputClasses} flex-1 h-auto py-2"
					style="align-self: stretch;"
					bind:value={data.artist_entrance}
					placeholder="Address, door, wristbands, contact, etc. "
					on:input={changed}
				/>
			</div>
		</div>
	</div>

	<div>
		<div class="flex items-center justify-between mb-2">
			<span class="text-[13px] font-bold uppercase tracking-wider text-lime">Contacts</span>
			<div class="flex items-center gap-2">
				{#if (data.contacts || []).length > 0}
					<button
						type="button"
						class={resetBtnCls(contactsResetStage)}
						on:click={() => clickReset('contacts')}
					>
						{RESET_LABELS[contactsResetStage]}
					</button>
				{/if}
				<button type="button" class={addButtonCls} on:click={addContact}> + Add contact </button>
			</div>
		</div>

		{#if (data.contacts || []).length}
			<div class="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5 px-1 mb-1">
				<span class="text-[12px] pl-1 font-bold uppercase tracking-wider text-gray3">Role</span>
				<span class="text-[12px] pl-1 font-bold uppercase tracking-wider text-gray3">Full Name</span>
				<span class="text-[12px] pl-1 font-bold uppercase tracking-wider text-gray3">Email</span>
				<span class="text-[12px] pl-1 font-bold uppercase tracking-wider text-gray3">Phone</span>
				<span class="w-6"></span>
			</div>
		{/if}

		<div class="space-y-1">
			{#each data.contacts || [] as contact, i}
				<div class="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
					<Field small bind:value={contact.role} placeholder="Role" on:change={changed} />
					<Field small bind:value={contact.name} placeholder="Full name" on:change={changed} />
					<Field
						small
						type="email"
						bind:value={contact.email}
						placeholder="Email"
						on:change={changed}
					/>
					<Field small bind:value={contact.phone} placeholder="Phone" on:change={changed} />
					<button
						type="button"
						class="text-gray2 hover:text-problem p-1 cursor-pointer"
						aria-label="Remove contact"
						on:click={() => removeContact(i)}
					>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
					</button>
				</div>
			{:else}
				<p class="text-xs text-gray2 italic">
					No contacts yet — add main, production, hospitality, runner.
				</p>
			{/each}
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
		<div>
			<span class="text-[12px] font-bold uppercase tracking-wider text-gray3 pl-2 mb-2 h-5 flex items-center">
				Load-In Instructions
			</span>
			<textarea
				use:autosize
				class={textareaClasses}
				bind:value={data.load_in_instructions}
				placeholder="Dock access, ramp, elevator"
				on:change={changed}
			></textarea>
		</div>

		<div>
			<span class="text-[12px] font-bold uppercase tracking-wider text-gray3 pl-2 mb-2 h-5 flex items-center">
				Parking Instructions
			</span>
			<textarea
				use:autosize
				class={textareaClasses}
				bind:value={data.parking_instructions}
				placeholder="Where the van/cars park"
				on:change={changed}
			></textarea>
		</div>

		<div>
			<div class="mb-2 h-5 pl-2 flex items-center">
				<Toggle
					label="Bus Parking Instructions"
					checked={data.bus_parking_enabled ?? true}
					on:change={(e) => {
						data.bus_parking_enabled = e.detail;
						changed();
					}}
				/>
			</div>
			<div class="transition-opacity {(data.bus_parking_enabled ?? true) ? '' : 'opacity-40 pointer-events-none select-none'}">
				<textarea
					use:autosize
					class={textareaClasses}
					bind:value={data.bus_parking_instructions}
					placeholder="Bus parking instructions"
					disabled={!(data.bus_parking_enabled ?? true)}
					on:change={changed}
				></textarea>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-4 items-start">
		<div class="space-y-5">
			<div>
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center gap-2">
						<span class="text-[13px] font-bold uppercase tracking-wider text-gray3">Main Crew</span>
						<span class="text-[10px] font-bold {nonArtistCrewCount >= 2 ? 'text-confirmed' : 'text-gray2'}">
							{nonArtistCrewCount}/2 (excl. artist)
						</span>
					</div>
					<div class="flex items-center gap-2">
						{#if (data.crew_ids || []).length > 0}
							<button
								type="button"
								class={resetBtnCls(crewResetStage)}
								on:click={() => clickReset('crew')}
							>
								{RESET_LABELS[crewResetStage]}
							</button>
						{/if}
						<button type="button" class={addButtonCls} on:click={() => (showCrewPicker = true)}>
							+ Add crew
						</button>
					</div>
				</div>

				{#if activeCrew.length}
					{#if assignedCrew.length}
						<div class="grid {crewGridCls} gap-2 px-2 mb-1">
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Role</span>
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Full Name</span>
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Email</span>
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Phone</span>
							<span class="w-6"></span>
						</div>
					{/if}
					<div class="space-y-1">
						{#each assignedCrew as member (member.id)}
							<div class="grid {crewGridCls} gap-2 items-center bg-gray1/30 rounded-xl px-3 py-2">
								<span
									class="text-xs font-bold truncate {member.crew_type === 'artist' ? 'text-lime' : 'text-gray2'}"
								>
									{member.role || CREW_TYPE_LABEL[member.crew_type] || member.crew_type}
								</span>
								<span class="text-sm text-white truncate">{member.name}</span>
								<span class="text-xs text-gray2 truncate">{member.email || '—'}</span>
								<span class="text-xs text-gray2 truncate">{member.phone || '—'}</span>
								<button
									type="button"
									class="text-gray2 hover:text-problem p-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
									aria-label="Remove crew member"
									on:click={() => removeCrewMember(member.id)}
								>
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
								</button>
							</div>
						{:else}
							<p class="text-xs text-gray2 italic">No crew assigned to this show yet.</p>
						{/each}
					</div>
				{:else}
					<p class="text-xs text-gray2 italic">
						No crew in settings yet — add your crew list in App Settings.
					</p>
				{/if}
			</div>

			<div>
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center gap-2">
						<Toggle
							label="Singers Crew"
							checked={data.singers_enabled}
							on:change={(e) => {
								data.singers_enabled = e.detail;
								changed();
							}}
						/>
						{#if data.singers_enabled}
							<span class="text-[10px] font-bold {(data.singer_crew_ids || []).length >= 1 ? 'text-confirmed' : 'text-gray2'}">
								{(data.singer_crew_ids || []).length}/1
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						{#if data.singers_enabled && (data.singer_crew_ids || []).length > 0}
							<button
								type="button"
								class={resetBtnCls(singersResetStage)}
								on:click={() => clickReset('singers')}
							>
								{RESET_LABELS[singersResetStage]}
							</button>
						{/if}
						{#if data.singers_enabled}
							<button type="button" class={addButtonCls} on:click={() => (showSingerPicker = true)}>
								+ Add singer
							</button>
						{/if}
					</div>
				</div>

				<div class="transition-opacity {data.singers_enabled ? '' : 'opacity-40 pointer-events-none select-none'}">
					{#if assignedSingers.length}
						<div class="grid {crewGridCls} gap-2 px-2 mb-1">
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Role</span>
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Full Name</span>
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Email</span>
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Phone</span>
							<span class="w-6"></span>
						</div>
					{/if}
					<div class="space-y-1">
						{#each assignedSingers as singer (singer.id)}
							<div class="grid {crewGridCls} gap-2 items-center bg-gray1/30 rounded-xl px-3 py-2">
								<span class="text-xs font-bold text-gray2 truncate">{singer.role || 'Singer'}</span>
								<span class="text-sm text-white truncate">{singer.name}</span>
								<span class="text-xs text-gray2 truncate">{singer.email || '—'}</span>
								<span class="text-xs text-gray2 truncate">{singer.phone || '—'}</span>
								<button
									type="button"
									class="text-gray2 hover:text-problem p-1 cursor-pointer"
									aria-label="Remove singer"
									on:click={() => removeSinger(singer.id)}
								>
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
								</button>
							</div>
						{:else}
							{#if data.singers_enabled}
								<p class="text-xs text-gray2 italic">
									{singerCrew.length ? 'No singers added yet.' : 'No singer roles in your crew settings yet.'}
								</p>
							{/if}
						{/each}
					</div>
				</div>
			</div>

			<div>
				<div class="flex items-center justify-between mb-2">
					<div class="flex items-center gap-2">
						<Toggle
							label="Media Crew"
							checked={data.media_crew_enabled}
							on:change={(e) => {
								data.media_crew_enabled = e.detail;
								changed();
							}}
						/>
						{#if data.media_crew_enabled}
							<span class="text-[10px] font-bold {(data.media_crew || []).length >= 1 ? 'text-confirmed' : 'text-gray2'}">
								{(data.media_crew || []).length}/1
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						{#if data.media_crew_enabled && (data.media_crew || []).length > 0}
							<button
								type="button"
								class={resetBtnCls(mediaResetStage)}
								on:click={() => clickReset('media')}
							>
								{RESET_LABELS[mediaResetStage]}
							</button>
						{/if}
						{#if data.media_crew_enabled}
							<button type="button" class={addButtonCls} on:click={() => (showMediaPicker = true)}>
								+ Add media
							</button>
						{/if}
					</div>
				</div>

				<div class="transition-opacity {data.media_crew_enabled ? '' : 'opacity-40 pointer-events-none select-none'}">
					{#if (data.media_crew || []).length}
						<div class="grid {crewGridCls} gap-2 px-2 mb-1">
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Role</span>
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Full Name</span>
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Email</span>
							<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Phone</span>
							<span class="w-6"></span>
						</div>
					{/if}
					<div class="space-y-1">
						{#each data.media_crew || [] as row (row.id)}
							{@const linked = mediaSelectableCrew.find((m) => m.id === row.crew_id)}
							<div class="grid {crewGridCls} gap-2 items-center bg-gray1/30 rounded-xl px-2 py-1.5">
								<span class="text-xs font-bold text-gray2 truncate px-2">{linked?.role || row.role || 'Media'}</span>
								<span class="text-sm text-white truncate px-1">{linked?.name || '—'}</span>
								<span class="text-xs text-gray2 truncate">{linked?.email || '—'}</span>
								<span class="text-xs text-gray2 truncate">{linked?.phone || '—'}</span>
								<button
									type="button"
									class="text-gray2 hover:text-problem p-1 cursor-pointer shrink-0"
									aria-label="Remove media crew row"
									on:click={() => removeMediaCrew(row)}
								>
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
								</button>
							</div>
						{:else}
							{#if data.media_crew_enabled}
								<p class="text-xs text-gray2 italic">No media crew rows yet.</p>
							{/if}
						{/each}
					</div>
				</div>
			</div>
		</div>

		<div>
			<div class="flex items-center justify-between mb-2">
				<span class="text-[13px] font-bold uppercase tracking-wider text-gray2">Run of Show</span>
				<div class="flex items-center gap-2">
					{#if (data.set_times || []).length > 0}
						<button
							type="button"
							class={resetBtnCls(runOfShowResetStage)}
							on:click={() => clickReset('runOfShow')}
						>
							{RESET_LABELS[runOfShowResetStage]}
						</button>
					{/if}
					{#if !(data.set_times || []).length}
						<button
							type="button"
							class="px-3 py-1 rounded-full bg-gray3 text-black text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
							on:click={loadSetTimesTemplate}
						>
							Load template
						</button>
					{/if}
					<button type="button" class={addButtonCls} on:click={addSetTime}> + Add row </button>
				</div>
			</div>

			{#if (data.set_times || []).length}
				<div class="grid grid-cols-[auto_92px_40px_1fr_auto] gap-2 px-2 mb-1 items-center">
					<span class="w-9"></span>
					<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Time</span>
					<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70 text-center">Length</span>
					<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Description</span>
					<span class="w-6"></span>
				</div>
			{/if}

			<div class="space-y-1.5">
				{#each data.set_times || [] as row, index (row.id)}
					<div
						role="listitem"
						class="grid grid-cols-[auto_92px_36px_1fr_auto] gap-2 items-center bg-gray1/30 border border-transparent rounded-xl px-2 py-1.5 transition-all
							{draggedIndex === index ? 'opacity-50' : ''}
							{dragOverIndex === index && draggedIndex !== index ? 'border-lime/60' : ''}"
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, index)}
						on:dragover={(e) => handleDragOver(e, index)}
						on:dragleave={handleDragLeave}
						on:drop={(e) => handleDrop(e, index)}
						on:dragend={handleDragEnd}
					>
						<div class="flex items-center gap-0.5 w-9">
							<button class="cursor-move text-gray2 hover:text-white shrink-0" aria-label="Drag to reorder">
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M9 5h2v2H9zm4 0h2v2h-2zM9 9h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2z"/>
								</svg>
							</button>
							<div class="flex flex-col shrink-0">
								<button
									type="button"
									class="text-gray2 hover:text-lime cursor-pointer leading-none"
									aria-label="Increase time"
									on:click={() => adjustTime(row, 'up')}
								>
									<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6" /></svg>
								</button>
								<button
									type="button"
									class="text-gray2 hover:text-lime cursor-pointer leading-none"
									aria-label="Decrease time"
									on:click={() => adjustTime(row, 'down')}
								>
									<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6" /></svg>
								</button>
							</div>
						</div>

						<input
							type="text"
							class="w-full bg-gray1 rounded-lg px-2 h-8 text-xs text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60"
							bind:value={row.time}
							placeholder="00:00PM"
							on:blur={() => formatTimeInput(row)}
						/>

						<span class="text-[12px] text-gray2 text-center">{row.length || '—'}</span>

						<input
							type="text"
							class="w-full bg-gray1 rounded-lg px-2 h-8 text-xs text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60"
							bind:value={row.label}
							placeholder="Description"
							on:change={changed}
						/>

						<button
							type="button"
							class="text-gray2 hover:text-problem p-1 cursor-pointer"
							aria-label="Remove row"
							on:click={() => removeSetTime(row)}
						>
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
						</button>
					</div>
				{:else}
					<p class="text-xs text-gray2 italic">
						No set times yet — load the template or add a row.
					</p>
				{/each}
			</div>
		</div>
	</div>
</div>

<CrewPickerModal
	open={showCrewPicker}
	title="Add Crew"
	options={crewPickerOptions}
	assignedIds={data.crew_ids || []}
	on:pick={(e) => addCrewMember(e.detail)}
	on:remove={(e) => removeCrewMember(e.detail.id)}
	on:close={() => (showCrewPicker = false)}
/>

<CrewPickerModal
	open={showSingerPicker}
	title="Add Singer"
	options={singerCrew}
	assignedIds={data.singer_crew_ids || []}
	on:pick={(e) => addSinger(e.detail)}
	on:remove={(e) => removeSinger(e.detail.id)}
	on:close={() => (showSingerPicker = false)}
/>

<CrewPickerModal
	open={showMediaPicker}
	title="Add Media Crew"
	options={mediaSelectableCrew}
	assignedIds={(data.media_crew || []).map((r) => r.crew_id).filter((id): id is string => !!id)}
	on:pick={(e) => addMediaRow(e.detail)}
	on:remove={(e) => {
		const row = (data.media_crew || []).find((r) => r.crew_id === e.detail.id);
		if (row) removeMediaCrew(row);
	}}
	on:close={() => (showMediaPicker = false)}
/>