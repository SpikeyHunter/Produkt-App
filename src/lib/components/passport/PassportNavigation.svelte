<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Person } from '$lib/types/events';

	export let people: Person[] = [];
	export let currentPersonIndex = 0;

	const dispatch = createEventDispatcher();

	$: currentPerson = people[currentPersonIndex];

	function nextPerson() {
		if (currentPersonIndex < people.length - 1) {
			dispatch('navigate', currentPersonIndex + 1);
		}
	}

	function prevPerson() {
		if (currentPersonIndex > 0) {
			dispatch('navigate', currentPersonIndex - 1);
		}
	}

	function goToPerson(index: number) {
		dispatch('navigate', index);
	}
</script>

<div class="flex items-center justify-between">
	<div class="flex items-center gap-2">
		<button
			type="button"
			class="flex items-center justify-center w-7 h-7 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
			on:click={prevPerson}
			disabled={currentPersonIndex === 0}
			aria-label="Previous person"
		>
			<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M15 18l-6-6 6-6"/>
			</svg>
		</button>

		<div class="text-center">
			<h3 class="text-base font-bold text-white">
				{currentPerson?.firstName} {currentPerson?.lastName}
			</h3>
			<p class="text-xs text-gray2">
				{currentPerson?.role} • {currentPersonIndex + 1} of {people.length}
			</p>
		</div>

		<button
			type="button"
			class="flex items-center justify-center w-7 h-7 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
			on:click={nextPerson}
			disabled={currentPersonIndex === people.length - 1}
			aria-label="Next person"
		>
			<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M9 18l6-6-6-6"/>
			</svg>
		</button>
	</div>

	<!-- Person indicator dots -->
	<div class="flex items-center gap-1.5">
		{#each people as person, index}
			<button
				type="button"
				class="w-1.5 h-1.5 rounded-full transition-colors cursor-pointer {index === currentPersonIndex ? 'bg-lime' : 'bg-gray2'}"
				on:click={() => goToPerson(index)}
				aria-label="Go to {person.firstName} {person.lastName}"
			></button>
		{/each}
	</div>
</div>