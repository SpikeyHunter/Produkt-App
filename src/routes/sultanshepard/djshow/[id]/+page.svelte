<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import MainLayout from '$lib/components/MainLayout.svelte';
    import Button from '$lib/components/buttons/Button.svelte';
    import { fetchSSShowById, type SSShow } from '$lib/services/ssShowService';
    
    import SSInfoCard from '$lib/components/sultanshepard/SSInfoCard.svelte';
    import SSSetTimes from '$lib/components/sultanshepard/SSSetTimes.svelte';
    import SSVenueSpecs from '$lib/components/sultanshepard/SSVenueSpecs.svelte';
    import SSVJInfo from '$lib/components/sultanshepard/SSVJInfo.svelte';
    import SSTracks from '$lib/components/sultanshepard/SSTracks.svelte';
    import SSNotes from '$lib/components/sultanshepard/SSNotes.svelte';

    let showId = $page.params.id || '';
    let show: SSShow | null = null;
    let loading = true;

    async function loadShow() {
        if (!showId) return;
        loading = true;
        show = await fetchSSShowById(showId);
        loading = false;
    }

    onMount(() => {
        loadShow();
    });

    function handleUpdate(event: CustomEvent) {
        if (show) {
            show = { ...show, ...event.detail.updates };
        }
    }

    function goBack() {
        goto('/sultanshepard/djshow');
    }
</script>

<svelte:head>
    <title>S+S - {show ? `${show.show_venue}` : 'Loading Show...'}</title>
</svelte:head>

<MainLayout pageTitle={show ? `${show.show_venue}` : 'Loading...'}>
    <div class="h-full overflow-y-auto overflow-x-hidden p-6 flex flex-col">
        <div class="mb-4 flex-shrink-0">
            <Button variant="gray" on:click={goBack}>
                <span class="flex items-center gap-2">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
                    Go Back
                </span>
            </Button>
        </div>

        {#if loading}
            <div class="flex justify-center items-center h-full">
                <div class="animate-spin w-8 h-8 text-lime"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg></div>
            </div>
        {:else if show}
            <div class="flex flex-wrap gap-6 justify-center xl:justify-start items-start pb-0">
                
                <div class="w-full xl:w-[330px] h-[700px] flex flex-col gap-6 flex-shrink-0">
                    <div class="flex-shrink-0">
                        <SSInfoCard {show} on:update={handleUpdate} />
                    </div>
                    <div class="flex-1 min-h-0">
                        <SSVenueSpecs {show} on:update={handleUpdate} />
                    </div>
                </div>

                <div class="w-full xl:w-[270px] h-[700px] flex flex-col gap-6 flex-shrink-0">
                    <div class="flex-1 min-h-0">
                        <SSSetTimes {show} on:update={handleUpdate} />
                    </div>
                    <div class="flex-shrink-0">
                        <SSVJInfo {show} on:update={handleUpdate} />
                    </div>
                </div>

                <div class="w-full xl:w-[300px] h-[700px] flex-shrink-0">
                    <SSTracks {show} on:update={handleUpdate} />
                </div>

                <div class="w-full xl:w-[300px] h-[700px] flex-shrink-0">
                    <SSNotes {show} on:update={handleUpdate} />
                </div>

            </div>
        {/if}
    </div>
</MainLayout>