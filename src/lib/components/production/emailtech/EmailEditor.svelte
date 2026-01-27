<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { EmailTechEvent, CrewTimeGroup, EmailContentData } from '$lib/types/emailtech';
    import CrewSection from './sections/CrewSection.svelte';
    
    export let event: EmailTechEvent | null = null;
    export let content: string = '';
    export let readOnly: boolean = false;
    export let placeholder: string = 'Select an event to start...';
    // New prop to determine which sections to show
    export let type: 'tech' | 'vj' = 'tech';

    const dispatch = createEventDispatcher();

    let parsedData: EmailContentData | null = null;
    let isStructured = false;

    // Reactively parse content or initialize defaults
    $: if (event) {
        if (!content || content.trim() === '') {
            initStructured();
        } else {
            try {
                if (content.trim().startsWith('{')) {
                    const parsed = JSON.parse(content);
                    if (parsed.version && parsed.sections) {
                        parsedData = parsed;
                        isStructured = true;
                    } else {
                        isStructured = false; 
                    }
                } else {
                    isStructured = false;
                }
            } catch {
                isStructured = false;
            }
        }
    } else {
        parsedData = null;
        isStructured = false;
    }

    function initStructured() {
        parsedData = {
            version: 1,
            sections: {
                // Initialize empty arrays; components will populate defaults if needed
                crew: { groups: [] }
            }
        };
        isStructured = true;
    }

    function handleCrewChange(e: CustomEvent<CrewTimeGroup[]>) {
        if (!parsedData) initStructured();
        if (parsedData) {
            if (!parsedData.sections.crew) parsedData.sections.crew = { groups: [] };
            parsedData.sections.crew.groups = e.detail;
            updateContent();
        }
    }

    function updateContent() {
        if (parsedData) {
            content = JSON.stringify(parsedData);
            dispatch('change', content);
        }
    }

    function handleTextInput(e: Event) {
        const target = e.target as HTMLTextAreaElement;
        content = target.value;
        dispatch('change', content);
    }
</script>

<div class="h-full flex flex-col relative group bg-navbar rounded-lg">
    {#if !event}
        <div class="absolute inset-0 flex items-center justify-center text-gray2 text-sm font-bold opacity-50">
            Select an event to edit
        </div>
    {:else if isStructured && parsedData}
        <div class="h-full overflow-y-auto p-4 space-y-8 custom-scrollbar">
            
            {#if type === 'tech'}
                <CrewSection 
                    crew={event.crew || {}} 
                    groups={parsedData.sections.crew?.groups || []}
                    {readOnly}
                    on:change={handleCrewChange}
                />
            {/if}

            {#if type === 'vj'}
                <div class="text-gray2 text-xs italic p-2 border border-dashed border-gray1 rounded">
                    VJ Form Sections coming soon... (Switch to Text Mode if needed)
                </div>
            {/if}
            
            {#if !readOnly}
                <div class="border border-dashed border-gray1 rounded-lg p-3 text-center opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
                    <span class="text-[10px] text-gray2 uppercase font-bold tracking-widest">+ Add Section</span>
                </div>
            {/if}
        </div>

    {:else}
        <textarea
            class="w-full h-full bg-transparent text-white p-4 text-sm font-mono resize-none focus:outline-none placeholder-gray2 leading-relaxed custom-scrollbar"
            {placeholder}
            value={content}
            on:input={handleTextInput}
            readonly={readOnly}
        ></textarea>
    {/if}
    
    {#if readOnly && event}
        <div class="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg pointer-events-none z-20">
            <span class="text-white font-bold text-sm bg-black/80 px-4 py-2 rounded">Read Only</span>
        </div>
    {/if}
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #777; }
</style>