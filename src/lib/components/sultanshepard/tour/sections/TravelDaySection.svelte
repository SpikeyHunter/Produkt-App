<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { TravelData, TravelPersonRow, SSCrew, SSTourDate } from '$lib/types/tour';
	import Field from '../ui/Field.svelte';
	import TextArea from '../ui/TextArea.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import Select from '../ui/Select.svelte';

	export let data: TravelData = {};
	export let crew: SSCrew[] = [];
	export let tourDate: SSTourDate | null = null; // for email subject context

	const dispatch = createEventDispatcher();
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	const DIRECTIONS: { v: 'in' | 'out'; l: string }[] = [
		{ v: 'in', l: 'Travel in' },
		{ v: 'out', l: 'Travel out' }
	];
	const MODES: { value: 'flight' | 'bus' | 'other'; label: string }[] = [
		{ value: 'flight', label: '✈ Vols' },
		{ value: 'bus', label: '🚌 Bus' },
		{ value: 'other', label: 'Other' }
	];
	const GROUND = [
		{ value: 'uber', label: 'Uber' },
		{ value: 'private', label: 'Private driver' },
		{ value: 'other', label: 'Other' },
		{ value: 'n/a', label: 'N/A' }
	];
	const HOTEL = [
		{ value: 'booked', label: 'Booked' },
		{ value: 'not_booked', label: 'Not booked' },
		{ value: 'n/a', label: 'N/A' }
	];

	$: people = data.people || [];
	$: crewById = new Map(crew.map((c) => [c.id, c]));
	$: availableCrew = crew.filter((c) => c.is_active !== false && !people.some((p) => p.crew_id === c.id));

	let expanded: string | null = null;
	let addCrewId = '';

	function addPerson() {
		if (!addCrewId) return;
		const row: TravelPersonRow = {
			crew_id: addCrewId,
			direction: 'in',
			mode: 'flight',
			booked: false,
			ground_transport: 'uber',
			hotel_status: 'not_booked'
		};
		data.people = [...people, row];
		expanded = addCrewId;
		addCrewId = '';
		changed();
	}

	function addAll() {
		const missing = availableCrew.map(
			(c): TravelPersonRow => ({
				crew_id: c.id,
				direction: 'in',
				mode: 'flight',
				booked: false,
				ground_transport: 'uber',
				hotel_status: 'not_booked'
			})
		);
		data.people = [...people, ...missing];
		changed();
	}

	function remove(crewId: string) {
		data.people = people.filter((p) => p.crew_id !== crewId);
		if (expanded === crewId) expanded = null;
		changed();
	}

	function emailHref(row: TravelPersonRow): string {
		const member = crewById.get(row.crew_id);
		if (!member?.email) return '';
		const dateStr = tourDate?.date || '';
		const subject = encodeURIComponent(`S+S Travel Day ${dateStr} — your travel info`);
		const lines = [
			`Hi ${member.name},`,
			'',
			`Here is your travel info for ${dateStr}:`,
			'',
			`Direction: travel ${row.direction === 'out' ? 'out' : 'in'}`,
			`Mode: ${row.mode || '—'}`,
			row.mode === 'flight' && row.flight_info ? `Flight: ${row.flight_info}` : '',
			row.booking_confirmation ? `Confirmation: ${row.booking_confirmation}` : '',
			row.other_notes ? `Notes: ${row.other_notes}` : '',
			`Ground transport: ${row.ground_transport || '—'}`,
			'',
			row.hotel_status === 'booked'
				? `Hotel: ${row.hotel_name || ''}\n${row.hotel_address || ''}\nConfirmation: ${row.hotel_confirmation || ''}\nRooming: ${row.rooming || ''}`
				: `Hotel: ${row.hotel_status === 'n/a' ? 'N/A' : 'not booked yet'}`,
			'',
			'Safe travels!',
			'S+S Tour Management'
		]
			.filter((l) => l !== '')
			.join('\n');
		return `mailto:${member.email}?subject=${subject}&body=${encodeURIComponent(lines)}`;
	}

	const statusDot = (row: TravelPersonRow) =>
		row.booked && (row.hotel_status === 'booked' || row.hotel_status === 'n/a')
			? 'bg-confirmed'
			: row.booked
				? 'bg-tentatif'
				: 'bg-problem';
</script>

<div class="space-y-3">
	<!-- add people -->
	<div class="flex flex-wrap items-center gap-2">
		<select
			class="flex-1 min-w-[160px] bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime"
			bind:value={addCrewId}
		>
			<option value="">+ Add person…</option>
			{#each availableCrew as c}
				<option value={c.id}>{c.name} ({c.role || c.crew_type})</option>
			{/each}
		</select>
		<button
			class="px-3 py-2 rounded-lg bg-lime text-black text-sm font-bold hover:opacity-90 transition disabled:opacity-40"
			disabled={!addCrewId}
			on:click={addPerson}
		>
			Add
		</button>
		{#if availableCrew.length > 0}
			<button
				class="px-3 py-2 rounded-lg border border-gray1 text-gray3 text-sm hover:border-lime hover:text-lime transition"
				on:click={addAll}
			>
				Add all crew
			</button>
		{/if}
	</div>

	{#if people.length === 0}
		<p class="text-sm text-gray2 italic">No travellers added yet.</p>
	{/if}

	{#each people as row (row.crew_id)}
		{@const member = crewById.get(row.crew_id)}
		<div class="bg-black/30 border border-gray1 rounded-xl overflow-hidden">
			<!-- header -->
			<button
				class="w-full flex items-center gap-3 px-3 py-2.5 text-left"
				on:click={() => (expanded = expanded === row.crew_id ? null : row.crew_id)}
			>
				<span class="w-2 h-2 rounded-full shrink-0 {statusDot(row)}"></span>
				<span class="flex-1 text-sm font-bold text-white truncate">
					{member?.name || 'Unknown'}
					<span class="font-normal text-gray2">· {member?.role || member?.crew_type || ''}</span>
				</span>
				<span class="text-[10px] uppercase tracking-wider text-gray2 shrink-0">
					{row.direction === 'out' ? 'Travel out' : 'Travel in'} · {row.mode}
					{row.booked ? '· booked' : ''}
				</span>
				<svg
					class="w-4 h-4 text-gray2 shrink-0 transition-transform {expanded === row.crew_id ? 'rotate-180' : ''}"
					viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				><polyline points="6 9 12 15 18 9" /></svg>
			</button>

			{#if expanded === row.crew_id}
				<div class="px-3 pb-3 space-y-3 border-t border-gray1 pt-3">
					<!-- direction + mode tabs -->
					<div class="flex flex-wrap gap-2">
						<div class="flex rounded-lg overflow-hidden border border-gray1">
							{#each DIRECTIONS as d}
								<button
									class="px-3 py-1.5 text-xs font-bold transition {row.direction === d.v ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}"
									on:click={() => { row.direction = d.v; changed(); }}
								>
									{d.l}
								</button>
							{/each}
						</div>
						<div class="flex rounded-lg overflow-hidden border border-gray1">
							{#each MODES as m}
								<button
									class="px-3 py-1.5 text-xs font-bold transition {row.mode === m.value ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}"
									on:click={() => { row.mode = m.value; changed(); }}
								>
									{m.label}
								</button>
							{/each}
						</div>
					</div>

					<!-- booking -->
					<div class="flex items-center gap-3">
						<Toggle label="Booked" bind:checked={row.booked} on:change={changed} />
					</div>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						{#if row.mode === 'flight'}
							<Field
								label="Flight info"
								placeholder="AC 123 · YUL→LAX · 10:35"
								bind:value={row.flight_info}
								on:change={changed}
							/>
						{/if}
						<Field
							label="Booking confirmation"
							placeholder="Confirmation #"
							bind:value={row.booking_confirmation}
							on:change={changed}
						/>
					</div>
					{#if row.mode !== 'flight'}
						<TextArea label="Details" rows={2} bind:value={row.other_notes} on:change={changed} />
					{/if}

					<!-- ground transport -->
					<Select label="Ground transport" options={GROUND} bind:value={row.ground_transport} on:change={changed} />

					<!-- hotel -->
					<div class="rounded-lg border border-gray1 p-3 space-y-3">
						<Select label="Hotel" options={HOTEL} bind:value={row.hotel_status} on:change={changed} />
						{#if row.hotel_status === 'booked'}
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								<Field label="Hotel name" bind:value={row.hotel_name} on:change={changed} />
								<Field label="Confirmation" bind:value={row.hotel_confirmation} on:change={changed} />
							</div>
							<Field label="Address" bind:value={row.hotel_address} on:change={changed} />
							<Field label="Rooming" placeholder="Room 1204 / shares with…" bind:value={row.rooming} on:change={changed} />
						{/if}
					</div>

					<!-- actions -->
					<div class="flex items-center justify-between pt-1">
						{#if member?.email}
							<a
								href={emailHref(row)}
								class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-lime text-black text-xs font-bold hover:opacity-90 transition"
							>
								<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
									<polyline points="22,6 12,13 2,6" />
								</svg>
								Email travel info
							</a>
						{:else}
							<span class="text-xs text-gray2 italic">No email on file for this person</span>
						{/if}
						<button
							class="text-xs text-gray2 hover:text-problem transition"
							on:click={() => remove(row.crew_id)}
						>
							Remove
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/each}
</div>