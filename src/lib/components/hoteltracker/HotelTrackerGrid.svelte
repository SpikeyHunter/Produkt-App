<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';

	export let trackerId: number;

	const dispatch = createEventDispatcher();

	let tracker: any = null;
	let dates: string[] = [];
	let loading = true;
	let debouncer: any;
	
	// Structure: { isHeader: bool, name?: string, hotelName: string, roomType: string, roomIndex: number }
	let gridRows: any[] = [];
	
	// Local state of input data
	let localData: any = {};
	let channel: any;

	// --- RE-RENDER KEY ---
	let renderKey = 0;

	// --- Bulk Update State ---
	let isBulkModalOpen = false;
	let bulkRateValue = '';
	let bulkTarget: { hotel: string; type: string; index: number; label: string } | null = null;

	onMount(() => {
		loadTracker();
		setupRealtime();
	});

	onDestroy(() => {
		if (channel) supabase.removeChannel(channel);
	});

	function setupRealtime() {
		channel = supabase
			.channel(`tracker_${trackerId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'hotel_tracker',
					filter: `id=eq.${trackerId}`
				},
				(payload) => {
					if (payload.new.tracker_data) {
						if (JSON.stringify(localData) !== JSON.stringify(payload.new.tracker_data)) {
							localData = payload.new.tracker_data;
							renderKey++;
						}
					}
					const configChanged =
						JSON.stringify(payload.new.configuration) !== JSON.stringify(tracker?.configuration);
					const datesChanged =
						payload.new.start_date !== tracker?.start_date ||
						payload.new.end_date !== tracker?.end_date;

					if (configChanged || datesChanged) {
						tracker = payload.new;
						generateDates(payload.new.start_date, payload.new.end_date);
						generateGridRows(payload.new.configuration);
					}
				}
			)
			.subscribe();
	}

	async function loadTracker() {
		loading = true;
		const { data, error } = await supabase
			.from('hotel_tracker')
			.select('*')
			.eq('id', trackerId)
			.single();

		if (data) {
			tracker = data;
			localData = data.tracker_data || {};
			generateDates(data.start_date, data.end_date);
			generateGridRows(data.configuration);
			renderKey++;
		}
		loading = false;
	}

	function generateDates(start: string, end: string) {
		const dateArray = [];
		let currentDate = new Date(start + 'T00:00:00');
		const endDate = new Date(end + 'T00:00:00');

		while (currentDate <= endDate) {
			dateArray.push(currentDate.toISOString().split('T')[0]);
			currentDate.setDate(currentDate.getDate() + 1);
		}
		dates = dateArray;
	}

	function generateGridRows(config: any) {
		gridRows = [];
		if (!config) return;
		const hotelOrder = ['Alt Hotel', 'Monville', 'W Hotel'];
		const sortedConfig = [...config].sort((a, b) => {
			const indexA = hotelOrder.indexOf(a.name);
			const indexB = hotelOrder.indexOf(b.name);
			if (indexA !== -1 && indexB !== -1) return indexA - indexB;
			if (indexA !== -1) return -1;
			if (indexB !== -1) return 1;
			return a.name.localeCompare(b.name);
		});
		sortedConfig.forEach((hotel) => {
			gridRows.push({ isHeader: true, name: hotel.name });
			hotel.rooms.forEach((room: any) => {
				for (let i = 0; i < room.count; i++) {
					gridRows.push({
						isHeader: false,
						hotelName: hotel.name,
						roomType: room.type,
						roomIndex: i
					});
				}
			});
		});
	}

	// --- CELL UPDATE LOGIC ---

	function updateCell(
		date: string,
		hotel: string,
		type: string,
		index: number,
		field: string,
		value: any
	) {
		ensureCellExists(date, hotel, type, index);
		localData[date][hotel][type][index][field] = value;
		
		localData = localData; 
		if (field === 'disabled') renderKey++;

		clearTimeout(debouncer);
		debouncer = setTimeout(saveToDb, 1000);
	}

	function ensureCellExists(date: string, hotel: string, type: string, index: number) {
		if (!localData[date]) localData[date] = {};
		if (!localData[date][hotel]) localData[date][hotel] = {};
		if (!localData[date][hotel][type]) localData[date][hotel][type] = {};
		if (!localData[date][hotel][type][index]) localData[date][hotel][type][index] = {};
	}

	async function saveToDb() {
		await supabase.from('hotel_tracker').update({ tracker_data: localData }).eq('id', trackerId);
		dispatch('saved');
	}

	function getValue(date: string, hotel: string, type: string, index: number, field: string) {
		try {
			return localData[date][hotel][type][index][field];
		} catch (e) {
			return undefined;
		}
	}

	// --- NEW: Time Formatting Logic ---
	function formatTimeInput(event: any) {
		let val = event.target.value.trim();
		if (!val) return;

		const field = event.target.dataset.field; // 'in_time' or 'out_time'
		
		// Determine Default Suffix: IN = PM, OUT = AM
		let defaultSuffix = 'PM';
		if (field === 'out_time') defaultSuffix = 'AM';

		// Normalize
		const clean = val.toLowerCase().replace(/[^a-z0-9]/g, '');
		const nums = clean.replace(/[a-z]/g, ''); 

		// Check if user typed 'a' or 'p' manually
		let suffix = defaultSuffix;
		if (clean.includes('a')) suffix = 'AM';
		else if (clean.includes('p')) suffix = 'PM';

		let formatted = val;

		if (nums.length > 0) {
			// Case: "4" -> "4PM" (or AM)
			if (nums.length <= 2) {
				formatted = nums + suffix;
			} 
			// Case: "430" -> "4:30PM"
			else if (nums.length === 3) {
				formatted = nums[0] + ':' + nums.slice(1) + suffix;
			}
			// Case: "1030" -> "10:30PM"
			else if (nums.length === 4) {
				formatted = nums.slice(0, 2) + ':' + nums.slice(2) + suffix;
			}
		}

		event.target.value = formatted;
		const { date, hotel, type, index } = event.target.dataset;
		updateCell(date, hotel, type, Number(index), field, formatted);
	}

	// --- CALCULATIONS ---

	function parseMoney(val: string): number {
		if (!val) return 0;
		const clean = val.replace(/[^0-9.-]+/g, '');
		const num = parseFloat(clean);
		return isNaN(num) ? 0 : num;
	}

	function formatMoney(num: number): string {
		return (
			num.toLocaleString('en-US', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}) + '$'
		);
	}

	function getRowTotal(hotel: string, type: string, index: number) {
		let sum = 0;
		dates.forEach((date) => {
			const disabled = getValue(date, hotel, type, index, 'disabled');
			if (!disabled) {
				const rate = getValue(date, hotel, type, index, 'rate') || '';
				sum += parseMoney(rate);
			}
		});
		return sum;
	}

	function getColumnTotal(date: string) {
		let sum = 0;
		gridRows.forEach((row) => {
			if (!row.isHeader) {
				const disabled = getValue(date, row.hotelName, row.roomType, row.roomIndex, 'disabled');
				if (!disabled) {
					const rate = getValue(date, row.hotelName, row.roomType, row.roomIndex, 'rate') || '';
					sum += parseMoney(rate);
				}
			}
		});
		return sum;
	}

	function getGrandTotal() {
		let sum = 0;
		dates.forEach((date) => {
			sum += getColumnTotal(date);
		});
		return sum;
	}

	function formatDateHeader(dateStr: string) {
		const [y, m, d] = dateStr.split('-');
		const date = new Date(Number(y), Number(m) - 1, Number(d));
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	const colors: any = {
		'Alt Hotel': 'text-confirmed',
		Monville: 'text-question',
		'W Hotel': 'text-info',
		Other: 'text-problem'
	};
	
	function formatCurrency(event: any) {
		let val = event.target.value.toString();
		const clean = val.replace(/[^0-9.]/g, '');
		if (clean) {
			const formatted =
				Number(clean).toLocaleString('en-US', {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2
				}) + '$';
			event.target.value = formatted;
			const { date, hotel, type, index } = event.target.dataset;
			if (date) updateCell(date, hotel, type, Number(index), 'rate', formatted);
		}
	}

	// --- Bulk Rate Logic ---

	function openBulkModal(row: any) {
		bulkTarget = {
			hotel: row.hotelName,
			type: row.roomType,
			index: row.roomIndex,
			label: `${row.roomType} #${row.roomIndex + 1}`
		};
		bulkRateValue = '';
		isBulkModalOpen = true;
	}

	async function applyBulkRate() {
		if (!bulkTarget || !bulkRateValue) return;

		const clean = bulkRateValue.replace(/[^0-9.]/g, '');
		let formatted = '';
		if (clean) {
			formatted =
				Number(clean).toLocaleString('en-US', {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2
				}) + '$';
		}

		dates.forEach((date) => {
			ensureCellExists(date, bulkTarget!.hotel, bulkTarget!.type, bulkTarget!.index);
			localData[date][bulkTarget!.hotel][bulkTarget!.type][bulkTarget!.index]['rate'] = formatted;
		});

		localData = { ...localData };
		renderKey++; // Force refresh
		isBulkModalOpen = false;
		clearTimeout(debouncer);
		await saveToDb();
	}
</script>

<div
	class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden relative"
>
	{#if loading}
		<div class="flex items-center justify-center h-full">
			<div
				class="w-8 h-8 border-4 border-lime border-t-transparent rounded-full animate-spin"
			></div>
		</div>
	{:else}
		<div class="overflow-auto scrollbar-hide h-full">
			<table class="w-full border-collapse">
				<thead class="sticky top-0 z-30 bg-[#2A2A2A]">
					<tr>
						<th
							class="p-4 text-center text-white bg-[#2A2A2A] min-w-[140px] border-b border-gray1 sticky left-0 z-40 text-base font-bold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]"
						>
							Room / Date
						</th>
						{#each dates as date}
							<th
								class="p-3 text-center text-white bg-[#2A2A2A] min-w-[130px] border-b border-l border-gray1 text-base font-medium"
							>
								{formatDateHeader(date)}
							</th>
						{/each}
						<th
							class="p-3 text-center text-gray3 bg-[#2A2A2A] min-w-[100px] border-b border-l border-gray1 sticky right-0 z-40 text-base font-bold shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.5)]"
						>
							TOTAL
						</th>
					</tr>
				</thead>
				
				{#key renderKey}
				<tbody>
					{#each gridRows as row, rIndex}
						{#if row.isHeader}
							<tr class="bg-[#1A1A1A]">
								<td class="p-3 sticky left-0 z-20 bg-[#1A1A1A] border-b border-gray1">
									<span
										class="font-bold {colors[row.name] ||
											'text-problem'} text-lg text-center uppercase tracking-wider block w-full"
									>
										{row.name}
									</span>
								</td>
								<td class="border-b border-gray1 bg-[#1A1A1A]" colspan={dates.length + 1}></td>
							</tr>
						{:else}
							<tr class="transition-colors group">
								<td
									class="p-0 border-b border-r border-gray1 bg-navbar sticky left-0 z-20 min-w-[140px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]"
								>
									<button
										type="button"
										class="w-full h-full p-4 text-center group focus:outline-none focus:bg-gray1 cursor-pointer"
										on:click={() => openBulkModal(row)}
										title="Click to set rate for entire row"
									>
										<span class="text-gray3/90 font-bold text-md block hover:text-lime">
											{row.roomType} #{row.roomIndex + 1}
										</span>
									</button>
								</td>

								{#each dates as date}
									{@const isDisabled = getValue(date, row.hotelName, row.roomType, row.roomIndex, 'disabled')}
									<td class="p-2 border-b border-r border-gray1 min-w-[130px] align-top relative h-[88px]">
										
										<button 
											type="button"
											class="absolute top-1 right-1 z-20 p-1 transition-colors rounded hover:bg-black/50 cursor-pointer"
											title={isDisabled ? "Enable Room" : "Disable Room (Exclude from totals)"}
											on:click={() => updateCell(date, row.hotelName, row.roomType, row.roomIndex, 'disabled', !isDisabled)}
										>
											{#if isDisabled}
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-lime" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
												  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
												</svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray3 hover:text-problem" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
												  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
												</svg>
											{/if}
										</button>

										{#if isDisabled}
											<div class="h-full w-full flex items-center justify-center bg-transparent">
												<span class="text-gray2/40 font-bold text-sm select-none italic tracking-wide">Not Booked</span>
											</div>
										{:else}
											<div class="flex flex-col gap-1 h-full">
												<div
													class="flex items-center justify-between gap-2 bg-gray rounded-md px-2 py-1.5 border border-gray1/30"
												>
													<input
														type="text"
														placeholder="Artist"
														class="w-2/3 bg-transparent text-sm font-bold text-lime placeholder-gray3 focus:outline-none focus:placeholder-transparent"
														value={getValue(date, row.hotelName, row.roomType, row.roomIndex, 'artist') || ''}
														on:input={(e) =>
															updateCell(
																date,
																row.hotelName,
																row.roomType,
																row.roomIndex,
																'artist',
																e.currentTarget.value
															)}
													/>
													<input
														type="text"
														placeholder="$"
														data-date={date}
														data-hotel={row.hotelName}
														data-type={row.roomType}
														data-index={row.roomIndex}
														class="w-1/3 bg-transparent text-sm text-right text-white font-bold placeholder-gray2/30 focus:outline-none focus:placeholder-transparent pr-4" 
														value={getValue(date, row.hotelName, row.roomType, row.roomIndex, 'rate') || ''}
														on:input={(e) =>
															updateCell(
																date,
																row.hotelName,
																row.roomType,
																row.roomIndex,
																'rate',
																e.currentTarget.value
															)}
														on:blur={formatCurrency}
													/>
												</div>

												<div class="flex gap-1 items-center mt-auto">
													<input
														type="text"
														placeholder="Guest Name"
														class="flex-1 px-1 pt-1 bg-transparent text-gray3 text-sm font-medium focus:text-white transition-colors focus:outline-none placeholder-gray2/20 focus:placeholder-transparent"
														value={getValue(date, row.hotelName, row.roomType, row.roomIndex, 'name') || ''}
														on:input={(e) =>
															updateCell(
																date,
																row.hotelName,
																row.roomType,
																row.roomIndex,
																'name',
																e.currentTarget.value
															)}
													/>
													<input
														type="text"
														placeholder="IN"
														data-date={date}
														data-hotel={row.hotelName}
														data-type={row.roomType}
														data-index={row.roomIndex}
														data-field="in_time"
														class="w-9 bg-gray1/30 rounded px-1 py-0.5 text-[10px] text-center text-confirmed font-mono focus:bg-gray1 focus:outline-none placeholder:text-gray2/20 focus:placeholder-transparent uppercase"
														value={getValue(date, row.hotelName, row.roomType, row.roomIndex, 'in_time') || ''}
														on:blur={formatTimeInput}
													/>
													<input
														type="text"
														placeholder="OUT"
														data-date={date}
														data-hotel={row.hotelName}
														data-type={row.roomType}
														data-index={row.roomIndex}
														data-field="out_time"
														class="w-9 bg-gray1/30 rounded px-1 py-0.5 text-[10px] text-center text-problem font-mono focus:bg-gray1 focus:outline-none placeholder:text-gray2/20 focus:placeholder-transparent uppercase"
														value={getValue(date, row.hotelName, row.roomType, row.roomIndex, 'out_time') || ''}
														on:blur={formatTimeInput}
													/>
												</div>
											</div>
										{/if}
									</td>
								{/each}

								<td
									class="p-4 border-b border-l border-gray1 bg-[#1A1A1A] sticky right-0 z-20 text-center min-w-[120px] shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.5)]"
								>
									<span class="text-gray3 font-bold text-[16px]">
										{formatMoney(getRowTotal(row.hotelName, row.roomType, row.roomIndex))}
									</span>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
				{/key}
				
				<tfoot class="sticky bottom-0 z-40 bg-[#2A2A2A]">
					<tr>
						<td
							class="p-4 text-center text-gray3 bg-[#2A2A2A] sticky left-0 z-50 text-sm font-bold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]"
						>
							DAILY TOTAL
						</td>
						{#key renderKey}
							{#each dates as date}
								<td
									class="p-3 text-right text-gray3 bg-[#2A2A2A] border-l border-gray1 text-s font-bold"
								>
									{formatMoney(getColumnTotal(date))}
								</td>
							{/each}
							<td
								class="p-3 text-right text-white bg-[#2A2A2A] border-l border-gray1 sticky right-0 z-50 text-lg font-black shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.5)]"
							>
								{formatMoney(getGrandTotal())}
							</td>
						{/key}
					</tr>
				</tfoot>
			</table>
		</div>
	{/if}

	{#if isBulkModalOpen && bulkTarget}
		<div class="absolute inset-0 z-50 flex items-center justify-center p-4">
			<button
				type="button"
				class="absolute inset-0 bg-black/60 backdrop-blur-sm w-full h-full cursor-default border-none"
				on:click={() => (isBulkModalOpen = false)}
				aria-label="Close modal"
			></button>

			<div
				class="relative bg-navbar border border-gray1 rounded-xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 pointer-events-auto"
			>
				<div>
					<h3 class="text-white font-bold text-lg">Room - Update Rate</h3>
					<p class="text-gray2 text-sm mt-1">
						Set rate for <span class="text-lime">{bulkTarget.label}</span> for all dates
					</p>
				</div>

				<div class="flex flex-col gap-1">
					<label for="bulk-rate-input" class="text-xs text-lime font-bold uppercase">Rate</label>
					<input
						id="bulk-rate-input"
						type="text"
						bind:value={bulkRateValue}
						placeholder="e.g. 250.00$"
						class="w-full bg-[#1A1A1A] border border-gray1 rounded-lg px-4 py-2 text-white placeholder-gray2 font-bold focus:border-lime focus:outline-none"
						on:keydown={(e) => e.key === 'Enter' && applyBulkRate()}
					/>
				</div>

				<div class="flex gap-2 justify-end mt-2">
					<button
						type="button"
						class="px-4 py-2 text-gray2 text-sm font-bold hover:text-white cursor-pointer"
						on:click={() => (isBulkModalOpen = false)}
					>
						Cancel
					</button>
					<button
						type="button"
						class="px-6 py-2 bg-lime text-black rounded-full text-sm font-bold hover:bg-lime/90 cursor-pointer"
						on:click={applyBulkRate}
					>
						Apply Rate
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
</style>