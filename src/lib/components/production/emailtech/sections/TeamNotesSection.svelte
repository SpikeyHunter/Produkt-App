<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    const dispatch = createEventDispatcher();
    
    let textarea: HTMLTextAreaElement;
    let localNotes = '';

    // --- SYNC LOGIC ---
    $: if (formData) {
        syncNotes();
    }

    async function syncNotes() {
        if (formData.team_notes === undefined) formData.team_notes = '';

        if (formData.team_notes !== localNotes) {
            localNotes = formData.team_notes;
            await tick();
            if (textarea) adjustHeight(textarea);
        }
    }

    function handleChange() { dispatch('change'); }
    function handleToggle(e: CustomEvent) { dispatch('toggle', e.detail); }

    function adjustHeight(el: HTMLTextAreaElement) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    function handleInput(e: Event) {
        const target = e.target as HTMLTextAreaElement;
        localNotes = target.value;
        formData.team_notes = localNotes;
        adjustHeight(target);
        handleChange();
    }

    // RESET FUNCTION
    async function handleReset() {
        if (readOnly) return;
        formData.team_notes = '';
        localNotes = '';
        
        await tick();
        if (textarea) adjustHeight(textarea);
        
        dispatch('change');
    }
</script>

<SectionCard 
    title="Team Notes" 
    id="team_notes" 
    isVisible={formData.visible_sections['team_notes']} 
    on:toggle={handleToggle}
    on:reset={handleReset}
>
    <label>
        <span class="sr-only">Team Notes</span>
        <textarea 
            bind:this={textarea}
            value={localNotes} 
            on:input={handleInput} 
            disabled={readOnly} 
            rows="1" 
            placeholder="@Team Notes"
            class="w-full bg-navbar border border-gray1 rounded-2xl p-3 text-sm text-white focus:border-lime focus:outline-none leading-relaxed placeholder-gray2/50 resize-none overflow-hidden min-h-[3rem]"
        ></textarea>
    </label>
</SectionCard>