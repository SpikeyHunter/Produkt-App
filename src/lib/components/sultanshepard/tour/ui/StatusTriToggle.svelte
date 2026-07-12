<script lang="ts">
	// 3-state status button: TBD -> YES -> NO -> TBD (click to cycle)
	//   null  = TBD  -> color-proposed
	//   true  = YES  -> color-confirmed
	//   false = NO   -> color-problem
	//
	// Emits `change` with the *new* value (boolean | null). Parent stores it
	// verbatim (true / false / null) so the DB always has an explicit value,
	// never `undefined`.
	import { createEventDispatcher } from 'svelte';

	export let label: string;
	export let value: boolean | null | undefined = null;

	const dispatch = createEventDispatcher<{ change: boolean | null }>();

	// Click order: TBD -> YES -> NO -> TBD ...
	const ORDER: (boolean | null)[] = [null, true, false];

	function cycle() {
		const current = value ?? null;
		const idx = ORDER.indexOf(current);
		const next = ORDER[(idx + 1) % ORDER.length];
		dispatch('change', next);
	}

	$: state = value === true ? 'yes' : value === false ? 'no' : 'tbd';
	$: displayText = state === 'yes' ? 'Yes' : state === 'no' ? 'No' : 'TBD';
</script>

<div class="flex items-center gap-1.5">
	<span class="text-[10px] font-bold uppercase tracking-wider text-gray3">{label}</span>
	<button
		type="button"
		class="px-2.5 h-5 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-colors cursor-pointer select-none flex items-center justify-center
			{state === 'tbd'
			? 'bg-proposed/15 border-proposed text-proposed'
			: state === 'yes'
				? 'bg-confirmed/15 border-confirmed text-confirmed'
				: 'bg-problem/15 border-problem text-problem'}"
		on:click={cycle}
		title="Click to change: TBD → Yes → No"
	>
		{displayText}
	</button>
</div>