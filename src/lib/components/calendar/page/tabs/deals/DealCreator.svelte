<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { slide } from 'svelte/transition';
	import ArtistSearch from './ArtistSearch.svelte';
	import DealType from './DealType.svelte';
	import DealDescription from './DealDescription.svelte';
	import DealDetails from './DealDetails.svelte';
	import DatePickerCompact from '$lib/components/buttons/DatePickerCompact.svelte';
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

	// --- UI State ---
	let showDetails = true;

	// --- Data State ---
	let newDeal = {
		id: '',
		artistName: '',
		role: 'Headliner' as DealRole,
		dealType: 'Versus' as DealTypeOption,
		guaranteeAmount: 0,
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
			bonuses: [
				{ id: crypto.randomUUID(), switchesAt: '% Sell Through', bonusAmount: 0, atAmount: 0 }
			],
			capEnabled: false,
			capAmount: 0
		} as DealDetailsInfo
	};

	$: {
		if (selectedArtist && selectedArtist.name) {
			newDeal.artistName = selectedArtist.name;
		} else {
			newDeal.artistName = '';
		}
	}
	
	// --- Dynamic Summary Generator ---
	$: dealSummary = (() => {
		if (newDeal.dealType === 'Flat') return '';

		const amt = Number(newDeal.details.metricAmount || 0).toFixed(2);
		const isPercent = newDeal.details.metricType.includes('%');
		const valStr = isPercent ? `${amt}%` : `$${amt}`;

		let cleanType: string = newDeal.details.metricType;

		if (cleanType === '% of Net') cleanType = 'of Net Revenue';
		else if (cleanType === '% of Net Gross') cleanType = 'of Net Gross';
		else if (cleanType.startsWith('% ')) cleanType = cleanType.substring(2);
		else if (cleanType.startsWith('%')) cleanType = cleanType.substring(1).trim();

		let afterStr = 'Costs';
		if (newDeal.details.afterType === 'Manual Split Point') {
			const sp = Number(newDeal.details.splitPointAmount || 0).toLocaleString(undefined, {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			});
			afterStr = `$${sp}`;
		}

		return `${newDeal.dealType} ${valStr} ${cleanType} after ${afterStr}`;
	})();

	// --- Actions ---
	function handleSave() {
		const dealSnapshot = {
			...newDeal,
			id: crypto.randomUUID()
		};
		dispatch('save', dealSnapshot);
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function addDeposit() {
		newDeal.deposits = [
			...newDeal.deposits,
			{
				id: crypto.randomUUID(),
				type: 'Flat',
				amount: 0,
				dueDateType: 'Relative',
				daysBeforeEvent: 0,
				specificDate: ''
			}
		];
	}

	function removeDeposit(id: string) {
		newDeal.deposits = newDeal.deposits.filter((d) => d.id !== id);
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
					<div
						class="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-white/5 transition-colors duration-200"
					>
						<div
							class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {newDeal.role ===
							roleOpt
								? 'border-lime'
								: 'border-gray2 group-hover:border-gray-400'}"
						>
							{#if newDeal.role === roleOpt}
								<div class="w-2.5 h-2.5 bg-lime rounded-full"></div>
							{/if}
						</div>
					</div>
					<input type="radio" bind:group={newDeal.role} value={roleOpt} class="hidden" />
					<span
						class="ml-1 font-bold {newDeal.role === roleOpt
							? 'text-white'
							: 'text-gray2 group-hover:text-gray-300'} transition-colors duration-200"
						>{roleOpt}</span
					>
				</label>
			{/each}
		</div>
	</div>

	<div class='mb-6'>
		<DealType bind:dealType={newDeal.dealType} />

		{#if newDeal.dealType !== 'Door Deal'}
			<div transition:slide={{ duration: 300 }} class="mt-6 px-2 w-1/2 overflow-hidden">
				<label
					for="guaranteeAmount"
					class="block text-xs text-gray2 mb-2 font-bold uppercase tracking-wide"
					>Guarantee Amount (USD)</label
				>
				<div class="relative">
					<span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">$</span>
					<input
						id="guaranteeAmount"
						type="number"
						bind:value={newDeal.guaranteeAmount}
						class="w-250px bg-navbar rounded-3xl pl-8 pr-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-lime"
					/>
				</div>
			</div>
		{/if}
	</div>

	<div class="px-2 mb-12">
		<DealDescription bind:description={newDeal.description} />
	</div>


	{#if newDeal.dealType !== 'Flat'}
		<div transition:slide={{ duration: 300 }} class="px-2 mb-12 overflow-hidden flex flex-col">
			<button
				type="button"
				on:click={() => (showDetails = !showDetails)}
				class="w-full bg-lime hover:opacity-90 text-black py-4 px-6 font-bold text-center transition-opacity cursor-pointer {showDetails
					? 'rounded-t-xl'
					: 'rounded-xl'}"
			>
				{dealSummary}
			</button>

			{#if showDetails}
				<div
					transition:slide={{ duration: 300 }}
					class="p-6 bg-navbar border-x border-b border-lime rounded-b-xl overflow-hidden"
				>
					<DealDetails bind:details={newDeal.details} dealType={newDeal.dealType} />
				</div>
			{/if}
		</div>
	{/if}

	<div>
		<h3 class="font-bold mb-5 text-gray3 px-2">Deposits</h3>

		{#each newDeal.deposits as deposit (deposit.id)}
			<div
				transition:slide={{ duration: 300 }}
				class="flex items-end gap-4 mb-5 p-4 bg-navbar rounded-2xl overflow-hidden"
			>
				<div class="flex-1">
					<div class="block text-xs text-gray2 mb-2 font-bold">Deposit Type</div>
					<div class="flex bg-black rounded-xl p-1">
						{#each depositTypes as depType}
							<button
								on:click={() => (deposit.type = depType)}
								class="flex-1 py-2 text-sm rounded-lg {deposit.type === depType
									? 'bg-gray1 text-white font-bold'
									: 'text-gray2 cursor-pointer'}">{depType}</button
							>
						{/each}
					</div>
				</div>

				<div class="flex-1">
					<label for="amount-{deposit.id}" class="block text-xs text-gray2 mb-2 font-bold"
						>Amount</label
					>
					<input
						id="amount-{deposit.id}"
						type="number"
						bind:value={deposit.amount}
						class="w-full bg-black rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-lime"
					/>
				</div>

				<div class="flex-[1.5]">
					<div class="block text-xs text-gray2 mb-2 font-bold">Due Date Type</div>
					<div class="flex bg-black rounded-xl p-1">
						{#each dueDateTypes as dtType}
							<button
								on:click={() => (deposit.dueDateType = dtType)}
								class="flex-1 py-2 text-sm rounded-lg {deposit.dueDateType === dtType
									? 'bg-gray1 text-white font-bold'
									: 'text-gray2 cursor-pointer'}">{dtType}</button
							>
						{/each}
					</div>
				</div>

				{#if deposit.dueDateType === 'Relative'}
					<div class="flex-[1]">
						<label for="days-{deposit.id}" class="block text-xs text-gray2 mb-2 font-bold"
							>Days Before</label
						>
						<input
							id="days-{deposit.id}"
							type="number"
							bind:value={deposit.daysBeforeEvent}
							class="w-full bg-black rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-lime"
						/>
					</div>
				{:else}
					<div class="flex-[1]">
						<div class="block text-xs text-gray2 mb-2 font-bold">Specific Date</div>
						<div class="bg-black rounded-xl px-2 py-2 flex items-center h-[48px]">
							<DatePickerCompact
								bind:value={deposit.specificDate}
								width="w-full"
								variant="outline"
								placeholder="Select date"
							/>
						</div>
					</div>
				{/if}

				<button
					on:click={() => removeDeposit(deposit.id)}
					class="text-gray2 hover:text-red-500 p-3 cursor-pointer rounded-xl bg-black transition-colors"
					>✕</button
				>
			</div>
		{/each}

		<button
			on:click={addDeposit}
			class="px-2 text-lime font-bold flex items-center gap-2 mt-2 hover:opacity-80 cursor-pointer transition-opacity"
		>
			<span
				class="text-2xl bg-lime text-black rounded-full w-6 h-6 flex items-center justify-center pb-0.5"
				>+</span
			> Add deposit
		</button>
	</div>

	<div class="flex gap-4 justify-end mt-4">
		<button
			on:click={handleCancel}
			class="px-8 py-3 bg-navbar text-white font-bold rounded-full hover:bg-gray2 transition-colors cursor-pointer"
			>Cancel</button
		>
		<button
			on:click={handleSave}
			class="px-8 py-3 bg-lime text-black font-bold rounded-full hover:opacity-90 transition-opacity cursor-pointer"
			>Save Deal</button
		>
	</div>
</div>