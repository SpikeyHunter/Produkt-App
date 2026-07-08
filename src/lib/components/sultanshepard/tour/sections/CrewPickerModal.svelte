<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { SSCrew, CrewType } from '$lib/types/tour';

	export let open = false;
	export let title = 'Add Crew';
	export let options: SSCrew[] = [];
	export let assignedIds: string[] = []; // Track already selected crew
	const dispatch = createEventDispatcher();

	const SECTIONS: { label: string; types: CrewType[] }[] = [
		{ label: 'Artist & Singers', types: ['artist', 'singer'] },
		{ label: 'Production', types: ['prod'] },
		{ label: 'Management', types: ['management'] },
		{ label: 'Media', types: ['media'] }
	];

	let search = '';

	// Used instead of the raw `autofocus` attribute
	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}

	$: filtered = options.filter((c) =>
		`${c.name} ${c.role || ''}`.toLowerCase().includes(search.toLowerCase())
	);

	function groupFor(types: CrewType[]) {
		return filtered
			.filter((c) => types.includes(c.crew_type))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	// Toggle functionality allows adding/removing multiple members without closing the modal
	function toggle(member: SSCrew, isAssigned: boolean) {
		if (isAssigned) {
			dispatch('remove', member);
		} else {
			dispatch('pick', member);
		}
	}

	function close() {
		open = false;
		search = '';
		dispatch('close');
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm"
		on:click|self={close}
		role="presentation"
		transition:fade={{ duration: 200 }}
	>
		<div
			class="bg-navbar rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
			in:fly={{ y: 30, duration: 400, easing: cubicOut }}
			out:fade={{ duration: 200 }}
		>
			<div class="flex items-center gap-3 px-5 py-3.5 shrink-0 bg-navbar">
				<h2 class="text-sm font-bold text-white flex-1">{title}</h2>
				<button class="text-gray2 hover:text-white transition cursor-pointer" on:click={close} aria-label="Close">
					<svg
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg
					>
				</button>
			</div>

			<div class="px-5 py-3 shrink-0 bg-black/20">
				<input
					class="w-full bg-black/40 rounded-full px-4 py-2 text-sm text-white placeholder-gray2 outline-none border-none focus:bg-black/60 transition"
					placeholder="Search crew…"
					bind:value={search}
					use:focusOnMount
				/>
			</div>

			<div class="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
				{#each SECTIONS as section}
					{@const members = groupFor(section.types)}
					{#if members.length > 0}
						<div>
							<h3 class="text-[10px] font-bold text-gray2 mb-2 uppercase tracking-wider pl-1">
								{section.label}
							</h3>
							<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
								{#each members as member (member.id)}
									{@const isAssigned = assignedIds.includes(member.id)}
									<button
										type="button"
										class="w-full text-left transition rounded-xl px-3 py-2 flex items-center justify-between gap-2 {isAssigned ? 'bg-black/40 opacity-70 cursor-pointer hover:opacity-100' : 'bg-black/30 hover:bg-black/50 cursor-pointer'}"
										on:click={() => toggle(member, isAssigned)}
									>
										<span class="flex flex-col min-w-0">
											<span
												class="text-[10px] font-bold uppercase tracking-wider {member.crew_type === 'artist' ? 'text-lime' : 'text-gray2'}"
											>
												{member.role || member.crew_type}
											</span>
											<span class="text-sm text-white truncate">{member.name}</span>
										</span>
										{#if isAssigned}
											<svg class="w-4 h-4 text-lime shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" /></svg>
										{:else}
											<svg class="w-4 h-4 text-gray2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
										{/if}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				{/each}

				{#if filtered.length === 0}
					<p class="text-xs text-gray2 italic text-center py-6">
						{options.length === 0 ? 'No crew available.' : 'No matches.'}
					</p>
				{/if}
			</div> <div class="px-5 py-4 border-t border-gray1 shrink-0 bg-navbar flex justify-end">
				<button
					type="button"
					class="bg-lime text-black font-bold text-sm px-6 py-2 rounded-full hover:brightness-110 transition cursor-pointer"
					on:click={close}
				>
					Done
				</button>
			</div>

		</div> </div>
{/if}