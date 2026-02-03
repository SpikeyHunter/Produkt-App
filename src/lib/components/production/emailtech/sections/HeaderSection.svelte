<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TechEmailForm, EmailTechEvent } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';
    import EventSelector from '../EventSelector.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    export let events: EmailTechEvent[] = []; 
    export let mainEvent: EmailTechEvent | null = null;

    const dispatch = createEventDispatcher();

    $: isVisible = formData?.visible_sections?.['header'] ?? true;
    $: if (formData && !formData.visible_sections) {
        console.error('[HeaderSection] formData.visible_sections is undefined inside child component!', formData);
    }

    // Filter logic
    $: availableSecondEvents = events.filter(e => {
        if (e.id === mainEvent?.id) return false;
        if (mainEvent?.event_venue === 'New City Gas') return e.event_venue === 'Bazart';
        if (mainEvent?.event_venue === 'Bazart') return e.event_venue === 'New City Gas';
        return true;
    });

    $: selectedSecondEvents = formData.second_event ? [formData.second_event] : [];

    function handleChange() { dispatch('change'); }
    function handleToggle(e: CustomEvent) { dispatch('toggle', e.detail); }

    function handleSecondEventSelect(e: CustomEvent) {
        const selected = e.detail;
        formData.second_event = selected.length > 0 ? selected[0] : null;
        dispatch('change');
    }

    // RESET: Clears liaison and linked event
    function handleReset() {
        if (readOnly) return;
        formData.liaison = '';
        formData.second_event = null;
        dispatch('change');
    }
</script>

<SectionCard 
    title="Show Info" 
    id="header" 
    {isVisible} 
    on:toggle={handleToggle}
    on:reset={handleReset}
>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        <div class="flex flex-col gap-1.5 z-0 relative">
            <span class="text-[10px] text-gray2 uppercase font-bold ml-1">Liaison Name</span>
            <input 
                type="text" 
                bind:value={formData.liaison} 
                on:input={handleChange} 
                disabled={readOnly} 
                placeholder="e.g. Charles"
                class="w-full bg-navbar border border-gray1 rounded-2xl px-4 py-2.5 text-sm text-white focus:border-lime focus:outline-none placeholder-gray2/50 transition-all" 
            />
        </div>

        <div class="flex flex-col gap-1.5 z-50 relative">
            <span class="text-[10px] text-gray2 uppercase font-bold ml-1">Linked Event (Optional)</span>
            {#if !readOnly}
                <EventSelector 
                    events={availableSecondEvents}
                    selectedEvents={selectedSecondEvents}
                    loading={false}
                    on:select={handleSecondEventSelect}
                />
            {:else}
                <div class="w-full bg-navbar border border-gray1 rounded-2xl px-4 py-2.5 text-sm text-white opacity-50">
                    {formData.second_event ? formData.second_event.event_name : 'No linked event'}
                </div>
            {/if}
        </div>
    </div>
</SectionCard>