<!-- /src/lib/components/booking/artistavailability/ArtistCard.svelte -->
<script lang="ts">
    import type { BookingArtist } from '$lib/types/booking';
    import { createEventDispatcher } from 'svelte';

    export let data: BookingArtist;
    const dispatch = createEventDispatcher();
</script>

<div 
    on:click={() => dispatch('click')}
    on:keydown={(e) => e.key === 'Enter' && dispatch('click')}
    role="button"
    tabindex="0"
    class="bg-navbar rounded-2xl p-4 transition-all duration-200 group h-full w-full
           cursor-pointer hover:scale-[1.02] hover:shadow-xl flex flex-col"
>
    <h3 class="text-white text-lg font-bold truncate leading-tight group-hover:text-lime transition-colors">
        {data.name}
    </h3>

    {#if data.genres && data.genres.length > 0}
        <div class="flex flex-wrap gap-2 mt-2 overflow-hidden content-start flex-1">
            {#each data.genres.slice(0, 8) as genre}
                <span class="px-2 py-1 bg-gray1 text-lime text-xs rounded-full whitespace-nowrap">
                    {genre}
                </span>
            {/each}
        </div>
    {/if}

    <div class="mt-auto pt-2 text-xs text-gray2 text-right">
        Artist Card
    </div>
</div>
