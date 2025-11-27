<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { updateSSShow, type SSShow } from '$lib/services/ssShowService';

    export let show: SSShow;
    const dispatch = createEventDispatcher();

    let notes = Array.isArray(show.notes) ? show.notes : [];
    let newNote = '';

    async function save() {
        await updateSSShow(show.id, { notes });
        dispatch('update', { updates: { notes } });
    }

    function addNote() {
        if (!newNote.trim()) return;
        // Add to TOP of list
        notes = [{ id: Date.now(), text: newNote }, ...notes];
        newNote = '';
        save();
    }

    function deleteNote(id: number) {
        notes = notes.filter((n: any) => n.id !== id);
        save();
    }
</script>

<div class="bg-navbar rounded-2xl overflow-hidden h-full flex flex-col">
    <div class="px-5 py-4 border-b border-gray1 flex-shrink-0">
        <h3 class="text-lg font-bold text-white">Notes</h3>
    </div>
    
    <div class="p-4 border-b border-gray1 bg-navbar flex-shrink-0">
        <div class="flex gap-2">
            <input 
                type="text" 
                class="flex-1 bg-gray1 rounded-lg px-3 py-2 text-sm text-white border-none focus:ring-1 focus:ring-lime" 
                placeholder="Add a note..." 
                bind:value={newNote} 
                on:keydown={(e) => e.key === 'Enter' && addNote()}
            />
            <button class="bg-lime text-black rounded-lg px-4 font-bold text-sm hover:opacity-90" on:click={addNote}>Add</button>
        </div>
    </div>

    <div class="flex-1 p-4 overflow-y-auto space-y-2 custom-scrollbar">
        {#each notes as note (note.id)}
            <div class="bg-gray1 p-3 rounded-lg flex gap-3 group items-start">
                <p class="text-sm text-white flex-1 break-words leading-snug">{note.text}</p>
                <button class="text-gray3 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" on:click={() => deleteNote(note.id)} aria-label="Delete note">✕</button>
            </div>
        {/each}
        {#if notes.length === 0}
            <div class="text-center text-gray2 text-xs italic pt-4">No notes added.</div>
        {/if}
    </div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
</style>