<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';
    import { autofillTechForm, defaultTechForm, initSetTimes } from '$lib/services/techTemplateService';
    // [Fix] Corrected Import Paths
    import { generateTechEmailString } from '$lib/utils/emailTechGenerator'; 
    import type { EmailTechEvent, TechEmailForm, TimetableEntry } from '$lib/types/emailtech';
    import TechForm from './TechForm.svelte';

    export let content: string = '';
    export let readOnly: boolean = false;
    export let selectedEvents: EmailTechEvent[] = [];
    export let events: EmailTechEvent[] = [];

    const dispatch = createEventDispatcher();
    let formData: TechEmailForm = JSON.parse(JSON.stringify(defaultTechForm));
    let currentEventId: number = -1;
    let suppressSave = false;

    const DEFAULT_CREW_CALLS = [{ time: '19:00', names: '' }, { time: '20:30', names: '' }];

    // Detect Event Switch
    $: primaryEventId = selectedEvents.length > 0 ? selectedEvents[0].event_id : -1;
    $: if (primaryEventId !== -1 && primaryEventId !== currentEventId) {
        currentEventId = primaryEventId;
        initForm();
    }

    // Sync Helpers
    $: if (selectedEvents.length > 0 && selectedEvents[0].crew && !suppressSave) {
        syncCrewToForm(selectedEvents[0].crew);
    }

    $: if (formData && !suppressSave) {
        syncSetTimes(selectedEvents[0], formData.second_event);
    }

    function syncCrewToForm(crew: any) {
        if (!formData || suppressSave) return;
        const priorityOrder = ['LD', 'Video', 'Sound', 'Stage/Tech'];
        const excludedRoles = ['DT', 'VJ'];
        const allRoles = Object.keys(crew || {});
        const otherRoles = allRoles.filter(r => !priorityOrder.includes(r) && !excludedRoles.includes(r));
        const finalRoleOrder = [...priorityOrder, ...otherRoles];
        const orderedNames = new Set<string>();

        if (crew && typeof crew === 'object') {
            finalRoleOrder.forEach(role => {
                const names = crew[role];
                if (Array.isArray(names)) {
                    names.forEach((fullName: string) => {
                        const firstName = fullName.trim().split(' ')[0];
                        if (firstName) orderedNames.add(firstName);
                    });
                }
            });
        }

        const namesString = Array.from(orderedNames).join(', ');
        if (formData.crew_calls.length > 0 && formData.crew_calls[0].names !== namesString) {
            formData.crew_calls[0].names = namesString;
            updateOutput();
        }
    }

    function syncSetTimes(mainEvent: EmailTechEvent, secondEvent: EmailTechEvent | null | undefined) {
        if (!mainEvent || suppressSave) return;
        const newSetTimes = initSetTimes([mainEvent]);
        if (secondEvent && secondEvent.timetable) {
            let entries: TimetableEntry[] = [];
            try { 
                entries = typeof secondEvent.timetable === 'string' ? JSON.parse(secondEvent.timetable) : secondEvent.timetable;
            } catch (e) {}
            
            if (entries.length > 0) {
                let venueLabel = secondEvent.event_venue || 'Second Stage';
                if (venueLabel === 'New City Gas') venueLabel = 'Main Room';
                else if (venueLabel === 'Bazart') venueLabel = 'Bazart Lounge';
                newSetTimes.push({ event_id: secondEvent.event_id, venue: venueLabel, entries: entries });
            }
        }
        if (JSON.stringify(formData.set_times) !== JSON.stringify(newSetTimes)) {
            formData.set_times = newSetTimes;
            updateOutput();
        }
    }

    async function initForm() {
        if (selectedEvents.length === 0) return;
        
        // STOP SAVE during initialization
        suppressSave = true;
        
        const primary = selectedEvents[0];
        // Safely access nested properties
        const savedData = primary.email_data?.tech_form_data;

        if (savedData) {
            // Merge defaults with saved data to ensure new fields are present
            formData = {
                ...JSON.parse(JSON.stringify(defaultTechForm)),
                ...savedData,
                visible_sections: { ...defaultTechForm.visible_sections, ...(savedData.visible_sections || {}) },
                set_times: Array.isArray(savedData.set_times) ? savedData.set_times : [],
                crew_calls: (Array.isArray(savedData.crew_calls) && savedData.crew_calls.length > 0) ? savedData.crew_calls : DEFAULT_CREW_CALLS,
                backline: Array.isArray(savedData.backline) ? savedData.backline : JSON.parse(JSON.stringify(defaultTechForm.backline)),
            };
        } else {
            // New Form
            formData = {
                ...JSON.parse(JSON.stringify(defaultTechForm)),
                visible_sections: { ...defaultTechForm.visible_sections, 'team_notes': false },
                set_times: initSetTimes(selectedEvents),
                crew_calls: DEFAULT_CREW_CALLS
            };
        }

        // Wait for Svelte to reflect changes in DOM/Child components
        await tick();
        
        // Allow saving again
        suppressSave = false;
        
        // Regenerate HTML on load to sync with data
        const generatedHtml = generateTechEmailString(selectedEvents, formData, 'Tech Team');
        content = generatedHtml;
        // Do not dispatch 'change' here to prevent auto-save on load
    }

    function handleFormChange(e: CustomEvent<TechEmailForm>) {
        // This comes from the child components (inputs)
        if (suppressSave) return;
        formData = e.detail;
        updateOutput();
    }

    function updateOutput() {
        if (suppressSave) return;
        const generatedHtml = generateTechEmailString(selectedEvents, formData, 'Tech Team');
        content = generatedHtml;
        dispatch('change', { content: generatedHtml, structuredData: formData });
    }

    export function runAutofill() {
        formData = autofillTechForm(selectedEvents, formData);
        handleFormChange({ detail: formData } as CustomEvent);
    }
</script>

<div class="h-full flex flex-col relative group bg-navbar rounded-lg">
    {#if selectedEvents.length === 0}
        <div class="absolute inset-0 flex items-center justify-center text-gray2 text-sm font-bold opacity-50">Select an event</div>
    {:else}
        <div class="h-full overflow-y-auto p-4 custom-scrollbar">
            <TechForm 
                bind:formData 
                {readOnly} 
                availableEvents={events} 
                selectedEvent={selectedEvents[0]} 
                on:change={handleFormChange} 
            />
        </div>
    {/if}
</div>