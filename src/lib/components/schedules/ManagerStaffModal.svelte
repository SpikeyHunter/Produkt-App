<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { supabase } from '$lib/supabase';
    import type { Staff } from '$lib/types/schedule';

    export let isOpen = false;

    const dispatch = createEventDispatcher();
    let staffList: Staff[] = [];
    let filteredStaff: Staff[] = [];
    
    let newName = '';
    let newEmail = '';
    let searchQuery = '';
    let loading = true;
    let confirmDeleteId: number | null = null;
    let realtimeChannel: any = null;

    onMount(async () => {
        await loadStaff();
        setupRealtime();
    });

    onDestroy(() => {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    });

    // Reactive Search
    $: {
        if (searchQuery.trim() === '') {
            filteredStaff = staffList;
        } else {
            const q = searchQuery.toLowerCase();
            filteredStaff = staffList.filter(s => 
                s.name.toLowerCase().includes(q) || 
                (s.email && s.email.toLowerCase().includes(q))
            );
        }
    }

    function setupRealtime() {
        if (realtimeChannel) return;
        
        realtimeChannel = supabase
            .channel('staff_updates_modal_v3')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'prod_staff' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newStaff = payload.new as Staff;
                    if (!staffList.find(s => s.id === newStaff.id)) {
                        staffList = [...staffList, newStaff].sort((a, b) => a.name.localeCompare(b.name));
                    }
                } else if (payload.eventType === 'DELETE') {
                    staffList = staffList.filter(s => s.id !== payload.old.id);
                } else if (payload.eventType === 'UPDATE') {
                    const updatedStaff = payload.new as Staff;
                    staffList = staffList.map(s => s.id === updatedStaff.id ? updatedStaff : s);
                }
            })
            .subscribe();
    }

    async function loadStaff() {
        loading = true;
        const { data } = await supabase.from('prod_staff').select('*').order('name');
        if (data) staffList = data;
        loading = false;
    }

    async function addStaff() {
        if (!newName.trim()) return;
        
        if (staffList.some(s => s.name.toLowerCase() === newName.trim().toLowerCase())) {
            alert('Staff member already exists');
            return;
        }

        const { error } = await supabase.from('prod_staff').insert({
            name: newName.trim(),
            email: newEmail.trim(),
            stage_manager: false
        });
        
        if (error) {
            console.error('Error adding staff:', error);
            if (error.code === '23505') alert('This staff member already exists.');
        } else {
            newName = '';
            newEmail = '';
        }
    }

    async function toggleStageManager(staff: Staff) {
        const updatedVal = !staff.stage_manager;
        // Optimistic update
        staffList = staffList.map(s => s.id === staff.id ? { ...s, stage_manager: updatedVal } : s);
        
        await supabase.from('prod_staff').update({ stage_manager: updatedVal }).eq('id', staff.id);
    }

    async function deleteStaff(id: number) {
        // Optimistic delete
        staffList = staffList.filter(s => s.id !== id);
        confirmDeleteId = null;
        await supabase.from('prod_staff').delete().eq('id', id);
    }

    function close() {
        dispatch('close');
    }
</script>

{#if isOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
            class="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            on:click={close}
            on:keydown={(e) => e.key === 'Escape' && close()}
            role="button"
            tabindex="0"
            aria-label="Close modal"
        ></div>
        
        <div class="bg-gray1 border border-gray2/20 w-full max-w-2xl rounded-2xl relative z-10 overflow-hidden flex flex-col h-[600px] shadow-2xl">
            
            <div class="p-8 pb-4 flex justify-between items-start shrink-0">
                <div>
                    <h3 class="text-2xl font-bold text-white mb-1">Manage Default Staff</h3>
                    <p class="text-gray2 text-sm">Add or remove staff available for scheduling.</p>
                </div>
                <button 
                    on:click={close} 
                    class="text-gray2 hover:text-white cursor-pointer p-2 rounded-full hover:bg-white/5 transition-colors"
                    aria-label="Close"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            <div class="px-8 pb-6 space-y-4 border-b border-gray2/10 shrink-0">
                <div class="flex gap-3">
                    <input 
                        type="text" 
                        placeholder="New Staff Name" 
                        bind:value={newName}
                        class="flex-1 bg-black/30 border border-gray2/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lime transition-colors"
                        on:keydown={(e) => e.key === 'Enter' && addStaff()}
                    />
                    <input 
                        type="email" 
                        placeholder="Email (Optional)" 
                        bind:value={newEmail}
                        class="flex-1 bg-black/30 border border-gray2/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-lime transition-colors"
                        on:keydown={(e) => e.key === 'Enter' && addStaff()}
                    />
                    <button 
                        on:click={addStaff}
                        disabled={!newName}
                        class="px-6 py-3 bg-lime text-black font-bold rounded-xl hover:bg-lime/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(225,255,0,0.1)]"
                    >
                        Add
                    </button>
                </div>

                <div class="relative">
                    <svg class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input 
                        type="text" 
                        placeholder="Search staff..." 
                        bind:value={searchQuery}
                        class="w-full bg-gray2/5 border border-gray2/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-gray2/30 transition-colors"
                    />
                 </div>
            </div>

            <div class="flex-1 overflow-y-auto custom-scrollbar relative">
                {#if loading}
                    <div class="flex justify-center py-8">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-lime"></div>
                    </div>
                {:else}
                    <table class="w-full text-left text-sm border-collapse">
                        <thead class="text-gray2 text-xs uppercase tracking-wider font-bold sticky top-0 bg-gray1 z-20 shadow-sm">
                            <tr>
                                <th class="py-3 pl-8 bg-gray1">Name</th>
                                <th class="py-3 bg-gray1">Email</th>
                                <th class="py-3 text-center bg-gray1">Stage Manager</th>
                                <th class="py-3 text-right pr-8 bg-gray1">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray2/5">
                            {#each filteredStaff as staff (staff.id)}
                                <tr class="hover:bg-white/5 transition-colors group">
                                    <td class="py-3 pl-8 font-bold text-white">{staff.name}</td>
                                    <td class="py-3 text-gray-400">{staff.email || '-'}</td>
                                    <td class="py-3 text-center">
                                        <button 
                                            class="w-10 h-6 rounded-full transition-colors relative cursor-pointer {staff.stage_manager ? 'bg-lime' : 'bg-gray2/30'}"
                                            on:click={() => toggleStageManager(staff)}
                                            aria-label="Toggle stage manager status"
                                        >
                                            <span class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm {staff.stage_manager ? 'translate-x-4' : 'translate-x-0'}"></span>
                                        </button>
                                    </td>
                                    <td class="py-3 text-right pr-8">
                                        {#if confirmDeleteId === staff.id}
                                            <button 
                                                class="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer shadow-lg animate-in fade-in float-right"
                                                on:click={() => deleteStaff(staff.id)}
                                                title="Confirm Delete"
                                            >
                                                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                                            </button>
                                        {:else}
                                            <button 
                                                class="w-8 h-8 rounded-lg text-gray2 hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition-colors cursor-pointer float-right"
                                                on:click={() => confirmDeleteId = staff.id}
                                                on:mouseleave={() => setTimeout(() => { if (confirmDeleteId === staff.id) confirmDeleteId = null }, 2000)}
                                                title="Remove Staff"
                                                aria-label="Delete staff"
                                            >
                                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                            </button>
                                        {/if}
                                    </td>
                                </tr>
                            {:else}
                                <tr>
                                    <td colspan="4" class="text-center py-8 text-gray2 italic">
                                        {searchQuery ? 'No matching staff found.' : 'No staff members found.'}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {/if}
            </div>
        </div>
    </div>
{/if}