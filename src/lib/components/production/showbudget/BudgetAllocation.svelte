<!--
  BudgetAllocation — where the money is fenced, and what's left of it.

  Every income line is either pooled ("All expenses") or earmarked for one
  category / one section. Fenced money is tracked against what that bucket
  actually spends; anything it goes over is drawn from the pool, which is
  exactly what makes pooled budget useful.
-->
<script lang="ts">
	import { slide } from 'svelte/transition';
	import { formatDisplay } from '$lib/utils/budgetUtils';
	import type { AllocationReport } from '$lib/utils/budgetUtils';

	export let report: AllocationReport | null = null;

	let open = true;

	$: rows = report?.rows || [];
	$: pool = report?.pool;
	const tone = (n: number) => (n < 0 ? 'text-problem' : 'text-confirmed');
</script>

<div class="bg-gray1 rounded-lg p-3">
	<button
		type="button"
		on:click={() => (open = !open)}
		class="w-full flex items-center justify-between gap-2 cursor-pointer"
	>
		<span class="text-white font-bold text-sm uppercase tracking-wider">Allocation</span>
		<svg class="w-3 h-3 text-gray2 transform transition-transform {open ? '' : '-rotate-90'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if open}
		<div class="mt-2 space-y-2" transition:slide|local={{ duration: 150 }}>
			{#if !report || (rows.length === 0 && !pool?.allocated)}
				<p class="text-gray2 text-[11px] leading-snug">
					Nothing allocated yet. On an income line, pick a category or a section under
					“Allocated to” to fence that money — or leave it on “All expenses” so it covers
					any overrun.
				</p>
			{:else}
				{#if pool && (pool.allocated > 0 || pool.spent > 0)}
					<div class="rounded-lg bg-navbar/60 p-2">
						<div class="flex items-baseline justify-between gap-2">
							<span class="text-white text-xs font-bold truncate">All expenses (pool)</span>
							<span class="text-xs font-bold {tone(pool.remaining)}">{formatDisplay(pool.remaining)}</span>
						</div>
						<div class="text-gray2 text-[10px] mt-0.5">
							{formatDisplay(pool.allocated)} pooled · {formatDisplay(pool.spent)} used
						</div>
						{#if pool.overruns > 0}
							<div class="text-problem text-[10px] mt-0.5">
								incl. {formatDisplay(pool.overruns)} covering overruns
							</div>
						{/if}
					</div>
				{/if}

				{#each rows as row (row.target)}
					<div class="rounded-lg bg-navbar/60 p-2">
						<div class="flex items-baseline justify-between gap-2">
							<span class="text-white text-xs font-bold truncate" title={row.label}>{row.label}</span>
							<span class="text-xs font-bold {tone(row.remaining)}">{formatDisplay(row.remaining)}</span>
						</div>
						<div class="text-gray2 text-[10px] mt-0.5">
							{formatDisplay(row.allocated)} allocated · {formatDisplay(row.spent)} spent
						</div>
						{#if row.remaining < 0}
							<div class="text-problem text-[10px] mt-0.5">over — drawn from the pool</div>
						{/if}
					</div>
				{/each}

				<div class="pt-2 border-t border-gray2/10 space-y-0.5 text-[10px]">
					{#if report.unusedFenced > 0}
						<div class="flex justify-between">
							<span class="text-gray2">Unused in fenced sections</span>
							<span class="text-gray3 font-bold">{formatDisplay(report.unusedFenced)}</span>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
