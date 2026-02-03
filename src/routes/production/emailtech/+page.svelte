<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';     
    import MainLayout from '$lib/components/MainLayout.svelte';
    import EventSelector from '$lib/components/production/emailtech/EventSelector.svelte';
    import EventInfo from '$lib/components/production/emailtech/EventInfo.svelte';
    import EventActions from '$lib/components/production/emailtech/EventActions.svelte';
    import EmailEditor from '$lib/components/production/emailtech/EmailEditor.svelte';
    import CrewManager from '$lib/components/production/emailtech/CrewManager.svelte';
    import ActionPanel from '$lib/components/production/emailtech/ActionPanel.svelte';
    import {
        fetchEmailTechEvents,
        updateEventEmail,
        updateEventEmailData,
        updateEventCrew,
        fetchCrewMembers,
        updateEmailStatus,
        autofillEventCrew,
        resetEventData,
        addCrewMember,
        deleteCrewMember
    } from '$lib/services/emailtechService';
    import { defaultTechForm } from '$lib/services/techTemplateService'; 
    import type { EmailTechEvent, CrewMember, CrewAssignments, TechEmailForm } from '$lib/types/emailtech';

    let loading = true;
    let events: EmailTechEvent[] = [];
    let selectedEvents: EmailTechEvent[] = [];
    let crewMembers: CrewMember[] = [];

    let editorContent = '';
    let currentStatus = 'todo';
    
    let crewAssignments: CrewAssignments = {};
    
    let currentFormData: TechEmailForm = JSON.parse(JSON.stringify(defaultTechForm));

    let emailEditorComponent: EmailEditor;

    let saveTimeout: any;

    onMount(async () => {
        await loadInitialData();
    });

    async function loadInitialData() {
        loading = true;
        try {
            const [e, c] = await Promise.all([fetchEmailTechEvents(), fetchCrewMembers()]);
            events = e;
            crewMembers = c;

            const urlId = $page.url.searchParams.get('event_id');
            if (urlId) {
                const preSelected = events.find(ev => String(ev.event_id) === urlId);
                if (preSelected) {
                    handleEventSelect({ detail: [preSelected] } as CustomEvent);
                }
            }

        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            loading = false;
        }
    }

    function handleEventSelect(event: CustomEvent<EmailTechEvent[]>) {
        // 1. Clear any pending saves from the PREVIOUS event to prevent overwriting
        if (saveTimeout) clearTimeout(saveTimeout);

        const selection = event.detail;
        if (!selection || selection.length === 0) {
            resetView();
            return;
        }

        const main = selection[0];
        if (selection.length === 1 && main.event_venue === 'New City Gas') {
            const bazart = events.find(
                (e) => e.event_date === main.event_date && e.event_venue === 'Bazart'
            );
            selectedEvents = bazart ? [main, bazart] : [main];
        } else {
            selectedEvents = selection;
        }

        const primaryEvent = selectedEvents[0];
        crewAssignments = primaryEvent.crew || {};
        
        // Update URL
        const newUrl = new URL($page.url);
        newUrl.searchParams.set('event_id', String(primaryEvent.event_id));
        goto(newUrl.toString(), { replaceState: false, noScroll: true });

        loadEmailContent();
    }

    function resetView() {
        selectedEvents = [];
        editorContent = '';
        crewAssignments = {};
        currentStatus = 'todo';
        
        const newUrl = new URL($page.url);
        newUrl.searchParams.delete('event_id');
        goto(newUrl.toString(), { replaceState: true, noScroll: true });
    }

    function loadEmailContent() {
        if (selectedEvents.length === 0) return;
        const primaryEvent = selectedEvents[0];
        const emailData = primaryEvent.email_data || {};
        
        // This sets the HTML view, but structured data is handled by EmailEditor via binding/props
        editorContent = primaryEvent.tech_mail || '';
        currentStatus = emailData.tech_status || 'todo';
    }

    async function handleContentChange(e: CustomEvent<{ content: string; structuredData: TechEmailForm }>) {
        // If no event selected, ignore
        if (selectedEvents.length === 0) return;

        // 1. CAPTURE DATA IMMEDIATELY (Closure)
        // This is crucial. We capture the ID and DATA *now*, not inside the timeout.
        const eventIdToSave = selectedEvents[0].event_id;
        const dataToSave = JSON.parse(JSON.stringify(e.detail.structuredData)); // Deep copy to be safe
        const htmlToSave = e.detail.content;

        // 2. Update Local State (UI Responsiveness)
        editorContent = htmlToSave;
        currentFormData = dataToSave;
        
        // Update the array object locally so if we switch back and forth without reload, data persists in memory
        selectedEvents[0].tech_mail = htmlToSave;
        if (!selectedEvents[0].email_data) selectedEvents[0].email_data = {};
        selectedEvents[0].email_data.tech_form_data = dataToSave;

        // 3. Debounce the Database Save
        if (saveTimeout) clearTimeout(saveTimeout);

        saveTimeout = setTimeout(async () => {
            console.log(`Saving data for Event ID: ${eventIdToSave}`);
            try {
                // Use the CAPTURED eventIdToSave, not selectedEvents[0].event_id
                await Promise.all([
                    updateEventEmailData(eventIdToSave, 'tech', dataToSave),
                    updateEventEmail(eventIdToSave, 'tech', htmlToSave)
                ]);
            } catch (err) {
                console.error("Error saving email data:", err);
            }
        }, 1000); 
    }

    async function handleAutofill() {
        if (selectedEvents.length === 0) return;
        const eventId = selectedEvents[0].event_id;
        const eventDate = selectedEvents[0].event_date;
        const eventName = selectedEvents[0].event_name || selectedEvents[0].artist_name || '';
        if (eventDate) {
            loading = true;
            const result = await autofillEventCrew(eventId, eventDate, eventName);
            loading = false;
            if (result.success && result.assignments) {
                crewAssignments = result.assignments;
                selectedEvents[0].crew = result.assignments;
                selectedEvents = [...selectedEvents];
            }
        }

        if (emailEditorComponent) {
            emailEditorComponent.runAutofill();
        }
    }

    async function handleReset() {
        if (selectedEvents.length === 0) return;
        const eventId = selectedEvents[0].event_id;
        
        loading = true;
        const success = await resetEventData(eventId, 'tech');
        if (success) {
            window.location.reload();
        } else {
            loading = false;
            alert('Failed to reset event data.');
        }
    }

    async function handleSave() {
        if (selectedEvents.length === 0) return;
        // Immediate save button
        if(saveTimeout) clearTimeout(saveTimeout);
        
        const eventId = selectedEvents[0].event_id;
        try {
            await Promise.all([
                updateEventEmailData(eventId, 'tech', currentFormData),
                updateEventEmail(eventId, 'tech', editorContent)
            ]);
            alert('Email saved successfully');
        } catch (error) {
            alert('Error saving email');
        }
    }

    async function handleCrewUpdate(e: CustomEvent) {
        if (selectedEvents.length === 0) return;
        crewAssignments = e.detail.assignments;
        await updateEventCrew(selectedEvents[0].event_id, crewAssignments);
        selectedEvents[0].crew = crewAssignments;
        selectedEvents = [...selectedEvents];
    }

    async function handleAddCrew(e: CustomEvent) {
        const { name, email } = e.detail;
        const newMember = await addCrewMember(name, email);
        if (newMember) {
            crewMembers = [...crewMembers, newMember];
        } else {
            alert('Failed to add crew member.');
        }
    }

    async function handleRemoveCrew(e: CustomEvent) {
        const member = e.detail;
        const success = await deleteCrewMember(member.id);
        if (success) {
            crewMembers = crewMembers.filter(c => c.id !== member.id);
        } else {
            alert('Failed to delete crew member.');
        }
    }

    async function handleStatusUpdate(e: CustomEvent<string>) {
        if (selectedEvents.length === 0) return;
        const newStatus = e.detail;
        const eventId = selectedEvents[0].event_id;
        currentStatus = newStatus;
        if (!selectedEvents[0].email_data) selectedEvents[0].email_data = {};
        
        selectedEvents[0].email_data.tech_status = newStatus;
        selectedEvents[0].email_data.vj_status = newStatus;

        await updateEmailStatus(eventId, 'tech', newStatus);
        await updateEmailStatus(eventId, 'vj', newStatus);
    }
</script>

<svelte:head>
    <title>Email</title>
</svelte:head>

<MainLayout pageTitle="Email Tech">
    <div class="h-full flex flex-col p-6 w-full mx-auto overflow-hidden">
        <div class="flex-1 grid grid-cols-[300px_minmax(0,1fr)_300px] gap-6 min-w-[1200px] overflow-hidden">
            <div class="flex flex-col gap-4 overflow-hidden">
                <div class="bg-navbar border border-gray1 rounded-xl p-3 flex-shrink-0">
                    <EventSelector {events} bind:selectedEvents {loading} on:select={handleEventSelect} />
                </div>
                <div class="flex-1 overflow-y-auto flex flex-col gap-4">
                    <EventInfo event={selectedEvents[0] || null} />
                    {#if selectedEvents.length > 0}
                        <EventActions
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
                        <h2 class="text-sm font-bold text-white pl-2">Tech & VJ Mail</h2>
                    </div>
                </div>

                <div class="flex-1 p-0 overflow-hidden bg-navbar">
                    <EmailEditor
                        bind:this={emailEditorComponent}
                        {selectedEvents}
                        {events}
                        content={editorContent}
                        readOnly={selectedEvents.length === 0}
                        on:change={handleContentChange}
                    />
                </div>
            </div>

            <div class="flex flex-col gap-4 overflow-hidden">
                <div class="flex-shrink-0">
                    <ActionPanel
                        formData={currentFormData} 
                        {selectedEvents}
                        on:send={handleSave}
                    />
                </div>
                <div class="flex-1 overflow-hidden">
                    <CrewManager
                        {crewMembers}
                        assignments={crewAssignments}
                        {selectedEvents}
                        on:assign={handleCrewUpdate}
                        on:add={handleAddCrew} 
                        on:remove={handleRemoveCrew}
                    />
                </div>
            </div>
        </div>
    </div>
</MainLayout>