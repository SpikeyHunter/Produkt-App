<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fly } from 'svelte/transition';
    import type { TechEmailForm, EmailTechEvent } from '$lib/types/emailtech';
    import { liaisonLine } from '$lib/services/techTemplateService';
    import { defaultTechGreeting } from '$lib/utils/emailTechTemplate';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    /** every event in this email — the first is the main one */
    export let selectedEvents: EmailTechEvent[] = [];
    /** every event the selector knows, for the "+ Link" picker */
    export let events: EmailTechEvent[] = [];

    const dispatch = createEventDispatcher<{ change: void; toggle: any; link: number[] }>();

    $: isVisible = formData?.visible_sections?.['header'] ?? true;
    $: primary = selectedEvents[0] || null;
    $: linked = selectedEvents.slice(1);
    // What the advance says (events_advance.dos) — shown as the default.
    $: advanceLiaison = liaisonLine(selectedEvents);
    $: differs = advanceLiaison && (formData.liaison || '').trim() !== advanceLiaison;

    // --- link picker ---
    let pickerOpen = false;
    let search = '';
    $: linkedIds = new Set(selectedEvents.map((e) => e.event_id));
    $: candidates = events
        .filter((e, i, arr) => arr.findIndex((x) => x.event_id === e.event_id) === i) // one row per event
        .filter((e) => !linkedIds.has(e.event_id))
        .filter((e) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (e.event_name || '').toLowerCase().includes(q)
                || (e.artist_name || '').toLowerCase().includes(q)
                || (e.event_venue || '').toLowerCase().includes(q);
        })
        .sort((a, b) => {
            // same day as the main event first, then live shows by date, then the rest
            const day = primary?.event_date || '';
            const sa = a.event_date === day ? 0 : a.event_status === 'LIVE' ? 1 : 2;
            const sb = b.event_date === day ? 0 : b.event_status === 'LIVE' ? 1 : 2;
            if (sa !== sb) return sa - sb;
            return String(a.event_date || '').localeCompare(String(b.event_date || ''));
        })
        .slice(0, 40);

    function emitLinks(ids: number[]) {
        dispatch('link', ids);
    }
    function addLink(e: EmailTechEvent) {
        emitLinks([...linked.map((x) => x.event_id), e.event_id]);
        pickerOpen = false;
        search = '';
    }
    function removeLink(e: EmailTechEvent) {
        emitLinks(linked.map((x) => x.event_id).filter((id) => id !== e.event_id));
    }

    function fmtDate(d: string | null): string {
        if (!d) return 'TBD';
        const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return d;
        return new Date(+m[1], +m[2] - 1, +m[3], 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function handleChange() { dispatch('change'); }
    function handleToggle(e: CustomEvent) { dispatch('toggle', e.detail); }

    // --- custom greeting ---
    $: generatedGreeting = defaultTechGreeting(selectedEvents, { liaison: formData.liaison || advanceLiaison });
    function toggleGreeting() {
        if (readOnly) return;
        formData.greeting_custom = !formData.greeting_custom;
        // start from the generated text so it can be tweaked rather than retyped
        if (formData.greeting_custom && !(formData.greeting_text || '').trim()) {
            formData.greeting_text = generatedGreeting;
        }
        dispatch('change');
    }
    function resetGreeting() {
        if (readOnly) return;
        formData.greeting_text = generatedGreeting;
        dispatch('change');
    }
    function adjustHeight(el: HTMLTextAreaElement) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }
    // size to the pre-filled text as soon as the field appears
    function autosize(el: HTMLTextAreaElement) {
        requestAnimationFrame(() => adjustHeight(el));
        return { update: () => adjustHeight(el) };
    }

    function useAdvance() {
        if (readOnly) return;
        formData.liaison = advanceLiaison;
        dispatch('change');
    }

    // RESET: back to the advance's liaison (links are left alone)
    function handleReset() {
        if (readOnly) return;
        formData.liaison = advanceLiaison;
        formData.second_event = null;
        formData.greeting_custom = false;
        formData.greeting_text = '';
        dispatch('change');
    }
</script>

<svelte:window on:click={(e) => {
    if (pickerOpen && !(e.target as Element).closest('.link-picker')) pickerOpen = false;
}} />

<SectionCard 
    title="Show Info" 
    id="header" 
    {isVisible} 
    on:toggle={handleToggle}
    on:reset={handleReset}
>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        <div class="flex flex-col gap-1.5 z-0 relative">
            <div class="flex items-center justify-between">
                <span class="text-[10px] text-gray2 uppercase font-bold ml-1">Liaison (from advance DOS)</span>
                {#if differs && !readOnly}
                    <button type="button" on:click={useAdvance}
                        class="text-[10px] font-bold uppercase text-lime hover:underline cursor-pointer"
                        title="Advance says: {advanceLiaison}">Use “{advanceLiaison}”</button>
                {/if}
            </div>
            <input 
                type="text" 
                bind:value={formData.liaison} 
                on:input={handleChange} 
                disabled={readOnly} 
                placeholder={advanceLiaison || 'e.g. Charles'}
                class="w-full bg-navbar border border-gray1 rounded-2xl px-4 py-2.5 text-sm text-white focus:border-lime focus:outline-none placeholder-gray2/50 transition-all" 
            />
        </div>

        <div class="flex flex-col gap-1.5 relative z-20 link-picker">
            <span class="text-[10px] text-gray2 uppercase font-bold ml-1">Linked events (one combined email)</span>
            <div class="w-full min-h-[42px] bg-navbar border border-gray1 rounded-2xl px-2.5 py-1.5 flex flex-wrap items-center gap-1.5">
                {#each linked as e (e.id)}
                    <span class="inline-flex items-center gap-1 text-xs font-bold pl-2 pr-1 py-1 rounded-full bg-lime/10 border border-lime/40 text-lime max-w-full">
                        <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                        <span class="truncate">{e.event_name}</span>
                        <span class="text-gray2 font-normal whitespace-nowrap">· {e.event_venue || ''}</span>
                        {#if !readOnly}
                            <button type="button" on:click={() => removeLink(e)}
                                class="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-lime hover:text-black transition-colors cursor-pointer"
                                title="Unlink {e.event_name}" aria-label="Unlink {e.event_name}">
                                <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        {/if}
                    </span>
                {/each}
                {#if !readOnly && primary}
                    <button type="button" on:click={() => (pickerOpen = !pickerOpen)}
                        class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border border-lime/50 text-lime hover:bg-lime hover:text-black transition-colors cursor-pointer">
                        + Link event
                    </button>
                {:else if !linked.length}
                    <span class="text-xs text-gray2/70 italic">None</span>
                {/if}
            </div>

            {#if pickerOpen && !readOnly}
                <div transition:fly={{ y: -5, duration: 150 }}
                    class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
                    <div class="p-2 border-b border-gray1">
                        <!-- svelte-ignore a11y-autofocus -->
                        <input type="text" bind:value={search} autofocus placeholder="Search events to link…"
                            class="w-full bg-gray1 text-white rounded-md px-3 py-2 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime" />
                    </div>
                    <div class="max-h-64 overflow-y-auto">
                        {#each candidates as e (e.id)}
                            {@const sameDay = e.event_date && e.event_date === primary?.event_date}
                            <button type="button" on:click={() => addLink(e)}
                                class="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray1 transition-colors border-b border-gray1 last:border-0 cursor-pointer">
                                <div class="flex-1 min-w-0">
                                    <div class="text-xs font-bold text-white truncate">{e.event_name}</div>
                                    <div class="text-[10px] text-gray2 truncate">{e.event_venue || 'No venue'} • {fmtDate(e.event_date)}{e.event_status === 'LIVE' ? '' : ` • ${e.event_status || 'past'}`}</div>
                                </div>
                                {#if sameDay}
                                    <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-lime text-black shrink-0">same day</span>
                                {/if}
                            </button>
                        {:else}
                            <div class="p-3 text-center text-gray2 text-xs">No other events.</div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>

        <div class="md:col-span-2 flex flex-col gap-1.5">
            <!-- GREETING [toggle] — the field only exists while it's on -->
            <div class="flex items-center gap-2">
                <span class="text-[10px] text-gray2 uppercase font-bold ml-1">Custom greeting</span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={!!formData.greeting_custom}
                    aria-label="Custom greeting"
                    disabled={readOnly}
                    on:click={toggleGreeting}
                    class="relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer {formData.greeting_custom ? 'bg-lime' : 'bg-gray2'}"
                >
                    <span class="pointer-events-none inline-block h-3 w-3 transform rounded-full bg-black shadow transition {formData.greeting_custom ? 'translate-x-3' : 'translate-x-0'}"></span>
                </button>
                {#if formData.greeting_custom && !readOnly}
                    <button type="button" on:click={resetGreeting} class="ml-auto text-[10px] font-bold uppercase text-gray2 hover:text-white cursor-pointer">Use generated</button>
                {/if}
            </div>
            {#if formData.greeting_custom}
                <textarea
                    bind:value={formData.greeting_text}
                    use:autosize
                    on:input={(e) => { adjustHeight(e.target as HTMLTextAreaElement); handleChange(); }}
                    disabled={readOnly}
                    rows="3"
                    placeholder={generatedGreeting}
                    class="w-full bg-navbar border border-lime/60 rounded-2xl p-3 text-sm text-white leading-relaxed focus:border-lime focus:outline-none placeholder-gray2/50 resize-none overflow-hidden"
                ></textarea>
                <p class="text-[10px] text-gray2 ml-1">First line is the greeting; leave a blank line between paragraphs.</p>
            {/if}
        </div>
    </div>
</SectionCard>
