<script lang="ts">
	import type { DealDescription } from '../../../../../types/tabs/deals';
	import { slide, fade } from 'svelte/transition';

	export let description: DealDescription;

	function decrement(section: 'hotels', field: 'nights' | 'rooms' | 'suites' | 'custom_amount') {
		description[section][field] = Math.max(0, description[section][field] - 1);
	}

	function increment(section: 'hotels', field: 'nights' | 'rooms' | 'suites' | 'custom_amount') {
		description[section][field]++;
	}
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
</div>