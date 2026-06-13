<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { SetListData, SetListSong, TracklistTrack } from '$lib/types/tour';
	import Field from '../ui/Field.svelte';

	export let data: SetListData = {};
	export let tracklist: TracklistTrack[] = []; // default template from Settings

	const dispatch = createEventDispatcher();
	const uid = () => Math.random().toString(36).slice(2, 10);
	const changed = () => {
		data = { ...data };
		dispatch('change');
	};

	let expandedId: string | null = null;

	function loadTemplate() {
		data.songs = [...tracklist]
			.sort((a, b) => a.order - b.order)
			.map((t) => ({ id: uid(), name: t.name, singer_notes: t.notes || '' }));
		changed();
	}

	function addSong() {
		data.songs = [...(data.songs || []), { id: uid(), name: '' }];
		changed();
	}
	function addEncoreBreak() {
		data.songs = [...(data.songs || []), { id: uid(), name: 'ENCORE', is_encore_break: true }];
		changed();
	}
	function removeSong(song: SetListSong) {
		data.songs = (data.songs || []).filter((s) => s.id !== song.id);
		changed();
	}
	function move(index: number, dir: -1 | 1) {
		const songs = [...(data.songs || [])];
		const target = index + dir;
		if (target < 0 || target >= songs.length) return;
		[songs[index], songs[target]] = [songs[target], songs[index]];
		data.songs = songs;
		changed();
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<p class="text-[11px] text-gray2">Reorder with the arrows · click a song for singer / video / LD notes.</p>
		<div class="flex gap-3">
			{#if !(data.songs || []).length && tracklist.length}
				<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={loadTemplate}>Load default tracklist</button>
			{/if}
			<button type="button" class="text-xs font-bold text-gray3 hover:text-white cursor-pointer" on:click={addEncoreBreak}>+ Encore break</button>
			<button type="button" class="text-xs font-bold text-lime hover:opacity-80 cursor-pointer" on:click={addSong}>+ Add song</button>
		</div>
	</div>

	<div class="space-y-1.5">
		{#each data.songs || [] as song, i (song.id)}
			{#if song.is_encore_break}
				<div class="flex items-center gap-3 py-1">
					<div class="flex-1 border-t border-dashed border-tentatif/50"></div>
					<span class="text-[10px] font-black uppercase tracking-widest text-tentatif">Encore (pause)</span>
					<div class="flex-1 border-t border-dashed border-tentatif/50"></div>
					<div class="flex gap-1">
						<button type="button" class="text-gray2 hover:text-white p-0.5 cursor-pointer" aria-label="Move up" on:click={() => move(i, -1)}>↑</button>
						<button type="button" class="text-gray2 hover:text-white p-0.5 cursor-pointer" aria-label="Move down" on:click={() => move(i, 1)}>↓</button>
						<button type="button" class="text-gray2 hover:text-problem p-0.5 cursor-pointer" aria-label="Remove" on:click={() => removeSong(song)}>✕</button>
					</div>
				</div>
			{:else}
				<div class="bg-gray1/30 rounded-xl overflow-hidden">
					<div class="grid grid-cols-[28px_1fr_auto] gap-2 items-center px-2 py-1.5">
						<span class="text-xs font-black text-gray2 text-center">{(data.songs || []).slice(0, i + 1).filter((s) => !s.is_encore_break).length}</span>
						<input
							class="bg-transparent text-sm text-white font-bold outline-none cursor-pointer"
							bind:value={song.name}
							placeholder="Song name"
							on:change={changed}
							on:focus={() => (expandedId = song.id)}
						/>
						<div class="flex gap-1 items-center">
							<button type="button" class="text-gray2 hover:text-white px-1 cursor-pointer" aria-label="Move up" on:click={() => move(i, -1)}>↑</button>
							<button type="button" class="text-gray2 hover:text-white px-1 cursor-pointer" aria-label="Move down" on:click={() => move(i, 1)}>↓</button>
							<button
								type="button"
								class="text-gray2 hover:text-lime px-1 cursor-pointer text-xs"
								on:click={() => (expandedId = expandedId === song.id ? null : song.id)}
							>{expandedId === song.id ? 'Hide' : 'Notes'}</button>
							<button type="button" class="text-gray2 hover:text-problem px-1 cursor-pointer" aria-label="Remove" on:click={() => removeSong(song)}>✕</button>
						</div>
					</div>
					{#if expandedId === song.id}
						<div class="grid grid-cols-1 md:grid-cols-4 gap-2 px-3 pb-3">
							<Field small label="Singer notes" bind:value={song.singer_notes} on:change={changed} />
							<Field small label="Video notes" bind:value={song.video_notes} on:change={changed} />
							<Field small label="LD notes" bind:value={song.ld_notes} on:change={changed} />
							<Field small label="Other" bind:value={song.other_notes} on:change={changed} />
						</div>
					{/if}
				</div>
			{/if}
		{:else}
			<p class="text-xs text-gray2 italic">Empty set list — load the default tracklist (from Settings) or add songs.</p>
		{/each}
	</div>
</div>
