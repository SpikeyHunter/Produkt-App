<script lang="ts">
	import { supabase } from '$lib/supabase';
	import UploadModal from '$lib/components/modals/UploadModal.svelte';

	export let advance: any; 
	export let payment: any = {}; 
	export let eventDate: string;
	export let currentUserProfile: any;

	let amount = payment?.amount ?? 150;
	let notes = payment?.notes ?? '';
	let deliveryMethod = payment?.delivery_method ?? 'Pick Up';
	let status = payment?.status ?? 'Draft';
	let invoiceUrl = payment?.invoice_url;
	let approvedBy = payment?.approved_by;
    
    const uid = Math.random().toString(36).slice(2);
	let showUploadModal = false;
	let isUploading = false;

    $: isLocked = !!approvedBy;

    $: {
        if (payment) {
            amount = payment.amount ?? 150;
            notes = payment.notes ?? '';
            deliveryMethod = payment.delivery_method ?? 'Pick Up';
            status = payment.status ?? 'Draft';
            invoiceUrl = payment.invoice_url;
            approvedBy = payment.approved_by;
        }
    }

	async function updatePaymentField(field: string, value: any) {
		if (isLocked && field !== 'status' && field !== 'invoice_url') return; 
        
        // FIX: Use UPDATE instead of UPSERT to avoid "no unique constraint" error.
        // The parent component ensures the row exists and 'payment.id' is populated.
        if (!payment?.id) {
            console.error('No payment ID found for update');
            return;
        }

		const payload = {
			[field]: value,
            updated_at: new Date().toISOString()
		};

        const { data, error } = await supabase
			.from('talent_payments')
			.update(payload)
			.eq('id', payment.id)
			.select()
			.single();

		if (error) {
            console.error('Error updating payment:', error);
        } else {
            payment = data; 
        }
	}

	async function handleApprove() {
		if (!currentUserProfile || !payment?.id) return;

        const userName = currentUserProfile.first_name || 'User';
        const now = new Date().toISOString();

		approvedBy = userName;
        status = 'Approved';
        
		const { error } = await supabase
            .from('talent_payments')
            .update({
				status: 'Approved',
				approved_by: userName,
				approved_at: now
            })
            .eq('id', payment.id);

        if(error) console.error("Approval failed", error);
        else generateEmail();
	}

    function generateEmail() {
        const subject = `Approved: Invoice for ${advance.artist_name} - ${eventDate}`;
        const body = `Hello,%0D%0A%0D%0AThe attached invoice is approved for payment.%0D%0ADelivery method: ${deliveryMethod} (Produkt Office)%0D%0A%0D%0AInvoice Link: ${invoiceUrl || 'Please see attached'}%0D%0A%0D%0AThank you,%0D%0A${currentUserProfile?.first_name || 'Willis'}`;
        window.open(`mailto:comptabilite@newcitygas.com?subject=${subject}&body=${body}`);
    }

    function handleShareLink() {
        if (!payment?.public_token) {
            alert('Error: No public token found for this payment.');
            return;
        }
        const link = `${window.location.origin}/public/invoice/${payment.public_token}`;
        navigator.clipboard.writeText(link);
        alert('Link copied to clipboard!');
    }

    async function handleUpload(e: CustomEvent) {
        isUploading = true;
        const file = e.detail.file;
        const fileName = `${advance.event_id}_${advance.artist_name.replace(/\s+/g, '_')}_invoice.pdf`;
        
        try {
            const { error: uploadError } = await supabase.storage.from('invoices').upload(fileName, file, { upsert: true });
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(fileName);
            
            invoiceUrl = publicUrl;
            status = 'Invoiced'; 
            
            await updatePaymentField('invoice_url', publicUrl);
            await updatePaymentField('status', 'Invoiced');
            showUploadModal = false;
        } catch (err) {
            console.error('Upload failed', err);
            alert('Upload failed.');
        } finally {
            isUploading = false;
        }
    }
</script>

<div class="flex flex-col h-full bg-navbar">
    <div class="flex-shrink-0 p-5 border-b border-gray1 bg-gray1/30">
        <h2 class="text-xl font-bold text-white truncate">{advance.artist_name}</h2>
        <p class="text-lime text-xs font-bold uppercase tracking-wider mt-1">Action Panel</p>
    </div>

    <div class="flex-1 overflow-y-auto p-5 space-y-6">
        <div>
            <label for={`amount-${uid}`} class="block text-xs font-bold text-gray2 mb-2">Amount ($)</label>
            <input 
                id={`amount-${uid}`}
                type="number" 
                bind:value={amount} 
                on:change={() => updatePaymentField('amount', amount)}
                disabled={isLocked}
                class="w-full bg-gray1 border border-gray2 rounded-lg p-4 text-white font-bold text-lg focus:border-lime focus:outline-none disabled:opacity-50"
            />
        </div>

        <div class="space-y-4">
             {#if !invoiceUrl}
                <div class="grid grid-cols-2 gap-3">
                    <button 
                        on:click={() => showUploadModal = true}
                        class="py-6 rounded-xl border border-dashed border-gray2 hover:border-lime hover:bg-gray1/50 text-white font-bold text-sm transition-all flex flex-col items-center gap-2 group"
                    >
                        <svg class="w-5 h-5 text-gray2 group-hover:text-lime" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Upload PDF
                    </button>
                    <button 
                        on:click={handleShareLink}
                        class="py-6 rounded-xl border border-gray2 hover:border-white hover:bg-gray1/50 text-white font-bold text-sm transition-all flex flex-col items-center gap-2 group"
                    >
                         <svg class="w-5 h-5 text-gray2 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                        Share Link
                    </button>
                </div>
            {:else}
                <div class="bg-gray1 rounded-xl p-4 border border-lime/30 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-lime/10 flex items-center justify-center text-lime">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <div>
                            <p class="text-white text-sm font-bold">Invoice Uploaded</p>
                            <a href={invoiceUrl} target="_blank" class="text-xs text-lime hover:underline">View PDF</a>
                        </div>
                    </div>
                     <button 
                        aria-label="Remove invoice"
                        on:click={() => { invoiceUrl = null; status='Draft'; updatePaymentField('invoice_url', null); }} 
                        class="text-gray2 hover:text-white p-2" 
                        disabled={isLocked}
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            {/if}
        </div>

        <div class="space-y-3 pt-4 border-t border-gray1">
            <label class="flex items-center justify-between bg-gray1 p-3 rounded-lg cursor-pointer hover:bg-gray1/80 border border-transparent hover:border-gray2">
                <span class="text-xs text-gray2 font-bold">Delivery: {deliveryMethod}</span>
                 <input type="checkbox" class="hidden" checked={deliveryMethod === 'Mail'} on:change={() => !isLocked && updatePaymentField('delivery_method', deliveryMethod === 'Mail' ? 'Pick Up' : 'Mail')}>
                 <span class="text-lime text-xs font-bold">Change</span>
            </label>
            
            <textarea 
                bind:value={notes}
                on:blur={() => updatePaymentField('notes', notes)}
                disabled={isLocked}
                placeholder="Add notes..."
                rows="2"
                class="w-full bg-transparent border-b border-gray2 text-sm text-gray2 focus:text-white focus:border-lime focus:outline-none resize-none p-1"
            ></textarea>
        </div>
    </div>

    <div class="p-5 border-t border-gray1 bg-gray1/10">
        {#if isLocked}
             <div class="bg-gray1 rounded-xl p-3 text-center border border-lime/20 mb-3">
                <p class="text-lime text-xs font-bold">Approved by {approvedBy}</p>
             </div>
             <button 
                on:click={generateEmail} 
                class="w-full bg-gray2 text-white font-bold py-4 rounded-xl text-sm hover:bg-white hover:text-black transition-all"
            >
                Resend Email
            </button>
        {:else}
             <button 
                on:click={handleApprove}
                disabled={status !== 'Invoiced' && !invoiceUrl}
                class="w-full py-4 rounded-xl font-bold text-base transition-all shadow-lg
                {status !== 'Invoiced' && !invoiceUrl ? 'bg-gray1 text-gray2 cursor-not-allowed' : 'bg-white text-black hover:bg-lime hover:scale-[1.02]'}"
            >
                Approve & Email
            </button>
        {/if}
    </div>
</div>

<UploadModal
    isOpen={showUploadModal}
    title={`Upload Invoice - ${advance.artist_name}`}
    acceptedTypes=".pdf,.jpg,.png"
    {isUploading}
    on:close={() => (showUploadModal = false)}
    on:upload={handleUpload}
/>