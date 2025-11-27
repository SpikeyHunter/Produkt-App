<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import ProgressBar from '$lib/components/inputs/ProgressBar.svelte';
    import type { SSShow } from '$lib/services/ssShowService';

    export let show: SSShow;

    const dispatch = createEventDispatcher();

    // Format date for display
    $: displayDate = new Date(show.show_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
    });

    $: fullLocation = [show.show_city, show.show_country].filter(Boolean).join(', ');

    // Correctly access venue_info for tags
    $: venueInfo = show.venue_info || {};
    
    $: tags = [
        venueInfo.pixel_map === 'yes' ? 'Pixel Map' : null,
        venueInfo.camera === 'yes' ? 'Camera' : null,
        venueInfo.sdi_confirmed === 'yes' ? 'SDI Confirmed' : null,
        (!show.dos_contact || (Array.isArray(show.dos_contact) && show.dos_contact.length === 0)) ? 'No Contact' : null
    ].filter(Boolean);

    function handleClick() {
        dispatch('click', { show });
    }

    function handleEdit(e: Event) {
        e.stopPropagation();
        dispatch('edit', { show });
    }
</script>

<div
    class="bg-navbar rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl cursor-pointer h-52 group"
    on:click={handleClick}
    on:keydown={(e) => e.key === 'Enter' && handleClick()}
    role="button"
    tabindex="0"
    aria-label={`View details for ${show.show_venue || 'show'}`}
>
    <div class="flex gap-4 h-full">
        <div class="w-32 flex flex-col flex-shrink-0 h-full">
            <div class="flex-1 rounded-xl overflow-hidden relative bg-gray-900 flex items-center justify-center">
                {#if show.flyer_url}
                    <img
                        src={show.flyer_url}
                        alt={show.show_venue || 'Show flyer'}
                        class="w-full h-full object-cover object-center opacity-90 group-hover:opacity-100 transition-opacity"
                        loading="lazy"
                    />
                {:else}
                    <div class="text-center">
                        <span class="text-xs text-gray2">No IMG</span>
                    </div>
                {/if}
            </div>
            
            <div class="bg-gray3 text-black px-2 py-1 rounded-lg text-center font-bold text-xs mt-3 flex-shrink-0">
                {displayDate}
            </div>
        </div>

        <div class="flex-1 flex flex-col min-w-0 h-full">
            <div class="flex items-start justify-between mb-2">
                <div class="flex-1 min-w-0 pr-2">
                    <h3 class="text-white text-lg font-bold truncate leading-tight">
                        {show.show_venue || 'TBD Venue'}
                    </h3>
                    <p class="text-gray2 text-sm mt-0.5 truncate">{fullLocation}</p>
                </div>

                <button
                    on:click={handleEdit}
                    class="p-2 text-gray2 hover:text-black hover:bg-lime rounded-lg transition-all duration-200"
                    aria-label="Edit show"
                    title="Edit show"
                >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
            </div>

            <div class="mb-4">
                <ProgressBar
                    event={{ progress: show.progress }}
                    showLabel={true}
                    labelSize="text-xs"
                    barHeight="h-1.5"
                    maxWidth="max-w-none"
                />
            </div>

            <div class="flex-1 min-h-0 overflow-hidden">
                <div class="flex flex-wrap gap-2">
                    {#if tags.length === 0}
                         <span class="rounded-full border border-gray2 bg-gray2/20 px-3 py-1 text-xs font-bold text-gray2">
                            Setup Required
                        </span>
                    {:else}
                        {#each tags as tag}
                            <span class="rounded-full border border-lime bg-lime/10 px-3 py-1 text-xs font-bold text-lime whitespace-nowrap">
                                {tag}
                            </span>
                        {/each}
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>