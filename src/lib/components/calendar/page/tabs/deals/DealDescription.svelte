<script lang="ts">
	import type { DealDescription } from '../../../../../types/tabs/deals';
	import { slide, fade } from 'svelte/transition';

	export let description: DealDescription;

	function decrement(section: 'hotels', field: 'nights' | 'rooms' | 'suites' | 'custom_amount') {
		// Nights can't drop below 1 while at least one room or suite is booked.
		const floor = section === 'hotels' && field === 'nights' && hasRoomsOrSuites ? 1 : 0;
		description[section][field] = Math.max(floor, description[section][field] - 1);
	}

	function increment(section: 'hotels', field: 'nights' | 'rooms' | 'suites' | 'custom_amount') {
		description[section][field]++;
	}

	// Adding a room or suite implies at least one night — bump 0 nights up to 1
	// (covers increments, manual edits and legacy deals saved with 0 nights).
	$: hasRoomsOrSuites =
		(Number(description?.hotels?.rooms) || 0) + (Number(description?.hotels?.suites) || 0) > 0;
	$: if (description?.hotels && hasRoomsOrSuites && !(Number(description.hotels.nights) || 0)) {
		description.hotels.nights = 1;
	}

	// Defensive init so binding never hits an undefined object (legacy deals).
	$: if (description && !description.setTimes)
		description.setTimes = { enabled: false, from: '', to: '' };
	$: if (description && !description.billing)
		description.billing = { enabled: false, notes: '' };
	$: if (description && !description.bookingNotes)
		description.bookingNotes = { enabled: false, notes: '' };

	// Derive set length (in minutes) from the two 24h "HH:MM" time inputs.
	// Handles sets that cross midnight (e.g. 11:30PM -> 12:30AM).
	function computeSetLength(from: string, to: string): number | null {
		if (!from || !to) return null;
		const [fh, fm] = from.split(':').map(Number);
		const [th, tm] = to.split(':').map(Number);
		if ([fh, fm, th, tm].some((n) => Number.isNaN(n))) return null;
		let mins = th * 60 + tm - (fh * 60 + fm);
		if (mins < 0) mins += 24 * 60;
		return mins;
	}

	$: setLengthMins = computeSetLength(description?.setTimes?.from, description?.setTimes?.to);
</script>

<div class="mt-8">
	<h3 class="font-bold mb-6 text-gray3">Description / Logistics</h3>

	<div class="flex flex-col lg:flex-row gap-6 text-sm bg-navbar p-4 rounded-2xl items-stretch">
		<div class="w-full lg:w-[240px] flex flex-col min-h-[220px]">
			<div class="flex items-center justify-between border-b border-[#333] pb-4 mb-4 shrink-0">
				<h4 class="font-bold text-white whitespace-nowrap">Hotels</h4>
				<button
					type="button"
					role="switch"
					aria-checked={description.hotels.enabled}
					aria-label="Toggle Hotels section"
					on:click={() => (description.hotels.enabled = !description.hotels.enabled)}
					class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-lime
                    {description.hotels.enabled ? 'bg-lime' : 'bg-[#444]'}"
				>
					<span
						aria-hidden="true"
						class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out
                        {description.hotels.enabled ? 'translate-x-5' : 'translate-x-0'}"
					></span>
				</button>
			</div>

			<div class="grid items-start flex-1">
				{#if description.hotels.enabled}
					<div class="col-start-1 row-start-1" transition:slide={{ duration: 300 }}>
						<div class="flex flex-col gap-2 pb-2">
							

							<div class="flex items-center justify-between text-white font-bold">
								<span>Rooms</span>
								<div class="flex items-center gap-2 rounded-xl p-1">
									<button on:click={() => decrement('hotels', 'rooms')} class="w-7 h-7 bg-gray1 rounded-lg hover:text-lime flex items-center justify-center cursor-pointer text-lg leading-none">-</button>
									<span class="w-5 text-center text-sm">{description.hotels.rooms}</span>
									<button on:click={() => increment('hotels', 'rooms')} class="w-7 h-7 bg-gray1 rounded-lg hover:text-lime flex items-center justify-center cursor-pointer text-lg leading-none">+</button>
								</div>
							</div>

							<div class="flex items-center justify-between text-white font-bold pb-2">
								<span>Suites</span>
								<div class="flex items-center gap-2 rounded-xl p-1">
									<button on:click={() => decrement('hotels', 'suites')} class="w-7 h-7 bg-gray1 rounded-lg hover:text-lime flex items-center justify-center cursor-pointer text-lg leading-none">-</button>
									<span class="w-5 text-center text-sm">{description.hotels.suites}</span>
									<button on:click={() => increment('hotels', 'suites')} class="w-7 h-7 bg-gray1 rounded-lg hover:text-lime flex items-center justify-center cursor-pointer text-lg leading-none">+</button>
								</div>
							</div>
							<div class="flex items-center justify-between text-white font-bold pb-2">
								<span>Nights</span>
								<div class="flex items-center gap-2 rounded-xl p-1">
									<button on:click={() => decrement('hotels', 'nights')} class="w-7 h-7 bg-gray1 rounded-lg hover:text-lime flex items-center justify-center cursor-pointer text-lg leading-none">-</button>
									<span class="w-5 text-center text-sm">{description.hotels.nights}</span>
									<button on:click={() => increment('hotels', 'nights')} class="w-7 h-7 bg-gray1 rounded-lg hover:text-lime flex items-center justify-center cursor-pointer text-lg leading-none">+</button>
								</div>
							</div>

							{#if !description.hotels.custom_room}
								<button
									class="text-lime text-xs font-bold flex items-center gap-2 mt-4 w-max hover:opacity-80 transition-opacity cursor-pointer"
									on:click={() => {
										description.hotels.custom_room = true;
										description.hotels.custom_name = 'Custom';
									}}
								>
									<span class="text-base bg-lime text-black rounded-full w-4 h-4 flex items-center justify-center leading-none">+</span> Add custom
								</button>
							{:else}
								<div transition:slide={{ duration: 300 }} class="flex items-center justify-between text-white font-bold w-full mt-4">
									<div class="flex items-center gap-1 w-[55%]">
										<input
											type="text"
											bind:value={description.hotels.custom_name}
											class="w-full bg-transparent text-white font-bold focus:outline-none focus:ring-0 border-b border-transparent focus:border-lime placeholder:text-gray2"
										/>
										<button
											on:click={() => {
												description.hotels.custom_room = false;
												description.hotels.custom_name = '';
												description.hotels.custom_amount = 0;
											}}
											class="text-gray2 hover:text-red-500 hover:bg-problem font-bold px-1 transition-colors cursor-pointer text-sm"
											aria-label="Remove custom">✕</button>
									</div>
									<div class="flex items-center gap-2 rounded-xl p-1">
										<button on:click={() => decrement('hotels', 'custom_amount')} class="w-7 h-7 bg-gray1 rounded-lg hover:text-lime flex items-center justify-center cursor-pointer text-lg leading-none">-</button>
										<span class="w-5 text-center text-sm">{description.hotels.custom_amount}</span>
										<button on:click={() => increment('hotels', 'custom_amount')} class="w-7 h-7 bg-gray1 rounded-lg hover:text-lime flex items-center justify-center cursor-pointer text-lg leading-none">+</button>
									</div>
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<div class="col-start-1 row-start-1 w-full h-full flex items-center justify-center" transition:fade={{ duration: 200 }}>
						<span class="text-gray2 font-bold italic pb-12">Not Applicable</span>
					</div>
				{/if}
			</div>
		</div>

		<div class="w-full lg:w-[260px] flex flex-col gap-6">
			<div class="flex flex-col border-b border-[#333] pb-4">
				<div class="flex items-center justify-between mb-4">
					<h4 class="font-bold text-white whitespace-nowrap">Ground Transport</h4>
					<button
						type="button"
						role="switch"
						aria-checked={description.groundTransport.enabled}
						aria-label="Toggle Ground Transport section"
						on:click={() => (description.groundTransport.enabled = !description.groundTransport.enabled)}
						class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-lime
                        {description.groundTransport.enabled ? 'bg-lime' : 'bg-[#444]'}"
					>
						<span
							aria-hidden="true"
							class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out
                            {description.groundTransport.enabled ? 'translate-x-5' : 'translate-x-0'}"
						></span>
					</button>
				</div>
				<div class="grid items-start min-h-[24px]">
					{#if description.groundTransport.enabled}
						<div class="col-start-1 row-start-1" transition:fade={{ duration: 200 }}>
							<div class="px-2 pb-1">
								<span class="text-gray3 font-bold italic">Covered by New City Gas</span>
							</div>
						</div>
					{:else}
						<div class="col-start-1 row-start-1" transition:fade={{ duration: 200 }}>
							<div class="px-2 pb-1">
								<span class="text-gray2/50 font-bold italic">Not included in the Deal</span>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<div class="flex flex-col border-b border-[#333] pb-4">
				<div class="flex items-center justify-between mb-4">
					<h4 class="font-bold text-white whitespace-nowrap">Immigration</h4>
					<button
						type="button"
						role="switch"
						aria-checked={description.immigration.enabled}
						aria-label="Toggle Immigration section"
						on:click={() => (description.immigration.enabled = !description.immigration.enabled)}
						class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-lime
                        {description.immigration.enabled ? 'bg-lime' : 'bg-[#444]'}"
					>
						<span
							aria-hidden="true"
							class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out
                            {description.immigration.enabled ? 'translate-x-5' : 'translate-x-0'}"
						></span>
					</button>
				</div>
				<div class="grid items-start min-h-[24px]">
					{#if description.immigration.enabled}
						<div class="col-start-1 row-start-1" transition:fade={{ duration: 200 }}>
							<div class="px-2 pb-1">
								<span class="text-gray3 font-bold italic">Exemption letter to be provided</span>
							</div>
						</div>
					{:else}
						<div class="col-start-1 row-start-1" transition:fade={{ duration: 200 }}>
							<div class="px-2 pb-1">
								<span class="text-gray2/50 font-bold italic">Not included in the Deal</span>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="w-full lg:flex-1 flex flex-col min-h-[220px]">
			<div class="flex items-center justify-between border-b border-[#333] pb-4 mb-4 shrink-0">
				<h4 class="font-bold text-white whitespace-nowrap">Notes</h4>
				<button
					type="button"
					role="switch"
					aria-checked={description.other.enabled}
					aria-label="Toggle Notes section"
					on:click={() => (description.other.enabled = !description.other.enabled)}
					class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-lime
                    {description.other.enabled ? 'bg-lime' : 'bg-[#444]'}"
				>
					<span
						aria-hidden="true"
						class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out
                        {description.other.enabled ? 'translate-x-5' : 'translate-x-0'}"
					></span>
				</button>
			</div>

			<div class="grid items-start w-full flex-1">
				{#if description.other.enabled}
					<div class="col-start-1 row-start-1 w-full h-full" transition:fade={{ duration: 200 }}>
						<div class="pb-2 h-full">
							<textarea
								bind:value={description.other.notes}
								placeholder="Enter specific notes"
								class="w-full h-[160px] bg-black/20 placeholder:text-gray2/50 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:ring-1 focus:ring-lime outline-none resize-none"
							></textarea>
						</div>
					</div>
				{:else}
					<div class="col-start-1 row-start-1 w-full h-full flex items-center justify-center" transition:fade={{ duration: 200 }}>
						<span class="text-gray2 font-bold italic pb-12">Not Applicable</span>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex flex-col lg:flex-row gap-6 text-sm bg-navbar p-4 rounded-2xl items-stretch mt-6">
		<!-- Set Times -->
		<div class="w-full lg:w-[240px] flex flex-col min-h-[160px]">
			<div class="flex items-center justify-between border-b border-[#333] pb-4 mb-4 shrink-0">
				<h4 class="font-bold text-white whitespace-nowrap">Set Times</h4>
				<button
					type="button"
					role="switch"
					aria-checked={description.setTimes.enabled}
					aria-label="Toggle Set Times section"
					on:click={() => (description.setTimes.enabled = !description.setTimes.enabled)}
					class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-lime
                    {description.setTimes.enabled ? 'bg-lime' : 'bg-[#444]'}"
				>
					<span
						aria-hidden="true"
						class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out
                        {description.setTimes.enabled ? 'translate-x-5' : 'translate-x-0'}"
					></span>
				</button>
			</div>
			<div class="grid items-start flex-1">
				{#if description.setTimes.enabled}
					<div class="col-start-1 row-start-1 w-full" transition:slide={{ duration: 300 }}>
						<div class="flex items-end gap-3">
							<div class="flex-1">
								<span class="block text-[11px] font-bold text-gray2 mb-1 uppercase tracking-wide">From</span>
								<input
									type="time"
									bind:value={description.setTimes.from}
									class="w-full bg-black/20 rounded-xl px-3 py-2 text-sm font-bold text-white focus:ring-1 focus:ring-lime outline-none [color-scheme:dark]"
								/>
							</div>
							<span class="text-gray2 font-bold pb-2">-</span>
							<div class="flex-1">
								<span class="block text-[11px] font-bold text-gray2 mb-1 uppercase tracking-wide">To</span>
								<input
									type="time"
									bind:value={description.setTimes.to}
									class="w-full bg-black/20 rounded-xl px-3 py-2 text-sm font-bold text-white focus:ring-1 focus:ring-lime outline-none [color-scheme:dark]"
								/>
							</div>
						</div>
						<div class="flex items-center justify-between mt-4 px-1">
							<span class="text-gray2 font-bold">Length</span>
							<span class="font-bold {setLengthMins !== null ? 'text-lime' : 'text-gray2/50'}">
								{setLengthMins !== null ? `${setLengthMins} min` : '—'}
							</span>
						</div>
					</div>
				{:else}
					<div class="col-start-1 row-start-1 w-full h-full flex items-center justify-center" transition:fade={{ duration: 200 }}>
						<span class="text-gray2 font-bold italic pb-8">Not Applicable</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Billing -->
		<div class="w-full lg:w-[260px] flex flex-col min-h-[160px]">
			<div class="flex items-center justify-between border-b border-[#333] pb-4 mb-4 shrink-0">
				<h4 class="font-bold text-white whitespace-nowrap">Billing</h4>
				<button
					type="button"
					role="switch"
					aria-checked={description.billing.enabled}
					aria-label="Toggle Billing section"
					on:click={() => (description.billing.enabled = !description.billing.enabled)}
					class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-lime
                    {description.billing.enabled ? 'bg-lime' : 'bg-[#444]'}"
				>
					<span
						aria-hidden="true"
						class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out
                        {description.billing.enabled ? 'translate-x-5' : 'translate-x-0'}"
					></span>
				</button>
			</div>
			<div class="grid items-start w-full flex-1">
				{#if description.billing.enabled}
					<div class="col-start-1 row-start-1 w-full h-full" transition:fade={{ duration: 200 }}>
						<textarea
							bind:value={description.billing.notes}
							placeholder="Enter billing notes"
							class="w-full h-[120px] bg-black/20 placeholder:text-gray2/50 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:ring-1 focus:ring-lime outline-none resize-none"
						></textarea>
					</div>
				{:else}
					<div class="col-start-1 row-start-1 w-full h-full flex items-center justify-center" transition:fade={{ duration: 200 }}>
						<span class="text-gray2 font-bold italic pb-8">Not Applicable</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Booking Notes -->
		<div class="w-full lg:flex-1 flex flex-col min-h-[160px]">
			<div class="flex items-center justify-between border-b border-[#333] pb-4 mb-4 shrink-0">
				<h4 class="font-bold text-white whitespace-nowrap">Booking Notes</h4>
				<button
					type="button"
					role="switch"
					aria-checked={description.bookingNotes.enabled}
					aria-label="Toggle Booking Notes section"
					on:click={() => (description.bookingNotes.enabled = !description.bookingNotes.enabled)}
					class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-lime
                    {description.bookingNotes.enabled ? 'bg-lime' : 'bg-[#444]'}"
				>
					<span
						aria-hidden="true"
						class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out
                        {description.bookingNotes.enabled ? 'translate-x-5' : 'translate-x-0'}"
					></span>
				</button>
			</div>
			<div class="grid items-start w-full flex-1">
				{#if description.bookingNotes.enabled}
					<div class="col-start-1 row-start-1 w-full h-full" transition:fade={{ duration: 200 }}>
						<textarea
							bind:value={description.bookingNotes.notes}
							placeholder="Add booking notes"
							class="w-full h-[120px] bg-black/20 placeholder:text-gray2/50 rounded-2xl px-4 py-3 text-sm font-bold text-white focus:ring-1 focus:ring-lime outline-none resize-none"
						></textarea>
					</div>
				{:else}
					<div class="col-start-1 row-start-1 w-full h-full flex items-center justify-center" transition:fade={{ duration: 200 }}>
						<span class="text-gray2 font-bold italic pb-8">Not Applicable</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>