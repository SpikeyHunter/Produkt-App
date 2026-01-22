<script lang="ts">
    import { onMount } from 'svelte';
    import MainLayout from '$lib/components/MainLayout.svelte';
    
    // Components
    import EventSelector from '$lib/components/production/emailtech/EventSelector.svelte';
    import EventInfo from '$lib/components/production/emailtech/EventInfo.svelte';
    import EventActions from '$lib/components/production/emailtech/EventActions.svelte';
    import EmailEditor from '$lib/components/production/emailtech/EmailEditor.svelte';
    import CrewManager from '$lib/components/production/emailtech/CrewManager.svelte';
    import ActionPanel from '$lib/components/production/emailtech/ActionPanel.svelte';

    // Services & Types
    import {
        fetchEmailTechEvents,
        updateEventEmail,
        updateEventCrew,
        fetchCrewMembers,
        updateEmailStatus,
        autofillEventCrew
    } from '$lib/services/emailtechService';
    
    import type {
        EmailTechEvent,
        CrewMember,
        CrewAssignments
    } from '$lib/types/emailtech';

    // State
    let loading = true;
    let events: EmailTechEvent[] = [];
    let selectedEvents: EmailTechEvent[] = [];
    let crewMembers: CrewMember[] = [];
    
    // Editor & Status State
    let editorContent = '';
    let currentStatus = 'todo';
    let templateType: 'tech' | 'vj' = 'tech';
    let crewAssignments: CrewAssignments = {};

    onMount(async () => {
        await loadInitialData();
    });

    async function loadInitialData() {
        loading = true;
        try {
            const [e, c] = await Promise.all([fetchEmailTechEvents(), fetchCrewMembers()]);
            events = e;
            crewMembers = c;
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            loading = false;
        }
    }

    function handleEventSelect(event: CustomEvent<EmailTechEvent[]>) {
        const selection = event.detail;
        if (!selection || selection.length === 0) {
            resetView();
            return;
        }

        const main = selection[0];
        if (selection.length === 1 && main.event_venue === 'New City Gas') {
            const bazart = events.find(e => 
                e.event_date === main.event_date && 
                e.event_venue === 'Bazart'
            );
            selectedEvents = bazart ? [main, bazart] : [main];
        } else {
            selectedEvents = selection;
        }

        const primaryEvent = selectedEvents[0];
        // Load Crew
        crewAssignments = primaryEvent.crew || {};
        loadEmailContent();
    }

    function resetView() {
        selectedEvents = [];
        editorContent = '';
        crewAssignments = {};
        currentStatus = 'todo';
    }

    function loadEmailContent() {
        if (selectedEvents.length === 0) return;
        
        const primaryEvent = selectedEvents[0];
        const emailData = primaryEvent.email_data || {};
        
        if (templateType === 'tech') {
            editorContent = primaryEvent.tech_mail || '';
            currentStatus = emailData.tech_status || 'todo';
        } else {
            editorContent = primaryEvent.vj_mail || '';
            currentStatus = emailData.vj_status || 'todo';
        }
    }

    function toggleTemplateType() {
        templateType = templateType === 'tech' ? 'vj' : 'tech';
        loadEmailContent();
    }

    function handleContentChange(e: CustomEvent<string>) {
        editorContent = e.detail;
        if(selectedEvents.length > 0) {
            if(templateType === 'tech') selectedEvents[0].tech_mail = editorContent;
            else selectedEvents[0].vj_mail = editorContent;
        }
    }

    // --- AUTOFILL HANDLER ---
    async function handleAutofill() {
        if(selectedEvents.length === 0) return;
        
        const eventId = selectedEvents[0].event_id;
        const eventDate = selectedEvents[0].event_date;
        // Grab the event name or artist name for matching
        const eventName = selectedEvents[0].event_name || selectedEvents[0].artist_name || '';

        if (!eventDate) {
            alert("This event has no date set, cannot autofill.");
            return;
        }

        loading = true;
        // Pass eventName to help filter multiple schedule rows
        const result = await autofillEventCrew(eventId, eventDate, eventName);
        loading = false;

        if (result.success && result.assignments) {
            crewAssignments = result.assignments;
            selectedEvents[0].crew = result.assignments;
        } else {
            console.warn("Autofill returned unsuccessful.");
            alert("Could not autofill. Check console for details.");
        }
    }

    // --- RESET HANDLER ---
    async function handleReset() {
        if (selectedEvents.length === 0) return;
        
        const eventId = selectedEvents[0].event_id;
        
        loading = true;
        
        // Parallel update: Clear Content, Status, AND Crew
        const [emailSuccess, statusSuccess, crewSuccess] = await Promise.all([
            updateEventEmail(eventId, templateType, ''),
            updateEmailStatus(eventId, templateType, 'todo'),
            updateEventCrew(eventId, {})
        ]);
        
        loading = false;

        if (emailSuccess && statusSuccess && crewSuccess) {
            // Update Local State
            editorContent = '';
            currentStatus = 'todo';
            crewAssignments = {}; 
            selectedEvents[0].crew = {};

            if (templateType === 'tech') {
                selectedEvents[0].tech_mail = '';
                if (!selectedEvents[0].email_data) selectedEvents[0].email_data = {};
                selectedEvents[0].email_data.tech_status = 'todo';
            } else {
                selectedEvents[0].vj_mail = '';
                if (!selectedEvents[0].email_data) selectedEvents[0].email_data = {};
                selectedEvents[0].email_data.vj_status = 'todo';
            }
        }
    }

    async function handleStatusUpdate(e: CustomEvent<string>) {
        if (selectedEvents.length === 0) return;
        const newStatus = e.detail;
        const eventId = selectedEvents[0].event_id;
        
        currentStatus = newStatus; 
        
        if (!selectedEvents[0].email_data) selectedEvents[0].email_data = {};
        if (templateType === 'tech') selectedEvents[0].email_data.tech_status = newStatus;
        else selectedEvents[0].email_data.vj_status = newStatus;

        await updateEmailStatus(eventId, templateType, newStatus);
    }

    async function handleSave() {
        if (selectedEvents.length === 0) return;
        const eventId = selectedEvents[0].event_id;
        const success = await updateEventEmail(eventId, templateType, editorContent);
        if (success) console.log('Email saved successfully');
    }

    async function handleCrewUpdate(e: CustomEvent) {
        if (selectedEvents.length === 0) return;
        crewAssignments = e.detail.assignments;
        await updateEventCrew(selectedEvents[0].event_id, crewAssignments);
        selectedEvents[0].crew = crewAssignments;
    }

</script>

<MainLayout pageTitle="Email Tech Builder">
    <div class="h-full flex flex-col p-6 w-full mx-auto overflow-hidden">
        
        <div class="flex-1 grid grid-cols-[300px_minmax(0,1fr)_300px] gap-6 min-w-[1200px] overflow-hidden">
            
            <div class="flex flex-col gap-4 overflow-hidden">
                <div class="bg-navbar border border-gray1 rounded-xl p-3 flex-shrink-0">
                    <EventSelector 
                        {events} 
                        bind:selectedEvents 
                        {loading} 
                        on:select={handleEventSelect} 
                    />
                </div>
                
                <div class="flex-1 overflow-y-auto flex flex-col gap-4">
                    <EventInfo event={selectedEvents[0] || null} />
                    
                    {#if selectedEvents.length > 0}
                        <EventActions 
                            {templateType} 
                            {currentStatus}
                            on:autofill={handleAutofill}
                            on:reset={handleReset}
                            on:updateStatus={handleStatusUpdate}
                        />
                    {/if}
                </div>
            </div>

            <div class="flex flex-col gap-4 bg-navbar border border-gray1 rounded-xl overflow-hidden">
                <div class="flex items-center justify-between p-3 border-b border-gray1 bg-gray1/50 flex-shrink-0">
                    <div class="flex items-center gap-3">
                        <h2 class="text-sm font-bold text-white pl-2">Email Editor</h2>
                        <span class="text-xs text-gray3 px-2 py-0.5 border border-gray2 rounded">
                            {templateType === 'tech' ? 'Tech Team' : 'VJ Team'}
                        </span>
                    </div>
                    
                    <button 
                        class="px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-2 cursor-pointer
                        {templateType === 'tech' ? 'bg-lime text-black border-lime hover:bg-white' : 'text-gray3 border-gray2 hover:text-white'}"
                        on:click={toggleTemplateType}
                        disabled={selectedEvents.length === 0}
                    >
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        Switch to {templateType === 'tech' ? 'VJ Mail' : 'Tech Mail'}
                    </button>
                </div>

                <div class="flex-1 p-0 overflow-hidden">
                    <EmailEditor 
                        content={editorContent} 
                        readOnly={selectedEvents.length === 0}
                        on:change={handleContentChange}
                    />
                </div>
            </div>

            <div class="flex flex-col gap-4 overflow-hidden">
                <div class="flex-shrink-0">
                    <ActionPanel 
                        emailContent={editorContent} 
                        selectedRecipients={[]} 
                        on:send={handleSave} 
                    />
                </div>
                
                <div class="flex-1 overflow-hidden">
                    <CrewManager
                        {crewMembers}
                        assignments={crewAssignments}
                        on:assign={handleCrewUpdate}
                        on:add={() => {}} 
                        on:remove={() => {}}
                    />
                </div>
            </div>

        </div>
    </div>
</MainLayout>