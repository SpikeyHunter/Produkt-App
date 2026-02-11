<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase';
    import UploadModal from '$lib/components/modals/UploadModal.svelte';

    const token = $page.params.token;
    
    let loading = true;
    let paymentData: any = null;
    let eventData: any = null;
    let artistData: any = null;
    let isUploading = false;
    let showModal = false;
    let success = false;

    onMount(async () => {
        // 1. Fetch payment info using the public token
        const { data: payData, error: payError } = await supabase
            .from('talent_payments')
            .select('*')
            .eq('public_token', token)
            .single();

        if (payError || !payData) {
            loading = false;
            return;
        }

        paymentData = payData;

        // 2. Fetch linked Event and Artist Info
        if (paymentData.advance_id) {
            const { data: advData } = await supabase
                .from('events_advance')
                .select('artist_name, event_id')
                .eq('id', paymentData.advance_id)
                .single();
            
            artistData = advData;

            if (advData?.event_id) {
                const { data: evtData } = await supabase
                    .from('events')
                    .select('event_name, event_date, event_venue')
                    .eq('event_id', advData.event_id)
                    .single();
                eventData = evtData;
            }
        }
        loading = false;
    });

    async function handleUpload(e: CustomEvent) {
        if (!artistData) return;
        isUploading = true;
        
        const file = e.detail.file;
        const fileName = `${paymentData.event_id}_${artistData.artist_name.replace(/\s+/g, '_')}_invoice.pdf`;

        try {
            // Upload
            const { error: upError } = await supabase.storage
                .from('invoices')
                .upload(fileName, file, { upsert: true });
            
            if (upError) throw upError;

            // Get URL
            const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(fileName);

            // Update DB
            await supabase
                .from('talent_payments')
                .update({ 
                    invoice_url: publicUrl,
                    status: 'Invoiced'
                })
                .eq('id', paymentData.id);

            success = true;
            showModal = false;
        } catch (err) {
            console.error(err);
            alert('Error uploading file.');
        } finally {
            isUploading = false;
        }
    }
</script>

<div class="min-h-screen bg-gray1 text-white flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-md bg-navbar border border-gray2 rounded-2xl p-8 shadow-2xl">
        <div class="text-center mb-8">
            <img src="/images/ProduktXX_LOGO1.png" alt="Logo" class="h-8 mx-auto mb-6" />
            
            {#if loading}
                <div class="animate-spin w-8 h-8 border-2 border-lime border-t-transparent rounded-full mx-auto"></div>
            {:else if !paymentData}
                <div class="text-red-400 font-bold">Invalid or Expired Link</div>
            {:else if success}
                <div class="text-lime text-5xl mb-4">✓</div>
                <h2 class="text-2xl font-bold mb-2">Invoice Received!</h2>
                <p class="text-gray2">Thank you. Your invoice has been submitted to accounting.</p>
            {:else}
                <h1 class="text-2xl font-bold mb-1">Invoice Upload</h1>
                <p class="text-lime font-bold text-lg mb-4">{artistData?.artist_name}</p>
                
                <div class="bg-gray1 rounded-xl p-4 text-left text-sm space-y-2 mb-6 border border-gray2/50">
                    <div class="flex justify-between">
                        <span class="text-gray2">Event:</span>
                        <span class="font-bold text-right">{eventData?.event_name}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray2">Date:</span>
                        <span class="font-bold text-right">{new Date(eventData?.event_date).toDateString()}</span>
                    </div>
                     <div class="flex justify-between">
                        <span class="text-gray2">Amount:</span>
                        <span class="font-bold text-right text-lime">${paymentData.amount}</span>
                    </div>
                </div>

                <button 
                    class="w-full bg-lime text-black font-bold py-4 rounded-xl shadow-lg hover:scale-105 transition-transform"
                    on:click={() => showModal = true}
                >
                    Upload Invoice (PDF)
                </button>
            {/if}
        </div>
    </div>
</div>

<UploadModal
    isOpen={showModal}
    title="Select Invoice File"
    {isUploading}
    on:close={() => showModal = false}
    on:upload={handleUpload}
/>