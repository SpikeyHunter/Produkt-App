<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import ArtistSearch from './ArtistSearch.svelte';
	import DealType from './DealType.svelte';
	import DealDescription from './DealDescription.svelte';
	import DealDetails from './DealDetails.svelte';

	export let event_date: string = '';
	export let eventCost: any = null;
	export let venueCurrency: string = 'CAD';
	export let existingDeal: any = null;

	$: computedTotalCost = (() => {
		try {
			if (!eventCost) return 0;
			let parsed = typeof eventCost === 'string' ? JSON.parse(eventCost) : eventCost;
			if (typeof parsed === 'string') parsed = JSON.parse(parsed);
			return parsed?.total_cost?.[0] || 0;
		} catch (e) {
			return 0;
		}
	})();
	import type {
		DealRole,
		DealTypeOption,
		Deposit,
		DealDescription as LogisticsDesc,
		DealDetailsInfo,
		DepositType,
		DueDateType
	} from '../../../../../types/tabs/deals';

	let selectedArtist: {
		name: string;
		id?: string | number;
		picture?: string;
		isCustom?: boolean;
	} | null = null;

	const dispatch = createEventDispatcher();

	const depositTypes: DepositType[] = ['Percent', 'Flat'];
	const dueDateTypes: DueDateType[] = ['Relative', 'Specific'];

	let showDetails = true;

	let newDeal = {
		id: crypto.randomUUID(),
		artistName: '',
		artistId: '' as string | number | undefined,
		artistPic: '' as string | undefined,
		summaryText: '' as string | undefined,
		role: 'Headliner' as DealRole,
		dealType: 'Flat' as DealTypeOption,
		guaranteeAmount: 0,
		w_tax: true,       // 🚀 NEW: Withholding tax boolean
		w_tax_amount: 24,  // 🚀 NEW: Withholding tax amount
		description: {
			hotels: { enabled: true, nights: 0, rooms: 0, suites: 0, custom_room: false, custom_name: '', custom_amount: 0 },
			groundTransport: { enabled: true, notes: '' },
			immigration: { enabled: true, notes: '' },
			other: { enabled: false, notes: '' }
		} as LogisticsDesc,
		deposits: [] as Deposit[],
		details: {
			metricType: '% of Net',
			metricAmount: 0,
			afterType: 'Costs',
			splitPointAmount: 0,
			retroactiveBonusEnabled: false,
			bonuses: [{ id: crypto.randomUUID(), switchesAt: '% Sell Through', bonusAmount: 0, atAmount: 0 }]
		} as DealDetailsInfo
	};
	let displayAmount = '';

	onMount(() => {
		if (existingDeal) {
			newDeal = JSON.parse(JSON.stringify(existingDeal));
			
			// Handle legacy deals that might not have w_tax defined yet
			if (newDeal.w_tax === undefined) newDeal.w_tax = true;
			if (newDeal.w_tax_amount === undefined) newDeal.w_tax_amount = 24;

			selectedArtist = {
				name: newDeal.artistName,
				id: newDeal.artistId,
				picture: newDeal.artistPic,
				isCustom: false
			};
			displayAmount = formatMoney(newDeal.guaranteeAmount);
		} else {
			displayAmount = formatMoney(newDeal.guaranteeAmount);
		}
	});

	$: {
		if (selectedArtist && selectedArtist.name) {
			newDeal.artistName = selectedArtist.name;
		} else {
			newDeal.artistName = '';
		}
	}

	// Dynamic Summary Generator
	$: dealSummary = (() => {
		if (newDeal.dealType === 'Flat') return '';

		const totalCost = computedTotalCost;
		const amount = newDeal.details.metricAmount || 0;
		const afterType = String(newDeal.details.afterType);

		const formatNum = (val: number | string) =>
			Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		const guar = `$${formatNum(newDeal.guaranteeAmount)}`;

		let prefix = '';
		if (newDeal.dealType === 'Door Deal') prefix = 'Door Deal of';
		else if (newDeal.dealType === 'Versus') prefix = `${guar} Versus`;
		else if (newDeal.dealType === 'Plus') prefix = `${guar} Plus`;

		if (newDeal.details.metricType === '% of Net') {
			const afterVal = afterType === 'Costs' ? totalCost : newDeal.details.splitPointAmount || 0;
			if (newDeal.dealType === 'Door Deal') {
				return `${prefix} ${formatNum(amount)}% of Net Revenue after ${venueCurrency}$${formatNum(afterVal)}`;
			} 
			else {
				const afterLabel = afterType === 'Costs' ? 'Costs' : `${venueCurrency}$${formatNum(afterVal)}`;
				return `${prefix} ${formatNum(amount)}% of Net Revenue after ${afterLabel}`;
			}
		}

		if (newDeal.details.metricType === '% of Net Gross') {
			return `${prefix} ${formatNum(amount)}% of Net Gross`;
		}

		const bonusCount = newDeal.details.bonuses?.length || 0;
		if (newDeal.dealType === 'Plus' && bonusCount > 1 && ['Per Ticket', 'Flat'].includes(newDeal.details.metricType)) {
			return `${guar} + ${bonusCount} Bonuses`;
		}

		const threshold = newDeal.details.bonuses?.[0]?.atAmount || 0;

		if (newDeal.details.metricType === 'Per Ticket') {
			if (afterType === '% Sell Through') return `${prefix} $${formatNum(amount)} per ticket after ${formatNum(threshold)}% sold`;
			else if (afterType === '# Tickets Sold') return `${prefix} $${formatNum(amount)} per ticket after ${threshold} tickets sold`;
		}

		if (newDeal.details.metricType === 'Flat') {
			if (afterType === '% Sell Through') return `${prefix} $${formatNum(amount)} after ${formatNum(threshold)}% sold`;
			else if (afterType === '# Tickets Sold') return `${prefix} $${formatNum(amount)} after ${threshold} tickets sold`;
			else if (afterType === 'Manual Split Point') return `${prefix} $${formatNum(amount)} after ${venueCurrency}$${formatNum(threshold)}`;
		}

		return '';
	})();

	function handleSave() {
		const payload = JSON.parse(JSON.stringify(newDeal));

		payload.artistId = selectedArtist?.id || "NULL";
		payload.artistPic = selectedArtist?.picture || "NULL";
		payload.summaryText = dealSummary || (payload.dealType === 'Flat' ? `$${payload.guaranteeAmount} Flat Deal` : '');

		if (payload.dealType === 'Flat') {
			delete payload.details;
		} else if (payload.dealType === 'Door Deal') {
			payload.guaranteeAmount = 0;
		}

		if (!payload.description.hotels.enabled) payload.description.hotels = { enabled: false };
		if (!payload.description.groundTransport.enabled) payload.description.groundTransport = { enabled: false };
		if (!payload.description.immigration.enabled) payload.description.immigration = { enabled: false };
		if (!payload.description.other.enabled) payload.description.other = { enabled: false, notes: '' };

		dispatch('save', payload);
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function addDeposit() {
		newDeal.deposits = [...newDeal.deposits, { id: crypto.randomUUID(), type: 'Flat', amount: 0, dueDateType: 'Relative', daysBeforeEvent: 0, specificDate: '' }];
	}

	function removeDeposit(id: string) {
		newDeal.deposits = newDeal.deposits.filter((d) => d.id !== id);
	}

	let activeDateId: string | null = null;
	let calMonth = new Date().getMonth();
	let calYear = new Date().getFullYear();
	$: calDays = (() => {
		const firstDay = new Date(calYear, calMonth, 1).getDay();
		const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
		return Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);
	})();
	const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

	export function formatMoney(amount: number | string | null | undefined): string {
		if (amount === null || amount === undefined || isNaN(Number(amount)) || amount === '') return '';
		const num = Number(amount);
		const hasDecimals = num % 1 !== 0;
		const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: hasDecimals ? 2 : 0 }).format(num);
		return `${formatted}$`;
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const rawString = target.value.replace(/[^0-9.-]+/g, '');
		const parsed = parseFloat(rawString);
		newDeal.guaranteeAmount = isNaN(parsed) ? 0 : parsed;
		displayAmount = target.value;
	}

	function handleFocus() {
		if (newDeal.guaranteeAmount !== undefined && newDeal.guaranteeAmount !== 0) {
			displayAmount = newDeal.guaranteeAmount.toString();
		} else {
			displayAmount = '';
		}
	}

	function handleBlur() {
		if (!displayAmount || displayAmount.trim() === '') newDeal.guaranteeAmount = 0;
		displayAmount = formatMoney(newDeal.guaranteeAmount);
	}
</script>

<div class="bg-gray1 p-8 rounded-2xl flex flex-col max-w-4xl text-white">
	<div>
		<div class="mb-6">
			<div class="block text-xs text-gray2 mb-2 uppercase tracking-wide font-bold">Artist Name</div>
			<ArtistSearch bind:selectedArtist />
		</div>
		<div class="grid grid-cols-2 max-w-md gap-4 px-2 mb-6">
			{#each ['Headliner', 'Support'] as roleOpt}
				<label class="group flex items-center cursor-pointer relative -ml-2">
					<div class="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-white/5 transition-colors duration-200">
						<div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {newDeal.role === roleOpt ? 'border-lime' : 'border-gray2 group-hover:border-gray-400'}">
							{#if newDeal.role === roleOpt}
								<div class="w-2.5 h-2.5 bg-lime rounded-full"></div>
							{/if}
						</div>
					</div>
					<input type="radio" bind:group={newDeal.role} value={roleOpt} class="hidden" />
					<span class="ml-1 font-bold {newDeal.role === roleOpt ? 'text-white' : 'text-gray2 group-hover:text-gray-300'} transition-colors duration-200">{roleOpt}</span>
				</label>
			{/each}
		</div>
	</div>

	<div class="mb-2">
		<DealType bind:dealType={newDeal.dealType} />

		{#if newDeal.dealType !== 'Door Deal'}
			<div transition:slide={{ duration: 300 }} class="mt-6 px-2 w-1/2">
				<label for="guaranteeAmount" class="block text-xs text-gray2 mb-2 font-bold uppercase tracking-wide">Guarantee Amount (USD)</label>
				<div class="relative">
					<input id="guaranteeAmount" type="text" bind:value={displayAmount} on:input={handleInput} on:focus={handleFocus} on:blur={handleBlur} class="w-150px bg-navbar rounded-3xl pl-5 pr-2 py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime" />
				</div>
				{#if newDeal.guaranteeAmount < 0}
					<div class="text-problem text-xs mt-2 ml-2 font-medium">Amount cannot be negative</div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="px-2 mb-8 mt-4">
		<div class="flex flex-col border-b border-[#333] pb-4 bg-navbar p-4 rounded-2xl">
			<div class="flex items-center justify-between">
				<h3 class="font-bold text-gray3">Subject to Withholding Tax</h3>
				<button
					type="button"
					role="switch"
					aria-checked={newDeal.w_tax}
					aria-label="Toggle Withholding Tax"
					on:click={() => (newDeal.w_tax = !newDeal.w_tax)}
					class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-lime
					{newDeal.w_tax ? 'bg-lime' : 'bg-[#444]'}"
				>
					<span
						aria-hidden="true"
						class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out
						{newDeal.w_tax ? 'translate-x-5' : 'translate-x-0'}"
					></span>
				</button>
			</div>
			
			{#if newDeal.w_tax}
				<div class="flex items-center gap-4 mt-4" transition:slide={{ duration: 200 }}>
					<label for="w_tax_amount" class="text-xs text-gray2 font-bold uppercase tracking-wide">Tax Percentage</label>
					<div class="relative w-24">
						<input 
							id="w_tax_amount"
							type="number" 
							bind:value={newDeal.w_tax_amount} 
							class="w-full bg-black/40 rounded-xl pl-4 pr-8 py-2 text-white font-bold focus:outline-none focus:ring-1 focus:ring-lime [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
						/>
						<span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray2 font-bold">%</span>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<div class="px-2 mb-12">
		<DealDescription bind:description={newDeal.description} />
	</div>

	{#if newDeal.dealType !== 'Flat'}
		<div transition:slide={{ duration: 300 }} class="px-2 mb-12 overflow-hidden flex flex-col">
			<button type="button" on:click={() => (showDetails = !showDetails)} class="w-full bg-lime hover:opacity-90 text-black py-4 px-6 font-bold text-center transition-opacity cursor-pointer {showDetails ? 'rounded-t-xl' : 'rounded-xl'}">
				{dealSummary}
			</button>
			{#if showDetails}
				<div transition:slide={{ duration: 300 }} class="p-6 bg-navbar border-x-2 border-b-2 border-lime rounded-b-xl overflow-hidden">
					<DealDetails bind:details={newDeal.details} dealType={newDeal.dealType} {eventCost} {venueCurrency} />
				</div>
			{/if}
		</div>
	{/if}

	<div>
		<h3 class="font-bold mb-5 text-gray3 px-2">Deposits</h3>
		{#each newDeal.deposits as deposit (deposit.id)}
			<div transition:slide={{ duration: 300 }} class="flex items-start gap-4 mb-5 p-4 bg-navbar rounded-2xl overflow-visible">
				<div class="flex-1 relative group/tooltip">
					<div class="block text-xs text-gray2 mb-2 ml-2 font-bold ">Deposit Type</div>
					<div class="flex bg-black/20 rounded-3xl p-1">
						{#each depositTypes as depType}
							<button on:click={() => { if (newDeal.dealType === 'Door Deal' && depType !== 'Flat') return; deposit.type = depType; }} disabled={newDeal.dealType === 'Door Deal' && depType !== 'Flat'} class="flex-1 py-2 text-sm rounded-3xl transition-colors {deposit.type === depType ? 'bg-lime/10 text-lime font-bold' : newDeal.dealType === 'Door Deal' && depType !== 'Flat' ? 'text-gray-500 cursor-not-allowed opacity-50' : 'text-gray3 cursor-pointer hover:text-white'}">
								{depType}
							</button>
						{/each}
					</div>
					{#if newDeal.dealType === 'Door Deal'}
						<div class="absolute top-full mt-1 left-0 hidden group-hover/tooltip:block bg-[#1A1A1A] hover:cursor-pointer text-problem text-xs px-2 py-0.5 rounded-3xl whitespace-nowrap z-[40] shadow-xl">
							Door Deal deposits can only be flat.
						</div>
					{/if}
				</div>

				<div class="flex-1 relative">
					<label for="amount-{deposit.id}" class="block text-xs text-gray2 mb-2 ml-2 font-bold whitespace-nowrap">
						Amount
						{#if newDeal.dealType !== 'Door Deal'}
							<span class="text-lime ml-1">({deposit.type === 'Percent' ? formatMoney((newDeal.guaranteeAmount * (deposit.amount || 0)) / 100) : formatMoney(deposit.amount || 0)})</span>
						{/if}
					</label>
					<div class="relative">
						<span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">{deposit.type === 'Percent' ? '% ' : '$ '}</span>
						<input id="amount-{deposit.id}" type="number" bind:value={deposit.amount} on:focus={(e) => { if (e.currentTarget.value === '0') e.currentTarget.value = ''; }} on:blur={() => (deposit.amount = deposit.amount || 0)} class="w-full bg-black/20 rounded-3xl pl-8 pr-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-lime [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
					</div>
					{#if deposit.type === 'Percent' && deposit.amount > 100}
						<div class="text-problem text-xs mt-2 ml-2 font-medium leading-tight">Cannot exceed 100%</div>
					{:else if deposit.type === 'Flat' && newDeal.dealType !== 'Door Deal' && deposit.amount > newDeal.guaranteeAmount}
						<div class="text-problem text-xs mt-2 ml-2 font-medium leading-tight">Cannot exceed guarantee</div>
					{/if}
				</div>

				<div class="flex-[1.5]">
					<div class="block text-xs text-gray2 mb-2 ml-2 font-bold">Due Date Type</div>
					<div class="flex bg-black/20 rounded-3xl p-1">
						{#each dueDateTypes as dtType}
							<button on:click={() => (deposit.dueDateType = dtType)} class="flex-1 py-2 text-sm rounded-3xl {deposit.dueDateType === dtType ? 'bg-lime/10 text-lime font-bold' : 'text-gray3 cursor-pointer hover:text-white transition-colors'}">{dtType}</button>
						{/each}
					</div>
				</div>

				{#if deposit.dueDateType === 'Relative'}
					<div class="flex-[1]">
						<label for="days-{deposit.id}" class="block text-xs text-gray2 mb-2 ml-2 font-bold">Days Before</label>
						<input id="days-{deposit.id}" type="number" bind:value={deposit.daysBeforeEvent} on:focus={(e) => { if (e.currentTarget.value === '0') e.currentTarget.value = ''; }} on:blur={() => (deposit.daysBeforeEvent = deposit.daysBeforeEvent || 0)} class="w-full bg-black/20 rounded-3xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-lime [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
					</div>
				{:else}
					<div class="flex-[1] relative z-50">
						<div class="block text-xs text-gray2 mb-2 font-bold">Specific Date</div>
						<div class="relative w-full">
							<input id="date-{deposit.id}" type="text" readonly value={deposit.specificDate ? new Date(deposit.specificDate + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} placeholder="Select date" on:click={() => { if (activeDateId === deposit.id) { activeDateId = null; } else { activeDateId = deposit.id; if (deposit.specificDate) { const d = new Date(deposit.specificDate + 'T00:00:00'); calMonth = d.getMonth(); calYear = d.getFullYear(); } else if (typeof event_date !== 'undefined' && event_date) { const d = new Date(event_date + 'T00:00:00'); if (!isNaN(d.getTime())) { calMonth = d.getMonth(); calYear = d.getFullYear(); } } else { const now = new Date(); calMonth = now.getMonth(); calYear = now.getFullYear(); } } }} class="w-full bg-black/20 rounded-3xl px-4 py-2 text-md text-white cursor-pointer focus:outline-none focus:ring-1 focus:ring-lime hover:bg-black/40 transition-colors" />

							{#if activeDateId === deposit.id}
								<button type="button" class="fixed inset-0 w-full h-full z-40 cursor-default bg-transparent border-none" aria-label="Close calendar" on:click={() => (activeDateId = null)}></button>
								<div class="absolute bottom-full mb-2 left-0 w-64 bg-navbar border border-lime rounded-xl shadow-2xl z-50 p-4">
									<div class="flex justify-between items-center mb-4">
										<button type="button" class="text-gray2 hover:text-lime p-1 transition-colors cursor-pointer" on:click={() => { if (calMonth === 0) { calMonth = 11; calYear--; } else { calMonth--; } }}>◀</button>
										<div class="text-white font-bold text-sm">{monthNames[calMonth]} {calYear}</div>
										<button type="button" class="text-gray2 hover:text-lime p-1 transition-colors cursor-pointer" on:click={() => { if (calMonth === 11) { calMonth = 0; calYear++; } else { calMonth++; } }}>▶</button>
									</div>
									<div class="grid grid-cols-7 gap-1 mb-2 text-center text-xs text-gray2 font-bold">
										{#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as dayName}
											<div>{dayName}</div>
										{/each}
									</div>
									<div class="grid grid-cols-7 gap-1">
										{#each calDays as day}
											{#if day === null}
												<div></div>
											{:else}
												<button type="button" class="h-8 w-full rounded-md flex items-center justify-center text-sm transition-colors cursor-pointer {deposit.specificDate === `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` ? 'bg-lime text-black font-bold' : 'text-white hover:bg-gray1 border border-transparent hover:border-lime/50'}" on:click={() => { deposit.specificDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; activeDateId = null; }}>
													{day}
												</button>
											{/if}
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				<button on:click={() => removeDeposit(deposit.id)} class="text-gray2 self-center translate-y-2 hover:text-problem hover:bg-problem/40 rounded-3xl px-3 py-2 cursor-pointer transition-colors">
					✕
				</button>
			</div>
		{/each}

		<button on:click={addDeposit} class="px-2 text-lime font-bold flex items-center gap-2 mt-2 hover:opacity-80 cursor-pointer transition-opacity">
			<span class="text-2xl bg-lime text-black rounded-full w-6 h-6 flex items-center justify-center pb-0.5">+</span> Add deposit
		</button>
	</div>

	<div class="flex gap-4 justify-end mt-4">
		<button on:click={handleCancel} class="px-8 py-3 bg-navbar text-white font-bold rounded-full hover:bg-gray2 transition-colors cursor-pointer">Cancel</button>
		<button on:click={handleSave} class="px-8 py-3 bg-lime text-black font-bold rounded-full hover:opacity-90 transition-opacity cursor-pointer">{existingDeal ? 'Update Deal' : 'Save Deal'}</button>
	</div>
</div>