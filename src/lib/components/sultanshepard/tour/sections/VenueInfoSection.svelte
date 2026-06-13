<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { VenueInfoData, SSTourData, SSCrew, GreenRoom } from '$lib/types/tour';
	import Field from '../ui/Field.svelte';
	import TextArea from '../ui/TextArea.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import Select from '../ui/Select.svelte';

	export let data: VenueInfoData = {};
	export let tourData: SSTourData; // for crew/singers auto-assignment
	export let crew: SSCrew[] = [];

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	const VENUE_TYPES = ['Festival', 'Concert Hall', 'Theatre', 'Club', 'Other'].map((v) => ({ value: v, label: v }));

	// --- Green room auto-assignment ---
	// Groups derive from crew assigned in Event Details + singers count.
	$: assignedCrew = crew.filter((c) => (tourData.event_details?.crew_ids || []).includes(c.id));
	$: singersCount = tourData.event_details?.singers_enabled
		? (tourData.event_details?.singers || []).length
		: assignedCrew.filter((c) => c.crew_type === 'singer').length;

	function autoAssign(count: number): GreenRoom[] {
		const singers = Array.from({ length: Math.max(singersCount, 0) }, (_, i) => `Singer ${i + 1}`);
		const mk = (name: string, assigned: string[]): GreenRoom => ({ id: uid(), name, assigned });
		if (count <= 1) return [mk('GR 1', ['Everyone'])];
		if (count === 2) return [mk('GR 1', ['Artist']), mk('GR 2', ['Prod', ...singers])];
		if (count === 3) return [mk('GR 1', ['Artist']), mk('GR 2', ['Prod']), mk('GR 3', singers.length ? singers : ['Singers'])];
		// 4+: Artist / Prod / then singers split across remaining rooms
		const rooms = [mk('GR 1', ['Artist']), mk('GR 2', ['Prod'])];
		const remaining = count - 2;
		for (let i = 0; i < remaining; i++) {
			const slice = singers.filter((_, idx) => idx % remaining === i);
			rooms.push(mk(`GR ${i + 3}`, slice.length ? slice : []));
		}
		return rooms;
	}

	function setGreenRoomCount(count: number) {
		data.green_room_count = count;
		if (!data.green_room_is_custom) {
			data.green_rooms = autoAssign(count);
		} else {
			// keep custom assignments, just resize
			const rooms = [...(data.green_rooms || [])];
			while (rooms.length < count) rooms.push({ id: uid(), name: `GR ${rooms.length + 1}`, assigned: [] });
			data.green_rooms = rooms.slice(0, count);
		}
		changed();
	}

	function reAuto() {
		data.green_room_is_custom = false;
		data.green_rooms = autoAssign(data.green_room_count || 1);
		changed();
	}

	function markCustom() {
		data.green_room_is_custom = true;
		changed();
	}
</script>

<div class="space-y-6">
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<Select
			label="Indoor / Outdoor"
			options={[{ value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]}
			bind:value={data.indoor_outdoor}
			on:change={changed}
		/>
		<Select label="Venue Type" options={VENUE_TYPES} bind:value={data.venue_type} on:change={changed} />
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<Field label="WiFi Login" bind:value={data.wifi_login} placeholder="Network / login" on:change={changed} />
		<Field label="WiFi Password" bind:value={data.wifi_password} placeholder="Password" on:change={changed} />
	</div>

	<div class="flex gap-8">
		<Toggle label="Shower" checked={data.shower} on:change={(e) => { data.shower = e.detail; changed(); }} />
		<Toggle label="Green Room(s)" checked={data.green_room} on:change={(e) => {
			data.green_room = e.detail;
			if (e.detail && !data.green_room_count) setGreenRoomCount(1);
			changed();
		}} />
	</div>

	{#if data.green_room}
		<div class="bg-gray1/20 border border-gray1 rounded-xl p-4 space-y-4">
			<div class="flex items-center justify-between flex-wrap gap-3">
				<label class="flex items-center gap-3 text-sm text-gray2">
					How many green rooms?
					<input
						type="number" min="1" max="8"
						class="w-16 bg-gray1 rounded-lg px-2 h-8 text-sm text-white outline-none border border-transparent focus:border-lime/60"
						value={data.green_room_count || 1}
						on:change={(e) => setGreenRoomCount(Math.max(1, Number((e.target as HTMLInputElement).value) || 1))}
					/>
				</label>
				<div class="flex items-center gap-3 text-xs">
					{#if data.green_room_is_custom}
						<span class="text-tentatif font-bold uppercase tracking-wider">Custom order</span>
						<button type="button" class="text-lime font-bold hover:opacity-80 cursor-pointer" on:click={reAuto}>Reset to auto</button>
					{:else}
						<span class="text-gray2">Auto-assigned from Event Details crew · {singersCount} singer{singersCount === 1 ? '' : 's'}</span>
					{/if}
				</div>
			</div>

			{#if !assignedCrew.length}
				<p class="text-xs text-tentatif">
					No crew assigned yet — assign crew in the <span class="font-bold">Event Details</span> section above to auto-fill assignments.
				</p>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				{#each data.green_rooms || [] as room (room.id)}
					<div class="bg-navbar rounded-xl p-3 space-y-2">
						<input
							class="w-full bg-transparent text-sm font-bold text-white outline-none border-b border-transparent focus:border-lime/40"
							bind:value={room.name}
							on:change={() => { markCustom(); }}
						/>
						<input
							class="w-full bg-gray1 rounded-lg px-2.5 h-8 text-xs text-gray3 outline-none border border-transparent focus:border-lime/60"
							value={room.assigned.join(', ')}
							placeholder="Assigned (comma separated)"
							on:change={(e) => {
								room.assigned = (e.target as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean);
								markCustom();
							}}
						/>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<TextArea label="Venue Notes" bind:value={data.notes} rows={2} on:change={changed} />
</div>
