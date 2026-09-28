<script lang="ts">
    import { createEventDispatcher, setContext } from 'svelte';
    import { writable, readable, type Readable } from 'svelte/store';
    import { autofillTechForm, initSetTimes } from '$lib/services/techTemplateService';
    import { generateTechEmailString } from '$lib/utils/emailTechGenerator';
    import { generateVJEmailString } from '$lib/utils/emailGenerator';
    import { normalizeCrew } from '$lib/types/emailtech';
    import { emailSettings } from '$lib/services/emailSettingsService';
    import type { EmailTechEvent, TechEmailForm } from '$lib/types/emailtech';
    import type { Touch } from '$lib/services/emailTechSync';
    import TechForm from './TechForm.svelte';

    /** The form lives in the page's sync record; this component edits it and
     *  reports every change so only the touched pieces get saved. */
    export let formData: TechEmailForm;
    export let readOnly: boolean = false;
    export let selectedEvents: EmailTechEvent[] = [];
    export let events: EmailTechEvent[] = [];
    export let senderName = 'Tech Team';
    /** who is editing which section (from the sync engine) */
    export let touched: Readable<Record<string, Touch>> = readable({});

    const dispatch = createEventDispatcher<{ change: TechEmailForm }>();

    // SectionCard reads this through context to show the "✎ Name" badge.
    const touchedCtx = writable<Record<string, Touch>>({});
    setContext('emailtech-touched', touchedCtx);
    $: touchedCtx.set($touched || {});

    // --- Preview ---
    let view: 'edit' | 'preview' = 'edit';
    let previewKind: 'tech' | 'vj' = 'tech';
    let previewWidth: 'mobile' | 'desktop' = 'desktop';
    $: previewFormat = formData?.email_format || $emailSettings.format;
    $: previewHtml =
        view === 'preview' && selectedEvents.length && formData
            ? previewKind === 'tech'
                ? generateTechEmailString(selectedEvents, formData, senderName, previewFormat)
                : generateVJEmailString(selectedEvents, formData, senderName, previewFormat)
            : '';
    // the "text" format is black-on-white paragraphs, like a plain mail client
    $: previewDoc = previewFormat === 'text'
        ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#fff;}</style></head><body>${previewHtml}</body></html>`
        : previewHtml;

    export function showPreview(kind: 'tech' | 'vj' = 'tech') {
        previewKind = kind;
        view = 'preview';
    }

    // --- Keep crew names and set times in step with the event data ---
    // Only when the INPUTS change (crew, timetable, event). Re-deriving on every
    // form replacement would echo a remote edit straight back as a save and two
    // clients could ping-pong forever.
    let lastCrewKey = '';
    let lastSetTimesKey = '';
    $: crewKey = `${selectedEvents[0]?.event_id ?? ''}:${JSON.stringify(selectedEvents[0]?.crew || null)}`;
    $: if (formData && selectedEvents.length && crewKey !== lastCrewKey) {
        lastCrewKey = crewKey;
        syncCrewToForm(selectedEvents[0].crew);
    }

    $: setTimesKey = selectedEvents.map((e) => `${e.event_id}:${JSON.stringify(e.timetable)}`).join('|') + '|' + events.length;
    $: if (formData && selectedEvents.length && setTimesKey !== lastSetTimesKey) {
        lastSetTimesKey = setTimesKey;
        syncSetTimes(selectedEvents);
    }

    function syncCrewToForm(rawCrew: any) {
        if (!formData || formData.crew_calls_manual) return;
        const crew = normalizeCrew(rawCrew);
        const firsts = (roles: string[]) => {
            const out: string[] = [];
            roles.forEach((r) => (crew[r] || []).forEach((n) => {
                const f = n.trim().split(' ')[0];
                if (f && !out.includes(f)) out.push(f);
            }));
            return out.join(', ');
        };
        const techs = firsts(['LD', 'VIDEO', 'SOUND', 'TECH', 'DT']);
        const vjs = firsts(['VJ']);
        if (!formData.crew_calls?.length) return;
        let changed = false;
        if (formData.crew_calls[0].names !== techs) { formData.crew_calls[0].names = techs; changed = true; }
        if (formData.crew_calls[1] && formData.crew_calls[1].names !== vjs) { formData.crew_calls[1].names = vjs; changed = true; }
        if (changed) emit();
    }

    function syncSetTimes(evts: EmailTechEvent[]) {
        const next = initSetTimes(evts, events);
        if (JSON.stringify(formData.set_times) !== JSON.stringify(next)) {
            formData.set_times = next;
            emit();
        }
    }

    function handleFormChange(e: CustomEvent<TechEmailForm>) {
        if (e.detail && e.detail !== formData) formData = e.detail;
        emit();
    }

    function emit() {
        if (readOnly || !formData) return;
        dispatch('change', formData);
    }

    export function runAutofill() {
        formData = autofillTechForm(selectedEvents, formData, events);
        emit();
    }
</script>

<div class="h-full flex flex-col relative group bg-navbar rounded-lg">
    {#if selectedEvents.length === 0}
        <div class="absolute inset-0 flex items-center justify-center text-gray2 text-sm font-bold opacity-50">Select an event</div>
    {:else}
        <!-- Edit / Preview switch -->
        <div class="flex items-center justify-between px-4 py-2 shrink-0 gap-3 border-b border-gray1/60">
            <div class="flex gap-1 bg-gray1 p-1 rounded-lg">
                <button type="button" on:click={() => (view = 'edit')}
                    class="px-3 text-xs font-bold py-1.5 rounded-md transition-all cursor-pointer {view === 'edit' ? 'bg-lime text-black shadow-sm' : 'text-gray-400 hover:text-white'}">Edit</button>
                <button type="button" on:click={() => (view = 'preview')}
                    class="px-3 text-xs font-bold py-1.5 rounded-md transition-all cursor-pointer {view === 'preview' ? 'bg-lime text-black shadow-sm' : 'text-gray-400 hover:text-white'}">Preview</button>
            </div>
            {#if view === 'preview'}
                <div class="flex items-center gap-2">
                    <div class="flex gap-1 bg-gray1 p-1 rounded-lg">
                        <button type="button" on:click={() => (previewKind = 'tech')}
                            class="px-3 text-xs font-bold py-1.5 rounded-md transition-all cursor-pointer {previewKind === 'tech' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}">Tech</button>
                        <button type="button" on:click={() => (previewKind = 'vj')}
                            class="px-3 text-xs font-bold py-1.5 rounded-md transition-all cursor-pointer {previewKind === 'vj' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}">VJ</button>
                    </div>
                    <div class="flex gap-1 bg-gray1 p-1 rounded-lg">
                        <button type="button" on:click={() => (previewWidth = 'mobile')} title="Phone width (375px)" aria-label="Phone width"
                            class="px-2.5 py-1.5 rounded-md transition-all cursor-pointer {previewWidth === 'mobile' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                        </button>
                        <button type="button" on:click={() => (previewWidth = 'desktop')} title="Desktop width" aria-label="Desktop width"
                            class="px-2.5 py-1.5 rounded-md transition-all cursor-pointer {previewWidth === 'desktop' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        </button>
                    </div>
                </div>
            {/if}
        </div>

        {#if view === 'edit'}
            <div class="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
                <TechForm 
                    bind:formData 
                    {readOnly} 
                    availableEvents={events} 
                    {selectedEvents}
                    selectedEvent={selectedEvents[0]} 
                    on:change={handleFormChange} 
                    on:link
                />
            </div>
        {:else}
            <div class="flex-1 overflow-auto p-4 bg-black/30 flex justify-center items-start">
                <iframe
                    title="Email preview"
                    srcdoc={previewDoc}
                    sandbox=""
                    class="{previewFormat === 'text' ? 'bg-white' : 'bg-[#161616]'} border border-gray1 rounded-xl shadow-2xl transition-all duration-300"
                    style="width: {previewWidth === 'mobile' ? '375px' : '100%'}; max-width: 100%; height: 100%; min-height: 640px;"
                ></iframe>
            </div>
        {/if}
    {/if}
</div>
