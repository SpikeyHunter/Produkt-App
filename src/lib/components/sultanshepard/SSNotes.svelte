<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { updateSSShow, type SSShow } from '$lib/services/ssShowService';

    export let show: SSShow;
    const dispatch = createEventDispatcher();

    let notes = Array.isArray(show.notes) ? show.notes : [];
    let newNote = '';

    // Editing State
    let editingId: number | null = null;
    let editingText = '';

    async function save() {
        await updateSSShow(show.id, { notes });
        dispatch('update', { updates: { notes } });
    }

    function addNote() {
        if (!newNote.trim()) return;
        notes = [{ id: Date.now(), text: newNote }, ...notes];
        newNote = '';
        save();
    }

    function deleteNote(id: number) {
        notes = notes.filter((n: any) => n.id !== id);
        save();
    }

    // --- Editing Functions ---

    function startEdit(note: any) {
        editingId = note.id;
        editingText = note.text;
    }

    function saveEdit() {
        if (editingId === null) return;
        
        notes = notes.map(n => n.id === editingId ? { ...n, text: editingText } : n);
        notes = notes.filter(n => n.text.trim() !== '');
        
        save();
        editingId = null;
        editingText = '';
    }

    function handleEditKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
        }
        if (e.key === 'Escape') {
            editingId = null; 
        }
    }

    function focus(node: HTMLElement) {
        node.focus();
        // Move cursor to end
        const val = (node as HTMLTextAreaElement).value;
        (node as HTMLTextAreaElement).value = '';
        (node as HTMLTextAreaElement).value = val;
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
                class="flex-1 bg-gray1 rounded-2xl px-4 py-2 text-sm text-white border-none focus:ring-1 focus:ring-lime placeholder-gray-500" 
                placeholder="Add a note here..." 
                bind:value={newNote} 
                on:keydown={(e) => e.key === 'Enter' && addNote()}
            />
            <button 
                class="bg-lime text-black rounded-2xl px-5 font-bold text-sm hover:opacity-90 transition-opacity" 
                on:click={addNote}
            >
                Add
            </button>
        </div>
    </div>

    <div class="flex-1 p-4 overflow-y-auto space-y-2 custom-scrollbar">
        {#each notes as note (note.id)}
            <div class="bg-gray1 p-2.5 rounded-xl flex gap-2 group items-start transition-colors hover:bg-[#2a2a2a]">
                
                {#if editingId === note.id}
                    <textarea
                        use:focus
                        class="flex-1 bg-black/40 rounded-lg p-1 text-sm text-white border border-lime focus:outline-none resize-none h-auto w-full leading-tight block"
                        bind:value={editingText}
                        on:blur={saveEdit}
                        on:keydown={handleEditKeydown}
                        style="field-sizing: content; min-height: 24px;" 
                    ></textarea>
                {:else}
                    <div 
                        class="text-sm text-white flex-1 break-all whitespace-pre-wrap leading-tight font-medium cursor-text pt-0.5 px-1"
                        on:click={() => startEdit(note)}
                        role="button"
                        tabindex="0"
                        on:keydown={(e) => e.key === 'Enter' && startEdit(note)}
                    >
                        {note.text}
                    </div>
                {/if}
                
                <button 
                    class="text-[var(--color-problem)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 pt-0.5 cursor-pointer" 
                    on:click={() => deleteNote(note.id)} 
                    aria-label="Delete note"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
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