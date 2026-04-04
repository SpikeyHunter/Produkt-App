<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { supabase } from '$lib/supabase.js';
    import MainLayout from '$lib/components/MainLayout.svelte'; 
    import BottleGrid from '$lib/components/bazart/BottleGrid.svelte';
    import AddBottleForm from '$lib/components/bazart/AddBottleForm.svelte';
    import ModifyBottleForm from '$lib/components/bazart/ModifyBottleForm.svelte';
    import CustomBottleForm from '$lib/components/bazart/CustomBottleForm.svelte';

    let bottles: any[] = [];
    let realtimeChannel: any;
    
    let editingBottle: any = null;
    let isAddingCustom: boolean = false;

    onMount(async () => {
        await fetchBottles();
        setupRealtime();
    });

    onDestroy(() => {
        if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    });

    async function fetchBottles() {
        const { data, error } = await supabase.from('bazart_menu_drink').select('*');
        if (!error && data) bottles = data;
    }

    function setupRealtime() {
        realtimeChannel = supabase.channel('public:bazart_menu_drink')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bazart_menu_drink' }, () => {
                fetchBottles();
            }).subscribe();
    }

    function handleEditBottle(event: CustomEvent) {
        isAddingCustom = false;
        editingBottle = event.detail.bottle;
    }

    function handleAddCustom() {
        editingBottle = null;
        isAddingCustom = true;
    }

    function closePanels() {
        editingBottle = null;
        isAddingCustom = false;
    }
</script>

<svelte:head>
    <title>Bazart Menu</title>
</svelte:head>

<MainLayout pageTitle="Bazart Menu">
    <div class="w-full h-[calc(100vh-40px)] bg-gray1 text-white p-4 md:p-6 flex flex-col overflow-hidden">
        <div class="w-full h-full flex flex-row gap-6 min-h-0">
            
            <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
                <BottleGrid {bottles} on:edit={handleEditBottle} on:addCustom={handleAddCustom} />
            </div>

            <div class="shrink-0 flex flex-col min-h-0 overflow-hidden transition-all duration-300 ease-in-out {(editingBottle || isAddingCustom) ? 'w-[380px]' : 'w-[320px]'}">
                {#if editingBottle}
                    <ModifyBottleForm bottle={editingBottle} on:close={closePanels} on:saved={closePanels} />
                {:else if isAddingCustom}
                    <CustomBottleForm on:close={closePanels} on:saved={closePanels} />
                {:else}
                    <AddBottleForm />
                {/if}
            </div>

        </div>
    </div>
</MainLayout>