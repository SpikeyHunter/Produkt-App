<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';     
    import { readable, type Readable } from 'svelte/store';
    import MainLayout from '$lib/components/MainLayout.svelte';
    import EventSelector from '$lib/components/production/emailtech/EventSelector.svelte';
    import EventInfo from '$lib/components/production/emailtech/EventInfo.svelte';
    import EventActions from '$lib/components/production/emailtech/EventActions.svelte';
    import EmailEditor from '$lib/components/production/emailtech/EmailEditor.svelte';
    import CrewManager from '$lib/components/production/emailtech/CrewManager.svelte';
    import ActionPanel from '$lib/components/production/emailtech/ActionPanel.svelte';
    import SchedulePickModal from '$lib/components/production/emailtech/SchedulePickModal.svelte';
    import EmailSettingsModal from '$lib/components/production/emailtech/EmailSettingsModal.svelte';
    import {
        fetchEmailTechEvents,
        fetchCrewMembers,
        matchEventCrew,
        fetchEmailTechRecord,
        updateLinkedEvents,
        resetEventData,
        addCrewMember,
        deleteCrewMember
    } from '$lib/services/emailtechService';
    import { crewFromScheduleRow, type ScheduleRow, type ScheduleMatch } from '$lib/services/scheduleMatch';
    import { createEmailTechSync, tableMissing, EMAILTECH_SCHEMA_SQL, type EmailTechSync, type EmailTechRecord, type Peer, type SaveState, type Touch } from '$lib/services/emailTechSync';
    import { loadEmailSettings } from '$lib/services/emailSettingsService';
    import { defaultTechForm, liaisonNamesOf } from '$lib/services/techTemplateService'; 
    import { authStore } from '$lib/stores/authStore';
    import { normalizeCrew } from '$lib/types/emailtech';
    import type { EmailTechEvent, CrewMember, CrewAssignments, TechEmailForm } from '$lib/types/emailtech';

    let loading = true;
    let events: EmailTechEvent[] = [];
    let selectedEvents: EmailTechEvent[] = [];
    let crewMembers: CrewMember[] = [];

    let currentStatus = 'todo';
    let crewAssignments: CrewAssignments = {};
    let currentFormData: TechEmailForm = JSON.parse(JSON.stringify(defaultTechForm));

    let emailEditorComponent: EmailEditor;

    // --- co-editing ---
    let sync: EmailTechSync | null = null;
    /** event the engine is bound to (selectedEvents can change under us via bind:) */
    let syncEventId: number | null = null;
    let settingsOpen = false;
    let sqlCopied = false;
    let record: EmailTechRecord | null = null;
    let unsubRecord: (() => void) | null = null;
    let peersStore: Readable<Peer[]> = readable([]);
    let saveStateStore: Readable<SaveState> = readable('idle' as SaveState);
    let touchedStore: Readable<Record<string, Touch>> = readable({});
    let blurTimer: ReturnType<typeof setTimeout> | null = null;

    $: senderName = $authStore.profile?.first_name
        || ($authStore.user?.user_metadata?.first_name as string | undefined)
        || ($authStore.user?.user_metadata?.name as string | undefined)?.split(' ')[0]
        || $authStore.user?.email?.split('@')[0]
        || 'Tech Team';

    // --- schedule pick modal ---
    let pickOpen = false;
    let pickRows: ScheduleRow[] = [];
    let pickCandidates: ScheduleRow[] = [];
    let pickReason = '';
    let crewSourceNote = '';
    let autofillNote = '';

    $: liaisonNames = Array.from(new Set(selectedEvents.flatMap((e) => liaisonNamesOf(e))));

    onMount(async () => {
        await Promise.all([loadInitialData(), loadEmailSettings()]);
    });

    onDestroy(() => {
        void teardownSync();
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
                    await selectEvents([preSelected, ...linkedEventsOf(preSelected)]);
                }
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            loading = false;
        }
    }

    /** Events linked to `owner` (email_data.linked_event_ids), deduped by event_id. */
    function linkedEventsOf(owner: EmailTechEvent, ids?: number[]): EmailTechEvent[] {
        const list: number[] = ids ?? (Array.isArray(owner.email_data?.linked_event_ids) ? owner.email_data.linked_event_ids : []);
        const out: EmailTechEvent[] = [];
        list.forEach((id) => {
            if (id === owner.event_id) return;
            const ev = events.find((x) => x.event_id === id);
            if (ev && !out.includes(ev)) out.push(ev);
        });
        return out;
    }

    /* ------------------------------------------------------- selection */

    function handleEventSelect(event: CustomEvent<EmailTechEvent[]>) {
        const selection = event.detail;
        if (!selection || selection.length === 0) {
            void resetView();
            return;
        }
        void selectEvents(selection);
    }

    async function selectEvents(selection: EmailTechEvent[]) {
        const primary = selection[0];
        const switching = !sync || syncEventId !== primary.event_id;

        if (switching) {
            await teardownSync();
            // Use the freshest copy of the event, and re-read its email-tech row
            // from the database before the editor mounts: the list is a snapshot
            // from page load and may miss what someone else (or you, on another
            // event) saved since.
            const fresh = events.find((e) => e.id === primary.id) || primary;
            loading = true;
            const latest = await fetchEmailTechRecord(fresh.event_id);
            loading = false;
            if (latest) {
                fresh.crew = latest.crew;
                fresh.email_data = latest.email_data;
                fresh.tech_mail = latest.tech_mail;
                fresh.vj_mail = latest.vj_mail;
            }
            selectedEvents = [fresh, ...selection.slice(1).map((e) => events.find((x) => x.id === e.id) || e)];
            startSync(fresh);
        } else {
            selectedEvents = selection;
        }

        const newUrl = new URL($page.url);
        newUrl.searchParams.set('event_id', String(primary.event_id));
        goto(newUrl.toString(), { replaceState: false, noScroll: true });
    }

    async function resetView() {
        await teardownSync();
        selectedEvents = [];
        crewAssignments = {};
        currentStatus = 'todo';
        currentFormData = JSON.parse(JSON.stringify(defaultTechForm));
        crewSourceNote = '';
        autofillNote = '';
        
        const newUrl = new URL($page.url);
        newUrl.searchParams.delete('event_id');
        goto(newUrl.toString(), { replaceState: true, noScroll: true });
    }

    /* ------------------------------------------------------------ sync */

    function startSync(primary: EmailTechEvent) {
        syncEventId = primary.event_id;
        sync = createEmailTechSync(
            primary.event_id,
            { crew: primary.crew || {}, email_data: primary.email_data || {}, tech_mail: primary.tech_mail, vj_mail: primary.vj_mail },
            senderName
        );
        peersStore = sync.peers;
        saveStateStore = sync.saveState;
        touchedStore = sync.touched;

        let first = true;
        unsubRecord = sync.record.subscribe((rec) => {
            record = rec;
            applyRecord(rec, first);
            first = false;
        });

        sync.onRemote((keys) => {
            // form pieces someone else changed: rebuild the editor's copy
            if (keys.some((k) => k.startsWith('form.')) && record) {
                currentFormData = formFrom(record);
            }
            if (keys.includes('linked_event_ids') && record) {
                const owner = selectedEvents[0];
                if (owner) selectedEvents = [owner, ...linkedEventsOf(owner, record.email_data.linked_event_ids || [])];
            }
        });

        sync.onAdvance(() => void refreshEvents());

        // brand-new event: create the form once so everyone shares the same one
        if (!primary.email_data?.tech_form_data) {
            const form = formFrom(sync ? { crew: primary.crew || {}, email_data: {}, tech_mail: null, vj_mail: null } : null);
            sync.replaceForm(form);
        }
    }

    async function teardownSync() {
        if (blurTimer) clearTimeout(blurTimer);
        unsubRecord?.();
        unsubRecord = null;
        const s = sync;
        sync = null;
        syncEventId = null;
        record = null;
        peersStore = readable([]);
        saveStateStore = readable('idle' as SaveState);
        touchedStore = readable({});
        if (s) await s.destroy();
    }

    /** Push the record into the UI state and into the shared event objects. */
    function applyRecord(rec: EmailTechRecord, initial: boolean) {
        crewAssignments = rec.crew;
        currentStatus = rec.email_data.tech_status || 'todo';
        if (initial) currentFormData = formFrom(rec);

        const primary = selectedEvents[0];
        if (primary) {
            primary.crew = rec.crew;
            primary.email_data = rec.email_data;
            primary.tech_mail = rec.tech_mail;
            primary.vj_mail = rec.vj_mail;
            selectedEvents = [...selectedEvents];
            events = [...events];
        }
    }

    /** Saved form + defaults for any field added since it was saved. */
    function formFrom(rec: EmailTechRecord | null): TechEmailForm {
        const base: TechEmailForm = JSON.parse(JSON.stringify(defaultTechForm));
        const saved = rec?.email_data?.tech_form_data;
        if (!saved) {
            return { ...base, visible_sections: { ...base.visible_sections, team_notes: false } };
        }
        return {
            ...base,
            ...JSON.parse(JSON.stringify(saved)),
            visible_sections: { ...base.visible_sections, ...(saved.visible_sections || {}) },
            set_times: Array.isArray(saved.set_times) ? saved.set_times : [],
            crew_calls: Array.isArray(saved.crew_calls) && saved.crew_calls.length ? saved.crew_calls : base.crew_calls,
            backline: Array.isArray(saved.backline) ? saved.backline : []
        };
    }

    /** Editor changed something: send only the keys that differ. */
    function handleContentChange(e: CustomEvent<TechEmailForm>) {
        if (!sync || !record) return;
        const form = e.detail;
        currentFormData = form;
        const saved: any = record.email_data.tech_form_data || {};
        const patch: Partial<TechEmailForm> = {};
        for (const k of Object.keys(form) as (keyof TechEmailForm)[]) {
            if (JSON.stringify(form[k] ?? null) !== JSON.stringify(saved[k] ?? null)) (patch as any)[k] = form[k];
        }
        if (Object.keys(patch).length) sync.setForm(patch);
    }

    function handleMails(e: CustomEvent<{ tech: string; vj: string }>) {
        if (!sync) return;
        sync.setMail('tech', e.detail.tech);
        sync.setMail('vj', e.detail.vj);
    }

    // Which section card has focus -> presence + "edited by" badge for others.
    function handleEditorFocusIn(e: FocusEvent) {
        if (!sync) return;
        if (blurTimer) clearTimeout(blurTimer);
        const sec = (e.target as HTMLElement | null)?.closest?.('[data-section]')?.getAttribute('data-section') || null;
        sync.focus(sec);
    }
    function handleEditorFocusOut() {
        if (!sync) return;
        if (blurTimer) clearTimeout(blurTimer);
        blurTimer = setTimeout(() => sync?.focus(null), 400);
    }

    /* ---------------------------------------------------- linked events */

    /** Selector: link/unlink on any row. Only the open event saves through sync;
     *  another owner's links are written directly. */
    async function handleLink(e: CustomEvent<{ primary: EmailTechEvent; ids: number[] }>) {
        const { primary, ids } = e.detail;
        if (sync && selectedEvents[0]?.event_id === primary.event_id) {
            applyLinks(ids);
            return;
        }
        const ok = await updateLinkedEvents(primary.event_id, ids);
        if (!ok) alert('Could not update the link.');
    }

    /** Show Info "+ Link event" / × : new full list of linked ids for the open event. */
    function handleLinkIds(e: CustomEvent<number[]>) {
        applyLinks(e.detail);
    }

    function applyLinks(ids: number[]) {
        const owner = selectedEvents[0];
        if (!sync || !owner) return;
        const clean = Array.from(new Set(ids.filter((id) => id !== owner.event_id)));
        sync.setLinked(clean);
        selectedEvents = [owner, ...linkedEventsOf(owner, clean)];
    }

    /** events_advance changed (riders, soundcheck, DOS…): reload and keep the selection. */
    async function refreshEvents() {
        const fresh = await fetchEmailTechEvents();
        if (!fresh.length) return;
        events = fresh;
        if (selectedEvents.length) {
            const byId = (id: string) => fresh.find((x) => x.id === id);
            const next = selectedEvents.map((s) => byId(s.id) || s);
            // the primary's email-tech columns stay owned by the sync record
            if (record) {
                next[0].crew = record.crew;
                next[0].email_data = record.email_data;
                next[0].tech_mail = record.tech_mail;
                next[0].vj_mail = record.vj_mail;
            }
            selectedEvents = next;
        }
    }

    /* --------------------------------------------------------- autofill */

    async function handleAutofill() {
        if (selectedEvents.length === 0 || !sync) return;
        const primary = selectedEvents[0];
        autofillNote = '';
        loading = true;
        const { match, assignments } = await matchEventCrew(primary, crewMembers);
        loading = false;
        await applyMatch(match, assignments);
    }

    async function applyMatch(match: ScheduleMatch, assignments: CrewAssignments | null) {
        crewSourceNote = match.row ? `${match.row.event_name || 'row'} (${match.reason})` : match.reason;
        // Several shows, or no show at all that day (only corpo / maintenance…):
        // let the user pick any row of the month, non-show types included.
        if (match.status === 'ambiguous' || (match.status === 'none' && match.monthRows.length)) {
            pickRows = match.monthRows;
            pickCandidates = match.candidates;
            pickReason = match.status === 'none' ? `${match.reason} — pick any row to use its crew, or skip` : match.reason;
            pickOpen = true;
            return;
        }
        if (assignments && sync) {
            sync.setCrew(assignments);
        } else if (match.status === 'none') {
            autofillNote = `No crew found in the schedule: ${match.reason}.`;
        }
        await tick();
        emailEditorComponent?.runAutofill();
    }

    async function handlePick(e: CustomEvent<ScheduleRow>) {
        pickOpen = false;
        if (!sync) return;
        const row = e.detail;
        sync.setPinnedRow(row.id);
        sync.setCrew(crewFromScheduleRow(row, crewMembers));
        crewSourceNote = `${row.event_name || 'row'} (chosen manually)`;
        await tick();
        emailEditorComponent?.runAutofill();
    }

    function handlePickClose() {
        pickOpen = false;
        emailEditorComponent?.runAutofill();
    }

    /* ------------------------------------------------------------ misc */

    async function handleReset() {
        if (selectedEvents.length === 0) return;
        const eventId = selectedEvents[0].event_id;
        
        loading = true;
        await teardownSync();
        const success = await resetEventData(eventId, 'tech');
        if (success) {
            window.location.reload();
        } else {
            loading = false;
            alert('Failed to reset event data.');
        }
    }

    function handleCrewUpdate(e: CustomEvent) {
        if (selectedEvents.length === 0 || !sync) return;
        crewAssignments = normalizeCrew(e.detail.assignments);
        sync.setCrew(crewAssignments);
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

    function handleStatusUpdate(e: CustomEvent<string>) {
        if (selectedEvents.length === 0 || !sync) return;
        currentStatus = e.detail;
        sync.setStatus(e.detail);
    }

    async function copySql() {
        try {
            await navigator.clipboard.writeText(EMAILTECH_SCHEMA_SQL);
            sqlCopied = true;
            setTimeout(() => (sqlCopied = false), 2000);
        } catch {
            prompt('Copy this SQL:', EMAILTECH_SCHEMA_SQL);
        }
    }

    const SAVE_LABEL: Record<SaveState, string> = {
        idle: '', dirty: 'Unsaved…', saving: 'Saving…', saved: 'Saved', error: 'NOT SAVED — retrying'
    };
</script>

<svelte:head>
    <title>Email</title>
</svelte:head>

<svelte:window on:beforeunload={() => { void sync?.flush(); }} />

<MainLayout pageTitle="Email Tech">
    <div class="emailtech-page h-full flex flex-col p-6 w-full mx-auto overflow-hidden gap-4">
        {#if $tableMissing}
            <div class="flex-shrink-0 flex items-center gap-3 bg-problem/10 border border-problem/50 rounded-xl px-4 py-2.5 text-xs text-white">
                <span class="font-bold text-problem uppercase tracking-wider">Setup</span>
                <span class="flex-1">The <code class="font-mono">events_emailtech</code> table doesn't exist yet — saving falls back to the old columns on <code class="font-mono">events</code> (no per-field co-editing). Run the SQL once in Supabase, then reload.</span>
                <button type="button" on:click={copySql} class="px-3 py-1.5 rounded-lg bg-lime text-black font-bold hover:bg-white transition-colors cursor-pointer whitespace-nowrap">
                    {sqlCopied ? 'Copied!' : 'Copy SQL'}
                </button>
            </div>
        {/if}
        <div class="flex-1 grid grid-cols-[300px_minmax(0,1fr)_300px] gap-6 min-w-[1200px] overflow-hidden">
            <div class="flex flex-col gap-4 overflow-hidden">
                <div class="bg-navbar border border-gray1 rounded-xl p-3 flex-shrink-0">
                    <EventSelector {events} bind:selectedEvents {loading} on:select={handleEventSelect} on:link={handleLink} />
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
                        {#if autofillNote}
                            <p class="text-xs text-problem px-1">{autofillNote}</p>
                        {/if}
                    {/if}
                </div>
            </div>

            <div class="flex flex-col gap-0 bg-navbar border border-gray1 rounded-xl overflow-hidden">
                <div class="flex items-center justify-between p-3 border-b border-gray1 bg-gray1/50 flex-shrink-0">
                    <div class="flex items-center gap-3">
                        <h2 class="text-sm font-bold text-white pl-2">Tech & VJ Mail</h2>
                        {#if selectedEvents.length}
                            {@const st = $saveStateStore}
                            <span class="text-[10px] font-bold uppercase tracking-wider
                                {st === 'error' ? 'text-problem animate-pulse' : st === 'saved' ? 'text-confirmed' : 'text-gray2'}">
                                {SAVE_LABEL[st]}
                            </span>
                        {/if}
                    </div>
                    <div class="flex items-center gap-3 pr-1">
                        {#if $peersStore.length}
                            <div class="flex items-center gap-1.5" title={$peersStore.map((p) => p.user).join(', ')}>
                                <span class="text-[10px] text-gray2 font-bold uppercase tracking-wider mr-1">Also here</span>
                                {#each $peersStore as p (p.clientId)}
                                    <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-black"
                                          style="background-color: {p.color};"
                                          title="{p.user}{p.section ? ` · editing ${p.section.replace('_', ' ')}` : ''}">
                                        {p.user.slice(0, 1).toUpperCase()}
                                    </span>
                                {/each}
                            </div>
                        {/if}
                        <button type="button" on:click={() => (settingsOpen = true)}
                            class="w-7 h-7 rounded-lg flex items-center justify-center text-gray2 hover:text-lime hover:bg-gray1 transition-colors cursor-pointer"
                            title="Email settings" aria-label="Email settings">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        </button>
                    </div>
                </div>

                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div class="flex-1 p-0 overflow-hidden bg-navbar" on:focusin={handleEditorFocusIn} on:focusout={handleEditorFocusOut}>
                    <EmailEditor
                        bind:this={emailEditorComponent}
                        formData={currentFormData}
                        {selectedEvents}
                        {events}
                        {senderName}
                        touched={touchedStore}
                        readOnly={selectedEvents.length === 0}
                        on:change={handleContentChange}
                        on:link={handleLinkIds}
                    />
                </div>
            </div>

            <div class="flex flex-col gap-4 overflow-hidden">
                <div class="flex-shrink-0">
                    <ActionPanel
                        formData={currentFormData} 
                        {selectedEvents}
                        {crewMembers}
                        {senderName}
                        on:change={() => handleContentChange(new CustomEvent('change', { detail: currentFormData }))}
                        on:mails={handleMails}
                        on:preview={(e) => emailEditorComponent?.showPreview(e.detail)}
                    />
                </div>
                <div class="flex-1 overflow-hidden">
                    <CrewManager
                        {crewMembers}
                        assignments={crewAssignments}
                        {selectedEvents}
                        {liaisonNames}
                        sourceNote={crewSourceNote}
                        on:assign={handleCrewUpdate}
                        on:add={handleAddCrew} 
                        on:remove={handleRemoveCrew}
                    />
                </div>
            </div>
        </div>
    </div>
</MainLayout>

<EmailSettingsModal isOpen={settingsOpen} on:close={() => (settingsOpen = false)} />

<SchedulePickModal
    isOpen={pickOpen}
    event={selectedEvents[0] || null}
    rows={pickRows}
    candidates={pickCandidates}
    reason={pickReason}
    on:pick={handlePick}
    on:close={handlePickClose}
/>

<style>
    /* every clickable thing on this page shows a hand cursor */
    :global(.emailtech-page button:not(:disabled)),
    :global(.emailtech-page [role='button']),
    :global(.emailtech-page select:not(:disabled)),
    :global(.emailtech-page label:has(input[type='checkbox'])),
    :global(.emailtech-page input[type='checkbox']:not(:disabled)),
    :global(.emailtech-page input[type='time']:not(:disabled)),
    :global(.emailtech-page input[type='color']:not(:disabled)) {
        cursor: pointer;
    }
</style>
