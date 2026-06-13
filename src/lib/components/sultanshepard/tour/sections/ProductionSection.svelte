<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ProductionData, LocalCrewItem } from '$lib/types/tour';
	import Field from '../ui/Field.svelte';
	import TextArea from '../ui/TextArea.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import Select from '../ui/Select.svelte';

	export let data: ProductionData = {};
	export let localCrewTemplate: { qty: number; role: string }[] = [];

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	function loadTemplate() {
		const fallback = [
			{ qty: 2, role: 'Tech LD' },
			{ qty: 2, role: 'Video' },
			{ qty: 4, role: 'Stagehands' },
			{ qty: 1, role: 'Carpenter' },
			{ qty: 1, role: 'Forklift' }
		];
		const tpl = localCrewTemplate.length ? localCrewTemplate : fallback;
		data.local_crew = tpl.map((t) => ({ id: uid(), qty: t.qty, role: t.role }));
		changed();
	}

	function addLocalCrew() {
		data.local_crew = [...(data.local_crew || []), { id: uid(), qty: 1, role: '' }];
		changed();
	}
	function removeLocalCrew(item: LocalCrewItem) {
		data.local_crew = (data.local_crew || []).filter((c) => c.id !== item.id);
		changed();
	}
</script>

<div class="space-y-6">
	<!-- Artist specs -->
	<div class="bg-gray1/20 border border-gray1 rounded-xl p-4 space-y-3">
		<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2">Artist Specs</span>
		<div class="flex flex-wrap items-center gap-6">
			<Select
				label=""
				options={[{ value: 'to_send', label: 'To Send' }, { value: 'sent', label: 'Sent' }]}
				bind:value={data.artist_specs_status}
				placeholder="Sent / To send"
				on:change={changed}
			/>
			<Toggle label="Confirmed by venue" checked={data.artist_specs_confirmed} on:change={(e) => { data.artist_specs_confirmed = e.detail; changed(); }} />
		</div>
		<TextArea bind:value={data.artist_specs_notes} placeholder="Notes…" rows={2} on:change={changed} />
	</div>

	<!-- Venue specs -->
	<div class="bg-gray1/20 border border-gray1 rounded-xl p-4 space-y-4">
		<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2">Venue Specs</span>
		<Field label="Specs File / Link" type="url" bind:value={data.venue_specs_link} placeholder="https://… (upload link or drive)" on:change={changed} />
		<div class="grid grid-cols-3 gap-3">
			<Field label="Stage Hauteur" bind:value={data.stage_height} placeholder="e.g. 1.5m" on:change={changed} />
			<Field label="Stage Largeur" bind:value={data.stage_width} placeholder="e.g. 12m" on:change={changed} />
			<Field label="Stage Profondeur" bind:value={data.stage_depth} placeholder="e.g. 8m" on:change={changed} />
		</div>
		<Toggle label="Mur LED" checked={data.led_wall} on:change={(e) => { data.led_wall = e.detail; changed(); }} />
		{#if data.led_wall}
			<div class="grid grid-cols-2 gap-3">
				<Field label="LED Largeur" bind:value={data.led_width} placeholder="e.g. 10m" on:change={changed} />
				<Field label="LED Hauteur" bind:value={data.led_height} placeholder="e.g. 5m" on:change={changed} />
			</div>
			<Field label="Pixel Map (upload link)" type="url" bind:value={data.pixel_map_link} placeholder="https://…" on:change={changed} />
		{/if}
		<TextArea label="Notes" bind:value={data.venue_specs_notes} rows={2} on:change={changed} />
	</div>

	<!-- Power -->
	<div class="flex flex-col md:flex-row md:items-start gap-4">
		<div class="shrink-0 pt-1">
			<Toggle label="Power confirmed" checked={data.power_confirmed} on:change={(e) => { data.power_confirmed = e.detail; changed(); }} />
		</div>
		<div class="flex-1">
			<TextArea bind:value={data.power_notes} placeholder="Power notes (amps, distro, location…)" rows={2} on:change={changed} />
		</div>
	</div>

	<!-- Local crew / stagehands -->
	<div>
		<div class="flex items-center justify-between mb-2">
			<span class="text-[11px] font-bold uppercase tracking-wider text-gray2">Local Crew / Stagehands</span>
			<div class="flex gap-3">
				{#if !(data.local_crew || []).length}
					<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={loadTemplate}>Load template</button>
				{/if}
				<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={addLocalCrew}>+ Add</button>
			</div>
		</div>
		<div class="space-y-1.5">
			{#each data.local_crew || [] as item (item.id)}
				<div class="grid grid-cols-[70px_1fr_auto] gap-2 items-center">
					<Field small type="number" bind:value={item.qty} on:change={changed} />
					<Field small bind:value={item.role} placeholder="Role" on:change={changed} />
					<button type="button" class="text-gray2 hover:text-problem p-1 cursor-pointer" aria-label="Remove" on:click={() => removeLocalCrew(item)}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
					</button>
				</div>
			{/each}
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
			<div class="flex items-end gap-3">
				<div class="flex-1"><Field label="Load-in" type="time" bind:value={data.load_in_time} on:change={changed} /></div>
				<div class="pb-2"><Toggle label="Confirmed" checked={data.load_in_confirmed} on:change={(e) => { data.load_in_confirmed = e.detail; changed(); }} /></div>
			</div>
			<div class="flex items-end gap-3">
				<div class="flex-1"><Field label="Load-out" type="time" bind:value={data.load_out_time} on:change={changed} /></div>
				<div class="pb-2"><Toggle label="Confirmed" checked={data.load_out_confirmed} on:change={(e) => { data.load_out_confirmed = e.detail; changed(); }} /></div>
			</div>
		</div>

		<div class="mt-4 max-w-xs">
			<Field label="Rate — Total (USD, links to Show Budget)" type="number" bind:value={data.stagehands_rate_total} placeholder="0" on:change={changed} />
		</div>
	</div>
</div>
