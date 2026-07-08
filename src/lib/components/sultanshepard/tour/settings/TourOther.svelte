<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { getUsdCadRate, setUsdCadRate } from '$lib/services/tourService';
	import { DEFAULT_USD_CAD_RATE } from '$lib/types/tour';

	const dispatch = createEventDispatcher();

	// Shared styling — mirrors the other settings tabs
	const inputCls =
		'w-full bg-black/40 rounded-full px-4 py-2 text-sm text-white placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime transition';
	const labelCls = 'text-[10px] uppercase tracking-wider text-gray2';

	let rate: number = DEFAULT_USD_CAD_RATE;
	let loading = true;
	let saving = false;
	let error = '';

	// Live preview amount (CAD) used to illustrate the conversion
	let previewCad = 1000;
	$: previewUsd = rate > 0 ? previewCad / rate : 0;

	onMount(async () => {
		try {
			rate = await getUsdCadRate();
		} catch (e) {
			console.error('Failed to load USD/CAD rate', e);
			error = 'Could not load the saved rate. Showing the default.';
			rate = DEFAULT_USD_CAD_RATE;
		} finally {
			loading = false;
		}
	});

	async function save() {
		const n = Number(rate);
		if (!Number.isFinite(n) || n <= 0) {
			error = 'Enter a valid rate greater than 0.';
			return;
		}
		saving = true;
		error = '';
		try {
			await setUsdCadRate(n);
			rate = n;
			dispatch('saved');
		} catch (e) {
			console.error('Failed to save USD/CAD rate', e);
			error = 'Failed to save. Please try again.';
		} finally {
			saving = false;
		}
	}
</script>

<div class="space-y-8">
	<div>
		<h3 class="text-xs font-bold text-gray2 mb-1 uppercase tracking-wider">Currency</h3>
		<p class="text-xs text-gray2 mb-4">
			A single fixed exchange rate used across the planner to convert CAD amounts (e.g. crew
			salaries) into USD in the show budget.
		</p>

		{#if loading}
			<p class="text-sm text-gray2 italic">Loading…</p>
		{:else}
			<div class="bg-black/30 rounded-2xl p-5 max-w-md space-y-4">
				<label class="block">
					<span class={labelCls}>Fixed USD / CAD Rate</span>
					<div class="relative mt-1">
						<span
							class="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray2 pointer-events-none"
							>1 USD =</span
						>
						<input
							type="number"
							step="0.0001"
							min="0"
							class="{inputCls} pl-20 pr-14"
							bind:value={rate}
						/>
						<span
							class="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray2 pointer-events-none"
							>CAD</span
						>
					</div>
					<span class="text-[10px] text-gray2 mt-1 block">
						USD/CAD pair — how many CAD equal 1 USD (e.g. {DEFAULT_USD_CAD_RATE}).
					</span>
				</label>

				<div class="text-xs text-gray3 border-t border-white/5 pt-3">
					Preview:
					<span class="text-white">${previewCad.toLocaleString()} CAD</span>
					≈
					<span class="text-lime"
						>${previewUsd.toLocaleString(undefined, {
							minimumFractionDigits: 2,
							maximumFractionDigits: 2
						})} USD</span
					>
				</div>

				{#if error}
					<p class="text-problem text-xs">{error}</p>
				{/if}

				<div class="flex justify-end pt-1">
					<button
						type="button"
						class="cursor-pointer px-5 py-2.5 rounded-full bg-lime text-black text-sm font-bold hover:opacity-90 transition disabled:opacity-40"
						disabled={saving}
						on:click={save}
					>
						{saving ? 'Saving…' : 'Save rate'}
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>