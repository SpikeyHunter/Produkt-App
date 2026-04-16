<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { supabase } from '$lib/supabase';
    import MainLayout from '$lib/components/MainLayout.svelte';
    import EventSelectorBO from '$lib/components/boxoffice/EventSelectorBO.svelte';
    import ReportGrid from '$lib/components/boxoffice/ReportGrid.svelte';
    import ReportRightPanel from '$lib/components/boxoffice/ReportRightPanel.svelte';
    import { DEFAULT_TICKETS } from '$lib/components/boxoffice/defaults';

    let events: any[] = [];
    let selectedEvent: any = null;
    let reportData: any = null;
    let currentUser: any = null;
    let channel: any;

    let isBookingUser = false;

    onMount(async () => {
        await loadUser();
        await loadEvents();
        setupRealtime();
    });

    onDestroy(() => {
        if (channel) supabase.removeChannel(channel);
    });

    async function loadUser() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
            currentUser = data;
            isBookingUser = currentUser?.main_permission === 'Booking' || currentUser?.secondary_permission?.includes('Booking');
        }
    }

    async function loadEvents() {
        const { data } = await supabase.from('events').select('*, box_office_reports(status, approved_by, approved_at)').order('event_date', { ascending: false });
        events = data || [];
    }

    async function handleEventSelect(event: CustomEvent) {
        selectedEvent = event.detail;
        if (selectedEvent) {
            await loadReport(selectedEvent.event_id);
        }
    }

    async function loadReport(eventId: number) {
        // Requirement 2: Use .maybeSingle() instead of .single() to avoid error when record doesn't exist
        const { data, error } = await supabase.from('box_office_reports').select('*').eq('event_id', eventId).maybeSingle();
        
        if (!data) {
            // Create default report if it doesn't exist
            const newReport = {
                event_id: eventId,
                status: 'todo',
                online: DEFAULT_TICKETS.online,
                door: DEFAULT_TICKETS.door,
                table_tickets: DEFAULT_TICKETS.table_tickets,
                comp: DEFAULT_TICKETS.comp,
                other: DEFAULT_TICKETS.other
            };
            const { data: inserted } = await supabase.from('box_office_reports').insert(newReport).select().single();
            reportData = inserted;

            // Sync the new report back to the selectedEvent and the events array to trigger UI updates
            if (selectedEvent) {
                selectedEvent.box_office_reports = [inserted];
                selectedEvent = { ...selectedEvent };
                const eventIndex = events.findIndex(e => e.event_id === eventId);
                if (eventIndex > -1) {
                    events[eventIndex].box_office_reports = [inserted];
                    events = [...events];
                }
            }
        } else {
            reportData = data;
        }
    }

    function setupRealtime() {
        channel = supabase.channel('boxoffice_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'box_office_reports' }, payload => {
                const newRecord = payload.new as any;
                
                if (selectedEvent && newRecord.event_id === selectedEvent.event_id) {
                    reportData = newRecord;
                    // Trigger reactivity for selectedEvent to update UI immediately
                    selectedEvent.box_office_reports = [newRecord];
                    selectedEvent = { ...selectedEvent };
                }
                
                // Update events list status badge
                const eventIndex = events.findIndex((e: any) => e.event_id === newRecord.event_id);
                if (eventIndex > -1) {
                    events[eventIndex].box_office_reports = [newRecord];
                    events = [...events];
                }
            })
            .subscribe();
    }

    async function saveReportData(updates: any) {
        if (!selectedEvent) return;
        
        // Optimistic UI update
        reportData = { ...reportData, ...updates };

        // Requirement 3: Optimistic UI update for the selectedEvent to make the button toggle instantly
        selectedEvent.box_office_reports = [{ ...(selectedEvent.box_office_reports?.[0] || {}), ...updates }];
        selectedEvent = { ...selectedEvent };

        const eventIndex = events.findIndex((e: any) => e.event_id === selectedEvent.event_id);
        if (eventIndex > -1) {
            events[eventIndex].box_office_reports = [{ ...(events[eventIndex].box_office_reports?.[0] || {}), ...updates }];
            events = [...events];
        }

        // Apply changes to database
        await supabase
            .from('box_office_reports')
            .update(updates)
            .eq('event_id', selectedEvent.event_id);
    }
</script>

<MainLayout>
    <div class="p-4 h-[calc(100vh-64px)] box-border">
        <div class="liaison-container">
            <div class="selector-column overflow-visible flex-shrink-0">
                <EventSelectorBO 
                    {events} 
                    {selectedEvent} 
                    {isBookingUser}
                    {currentUser}
                    on:select={(e: CustomEvent) => handleEventSelect(e)} 
                    on:approve={(e: CustomEvent) => saveReportData(e.detail)}
                    on:statusChange={(e: CustomEvent) => saveReportData({ status: e.detail })}
                />
            </div>

            <div class="details-column rounded-xl overflow-y-auto shadow-lg bg-[#1e1e1e] backdrop-blur relative">
                {#if selectedEvent && reportData}
                    <ReportGrid {reportData} on:update={(e: CustomEvent) => saveReportData(e.detail)} />
                {:else}
                    <div class="h-full flex items-center justify-center text-gray2 font-bold opacity-50">
                        Select an event to view Box Office report
                    </div>
                {/if}
            </div>

            <div class="export-column rounded-xl overflow-hidden shadow-lg border border-gray2/20 bg-navbar/50 backdrop-blur">
                {#if selectedEvent && reportData}
                    <ReportRightPanel 
                        {reportData} 
                        {isBookingUser}
                        on:update={(e: CustomEvent) => saveReportData(e.detail)} 
                    />
                {/if}
            </div>
        </div>
    </div>
</MainLayout>

<style>
    .liaison-container {
        display: grid;
        grid-template-columns: 320px 1fr 280px;
        gap: 16px;
        height: 100%;
    }
    .selector-column, .details-column, .export-column {
        height: 100%;
        overflow: hidden;
    }
</style>