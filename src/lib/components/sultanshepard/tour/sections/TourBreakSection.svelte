<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { BreakInfoData } from '$lib/types/tour';
	import Field from '../ui/Field.svelte';
	import TextArea from '../ui/TextArea.svelte';

	export let data: BreakInfoData = {};

	const dispatch = createEventDispatcher();
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};
</script>

<div class="space-y-3">
	<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
		<Field
			label="🚌 Bus location"
			placeholder="Where is the bus parked during the break?"
			bind:value={data.bus_location}
			on:change={changed}
		/>
		<Field
			label="🚚 Truck location"
			placeholder="Where is the truck parked during the break?"
			bind:value={data.truck_location}
			on:change={changed}
		/>
	</div>
	<TextArea
		label="Notes"
		rows={4}
		placeholder="Anything else about this break (driver days off, maintenance, etc.)"
		bind:value={data.notes}
		on:change={changed}
	/>
</div>
