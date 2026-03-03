<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import ArtistSearch from './ArtistSearch.svelte'; // Add this line

	// Define standard types (you can import these from calendar-types.ts)
	type DealRole = 'Headliner' | 'Support';
	type DealTypeOption = 'Flat' | 'Door Deal' | 'Plus' | 'Versus';
	type DepositType = 'Percent' | 'Flat';
	type DueDateType = 'Relative' | 'Specific';

	interface Deposit {
		id: string;
		type: DepositType;
		amount: number;
		dueDateType: DueDateType;
		daysBeforeEvent?: number;
	}

	export let venueSettings: any = null;

	const dispatch = createEventDispatcher();

	// --- State ---
	let currentExchangeRate = 1.0;
	let isFetchingRate = false;

	let newDeal = {
		id: '',
		artistName: '',
		role: 'Headliner' as DealRole,
		dealType: 'Flat' as DealTypeOption,
		guaranteeUsd: 0,
		description: '',
		deposits: [] as Deposit[]
	};

	// --- Currency Logic ---
	$: targetCurrency = venueSettings?.financials?.currency || 'USD';
	$: convertToUsdSetting = venueSettings?.financials?.convertToUsd || false;
	$: requiresConversion = convertToUsdSetting && targetCurrency !== 'USD';
	$: convertedGuarantee = newDeal.guaranteeUsd * currentExchangeRate;

	async function fetchExchangeRate() {
		if (!requiresConversion) return;
		isFetchingRate = true;
		try {
			const res = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
			const data = await res.json();
			currentExchangeRate = data.rates[targetCurrency] || 1.0;
		} catch (error) {
			console.error('Failed to fetch exchange rate', error);
		} finally {
			isFetchingRate = false;
		}
	}

	onMount(() => {
		fetchExchangeRate();
	});

	// --- Actions ---
	function handleSave() {
		const dealSnapshot = {
			...newDeal,
			id: crypto.randomUUID(),
			exchangeData: requiresConversion
				? {
						rate: currentExchangeRate,
						targetCurrency: targetCurrency,
						dateFetched: new Date().toISOString()
					}
				: null
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
				daysBeforeEvent: 0
			}
		];
	}

	function removeDeposit(id: string) {
		newDeal.deposits = newDeal.deposits.filter((d) => d.id !== id);
	}
</script>

<div class="bg-gray1 p-8 rounded-2xl flex flex-col gap-8 max-w-4xl text-white">
	<div>
		<label for="artist-name" class="block text-xs text-gray2 mb-2 uppercase tracking-wide font-bold"
			>Artist Name</label
		>
		<div>
			<label
				for="artist-name"
				class="block text-xs text-gray2 mb-2 uppercase tracking-wide font-bold">Artist Name</label
			>
			<ArtistSearch bind:value={newDeal.artistName} />
		</div>
	</div>

	<div class="flex gap-12">
		<label class="flex items-center gap-3 cursor-pointer">
			<input
				type="radio"
				bind:group={newDeal.role}
				value="Headliner"
				class="accent-lime w-5 h-5 cursor-pointer"
			/>
			<span class="font-bold">Headliner</span>
		</label>
		<label class="flex items-center gap-3 cursor-pointer">
			<input
				type="radio"
				bind:group={newDeal.role}
				value="Support"
				class="accent-lime w-5 h-5 cursor-pointer"
			/>
			<span class="font-bold">Support</span>
		</label>
	</div>

	<div class="h-px w-full bg-navbar rounded-full"></div>

	<div>
		<h3 class="font-bold mb-5 text-gray3">Deal Type</h3>
		<div class="flex gap-8">
			{#each ['Flat', 'Door Deal', 'Plus', 'Versus'] as type}
				<label class="flex items-center gap-3 cursor-pointer">
					<input
						type="radio"
						bind:group={newDeal.dealType}
						value={type}
						class="accent-lime w-5 h-5 cursor-pointer"
					/>
					<span>{type}</span>
				</label>
			{/each}
		</div>
	</div>

	<div>
		<label
			for="guarantee-usd"
			class="block text-xs text-gray2 mb-2 uppercase tracking-wide font-bold">Guarantee (USD)</label
		>
		<div class="flex items-center gap-4">
			<div class="relative w-48">
				<span class="absolute left-4 top-3.5 text-gray2 font-bold">$</span>
				<input
					id="guarantee-usd"
					type="number"
					bind:value={newDeal.guaranteeUsd}
					class="w-full bg-black border-transparent rounded-xl pl-8 pr-4 py-3.5 text-white focus:outline-none focus:ring-1 focus:ring-lime transition-all"
				/>
			</div>
			{#if requiresConversion}
				<div class="text-sm text-lime bg-lime/10 px-4 py-2 rounded-xl font-bold">
					{#if isFetchingRate}
						Calculating...
					{:else}
						~ {targetCurrency} ${convertedGuarantee.toFixed(2)} (Rate: {currentExchangeRate})
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div>
		<label for="deal-desc" class="sr-only">Description</label>
		<input
			id="deal-desc"
			type="text"
			bind:value={newDeal.description}
			placeholder="Enter a brief description (250 characters or less)"
			class="w-full bg-black border-transparent rounded-xl px-5 py-3.5 text-white placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime transition-all"
		/>
	</div>

	<div class="h-px w-full bg-navbar rounded-full"></div>

	<div>
		<h3 class="font-bold mb-5 text-gray3">Deposits</h3>

		{#each newDeal.deposits as deposit (deposit.id)}
			<div class="flex items-end gap-4 mb-5 p-4 bg-navbar rounded-2xl">
				<div class="flex-1">
					<div class="block text-xs text-gray2 mb-2 font-bold">Deposit Type</div>
					<div class="flex bg-black rounded-xl p-1">
						<button
							on:click={() => (deposit.type = 'Percent')}
							class="flex-1 py-2 text-sm rounded-lg {deposit.type === 'Percent'
								? 'bg-gray1 text-white font-bold'
								: 'text-gray2 cursor-pointer'}">Percent</button
						>
						<button
							on:click={() => (deposit.type = 'Flat')}
							class="flex-1 py-2 text-sm rounded-lg {deposit.type === 'Flat'
								? 'bg-gray1 text-white font-bold'
								: 'text-gray2 cursor-pointer'}">Flat</button
						>
					</div>
				</div>

				<div class="flex-1">
					<label for="deposit-amount-{deposit.id}" class="block text-xs text-gray2 mb-2 font-bold"
						>Amount</label
					>
					<input
						id="deposit-amount-{deposit.id}"
						type="number"
						bind:value={deposit.amount}
						class="w-full bg-black rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-lime"
					/>
				</div>

				<div class="flex-[1.5]">
					<div class="block text-xs text-gray2 mb-2 font-bold">Due Date</div>
					<div class="flex bg-black rounded-xl p-1">
						<button
							on:click={() => (deposit.dueDateType = 'Relative')}
							class="flex-1 py-2 text-sm rounded-lg {deposit.dueDateType === 'Relative'
								? 'bg-gray1 text-white font-bold'
								: 'text-gray2 cursor-pointer'}">Relative</button
						>
						<button
							on:click={() => (deposit.dueDateType = 'Specific')}
							class="flex-1 py-2 text-sm rounded-lg {deposit.dueDateType === 'Specific'
								? 'bg-gray1 text-white font-bold'
								: 'text-gray2 cursor-pointer'}">Specific</button
						>
					</div>
				</div>

				<div class="flex-[1]">
					<label for="deposit-days-{deposit.id}" class="block text-xs text-gray2 mb-2 font-bold"
						>Days *</label
					>
					<input
						id="deposit-days-{deposit.id}"
						type="number"
						bind:value={deposit.daysBeforeEvent}
						class="w-full bg-black rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-lime"
					/>
				</div>

				<button
					on:click={() => removeDeposit(deposit.id)}
					class="text-gray2 hover:text-problem p-3 cursor-pointer rounded-xl bg-black">✕</button
				>
			</div>
		{/each}

		<button
			on:click={addDeposit}
			class="text-lime font-bold flex items-center gap-2 mt-2 hover:opacity-80 cursor-pointer"
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
			class="px-8 py-3 bg-navbar text-white font-bold rounded-full hover:bg-gray1 transition-colors cursor-pointer"
			>Cancel</button
		>
		<button
			on:click={handleSave}
			class="px-8 py-3 bg-lime text-black font-bold rounded-full hover:opacity-90 transition-opacity cursor-pointer"
			>Save Deal</button
		>
	</div>
</div>
