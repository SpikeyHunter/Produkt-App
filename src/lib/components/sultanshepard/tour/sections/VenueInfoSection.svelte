<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';
	import type { VenueInfoData, SSTourData, SSCrew, GreenRoom, CrewType } from '$lib/types/tour';
	import Toggle from '../ui/Toggle.svelte';

	export let data: VenueInfoData = {};
	export let tourData: SSTourData;
	export let crew: SSCrew[] = [];

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);

	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	// Sorted according to user request
	const VENUE_TYPES = ['Concert Hall', 'Theatre', 'Festival', 'Club', 'Other'];

	// --- Check if any crew is added ---
	$: hasAssignedCrew =
		(tourData?.event_details?.crew_ids?.length || 0) > 0 ||
		(tourData?.event_details?.singer_crew_ids?.length || 0) > 0 ||
		(tourData?.event_details?.media_crew?.length || 0) > 0;

	// --- Green room auto-assignment algorithm ---
	const CREW_SORT_ORDER: Record<string, number> = {
		artist: 1,
		prod: 2,
		media: 3,
		management: 4,
		singer: 5
	};

	function sortCrewList(list: SSCrew[]) {
		return list.sort((a, b) => {
			const orderA = CREW_SORT_ORDER[a.crew_type] || 99;
			const orderB = CREW_SORT_ORDER[b.crew_type] || 99;
			if (orderA !== orderB) return orderA - orderB;
			return a.name.localeCompare(b.name);
		});
	}

	function autoAssign(count: number): GreenRoom[] {
		const ed = tourData.event_details || {};
		const allAssigned: SSCrew[] = [];

		// Gather all assigned crew
		(ed.crew_ids || []).forEach((id) => {
			const c = crew.find((x) => x.id === id);
			if (c) allAssigned.push(c);
		});

		if (ed.media_crew_enabled) {
			(ed.media_crew || []).forEach((m) => {
				const c = crew.find((x) => x.id === m.crew_id);
				if (c) allAssigned.push(c);
				// Unlinked media row -> treat as generic media person
				else if (m.role) allAssigned.push({ id: uid(), name: m.role, crew_type: 'media' as CrewType } as SSCrew);
			});
		}

		if (ed.singers_enabled) {
			(ed.singer_crew_ids || []).forEach((id) => {
				const c = crew.find((x) => x.id === id);
				if (c) allAssigned.push(c);
			});
		}

		// Filter groups (Management goes with Artists)
		const artists = sortCrewList(allAssigned.filter((c) => c.crew_type === 'artist' || c.crew_type === 'management'));
		const prods = sortCrewList(allAssigned.filter((c) => c.crew_type === 'prod' || c.crew_type === 'media'));
		const singers = sortCrewList(allAssigned.filter((c) => c.crew_type === 'singer'));

		const mk = (name: string, arr: SSCrew[]): GreenRoom => ({ id: uid(), name, assigned: arr.map((c) => c.name) });

		if (count <= 1) {
			return [mk('Green Room - Everyone', sortCrewList([...allAssigned]))];
		}
		if (count === 2) {
			return [
				mk('Green Room - Artist', artists),
				mk('Green Room - Production & Singers', sortCrewList([...prods, ...singers]))
			];
		}

		// Count >= 3: Room 1 is Artist, Room 2 is Prod, rest is split evenly for Singers.
		const rooms: GreenRoom[] = [
			mk('Green Room - Artist', artists),
			mk('Green Room - Production', prods)
		];

		const numSingerRooms = count - 2;
		const singerBuckets: SSCrew[][] = Array.from({ length: numSingerRooms }, () => []);

		// Fairly distribute across available remaining buckets
		singers.forEach((s, i) => {
			singerBuckets[i % numSingerRooms].push(s);
		});

		for (let i = 0; i < numSingerRooms; i++) {
			const arr = singerBuckets[i];
			const label = arr.length === 1 ? arr[0].name : (arr.length > 1 ? `Singers` : `Singer ${i + 1}`);
			rooms.push(mk(`Green Room - ${label}`, arr));
		}

		return rooms;
	}

	// --- CRITICAL FIX: Reactive Syncing Block ---
	$: {
		const _crewDeps = tourData?.event_details;
		const _allCrew = crew;

		if (data.green_room && data.green_room_count) {
			const auto = autoAssign(data.green_room_count);
			let rooms = data.green_rooms || [];
			let modified = false;

			// 1. Sync Length
			if (rooms.length !== data.green_room_count) {
				if (rooms.length > data.green_room_count) {
					rooms = rooms.slice(0, data.green_room_count);
				} else {
					while (rooms.length < data.green_room_count) {
						rooms.push({ ...auto[rooms.length] });
					}
				}
				modified = true;
			}

			// 2. Sync Assignments & Names
			// Smart matcher to check if a name is system-generated so it can safely be overwritten 
			// when the count changes, without destroying genuinely typed custom names.
			const isStandardName = (name: string) => {
				if (!name) return true;
				if (/^Green Room( \d+)?$/.test(name)) return true; 
				if (name === 'Green Room 1 - Artist') return true;
				if (name === 'Green Room - Everyone') return true;
				if (name === 'Green Room - Artist') return true;
				if (name === 'Green Room - Production & Singers') return true;
				if (name === 'Green Room - Production') return true;
				if (name.startsWith('Green Room - Singer')) return true;
				if (crew.some(c => name === `Green Room - ${c.name}`)) return true;
				return false;
			};

			rooms.forEach((r, i) => {
				const freshAssigned = auto[i] ? auto[i].assigned : [];
				
				if (JSON.stringify(r.assigned) !== JSON.stringify(freshAssigned)) {
					r.assigned = freshAssigned;
					modified = true;
				}

				const freshName = auto[i] ? auto[i].name : `Green Room - ${i + 1}`;
				if (!data.green_room_is_custom || isStandardName(r.name)) {
					if (r.name !== freshName) {
						r.name = freshName;
						modified = true;
					}
				}
			});

			if (modified) {
				data.green_rooms = rooms;
			}
		}
	}

	function setGreenRoomCount(count: number) {
		data.green_room_count = count;
		changed();
	}

	function markCustom() {
		data.green_room_is_custom = true;
		changed();
	}

	function goToEventDetails() {
		dispatch('switchTab', 'event_details');
	}

	// --- Copy Logic ---
	let copiedAll = false;
	let copiedRoomId: string | null = null;

	function generateRoomText(room: GreenRoom) {
		let text = `${room.name}\n`;
		room.assigned.forEach((p) => {
			text += `- ${p}\n`;
		});
		return text.trim();
	}

	async function copyRoom(room: GreenRoom) {
		const text = generateRoomText(room);
		await navigator.clipboard.writeText(text);
		copiedRoomId = room.id;
		setTimeout(() => (copiedRoomId = null), 2000);
	}

	async function copyAllRooms() {
		if (!data.green_rooms) return;
		const text = data.green_rooms.map(generateRoomText).join('\n\n');
		await navigator.clipboard.writeText(text);
		copiedAll = true;
		setTimeout(() => (copiedAll = false), 2000);
	}

	// --- Custom Dropdown Logic ---
	let activeDropdown: 'indoor' | 'venue' | null = null;
	let dropdownNodeIndoor: HTMLElement;
	let dropdownNodeVenue: HTMLElement;

	function toggleDropdown(id: 'indoor' | 'venue') {
		activeDropdown = activeDropdown === id ? null : id;
	}

	function selectIndoor(val: string) {
		data.indoor_outdoor = val as any;
		activeDropdown = null;
		changed();
	}

	function selectVenue(val: string) {
		data.venue_type = val as any;
		if (val !== 'Other') data.venue_type_custom = '';
		activeDropdown = null;
		changed();
	}

	function handleWindowClick(e: MouseEvent) {
		if (activeDropdown === 'indoor' && dropdownNodeIndoor && !dropdownNodeIndoor.contains(e.target as Node)) {
			activeDropdown = null;
		}
		if (activeDropdown === 'venue' && dropdownNodeVenue && !dropdownNodeVenue.contains(e.target as Node)) {
			activeDropdown = null;
		}
	}

	// --- Clear Button Logic ---
	let wifiClearStage: 0 | 1 = 0;
	let notesClearStage: 0 | 1 = 0;
	let wifiClearTimer: ReturnType<typeof setTimeout>;
	let notesClearTimer: ReturnType<typeof setTimeout>;

	function handleClear(section: 'wifi' | 'notes') {
		if (section === 'wifi') {
			if (wifiClearStage === 0) {
				wifiClearStage = 1;
				wifiClearTimer = setTimeout(() => (wifiClearStage = 0), 3000);
			} else {
				data.wifi_login = '';
				data.wifi_password = '';
				wifiClearStage = 0;
				clearTimeout(wifiClearTimer);
				changed();
			}
		} else {
			if (notesClearStage === 0) {
				notesClearStage = 1;
				notesClearTimer = setTimeout(() => (notesClearStage = 0), 3000);
			} else {
				data.notes = '';
				notesClearStage = 0;
				clearTimeout(notesClearTimer);
				changed();
			}
		}
	}

	onDestroy(() => {
		clearTimeout(wifiClearTimer);
		clearTimeout(notesClearTimer);
	});
</script>

<svelte:window on:click={handleWindowClick} />

<div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
	<div>
		<div class="flex items-center justify-between mb-2">
			<span class="text-[13px] font-bold uppercase tracking-wider text-lime">Venue Details</span>
		</div>
		
		<div class="space-y-4 bg-gray1/30 rounded-xl p-4">
			
			<div class="grid grid-cols-2 gap-3">
				<div bind:this={dropdownNodeIndoor}>
					<span class="block text-[11px] font-bold uppercase tracking-wider text-gray3 mb-1.5 pl-1">Indoor / Outdoor</span>
					<div class="relative">
						<button type="button" class="w-full bg-gray1 rounded-full pl-3 pr-4 h-9 text-sm outline-none border border-transparent focus:border-lime/60 flex items-center justify-between cursor-pointer transition-colors" on:click|stopPropagation={() => toggleDropdown('indoor')}>
							<span class="truncate {data.indoor_outdoor ? 'text-white' : 'text-gray2/60'}">
								{data.indoor_outdoor === 'indoor' ? 'Indoor' : data.indoor_outdoor === 'outdoor' ? 'Outdoor' : 'Select...'}
							</span>
							<svg class="w-4 h-4 text-gray2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
						</button>
						
						{#if activeDropdown === 'indoor'}
							<div class="absolute top-full mt-1.5 left-0 w-full bg-[#2A2A2A] rounded-xl shadow-lg overflow-hidden z-50 border border-gray1/60 py-1">
								<button type="button" class="w-full text-left px-3 py-2 text-sm text-gray2 hover:text-white hover:bg-gray1/60 transition-colors" on:click={() => selectIndoor('')}>Select...</button>
								<button type="button" class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray1/60 transition-colors" on:click={() => selectIndoor('indoor')}>Indoor</button>
								<button type="button" class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray1/60 transition-colors" on:click={() => selectIndoor('outdoor')}>Outdoor</button>
							</div>
						{/if}
					</div>
				</div>

				<div bind:this={dropdownNodeVenue}>
					<span class="block text-[11px] font-bold uppercase tracking-wider text-gray3 mb-1.5 pl-1">Venue Type</span>
					<div class="relative">
						<button type="button" class="w-full bg-gray1 rounded-full pl-3 pr-4 h-9 text-sm outline-none border border-transparent focus:border-lime/60 flex items-center justify-between cursor-pointer transition-colors" on:click|stopPropagation={() => toggleDropdown('venue')}>
							<span class="truncate {data.venue_type ? 'text-white' : 'text-gray2/60'}">
								{data.venue_type || 'Select...'}
							</span>
							<svg class="w-4 h-4 text-gray2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
						</button>
						
						{#if activeDropdown === 'venue'}
							<div class="absolute top-full mt-1.5 left-0 w-full bg-[#2A2A2A] rounded-xl shadow-lg overflow-hidden z-50 border border-gray1/60 py-1">
								<button type="button" class="w-full text-left px-3 py-2 text-sm text-gray2 hover:text-white hover:bg-gray1/60 transition-colors" on:click={() => selectVenue('')}>Select...</button>
								{#each VENUE_TYPES as vt}
									<button type="button" class="w-full text-left px-3 py-2 text-sm text-white hover:bg-gray1/60 transition-colors" on:click={() => selectVenue(vt)}>{vt}</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>

			{#if data.venue_type === 'Other'}
				<div>
					<input class="w-full bg-gray1 rounded-full px-3 h-9 text-sm text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60 transition-colors" placeholder="Specify venue type" bind:value={data.venue_type_custom} on:input={changed} />
				</div>
			{/if}

			<div class="pt-4 border-t border-gray1/60">
				<div class="mb-3 flex items-center justify-between">
					<Toggle label="WIFI" checked={data.wifi_enabled} on:change={(e) => { data.wifi_enabled = e.detail; changed(); }} />
					{#if data.wifi_enabled}
						<button type="button" class="text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer {wifiClearStage === 1 ? 'text-problem' : 'text-gray2 hover:text-problem'}" on:click={() => handleClear('wifi')}>
							{wifiClearStage === 1 ? 'Are you sure?' : 'Clear'}
						</button>
					{/if}
				</div>
				{#if data.wifi_enabled}
					<div class="grid grid-cols-2 gap-3">
						<input class="w-full bg-gray1 rounded-full px-3 h-9 text-sm text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60 transition-colors" placeholder="Network / Login" bind:value={data.wifi_login} on:input={changed} />
						<input class="w-full bg-gray1 rounded-full px-3 h-9 text-sm text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60 transition-colors" placeholder="Password" bind:value={data.wifi_password} on:input={changed} />
					</div>
				{/if}
			</div>

			<div class="pt-4 border-t border-gray1/60">
				<div class="mb-3 flex items-center justify-between">
					<Toggle label="VENUE NOTES" checked={data.notes_enabled} on:change={(e) => { data.notes_enabled = e.detail; changed(); }} />
					{#if data.notes_enabled}
						<button type="button" class="text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer {notesClearStage === 1 ? 'text-problem' : 'text-gray2 hover:text-problem'}" on:click={() => handleClear('notes')}>
							{notesClearStage === 1 ? 'Are you sure?' : 'Clear'}
						</button>
					{/if}
				</div>
				{#if data.notes_enabled}
					<textarea class="w-full bg-gray1 rounded-3xl px-4 py-3 text-sm text-white placeholder-gray2/60 outline-none border border-transparent focus:border-lime/60 transition-colors resize-none min-h-[80px]" placeholder="Enter venue notes..." bind:value={data.notes} on:input={changed}></textarea>
				{/if}
			</div>
		</div>
	</div>

	<div>
		<div class="flex items-center justify-between mb-2">
			<span class="text-[13px] font-bold uppercase tracking-wider text-lime">Facilities</span>
		</div>

		<div class="bg-gray1/30 rounded-xl p-4">
			<div class="flex flex-wrap items-center gap-x-5 gap-y-3">
				<Toggle label="Shower" checked={data.shower} on:change={(e) => { data.shower = e.detail; changed(); }} />

				<Toggle label="Green Room(s)" checked={data.green_room} on:change={(e) => {
					data.green_room = e.detail;
					if (e.detail && !data.green_room_count) setGreenRoomCount(1);
					changed();
				}} />
				
				{#if data.green_room}
					<div class="flex items-center gap-2">
						<span class="text-[11px] text-gray2 ml-1">How many?</span>
						<div class="flex items-center bg-gray1 rounded-full overflow-hidden border border-gray1/60 h-7">
							<button type="button" class="px-2.5 h-full hover:bg-gray2/20 text-white cursor-pointer font-bold leading-none" on:click={() => setGreenRoomCount(Math.max(1, (data.green_room_count||1) - 1))}>−</button>
							<span class="px-1 text-xs text-white font-mono w-6 text-center">{data.green_room_count || 1}</span>
							<button type="button" class="px-2.5 h-full hover:bg-gray2/20 text-white cursor-pointer font-bold leading-none" on:click={() => setGreenRoomCount(Math.min(6, (data.green_room_count||1) + 1))}>+</button>
						</div>
					</div>

					<div class="ml-auto flex items-center">
						<button type="button" class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider {copiedAll ? 'text-lime' : 'text-gray2 hover:text-white'} transition-colors cursor-pointer" on:click={copyAllRooms}>
							<span>{copiedAll ? 'Copied!' : 'Copy All'}</span>
							{#if copiedAll}
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
							{:else}
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
							{/if}
						</button>
					</div>
				{/if}
			</div>

			{#if data.green_room}
				<div class="pt-4 mt-4 border-t border-gray1/60 space-y-3">

					{#each data.green_rooms || [] as room (room.id)}
						<div class="bg-navbar rounded-3xl p-3 space-y-2 border border-gray1/40">
							<div class="flex items-center gap-2 border-b border-transparent focus-within:border-lime/40 pb-1 px-1 transition-colors">
								<input
									class="w-full bg-transparent text-sm font-bold text-white outline-none"
									bind:value={room.name}
									disabled={room.assigned.length === 0}
									placeholder="Room Name"
									on:input={markCustom}
								/>
								
								{#if room.assigned.length > 0}
									<button type="button" class="{copiedRoomId === room.id ? 'text-lime' : 'text-gray2 hover:text-white'} transition-colors cursor-pointer shrink-0" aria-label="Copy Room" on:click={() => copyRoom(room)}>
										{#if copiedRoomId === room.id}
											<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
										{:else}
											<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
										{/if}
									</button>
								{/if}
							</div>
							
							{#if room.assigned.length === 0}
								<button type="button" class="w-full flex items-center justify-between bg-gray1/40 hover:bg-gray2/10 rounded-full px-3 py-1.5 transition-all cursor-pointer mt-1" on:click={goToEventDetails}>
									<span class="text-[11px] text-problem font-bold">Missing crew members, please add in crew list</span>
									<span class="text-[10px] bg-problem/80 text-black px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">+ Add Crew members</span>
								</button>
							{:else}
								<div class="bg-gray1/40 rounded-2xl px-3 py-2.5 text-[13px] text-gray3 font-medium mt-1">
									<div class="flex flex-col gap-1">
										{#each room.assigned as person}
											<div class="truncate">- {person}</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/each}

				</div>
			{/if}
		</div>
	</div>
</div>