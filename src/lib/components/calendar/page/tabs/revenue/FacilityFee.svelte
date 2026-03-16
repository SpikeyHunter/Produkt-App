<script lang="ts">
	export let financials: any = {
		taxRate: 0,
		taxType: 'Divisor',
		facilityFee: 0
	};
	export let onReset: (() => void) | null = null;
</script>

<section class="space-y-4 pl-2 ">
    <div class="flex items-center justify-left max-w-4xl">
        <h3 class="text-xl font-black text-lime uppercase tracking-widest mr-4">Financials</h3>
        {#if onReset}
            <button 
                type="button" 
                on:click={onReset} 
                class="text-xs font-bold text-gray2 hover:text-problem pr-2 transition-colors hover:underline cursor-pointer"
            >
                Reset Values
            </button>
        {/if}
    </div>
    <div class="max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
		<div>
			<label for="facilityFee" class="block text-xs font-bold text-gray2 mb-1.5 ml-1">
				Facility Fee ($) 
			</label>
			<input
				id="facilityFee"
				type="number"
				min="0"
				step="0.01"
				placeholder="0.00"
				bind:value={financials.facilityFee}
				on:blur={(e) => {
					if (!e.currentTarget.value) financials.facilityFee = 0;
				}}
				class="w-full bg-gray1  rounded-3xl px-4 py-3 text-white placeholder-gray2/40 focus:border-lime focus:outline-none transition-colors text-sm"
			/>
		</div>

		<div>
			<label for="taxRate" class="block text-xs font-bold text-gray2 mb-1.5 ml-1">
				Tax Rate % 
			</label>
			<input
				id="taxRate"
				type="number"
				min="0"
				step="0.001"
				placeholder="0"
				bind:value={financials.taxRate}
				on:blur={(e) => {
					if (!e.currentTarget.value) financials.taxRate = 0;
				}}
				class="w-full bg-gray1 rounded-3xl px-4 py-3 text-white placeholder-gray2/40 focus:border-lime focus:outline-none transition-colors text-sm"
			/>
		</div>

		<div>
			<span class="block text-xs font-bold text-gray2 mb-1.5 ml-1">Tax Type</span>
			<div class="flex bg-gray1 rounded-3xl p-1 h-[46px]">
				<button
					type="button"
					class="flex-1 text-xs font-bold rounded-3xl transition-colors {financials.taxType ===
					'Divisor'
						? 'bg-lime text-black'
						: 'text-white cursor-pointer hover:bg-gray2/10'}"
					on:click={() => (financials.taxType = 'Divisor')}>Divisor</button
				>
				<button
					type="button"
					class="flex-1 text-xs font-bold rounded-3xl transition-colors {financials.taxType ===
					'Multiplier'
						? 'bg-lime text-black'
						: 'text-white cursor-pointer hover:bg-gray2/10'}"
					on:click={() => (financials.taxType = 'Multiplier')}>Multiplier</button
				>
			</div>
		</div>
	</div>
</section>

<style>
	/* Hide arrows on number inputs */
	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
