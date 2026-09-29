<script lang="ts">
    // VJ content: "Artist" lines followed by "- item" lines. Items that are
    // URLs render as links; anything else stays plain text. The box is
    // editable; the advance fills it when it is empty (or on Reset).
    import { createEventDispatcher, onMount } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import { isUrl } from '$lib/utils/emailTechTemplate';
    import { supabase } from '$lib/supabase';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    export let stretch = false;
    export let events: any[] = [];
    export let currentEventId: number | string | null = null;

    const dispatch = createEventDispatcher();
    let editing = false;
    let lastEventId: number | string | null = null;

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

    onMount(() => {
        populateVisuals(false);
    });

    function parseJson(data: any) {
        if (!data) return null;
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
        } catch (e) { 
            return null; 
        }
    }

    // New event -> fill from the advance when nothing was typed yet.
    $: if (events && currentEventId && currentEventId !== lastEventId) {
        lastEventId = currentEventId;
        populateVisuals(false);
    }

    /** What the advance rows say right now (from `rows`, default: the loaded list). */
    function advanceContent(rows: any[] = events): string {
        if (!rows || !currentEventId) return '';
        const relevantEvents = rows.filter(e => String(e.event_id) === String(currentEventId));
        const outputLines: string[] = [];

        // Headliners first
        const sortedEvents = [...relevantEvents].sort((a, b) => {
             const typeA = (a.artist_type || '').toLowerCase();
             const typeB = (b.artist_type || '').toLowerCase();
             if (typeA.includes('headliner')) return -1;
             if (typeB.includes('headliner')) return 1;
             return 0;
        });

        sortedEvents.forEach(row => {
            const visualsData = parseJson(row.visuals);
            const items: string[] = [];
            if (visualsData && typeof visualsData === 'object') {
                Object.values(visualsData).forEach((v: any) => {
                    if (typeof v === 'string' && v.trim() !== '') items.push(v.trim());
                });
            }
            if (items.length > 0) {
                outputLines.push(row.artist_name || 'Artist');
                items.forEach(it => outputLines.push(`- ${it}`));
                outputLines.push('');
            }
        });
        return outputLines.join('\n').trim();
    }

    /** force = Reset button: overwrite what was typed. */
    export function populateVisuals(force: boolean) {
        const fromAdvance = advanceContent();
        const current = (formData.vj_visuals || '').trim();
        if (!force && current && current !== 'WAITING') return;
        const next = fromAdvance || 'WAITING';
        if (formData.vj_visuals !== next) {
            formData.vj_visuals = next;
            handleChange();
        }
    }

    // Refresh: re-read the visuals straight from the advance (links added
    // after the email was started) and replace the box with them.
    let refreshing = false;
    let refreshNote = '';
    async function refreshFromAdvance() {
        if (readOnly || refreshing || !currentEventId) return;
        refreshing = true;
        refreshNote = '';
        try {
            const { data, error } = await supabase
                .from('events_advance')
                .select('event_id, artist_name, artist_type, visuals')
                .eq('event_id', currentEventId);
            if (error) throw error;
            const next = advanceContent(data || []) || 'WAITING';
            if (formData.vj_visuals !== next) {
                formData.vj_visuals = next;
                handleChange();
                refreshNote = 'Updated from the advance';
            } else {
                refreshNote = 'Already up to date';
            }
        } catch (e) {
            console.error('[emailtech] visuals refresh failed:', e);
            refreshNote = 'Could not refresh — try again';
        } finally {
            refreshing = false;
            setTimeout(() => (refreshNote = ''), 2500);
        }
    }

    function adjustHeight(el: HTMLTextAreaElement) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }
</script>

<SectionCard 
    title="VJ Visuals / Content" 
    id="vj_visuals" 
    isVisible={formData.visible_sections?.['vj_visuals'] ?? true} 
    on:toggle={handleToggle}
    on:reset={refreshFromAdvance}
    stretch={stretch}
>
    <div class="flex flex-col gap-2 {readOnly ? 'opacity-60 pointer-events-none' : ''}">
        <div class="flex items-center justify-between">
            <span class="text-[10px] text-gray2 uppercase font-bold ml-1">Content Links / Instructions</span>
            {#if !readOnly}
                <div class="flex items-center gap-3">
                {#if refreshNote}
                    <span class="text-[10px] text-gray2">{refreshNote}</span>
                {/if}
                <button type="button" on:click={() => (editing = !editing)}
                    class="text-[10px] font-bold uppercase {editing ? 'text-lime' : 'text-gray2 hover:text-white'} cursor-pointer">
                    {editing ? 'Done' : 'Edit'}
                </button>
                </div>
            {/if}
        </div>

        {#if editing && !readOnly}
            <textarea
                bind:value={formData.vj_visuals}
                on:input={(e) => { adjustHeight(e.target as HTMLTextAreaElement); handleChange(); }}
                rows="6"
                placeholder={'Artist Name\n- https://link…\n- plain instruction'}
                class="w-full bg-navbar border border-lime/60 rounded-2xl p-3 text-sm text-white font-mono leading-relaxed focus:border-lime focus:outline-none placeholder-gray2/50 resize-none overflow-hidden"
            ></textarea>
            <p class="text-[10px] text-gray2 ml-1">One artist per line, then “- ” items. Only real URLs become links.</p>
        {:else}
            <div class="w-full bg-navbar border border-gray1 rounded-2xl p-3 text-sm text-white font-mono whitespace-pre-wrap overflow-hidden">
                {#if formData.vj_visuals && formData.vj_visuals.trim() && formData.vj_visuals.trim() !== 'WAITING'}
                    {#each formData.vj_visuals.split('\n') as line}
                        {#if line.trim().startsWith('- ')}
                            {@const item = line.trim().slice(2).trim()}
                            <div class="flex">
                                <span class="mr-1">-</span>
                                {#if isUrl(item)}
                                    <a href={item} target="_blank" rel="noopener noreferrer" class="text-lime hover:underline break-all">{item}</a>
                                {:else}
                                    <span class="break-words">{item}</span>
                                {/if}
                            </div>
                        {:else if line.trim()}
                            <div class="font-bold mt-2 first:mt-0">{line}</div>
                        {/if}
                    {/each}
                {:else}
                    <span class="text-gray-500 italic">WAITING</span>
                {/if}
            </div>
        {/if}
    </div>
</SectionCard>
