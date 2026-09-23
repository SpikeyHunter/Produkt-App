<!--
  CommissionLine — the Produkt commission, as one row rather than a section.

  It is stored in the same `variableCosts` array as everything else (flagged
  `commission: true`), so every total, sheet and summary keeps working; this
  component only owns how it looks on the Costs tab.
-->
<script lang="ts">
	import { VARIABLE_COST_TYPES } from '$lib/components/calendar/page/tabs/deals/dealEngine';
	import { DEFAULT_COMMISSION_PERCENT } from '$lib/services/templateService';
	import Dropdown from '$lib/components/common/Dropdown.svelte';

	export let variableCosts: any[] = [];
	export let eventRevenue: any = {};
	export let artistFee: { sellout: number; est: number; actual: number } = {
		sellout: 0,
		est: 0,
		actual: 0
	};
	export let currency: string = 'CAD';
	export let triggerSave: () => void;

	const typeOptions = VARIABLE_COST_TYPES.map((t) => ({ value: t, label: t }));

	$: row = variableCosts.find((r: any) => r?.commission === true) || null;

	/* ---- the same maths the variable table uses ---- */
	$: tickets = eventRevenue?.tickets || [];
	$: financials = eventRevenue?.financials || { taxRate: 0, taxType: 'Divisor', facilityFee: 0 };

	function metrics(qtyField: 'allotment' | 'estSold' | 'sold', netComps = false) {
		let totalTickets = 0;
		let gross = 0;
		let fees = 0;
		for (const t of tickets) {
			let qty = Number(t[qtyField]) || 0;
			if (netComps) qty = qty - (Number(t.comps) || 0) - (Number(t.kills) || 0);
			totalTickets += qty;
			gross += qty * (Number(t.price) || 0);
			fees += qty * (Number(t.ticketFees) || 0) + qty * (Number(financials.facilityFee) || 0);
		}
		const rate = Number(financials.taxRate) || 0;
		const taxes =
			financials.taxType === 'Divisor' ? gross - gross / (1 + rate / 100) : gross * (rate / 100);
		return { totalTickets, gross, netGross: gross - taxes - fees };
	}

	$: selloutM = { ...metrics('allotment', true), artistFee: artistFee?.sellout || 0 };
	$: estM = { ...metrics('estSold'), artistFee: artistFee?.est || 0 };
	$: actM = { ...metrics('sold'), artistFee: artistFee?.actual || 0 };

	function calc(type: string, amount: number, m: any) {
		amount = Number(amount) || 0;
		switch (type) {
			case 'Flat':
				return amount;
			case '% of Gross':
				return (amount / 100) * m.gross;
			case '% of Net Gross':
				return (amount / 100) * m.netGross;
			case '$ per Paid Ticket':
			case '$ per Attendee':
				return amount * m.totalTickets;
			case '% of Artist Fee':
				return (amount / 100) * (m.artistFee || 0);
			default:
				return amount;
		}
	}

	$: offerBudget = row ? calc(row.type, row.externalAmount, selloutM) : 0;
	$: estimated = row ? calc(row.type, row.internalAmount, estM) : 0;
	$: actual = row ? calc(row.type, row.internalAmount, actM) : 0;

	const money = (n: number) => {
		try {
			return `${currency || 'CAD'}${new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: currency || 'CAD',
				currencyDisplay: 'narrowSymbol'
			}).format(n || 0)}`;
		} catch {
			return `CAD$${n || 0}`;
		}
	};
	const isPct = (t: string) => (t || '').includes('%');

	function addRow() {
		variableCosts = [
			...variableCosts,
			{
				id: crypto.randomUUID(),
				name: 'Produkt Commission',
				type: '% of Net Gross',
				internalAmount: DEFAULT_COMMISSION_PERCENT,
				externalAmount: DEFAULT_COMMISSION_PERCENT,
				reported: true,
				commission: true
			}
		];
		triggerSave();
	}

	function removeRow() {
		if (!row) return;
		variableCosts = variableCosts.filter((r: any) => r !== row);
		triggerSave();
	}

	function setType(t: string) {
		if (!row) return;
		row.type = t;
		variableCosts = variableCosts;
		triggerSave();
	}

	/** Both columns move together — the commission rate is one number. */
	function setAmount(value: number) {
		if (!row) return;
		const n = Number(value) || 0;
		row.internalAmount = n;
		row.externalAmount = n;
		variableCosts = variableCosts;
		triggerSave();
	}
</script>

<section class="flex flex-col mt-6">
	<div class="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-gray1/40">
		<h3 class="text-xl font-black text-lime tracking-wide mr-auto">Produkt Commission</h3>

		{#if row}
			<div class="flex items-center gap-2">
				<div class="relative">
					<input
						type="number"
						min="0"
						step="0.5"
						value={row.internalAmount ?? 0}
						on:input={(e) => setAmount(Number(e.currentTarget.value))}
						on:blur={triggerSave}
						aria-label="Commission amount"
						class="w-24 bg-gray1 rounded-2xl pl-3 pr-7 py-1.5 text-sm font-bold text-white text-right focus:outline-none focus:ring-2 focus:ring-lime"
					/>
					<span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray2 text-sm font-bold">
						{isPct(row.type) ? '%' : '$'}
					</span>
				</div>

				<div class="w-[150px]">
					<Dropdown
						options={typeOptions}
						value={row.type}
						small
						onChange={setType}
						placeholder="Type"
					/>
				</div>
			</div>

			<div class="flex items-center gap-6 text-sm font-bold text-gray2">
				<div>Offer Budget: <span class="text-white">{money(offerBudget)}</span></div>
				<div>/ Estimated: <span class="text-white">{money(estimated)}</span></div>
				<div>/ Actual: <span class="text-white">{money(actual)}</span></div>
			</div>

			<button
				type="button"
				on:click={removeRow}
				title="Remove the commission from this event"
				aria-label="Remove commission"
				class="w-7 h-7 flex items-center justify-center rounded-lg text-gray2 hover:text-problem hover:bg-problem/10 cursor-pointer transition-colors"
			>
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" />
					<line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" />
				</svg>
			</button>
		{:else}
			<span class="text-sm font-bold text-gray2">Not applied to this event</span>
			<button
				type="button"
				on:click={addRow}
				class="px-4 py-2 bg-lime text-black text-sm font-bold rounded-3xl hover:opacity-90 cursor-pointer transition-colors"
			>
				Add Commission
			</button>
		{/if}
	</div>
</section>
