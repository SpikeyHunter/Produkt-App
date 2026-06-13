<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ImmigrationData, ImmigrationCrewRow, SSTourData, SSCrew } from '$lib/types/tour';
	import Field from '../ui/Field.svelte';
	import Toggle from '../ui/Toggle.svelte';

	export let data: ImmigrationData = {};
	export let tourData: SSTourData;
	export let crew: SSCrew[] = [];

	const dispatch = createEventDispatcher();
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	// Auto-link rows to crew assigned on this show
	$: assignedCrew = crew.filter((c) => (tourData.event_details?.crew_ids || []).includes(c.id));
	$: if (data.enabled && assignedCrew.length) syncRows();

	function syncRows() {
		const existing = new Map((data.rows || []).map((r) => [r.crew_id, r]));
		const rows: ImmigrationCrewRow[] = assignedCrew.map(
			(c) => existing.get(c.id) || { crew_id: c.id }
		);
		// only update if membership changed (avoid loops)
		const same =
			rows.length === (data.rows || []).length &&
			rows.every((r, i) => (data.rows || [])[i]?.crew_id === r.crew_id);
		if (!same) {
			data.rows = rows;
			changed();
		}
	}

	function crewName(id: string) {
		return crew.find((c) => c.id === id)?.name || 'Unknown';
	}

	function mailto(row: ImmigrationCrewRow): string {
		const member = crew.find((c) => c.id === row.crew_id);
		const subject = encodeURIComponent('Your immigration document for the show');
		const body = encodeURIComponent(
			`Hi ${member?.name || ''},\n\nPlease find your immigration letter/visa document here:\n${row.document_link || '[link]'}\n\nKeep it with your passport when travelling.\n\nThanks,\nS+S Team`
		);
		return `mailto:${member?.email || ''}?subject=${subject}&body=${body}`;
	}
</script>

<div class="space-y-4">
	<Toggle label="Immigration needed for this show" checked={data.enabled} on:change={(e) => { data.enabled = e.detail; changed(); }} />

	{#if data.enabled}
		{#if !assignedCrew.length}
			<p class="text-xs text-tentatif">Assign crew in <span class="font-bold">Event Details</span> — immigration rows are generated per crew member automatically.</p>
		{/if}
		<div class="space-y-2">
			{#each data.rows || [] as row (row.crew_id)}
				<div class="bg-gray1/30 rounded-xl p-3 space-y-2.5">
					<div class="flex items-center justify-between flex-wrap gap-2">
						<span class="text-sm font-bold text-white">{crewName(row.crew_id)}</span>
						<a class="text-xs font-bold text-lime hover:opacity-80" href={mailto(row)}>Auto-send email →</a>
					</div>
					<div class="flex flex-wrap gap-x-6 gap-y-2">
						<Toggle label="Info sent to promoter" checked={row.info_sent_to_promoter} on:change={(e) => { row.info_sent_to_promoter = e.detail; changed(); }} />
						{#if row.info_sent_to_promoter}
							<Toggle label="Letter / visa received" checked={row.letter_or_visa_received} on:change={(e) => { row.letter_or_visa_received = e.detail; changed(); }} />
						{/if}
						{#if row.letter_or_visa_received}
							<Toggle label="Sent to crew member" checked={row.sent_to_crew} on:change={(e) => { row.sent_to_crew = e.detail; changed(); }} />
						{/if}
						<Toggle label="ETA" checked={row.eta_required} on:change={(e) => { row.eta_required = e.detail; changed(); }} />
						{#if row.eta_required}
							<Toggle label="ETA confirmed" checked={row.eta_confirmed} on:change={(e) => { row.eta_confirmed = e.detail; changed(); }} />
						{/if}
					</div>
					{#if row.letter_or_visa_received}
						<Field small label="Document Link (upload)" type="url" bind:value={row.document_link} placeholder="https://…" on:change={changed} />
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
