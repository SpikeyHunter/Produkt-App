<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SSTourData, SSCrew, BudgetLine } from '$lib/types/tour';
	import Field from '../ui/Field.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import TextArea from '../ui/TextArea.svelte';

	export let data: SSTourData['show_budget'] = {};
	export let tourData: SSTourData; // for live links (production stagehands, merch, photographer)
	export let crew: SSCrew[] = [];

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	const money = (n: number) =>
		n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

	// --- Live linked values ---
	$: assignedCrew = crew.filter((c) => (tourData.event_details?.crew_ids || []).includes(c.id));
	$: crewTotal = assignedCrew.reduce((s, c) => s + (Number(c.salary) || 0), 0);

	$: stagehandsTotal = Number(tourData.production?.stagehands_rate_total) || 0;

	$: merchEnabled = tourData.merch?.enabled === true;
	// sold = qty_in - qty_out; net = sold revenue minus venue %
	$: merchSold = (tourData.merch?.counts || []).reduce((s, c) => s + Math.max(0, (c.qty_in || 0) - (c.qty_out || 0)) * (c.price || 0), 0);
	$: merchNet = merchSold * (1 - ((tourData.merch?.venue_pct || 0) / 100));
	$: merchRevenue = data.merch_revenue_override ?? (merchEnabled ? Math.round(merchNet) : 0);

	$: sellerRate = merchEnabled && tourData.merch?.seller_rate ? Number(tourData.merch.seller_rate) : 0;

	$: photographerEnabled = tourData.event_details?.photographer_enabled === true;

	function line(key: 'flights' | 'hotels' | 'per_diem' | 'transports', label: string): BudgetLine {
		if (!data[key]) data[key] = { id: key, label, amount: 0, enabled: false };
		return data[key] as BudgetLine;
	}

	const TOGGLE_LINES: { key: 'flights' | 'hotels' | 'per_diem' | 'transports'; label: string }[] = [
		{ key: 'flights', label: 'Flights' },
		{ key: 'hotels', label: 'Hotels' },
		{ key: 'per_diem', label: 'Per Diem' },
		{ key: 'transports', label: 'Transports' }
	];

	function addExpense() {
		data.other_expenses = [...(data.other_expenses || []), { id: uid(), label: '', amount: 0, enabled: true }];
		changed();
	}
	function removeExpense(id: string) {
		data.other_expenses = (data.other_expenses || []).filter((e) => e.id !== id);
		changed();
	}

	$: toggleTotal = TOGGLE_LINES.reduce((s, t) => {
		const l = data[t.key];
		return s + (l?.enabled ? Number(l.amount) || 0 : 0);
	}, 0);
	$: otherTotal = (data.other_expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
	$: totalExpenses = crewTotal + stagehandsTotal + sellerRate + toggleTotal + otherTotal;
	$: net = merchRevenue - totalExpenses;
</script>

<div class="space-y-6">
	<p class="text-[11px] text-gray2 -mt-2">All amounts in <span class="text-white font-bold">USD$</span>. Crew, stagehands, merch and photographer lines are linked live to their tabs.</p>

	<!-- Crew (linked) -->
	<div>
		<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-2">Crew Assigned <span class="text-lime normal-case">· linked to Event Details</span></span>
		<div class="bg-gray1/30 rounded-xl divide-y divide-gray1/60">
			{#each assignedCrew as c (c.id)}
				<div class="flex items-center justify-between px-3 py-2 text-sm">
					<span class="text-white">{c.name} <span class="text-gray2 text-xs">· {c.role || c.crew_type}</span></span>
					<span class="text-gray3 font-mono">{money(Number(c.salary) || 0)}</span>
				</div>
			{:else}
				<p class="text-xs text-gray2 italic px-3 py-2">No crew assigned in Event Details.</p>
			{/each}
			{#if photographerEnabled}
				<div class="flex items-center justify-between px-3 py-2 text-sm">
					<span class="text-problem">Photographer <span class="text-xs opacity-70">· enabled in Event Details</span></span>
					<span class="text-problem font-mono">$0</span>
				</div>
			{/if}
			{#if assignedCrew.length}
				<div class="flex items-center justify-between px-3 py-2 text-sm font-bold">
					<span class="text-white">Crew total</span>
					<span class="text-white font-mono">{money(crewTotal)}</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Toggle lines -->
	<div>
		<span class="block text-[11px] font-bold uppercase tracking-wider text-gray2 mb-2">Travel & Per Diem</span>
		<div class="space-y-2">
			{#each TOGGLE_LINES as t}
				{@const l = line(t.key, t.label)}
				<div class="flex items-center gap-3">
					<div class="w-36 shrink-0">
						<Toggle label={t.label} checked={l.enabled} on:change={(e) => { l.enabled = e.detail; changed(); }} />
					</div>
					{#if l.enabled}
						<div class="w-36">
							<Field small type="number" bind:value={l.amount} placeholder="0" on:change={changed} />
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Linked: stagehands -->
	<div class="flex items-center justify-between bg-gray1/30 rounded-xl px-3 py-2.5 text-sm">
		<span class="text-white">Local Crew / Stagehands <span class="text-lime text-xs">· linked to Production</span></span>
		<span class="text-gray3 font-mono">{money(stagehandsTotal)}</span>
	</div>

	<!-- Linked: merch -->
	<div class="bg-gray1/30 rounded-xl px-3 py-2.5 space-y-2">
		<div class="flex items-center justify-between text-sm">
			<span class="text-white">Merch Revenue <span class="text-lime text-xs">· linked to Merch tab</span></span>
			<span class="font-mono {merchRevenue >= 0 ? 'text-confirmed' : 'text-problem'}">{money(merchRevenue)}</span>
		</div>
		{#if merchEnabled && sellerRate > 0}
			<div class="flex items-center justify-between text-sm">
				<span class="text-gray2">Merch Seller Rate</span>
				<span class="text-gray3 font-mono">-{money(sellerRate)}</span>
			</div>
		{/if}
		<label class="flex items-center gap-2 text-xs text-gray2">
			Override:
			<input
				type="number"
				class="w-28 bg-gray1 rounded-lg px-2 h-7 text-xs text-white outline-none border border-transparent focus:border-lime/60"
				value={data.merch_revenue_override ?? ''}
				on:change={(e) => {
					const v = (e.target as HTMLInputElement).value;
					data.merch_revenue_override = v === '' ? null : Number(v);
					changed();
				}}
				placeholder="auto"
			/>
		</label>
	</div>

	<!-- Other expenses -->
	<div>
		<div class="flex items-center justify-between mb-2">
			<span class="text-[11px] font-bold uppercase tracking-wider text-gray2">Other Expenses</span>
			<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={addExpense}>+ Add item</button>
		</div>
		<div class="space-y-1.5">
			{#each data.other_expenses || [] as e (e.id)}
				<div class="grid grid-cols-[1fr_130px_auto] gap-2 items-center">
					<Field small bind:value={e.label} placeholder="e.g. Photo, runner tip…" on:change={changed} />
					<Field small type="number" bind:value={e.amount} placeholder="0" on:change={changed} />
					<button type="button" class="text-gray2 hover:text-problem p-1 cursor-pointer" aria-label="Remove expense" on:click={() => removeExpense(e.id)}>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Totals -->
	<div class="border-t border-gray1 pt-4 space-y-1.5 text-sm">
		<div class="flex justify-between text-gray2"><span>Total expenses</span><span class="font-mono">{money(totalExpenses)}</span></div>
		<div class="flex justify-between text-gray2"><span>Merch revenue</span><span class="font-mono">{money(merchRevenue)}</span></div>
		<div class="flex justify-between font-bold text-base">
			<span class="text-white">Net</span>
			<span class="font-mono {net >= 0 ? 'text-confirmed' : 'text-problem'}">{money(net)}</span>
		</div>
	</div>

	<TextArea label="Budget Notes" bind:value={data.notes} rows={2} on:change={changed} />
</div>
