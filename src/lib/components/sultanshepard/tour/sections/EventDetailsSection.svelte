<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type {
		EventDetailsData,
		SSCrew,
		SSTourDate,
		SetTimeRow,
		MediaCrewRow
	} from '$lib/types/tour';
	import Field from '../ui/Field.svelte';
	import Toggle from '../ui/Toggle.svelte';

	export let data: EventDetailsData = {};
	export let crew: SSCrew[] = [];
	export let tourDate: SSTourDate | null = null;

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);
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
	const selectClasses =
		'w-full bg-gray1 rounded-xl px-2.5 h-9 text-sm text-white outline-none border border-transparent focus:border-lime/60 cursor-pointer appearance-none';

	// ============================================================
	// CONTACTS — preloaded roles (deletable, won't re-seed after init)
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
	// CREW LIST — artists always loaded by default + persisted.
	// Display order: Artist, Management, Production, Media.
	// (Singers have their own section below.)
	// ============================================================
	const CREW_TYPE_ORDER: Record<string, number> = { artist: 0, management: 1, prod: 2, media: 3 };
	const CREW_TYPE_LABEL: Record<string, string> = {
		artist: 'Artist',
		management: 'Management',
		prod: 'Production',
		media: 'Media'
	};

	$: activeCrew = crew.filter((c) => c.is_active !== false);

	// Auto-load artists once and persist to DB
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

	// Crew available to add (no singers — they have their own section)
	$: availableCrew = activeCrew
		.filter((c) => c.crew_type !== 'singer' && !(data.crew_ids || []).includes(c.id))
		.sort(
			(a, b) =>
				(CREW_TYPE_ORDER[a.crew_type] ?? 9) - (CREW_TYPE_ORDER[b.crew_type] ?? 9) ||
				a.name.localeCompare(b.name)
		);

	let crewToAdd = '';
	function addCrewMember() {
		if (!crewToAdd) return;
		data.crew_ids = [...(data.crew_ids || []), crewToAdd];
		crewToAdd = '';
		changed();
	}
	function removeCrewMember(id: string) {
		data.crew_ids = (data.crew_ids || []).filter((c) => c !== id);
		changed();
	}

	// ============================================================
	// SET TIMES — Time | Length | Description, drag & drop reorder,
	// time format + up/down nudge logic adapted from SetTimesModal.
	// ============================================================
	const DEFAULT_SET_TIMES = [
		'Load In',
		'Lunch',
		'Soundcheck S+S',
		'Soundcheck Singers',
		'Programming',
		'Video Check',
		'Doors',
		'Performance',
		'Diner',
		'Curfew',
		'Load Out'
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
					// sensible defaults for a show day
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

	// Length = gap until the next row. Negative gaps assume midnight crossing.
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
			if (diff < 0) diff += 1440; // crossed midnight
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
	// SINGERS — toggle + select from crew (singer roles only)
	// ============================================================
	$: singerCrew = activeCrew.filter((c) => c.crew_type === 'singer');
	$: assignedSingers = (data.singer_crew_ids || [])
		.map((id) => singerCrew.find((c) => c.id === id))
		.filter((c): c is SSCrew => !!c);
	$: availableSingers = singerCrew.filter((c) => !(data.singer_crew_ids || []).includes(c.id));

	let singerToAdd = '';
	function addSinger() {
		if (!singerToAdd) return;
		data.singer_crew_ids = [...(data.singer_crew_ids || []), singerToAdd];
		singerToAdd = '';
		changed();
	}
	function removeSinger(id: string) {
		data.singer_crew_ids = (data.singer_crew_ids || []).filter((s) => s !== id);
		changed();
	}

	// ============================================================
	// MEDIA CREW — toggle, Videographer + Photographer by default,
	// each row can be linked to a crew member.
	// ============================================================
	$: if (data.media_crew_enabled && !(data.media_crew || []).length) {
		data.media_crew = [
			{ id: uid(), role: 'Videographer', crew_id: null },
			{ id: uid(), role: 'Photographer', crew_id: null }
		];
		changed();
	}

	function addMediaCrew() {
		data.media_crew = [...(data.media_crew || []), { id: uid(), role: '', crew_id: null }];
		changed();
	}
	function removeMediaCrew(row: MediaCrewRow) {
		data.media_crew = (data.media_crew || []).filter((r) => r.id !== row.id);
		changed();
	}

	// Media-type crew first in the dropdowns, then everyone else
	$: mediaSelectableCrew = [...activeCrew].sort((a, b) => {
		const am = a.crew_type === 'media' ? 0 : 1;
		const bm = b.crew_type === 'media' ? 0 : 1;
		return am - bm || a.name.localeCompare(b.name);
	});
</script>

<div class="space-y-7">
	<!-- ============================================ -->
	<!-- TOP — 2 columns: Informations | Date + Access -->
	<!-- ============================================ -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<!-- LEFT — Venue / Address -->
		<div class="bg-gray1/30 rounded-xl p-4 space-y-3">
			<div class="flex items-baseline gap-2">
				<span class="text-[12px] font-bold uppercase tracking-wider text-gray2 w-16 shrink-0">Date</span>
				<span class="text-sm text-white font-bold">{tourDate?.date || '—'}</span>
				
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-[12px] font-bold uppercase tracking-wider text-gray2 w-16 shrink-0">Venue</span>
				<span class="text-sm text-white font-bold">{tourDate?.venue || '—'}</span>
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-[12px] font-bold uppercase tracking-wider text-gray2 w-16 shrink-0">Address</span>
				<span class="text-sm text-white">{tourDate?.address?.full_address || '—'}</span>
			</div>
		</div>

		<!-- RIGHT — Date + Artist Entrance -->
		<div class="bg-gray1/30 rounded-xl p-4 flex flex-col gap-3 h-full">
	
			<div class="flex flex-col flex-1">
				<span class="block text-[12px] font-bold uppercase tracking-wider text-gray2 mb-1.5">
					Artist Entrance / Accreditation
				</span>
				<input
					class="{inputClasses} flex-1 h-auto py-2"
					style="align-self: stretch;"
					bind:value={data.artist_entrance}
					placeholder="Address, door, wristbands, contact, etc. "
					on:change={changed}
				/>
			</div>
		</div>
	</div>

	<!-- ============================================ -->
	<!-- CONTACTS — full width: Role | Full Name | Email | Phone -->
	<!-- ============================================ -->
	<div>
		<div class="flex items-center justify-between mb-2">
			<span class="text-[13px] font-bold uppercase tracking-wider text-gray2">Contacts</span>
			<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={addContact}>
				+ Add contact
			</button>
		</div>

		{#if (data.contacts || []).length}
			<div class="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5 px-1 mb-1">
				<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Role</span>
				<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Full Name</span>
				<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Email</span>
				<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Phone</span>
				<span class="w-6"></span>
			</div>
		{/if}

		<div class="space-y-1">
			{#each data.contacts || [] as contact, i}
				<div class="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
					<Field small bind:value={contact.role} placeholder="Role" on:change={changed} />
					<Field small bind:value={contact.name} placeholder="Full name" on:change={changed} />
					<Field small type="email" bind:value={contact.email} placeholder="Email" on:change={changed} />
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
				<p class="text-xs text-gray2 italic">No contacts yet — add main, production, hospitality, runner.</p>
			{/each}
		</div>
	</div>

	<!-- ============================================ -->
	<!-- INSTRUCTIONS — 3 columns side by side -->
	<!-- ============================================ -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
		<!-- Load-in -->
		<div>
			<span class="text-[11px] font-bold uppercase tracking-wider text-gray2 mb-2 h-5 flex items-center">
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

		<!-- Parking -->
		<div>
			<span class="text-[11px] font-bold uppercase tracking-wider text-gray2 mb-2 h-5 flex items-center">
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

		<!-- Bus parking (toggleable — grays out when off) -->
		<div>
			<div class="mb-2 h-5 flex items-center">
				<Toggle
					label="Bus Parking Instructions"
					checked={data.bus_parking_enabled ?? true}
					on:change={(e) => {
						data.bus_parking_enabled = e.detail;
						changed();
					}}
				/>
			</div>
			<div
				class="transition-opacity {(data.bus_parking_enabled ?? true)
					? ''
					: 'opacity-40 pointer-events-none select-none'}"
			>
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

	<!-- ============================================ -->
	<!-- CREW LIST | SET TIMES — 2 columns -->
	<!-- ============================================ -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
		<!-- LEFT — Crew List -->
		<div>
			<div class="flex items-center justify-between mb-2">
				<span class="text-[13px] font-bold uppercase tracking-wider text-gray2">Crew List</span>
			</div>

			{#if activeCrew.length}
				{#if assignedCrew.length}
					<div class="grid grid-cols-[1fr_1.4fr_auto] gap-2 px-2 mb-1">
						<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Role</span>
						<span class="text-[10px] font-bold uppercase tracking-wider text-gray2/70">Full Name</span>
						<span class="w-6"></span>
					</div>
				{/if}
				<div class="space-y-1.5">
					{#each assignedCrew as member (member.id)}
						<div class="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center bg-gray1/30 rounded-xl px-3 py-2">
							<span class="text-xs font-bold {member.crew_type === 'artist' ? 'text-lime' : 'text-gray2'}">
								{member.role || CREW_TYPE_LABEL[member.crew_type] || member.crew_type}
							</span>
							<span class="text-sm text-white truncate">{member.name}</span>
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

				{#if availableCrew.length}
					<div class="flex gap-2 mt-2">
						<select class={selectClasses} bind:value={crewToAdd}>
							<option value="" disabled selected>Add crew from settings…</option>
							{#each availableCrew as member (member.id)}
								<option value={member.id}>
									{member.name} — {member.role || CREW_TYPE_LABEL[member.crew_type] || member.crew_type}
								</option>
							{/each}
						</select>
						<button
							type="button"
							class="shrink-0 px-3 h-9 rounded-xl bg-lime text-black text-xs font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
							disabled={!crewToAdd}
							on:click={addCrewMember}
						>
							Add
						</button>
					</div>
				{/if}
			{:else}
				<p class="text-xs text-gray2 italic">No crew in settings yet — add your crew list in App Settings.</p>
			{/if}
		</div>

		<!-- RIGHT — Set Times -->
		<div>
			<div class="flex items-center justify-between mb-2">
				<span class="text-[13px] font-bold uppercase tracking-wider text-gray2">Set Times</span>
				<div class="flex gap-3">
					{#if !(data.set_times || []).length}
						<button type="button" class="px-3 py-1 rounded-full bg-gray3 text-black text-xs font-bold hover:brightness-110 transition-all cursor-pointer" on:click={loadSetTimesTemplate}>
							Load template
						</button>
					{/if}
					<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={addSetTime}>
						+ Add row
					</button>
				</div>
			</div>

			{#if (data.set_times || []).length}
				<div class="grid grid-cols-[auto_92px_56px_1fr_auto] gap-2 px-2 mb-1 items-center">
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
						class="grid grid-cols-[auto_92px_56px_1fr_auto] gap-2 items-center bg-gray1/30 border border-transparent rounded-xl px-2 py-1.5 transition-all
							{draggedIndex === index ? 'opacity-50' : ''}
							{dragOverIndex === index && draggedIndex !== index ? 'border-lime/60' : ''}"
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, index)}
						on:dragover={(e) => handleDragOver(e, index)}
						on:dragleave={handleDragLeave}
						on:drop={(e) => handleDrop(e, index)}
						on:dragend={handleDragEnd}
					>
						<!-- drag handle + time nudge -->
						<div class="flex items-center gap-0.5 w-9">
							<button class="cursor-move text-gray2 hover:text-white shrink-0" aria-label="Drag to reorder">
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
									<path d="M9 5h2v2H9zm4 0h2v2h-2zM9 9h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2zm-4 4h2v2H9zm4 0h2v2h-2z" />
								</svg>
							</button>
							<div class="flex flex-col shrink-0">
								<button type="button" class="text-gray2 hover:text-lime cursor-pointer leading-none" aria-label="Increase time" on:click={() => adjustTime(row, 'up')}>
									<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6" /></svg>
								</button>
								<button type="button" class="text-gray2 hover:text-lime cursor-pointer leading-none" aria-label="Decrease time" on:click={() => adjustTime(row, 'down')}>
									<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6" /></svg>
								</button>
							</div>
						</div>

						<!-- time -->
						<input
							type="text"
							class="w-full bg-gray1 rounded-lg px-2 h-8 text-xs text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60"
							bind:value={row.time}
							placeholder="3:00PM"
							on:blur={() => formatTimeInput(row)}
						/>

						<!-- length (computed) -->
						<span class="text-[11px] text-gray2 text-center">{row.length || '—'}</span>

						<!-- description -->
						<input
							type="text"
							class="w-full bg-gray1 rounded-lg px-2 h-8 text-xs text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60"
							bind:value={row.label}
							placeholder="Description"
							on:change={changed}
						/>

						<!-- delete -->
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
					<p class="text-xs text-gray2 italic">No set times yet — load the template or add a row.</p>
				{/each}
			</div>
		</div>
	</div>

	<!-- ============================================ -->
	<!-- SINGERS CREW | MEDIA CREW — 2 columns -->
	<!-- ============================================ -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
		<!-- LEFT — Singers Crew -->
		<div>
			<div class="mb-2 h-5 flex items-center">
				<Toggle
					label="Singers Crew"
					checked={data.singers_enabled}
					on:change={(e) => {
						data.singers_enabled = e.detail;
						changed();
					}}
				/>
			</div>

			<div class="transition-opacity {data.singers_enabled ? '' : 'opacity-40 pointer-events-none select-none'}">
				<div class="space-y-1.5">
					{#each assignedSingers as singer (singer.id)}
						<div class="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center bg-gray1/30 rounded-xl px-3 py-2">
							<span class="text-xs font-bold text-gray2">{singer.role || 'Singer'}</span>
							<span class="text-sm text-white truncate">{singer.name}</span>
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
							<p class="text-xs text-gray2 italic">No singers added yet.</p>
						{/if}
					{/each}
				</div>

				{#if singerCrew.length}
					{#if availableSingers.length}
						<div class="flex gap-2 mt-2">
							<select class={selectClasses} bind:value={singerToAdd} disabled={!data.singers_enabled}>
								<option value="" disabled selected>Add singer from crew list…</option>
								{#each availableSingers as singer (singer.id)}
									<option value={singer.id}>{singer.name}{singer.role ? ` — ${singer.role}` : ''}</option>
								{/each}
							</select>
							<button
								type="button"
								class="shrink-0 px-3 h-9 rounded-xl bg-lime text-black text-xs font-bold hover:brightness-110 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
								disabled={!singerToAdd || !data.singers_enabled}
								on:click={addSinger}
							>
								Add
							</button>
						</div>
					{/if}
				{:else if data.singers_enabled}
					<p class="text-xs text-gray2 italic mt-2">No singer roles in your crew settings yet.</p>
				{/if}
			</div>
		</div>

		<!-- RIGHT — Media Crew -->
		<div>
			<div class="flex items-center justify-between mb-2 h-5">
				<Toggle
					label="Media Crew"
					checked={data.media_crew_enabled}
					on:change={(e) => {
						data.media_crew_enabled = e.detail;
						changed();
					}}
				/>
				{#if data.media_crew_enabled}
					<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={addMediaCrew}>
						+ Add row
					</button>
				{/if}
			</div>

			<div class="transition-opacity {data.media_crew_enabled ? '' : 'opacity-40 pointer-events-none select-none'}">
				<div class="space-y-1.5">
					{#each data.media_crew || [] as row (row.id)}
						<div class="grid grid-cols-[1fr_1.4fr_auto] gap-2 items-center bg-gray1/30 rounded-xl p-2">
							<input
								class="w-full bg-gray1 rounded-lg px-2 h-8 text-xs text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60"
								bind:value={row.role}
								placeholder="Role (Videographer, Photographer)"
								on:change={changed}
							/>
							<select
								class="w-full bg-gray1 rounded-lg px-2 h-8 text-xs text-white outline-none border border-transparent focus:border-lime/60 cursor-pointer appearance-none"
								bind:value={row.crew_id}
								on:change={changed}
							>
								<option value={null}>Select from crew list…</option>
								{#each mediaSelectableCrew as member (member.id)}
									<option value={member.id}>
										{member.name}{member.role ? ` — ${member.role}` : ''}
									</option>
								{/each}
							</select>
							<button
								type="button"
								class="text-gray2 hover:text-problem p-1 cursor-pointer"
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
</div>