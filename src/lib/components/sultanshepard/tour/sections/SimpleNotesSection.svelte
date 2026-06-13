<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SimpleNotesData } from '$lib/types/tour';
	import TextArea from '../ui/TextArea.svelte';

	export let data: SimpleNotesData = {};
	export let placeholder = 'Notes…';

	const dispatch = createEventDispatcher();
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};
</script>

<TextArea label="" rows={6} {placeholder} bind:value={data.notes} on:change={changed} />
