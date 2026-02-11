<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase';

	export let trackerId: number;

	let tracker: any = null;
	let dates: string[] = [];
	let loading = true;
	let debouncer: any;

	// Structure: { hotelName: string, roomType: string, roomIndex: number }
	let gridRows: any[] = [];

	// Local state of input data
	let localData: any = {};
	let channel: any;

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
					// Update cell data
					if (payload.new.tracker_data) {
						localData = payload.new.tracker_data;
					}
					// Check if configuration changed (Rows or Dates) to rebuild grid
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

		// --- CHANGE START: Custom Sorting Logic ---
		// Define the priority order
		const hotelOrder = ['Alt Hotel', 'Monville', 'W Hotel'];

		const sortedConfig = [...config].sort((a, b) => {
			const indexA = hotelOrder.indexOf(a.name);
			const indexB = hotelOrder.indexOf(b.name);

			// 1. If both are in the priority list, sort by the list order
			if (indexA !== -1 && indexB !== -1) return indexA - indexB;

			// 2. If only A is in the list, A comes first
			if (indexA !== -1) return -1;

			// 3. If only B is in the list, B comes first
			if (indexB !== -1) return 1;

			// 4. If neither are in the list (custom hotels), sort alphabetically at the end
			return a.name.localeCompare(b.name);
		});
		// --- CHANGE END ---

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

	function updateCell(
		date: string,
		hotel: string,
		type: string,
		index: number,
		field: string,
		value: string
	) {
		if (!localData[date]) localData[date] = {};
		if (!localData[date][hotel]) localData[date][hotel] = {};
		if (!localData[date][hotel][type]) localData[date][hotel][type] = {};
		if (!localData[date][hotel][type][index]) localData[date][hotel][type][index] = {};

		localData[date][hotel][type][index][field] = value;
		localData = localData;

		clearTimeout(debouncer);
		debouncer = setTimeout(saveToDb, 1000);
	}

	async function saveToDb() {
		await supabase.from('hotel_tracker').update({ tracker_data: localData }).eq('id', trackerId);
	}

	function getValue(date: string, hotel: string, type: string, index: number, field: string) {
		try {
			return localData[date][hotel][type][index][field] || '';
		} catch (e) {
			return '';
		}
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

	// Colors for headers
	const colors: any = {
		'Alt Hotel': 'text-confirmed',
		Monville: 'text-question',
		'W Hotel': 'text-info',
		Other: 'text-problem'
	};

	// Formatter for Currency Input
	function formatCurrency(event: any) {
		let val = event.target.value.toString();
		// Remove existing $ and commas to check raw value
		const clean = val.replace(/[^0-9.]/g, '');

		if (clean) {
			// Format with commas and append $
			const formatted = Number(clean).toLocaleString('en-US') + '$';
			event.target.value = formatted;

			// Trigger update to save the formatted value
			const { date, hotel, type, index } = event.target.dataset;
			if (date) updateCell(date, hotel, type, Number(index), 'rate', formatted);
		}
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
							class="p-4 text-center text-white bg-[#2A2A2A] min-w-[140px] border-b border-gray1 sticky left-0 z-40 text-base font-bold"
						>
							Room / Date
						</th>
						{#each dates as date}
							<th
								class="p-3 text-center text-white bg-[#2A2A2A] min-w-[220px] border-b border-l border-gray1 text-base font-medium"
							>
								{formatDateHeader(date)}
							</th>
						{/each}
					</tr>
				</thead>
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
								<td class="border-b border-gray1 bg-[#1A1A1A]" colspan={dates.length}></td>
							</tr>
						{:else}
							<tr class=" transition-colors">
								<td
									class="p-4 border-b border-r border-gray1 bg-navbar sticky left-0 z-20 min-w-[140px] text-center"
								>
									<span class="text-gray3/90 font-bold text-md block">
										{row.roomType} #{row.roomIndex + 1}
									</span>
								</td>

								{#each dates as date}
									<td class="p-2 border-b border-r border-gray1 min-w-[220px] align-top">
										<div class="flex flex-col gap-1">
											<div
												class="flex items-center justify-between gap-2 bg-gray rounded-md px-2 py-1.5 border border-gray1/30"
											>
												<input
													type="text"
													placeholder="Artist Name"
													class="w-2/3 bg-transparent text-sm font-bold text-lime placeholder-gray3 focus:outline-none"
													value={getValue(
														date,
														row.hotelName,
														row.roomType,
														row.roomIndex,
														'artist'
													)}
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
													class="w-1/3 bg-transparent text-sm text-right text-white font-bold placeholder-gray2/30 focus:outline-none"
													value={getValue(date, row.hotelName, row.roomType, row.roomIndex, 'rate')}
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

											<div class="relative px-1">
												<input
													type="text"
													placeholder="Guest Name"
													class="w-full px-1 pt-1.5 bg-transparent text-gray3 text-sm font-medium focus:text-white transition-colors focus:outline-none placeholder-gray2/20"
													value={getValue(date, row.hotelName, row.roomType, row.roomIndex, 'name')}
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
											</div>
										</div>
									</td>
								{/each}
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
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
