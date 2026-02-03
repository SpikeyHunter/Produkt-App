<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    export let stretch = false;
    export let events: any[] = [];
    export let currentEventId: number | string | null = null;

    const dispatch = createEventDispatcher();

    // Support fallback to visuals_interior for existing data on load
    $: if (formData && formData.vj_visuals === undefined) {
        formData.vj_visuals = formData.visuals_interior || '';
    }

    function handleChange() { 
        dispatch('change', formData);
    }

    function handleToggle(e: CustomEvent) { 
        const { id, isVisible } = e.detail;
        if (!formData.visible_sections) formData.visible_sections = {};
        formData.visible_sections[id] = isVisible;
        dispatch('toggle', e.detail); 
        handleChange();
    }

    // Lifecycle hook ensures sync happens immediately on load to sync with DB
    onMount(() => {
        populateVisuals(true);
    });

    function parseJson(data: any) {
        if (!data) return null;
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            // Handle double-stringified JSON common in some Supabase responses
            return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
        } catch (e) { 
            return null; 
        }
    }

    // Re-populate if events or event ID changes
    $: if (events && currentEventId) {
        populateVisuals();
    }

    function populateVisuals(forceSync = false) {
        if (!events || !currentEventId) return;
        
        const relevantEvents = events.filter(e => String(e.event_id) === String(currentEventId));
        let outputLines: string[] = [];
        let hasContent = false;

        // Sort: Headliners first for VJ priority
        const sortedEvents = relevantEvents.sort((a, b) => {
             const typeA = (a.artist_type || '').toLowerCase();
             const typeB = (b.artist_type || '').toLowerCase();
             if (typeA.includes('headliner')) return -1;
             if (typeB.includes('headliner')) return 1;
             return 0;
        });

        sortedEvents.forEach(row => {
            const visualsData = parseJson(row.visuals);
            let links: string[] = [];

            if (visualsData && typeof visualsData === 'object') {
                Object.values(visualsData).forEach((link: any) => {
                    if (typeof link === 'string' && link.trim() !== '') {
                        links.push(link.trim());
                    }
                });
            }

            if (links.length > 0) {
                hasContent = true;
                outputLines.push(row.artist_name || 'Artist');
                links.forEach(link => {
                    outputLines.push(`- ${link}`);
                });
                outputLines.push(''); 
            }
        });

        const newContent = hasContent ? outputLines.join('\n').trim() : "WAITING";
        
        // Push to DB if content is new or if forced (on mount)
        if (formData.vj_visuals !== newContent || forceSync) {
            formData.vj_visuals = newContent;
            handleChange();
        }
    }
</script>

<SectionCard 
    title="VJ Visuals / Content" 
    id="visuals" 
    isVisible={formData.visible_sections?.['visuals']} 
    on:toggle={handleToggle}
    on:reset={() => populateVisuals(true)}
    stretch={stretch}
>
    <div class="flex flex-col gap-2 {readOnly ? 'opacity-60 pointer-events-none' : ''}">
        <div class="flex flex-col gap-1">
            <span class="text-[10px] text-gray2 uppercase font-bold ml-1">Content Links / Instructions</span>
            
            <div class="w-full bg-navbar border border-gray1 rounded-2xl p-3 text-sm text-white font-mono whitespace-pre-wrap overflow-hidden">
                {#if formData.vj_visuals && formData.vj_visuals !== 'WAITING'}
                    {#each formData.vj_visuals.split('\n') as line}
                        {#if line.trim().startsWith('- ')}
                            {@const url = line.replace('- ', '').trim()}
                            <div class="flex">
                                <span class="mr-1">-</span>
                                <a href={url} target="_blank" rel="noopener noreferrer" class="text-lime hover:underline break-all">
                                    {url}
                                </a>
                            </div>
                        {:else}
                            <div class="font-bold mt-2 first:mt-0">{line}</div>
                        {/if}
                    {/each}
                {:else}
                    <span class="text-gray-500 italic">WAITING</span>
                {/if}
            </div>
        </div>
    </div>
</SectionCard>