<script lang="ts">
	import type { DealTypeOption } from '../../../../../types/tabs/deals'; // Adjust path as needed

	export let dealType: DealTypeOption;

	const dealTypes: DealTypeOption[] = ['Flat', 'Door Deal', 'Plus', 'Versus'];
</script>

<div class="px-2 mb-8">
	<h3 class="font-bold mb-3 text-white">Deal Type</h3>
	<div class="grid grid-cols-4 gap-20">
		{#each dealTypes as type}
			<label class="group flex items-center cursor-pointer relative -ml-2">
				<div class="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-white/5 transition-colors duration-200">
					<div
						class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {dealType === type
							? 'border-lime'
							: 'border-gray2 group-hover:border-gray-400'}"
					>
						{#if dealType === type}
							<div class="w-2.5 h-2.5 bg-lime rounded-full"></div>
						{/if}
					</div>
				</div>
				<input type="radio" bind:group={dealType} value={type} class="hidden" />
				<span class="ml-1 font-bold {dealType === type ? 'text-white' : 'text-gray2 group-hover:text-gray-300'} transition-colors duration-200">{type}</span>
			</label>
		{/each}
		
	</div>
	
</div>