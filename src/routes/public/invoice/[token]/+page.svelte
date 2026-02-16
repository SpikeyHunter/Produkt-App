<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabase';
    import UploadModal from '$lib/components/modals/UploadModal.svelte';
	import PreviewModal from '$lib/components/modals/PreviewModal.svelte';

    const token = $page.params.token;
    
    let loading = true;
    let paymentData: any = null;
    let eventData: any = null;
    let artistData: any = null;
    
    let isUploading = false;
    let showUploadModal = false;
	let showPreviewModal = false;
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
        
		// FORMAT: Date_ArtistName_DJ_Invoice.ext
		const dateStr = eventData?.event_date 
            ? new Date(eventData.event_date).toISOString().split('T')[0] 
            : new Date().toISOString().split('T')[0];
            
        // Clean the artist name to ensure no spaces or weird characters break the URL
		const cleanArtist = (artistData.artist_name || 'Artist')
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_'); // Removes duplicate underscores

		const ext = file.name.split('.').pop() || 'pdf';
        
        // Exact naming convention applied
        const fileName = `${dateStr}_${cleanArtist}_DJ_Invoice.${ext}`;

        try {
            // Upload to documents bucket -> invoices/locals/
            const { error: upError } = await supabase.storage
                .from('documents')
                .upload(`invoices/locals/${fileName}`, file, { upsert: true });

            if (upError) {
                console.error("Storage Error Details:", upError);
                throw upError;
            }

            // Get URL
            const { data: { publicUrl } } = supabase.storage
				.from('documents')
				.getPublicUrl(`invoices/locals/${fileName}`);

            // Update DB
            await supabase
                .from('talent_payments')
                .update({ 
                    invoice_url: publicUrl,
                    status: 'Invoiced'
                })
                .eq('id', paymentData.id);

			paymentData.invoice_url = publicUrl;
            success = true;
            showUploadModal = false;
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Error uploading file. Please check permissions.');
        } finally {
            isUploading = false;
        }
    }

	async function handleDeleteInvoice() {
		try {
			// Remove from DB reference
			await supabase
                .from('talent_payments')
                .update({ 
                    invoice_url: null,
                    status: 'Draft'
                })
                .eq('id', paymentData.id);
			
			paymentData.invoice_url = null;
			success = false;
		} catch (err) {
			console.error(err);
			alert('Error deleting file reference.');
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
            {:else}
				<div class="bg-gray1 rounded-xl p-5 text-left text-sm space-y-3 mb-6 border border-gray2/50 shadow-inner">
					<h1 class="text-2xl font-bold text-center mb-2">{artistData?.artist_name}</h1>
                    <div class="flex justify-between items-center border-b border-gray2/30 pb-2">
                        <span class="text-gray2">Event:</span>
                        <span class="font-bold text-right truncate max-w-[60%]">{eventData?.event_name}</span>
                    </div>
                    <div class="flex justify-between items-center border-b border-gray2/30 pb-2">
                        <span class="text-gray2">Date:</span>
                        <span class="font-bold text-right">{eventData?.event_date ? new Date(eventData.event_date).toDateString() : 'TBA'}</span>
                    </div>
                    <div class="flex justify-between items-center pt-1">
                        <span class="text-gray2 text-lg">Amount:</span>
                        <span class="font-bold text-right text-lime text-xl">${paymentData.amount}</span>
                    </div>
                </div>

				{#if paymentData.invoice_url}
					<div class="text-lime text-5xl mb-4">✓</div>
					<h2 class="text-xl font-bold mb-2">Invoice Uploaded</h2>
					<p class="text-gray2 text-sm mb-6">Your invoice is attached and currently under review by our accounting team.</p>
					
					<div class="grid grid-cols-2 gap-3">
						<button 
							class="w-full bg-gray1 border border-gray2 text-white font-bold py-3 rounded-3xl shadow-lg hover:cursor-pointer hover:border-lime hover:text-lime transition-all text-sm"
							on:click={() => showPreviewModal = true}
						>
							View Invoice
						</button>
						<button 
							class="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-bold py-3 rounded-3xl shadow-lg hover:cursor-pointer hover:bg-red-500 hover:text-white transition-all text-sm"
							on:click={handleDeleteInvoice}
						>
							Delete & Re-upload
						</button>
					</div>
				{:else}
					<p class="text-gray2 mb-4 text-sm">Please upload your invoice below to proceed with the payment.</p>
					<button 
						class="w-full bg-lime text-black font-bold py-4 rounded-xl shadow-lg hover:scale-105 transition-transform"
						on:click={() => showUploadModal = true}
					>
						Upload Invoice (PDF)
					</button>
				{/if}
            {/if}
        </div>
    </div>
</div>

<UploadModal
    isOpen={showUploadModal}
    title="Select Invoice File"
    {isUploading}
    on:close={() => showUploadModal = false}
    on:upload={handleUpload}
/>

{#if paymentData?.invoice_url}
	<PreviewModal
		isOpen={showPreviewModal}
		fileName="Uploaded Invoice Preview"
		fileUrl={paymentData.invoice_url}
		showDeleteButton={false}
		on:close={() => showPreviewModal = false}
	/>
{/if}