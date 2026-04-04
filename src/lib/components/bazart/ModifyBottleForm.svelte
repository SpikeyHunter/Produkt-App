<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { supabase } from '$lib/supabase.js';
    
    export let bottle: any;
    
    const dispatch = createEventDispatcher();
    
    let currentLang: 'fr' | 'en' = 'en';
    let isSaving = false;
    let isDeleting = false;
    let deleteConfirm = false;
    
    let selectedStatus = bottle.status || 'Available';
    const statusOptions = ['Available', 'Out of Stock', 'Hidden'];
    let isStatusOpen = false;
    let dropdownRef: HTMLDivElement;

    function parseJSON(data: any, isNested: boolean = false) {
        let parsed: any = {};
        if (typeof data === 'string') {
            try { 
                parsed = JSON.parse(data);
            } catch(e) { 
                parsed = { en: data, fr: data };
            }
        } else if (data) {
            parsed = JSON.parse(JSON.stringify(data));
        }

        if (typeof parsed !== 'object') parsed = {};
        if (!parsed.en) parsed.en = isNested ? {} : '';
        if (!parsed.fr) parsed.fr = isNested ? {} : '';
        return parsed;
    }

    let formData = {
        saq_code: bottle.saq_code || '',
        price: bottle.price || '',
        glass_price: bottle.glass_price || '',
        name: parseJSON(bottle.name, false),
        type: parseJSON(bottle.type, false),
        description: parseJSON(bottle.description, false),
        details: parseJSON(bottle.details, true),
        tasting: parseJSON(bottle.tasting, true)
    };

    const col1Keys = {
        en: ['Country', 'Region', 'Regulated Designation', 'Degree of alcohol', 'Sugar content'],
        fr: ['Pays', 'Région', 'Désignation réglementée', "Degré d'alcool", 'Taux de sucre']
    };
    const col2Keys = {
        en: ['Special feature', 'Size', 'Producer'],
        fr: ['Particularité', 'Format', 'Producteur']
    };
    const tastingKeys = {
        en: ['Vintage tasted', 'aromas', 'acidity', 'sweetness', 'body', 'mouthfeel', 'wood', 'serving_temperature'],
        fr: ['Millésime dégusté', 'aromas', 'acidité', 'sucrosité', 'corps', 'bouche', 'bois', 'serving_temperature']
    };

    onMount(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
                isStatusOpen = false;
            }
        }
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    });

    function selectStatus(opt: string) {
        selectedStatus = opt;
        isStatusOpen = false;
    }

    async function saveChanges() {
        isSaving = true;

        const saqValue = (formData.saq_code === '' || formData.saq_code === null || String(formData.saq_code).toUpperCase() === 'NULL') 
            ? null 
            : formData.saq_code;

        const { error } = await supabase
            .from('bazart_menu_drink')
            .update({ 
                status: selectedStatus,
                saq_code: saqValue,
                price: formData.price,
                glass_price: formData.glass_price === '' ? null : formData.glass_price,
                name: formData.name,
                type: formData.type,
                description: formData.description,
                details: formData.details,
                tasting: formData.tasting
            })
            .eq('id', bottle.id);

        isSaving = false;
        if (!error) {
            dispatch('saved');
        } else {
            console.error('Error updating bottle:', error);
            alert(error.code === '23505' ? 'This SAQ Code already exists.' : 'Update failed.');
        }
    }

    async function handleDelete() {
        if (!deleteConfirm) {
            deleteConfirm = true;
            setTimeout(() => deleteConfirm = false, 3000);
            return;
        }

        isDeleting = true;
        if (bottle.bottle_image) {
            const path = `bottles/${bottle.saq_code}.jpg`;
            await supabase.storage.from('bazart').remove([path]);
        }

        const { error } = await supabase.from('bazart_menu_drink').delete().eq('id', bottle.id);
        
        isDeleting = false;
        if (!error) {
            dispatch('saved');
        } else {
            console.error('Error deleting bottle:', error);
            alert('Failed to delete bottle.');
            deleteConfirm = false;
        }
    }
</script>

<div class="bg-navbar border border-gray2/10 rounded-2xl h-full flex flex-col text-white shadow-sm w-full overflow-hidden">
    <div class="px-5 pt-5 pb-3 flex justify-between items-start shrink-0 gap-2">
        <div>
            <h2 class="text-lg font-black uppercase tracking-wide text-lime">Modify Bottle</h2>
            <p class="text-xs text-gray2 font-bold mt-0.5">Update details directly below.</p>
        </div>
       
        <div class="flex bg-black/40 p-1 rounded-full border border-gray1 shrink-0">
            <button
                type="button"
                class="px-3 py-1 rounded-3xl text-[11px] font-bold transition-all cursor-pointer {currentLang === 'fr' ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}"
                on:click={() => currentLang = 'fr'}
            >
                FR
            </button>
            <button
                type="button"
                class="px-3 py-1 rounded-3xl text-[11px] font-bold transition-all cursor-pointer {currentLang === 'en' ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}"
                on:click={() => currentLang = 'en'}
            >
                EN
            </button>
        </div>
    </div>

    <div class="flex-1 overflow-y-auto pl-5 pr-1 custom-scrollbar flex flex-col min-h-0">
        <div class="pr-3 space-y-4 pb-4">
            <div class="flex flex-row items-center justify-between gap-3">
                <label for="status-trigger" class="text-xs text-gray2 uppercase tracking-widest font-bold pl-3 shrink-0">Status</label>
                <div class="relative w-48 shrink-0" bind:this={dropdownRef}>
                    <button 
                        id="status-trigger"
                        type="button"
                        on:click={() => isStatusOpen = !isStatusOpen}
                        class="w-full flex items-center justify-between bg-black/40 border border-transparent text-white font-bold text-sm rounded-3xl py-1.5 px-4 focus:outline-none focus:border-transparent transition-colors cursor-pointer {selectedStatus === 'Out of Stock' ? 'text-problem bg-problem/10' : ''} {selectedStatus === 'Hidden' ? 'text-gray3' : ''}"
                    >
                        <span>{selectedStatus}</span>
                        <svg class="w-3.5 h-3.5 transition-transform {isStatusOpen ? 'rotate-180' : ''} {selectedStatus === 'Out of Stock' ? 'text-problem' : selectedStatus === 'Hidden' ? 'text-gray3' : 'text-gray2'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {#if isStatusOpen}
                        <div class="absolute z-50 w-full mt-1.5 bg-navbar border border-gray2/20 rounded-3xl shadow-2xl overflow-hidden py-1">
                            {#each statusOptions as opt}
                                <button
                                    type="button"
                                    class="w-full text-left px-4 py-2 text-sm font-bold transition-colors cursor-pointer {selectedStatus === opt ? 'bg-white/10' : 'hover:bg-white/5'} {opt === 'Out of Stock' ? 'text-problem' : opt === 'Hidden' ? 'text-gray3' : 'text-lime'}"
                                    on:click={() => selectStatus(opt)}
                                >
                                    {opt}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>

            <hr class="border-gray1/40" />

            <div class="flex flex-col gap-2">
                <div class="flex flex-row gap-2">
                    <div class="flex flex-col gap-0.5 flex-1">
                        <span class="text-xs text-gray2 uppercase tracking-widest font-bold pl-3">SAQ Code</span>
                        <input type="text" bind:value={formData.saq_code} class="w-full text-sm font-bold text-white bg-transparent border border-transparent rounded-3xl px-3 py-1 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left" />
                    </div>

                    <div class="flex flex-col gap-0.5 flex-1">
                        <span class="text-xs text-gray2 uppercase tracking-widest font-bold pl-3">Glass Price</span>
                        <input type="text" bind:value={formData.glass_price} placeholder="0.00" class="w-full text-sm font-bold text-white bg-transparent border border-transparent rounded-3xl px-3 py-1 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left" />
                    </div>

                    <div class="flex flex-col gap-0.5 flex-1">
                        <span class="text-xs text-gray2 uppercase tracking-widest font-bold pl-3">Bottle Price</span>
                        <input type="text" bind:value={formData.price} class="w-full text-sm font-bold text-white bg-transparent border border-transparent rounded-3xl px-3 py-1 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left" />
                    </div>
                </div>

                <div class="flex flex-col gap-0.5">
                    <span class="text-xs text-gray2 uppercase tracking-widest font-bold pl-3">Name</span>
                    <textarea rows="2" bind:value={formData.name[currentLang]} class="w-full text-sm font-bold text-white bg-transparent border border-transparent rounded-2xl px-3 py-1.5 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left resize-none leading-snug custom-scrollbar"></textarea>
                </div>
                
                <div class="flex flex-col gap-0.5">
                    <span class="text-xs text-gray2 uppercase tracking-widest font-bold pl-3">Type</span>
                    <input type="text" bind:value={formData.type[currentLang]} class="w-full text-sm font-bold text-white bg-transparent border border-transparent rounded-3xl px-3 py-1 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left" />
                </div>
            </div>

            <hr class="border-gray1/40" />

            <div class="grid grid-cols-2 gap-x-2 gap-y-2">
                <div class="flex flex-col gap-2">
                    {#each col1Keys[currentLang] as key}
                        {#if formData.details[currentLang] && formData.details[currentLang][key] !== undefined}
                            <div class="flex flex-col gap-0.5">
                                <span class="text-[10px] text-gray2 uppercase tracking-widest font-bold pl-3 leading-tight break-words">{key}</span>
                                <textarea rows="2" bind:value={formData.details[currentLang][key]} class="w-full text-sm font-medium text-white bg-transparent border border-transparent rounded-2xl px-3 py-1.5 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left resize-none leading-snug custom-scrollbar"></textarea>
                            </div>
                        {/if}
                    {/each}
                </div>
                 
                <div class="flex flex-col gap-2">
                    {#each col2Keys[currentLang] as key}
                        {#if formData.details[currentLang] && formData.details[currentLang][key] !== undefined}
                            <div class="flex flex-col gap-0.5">
                                <span class="text-[10px] text-gray2 uppercase tracking-widest font-bold pl-3 leading-tight break-words">{key}</span>
                                <textarea rows="2" bind:value={formData.details[currentLang][key]} class="w-full text-sm font-medium text-white bg-transparent border border-transparent rounded-2xl px-3 py-1.5 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left resize-none leading-snug custom-scrollbar"></textarea>
                            </div>
                        {/if}
                    {/each}
                </div>
            </div>

            <hr class="border-gray1/40" />

            {#if formData.description[currentLang] !== undefined}
                <div class="flex flex-col gap-0.5">
                    <span class="text-[10px] text-gray2 uppercase tracking-widest font-bold pl-3">Detailed Info</span>
                    <textarea 
                        bind:value={formData.description[currentLang]} 
                        class="w-full text-sm font-medium text-white bg-transparent border border-transparent rounded-2xl px-3 py-1.5 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-justify min-h-[90px] resize-y leading-relaxed custom-scrollbar"
                    ></textarea>
                </div>
            {/if}

            <hr class="border-gray1/40" />

            <div class="grid grid-cols-2 gap-x-2 gap-y-2">
                {#each tastingKeys[currentLang] as key}
                    {#if formData.tasting[currentLang] && formData.tasting[currentLang][key] !== undefined}
                        <div class="flex flex-col gap-0.5">
                            <span class="text-[10px] text-gray2 uppercase tracking-widest font-bold pl-3 leading-tight break-words">{key}</span>
                            {#if typeof formData.tasting[currentLang][key] === 'object'}
                                <textarea rows="2" bind:value={formData.tasting[currentLang][key].value} class="w-full text-sm font-medium text-white bg-transparent border border-transparent rounded-2xl px-3 py-1.5 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left resize-none leading-snug custom-scrollbar"></textarea>
                            {:else}
                                <textarea rows="2" bind:value={formData.tasting[currentLang][key]} class="w-full text-sm font-medium text-white bg-transparent border border-transparent rounded-2xl px-3 py-1.5 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left resize-none leading-snug custom-scrollbar"></textarea>
                            {/if}
                        </div>
                    {/if}
                 {/each}
            </div>
        </div>
    </div>

    <div class="px-5 py-3 border-t flex flex-row items-center justify-between border-black/40 shrink-0">
        <button 
            type="button" 
            on:click={handleDelete}
            disabled={isDeleting}
            class="p-2 rounded-full transition-colors cursor-pointer {deleteConfirm ? 'bg-problem/10 text-problem hover:bg-problem/20' : 'text-gray2 hover:text-problem hover:bg-white/5'}"
            title={deleteConfirm ? "Click again to confirm delete" : "Delete Bottle"}
        >
            {#if deleteConfirm}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
            {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            {/if}
        </button>

        <div class="flex gap-2">
            <button 
                type="button"
                on:click={() => dispatch('close')}
                disabled={isSaving || isDeleting}
                class="px-4 py-1.5 rounded-3xl text-white hover:bg-white/10 transition-colors font-bold text-sm cursor-pointer disabled:opacity-50"
            >
                Cancel
            </button>
            <button 
                type="button"
                on:click={saveChanges}
                disabled={isSaving || isDeleting}
                class="bg-lime hover:opacity-90 disabled:opacity-50 disabled:bg-gray2 text-black font-black uppercase tracking-wide px-5 py-1.5 rounded-3xl transition-all duration-200 flex items-center justify-center cursor-pointer"
            >
                {isSaving ? 'Saving...' : 'Save'}
            </button>
        </div>
    </div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar { 
        width: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-track { 
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb { 
        background-color: rgba(255, 255, 255, 0.15);
        border-radius: 10px;
    }
    .custom-scrollbar:hover::-webkit-scrollbar-thumb { 
        background-color: rgba(255, 255, 255, 0.3);
    }
</style>