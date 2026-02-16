<script lang="ts">
    import { supabase } from '$lib/supabase';
    import UploadModal from '$lib/components/modals/UploadModal.svelte';
    import PreviewModal from '$lib/components/modals/PreviewModal.svelte';
    import PopupNotification from '$lib/components/modals/PopupNotification.svelte';

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
    let approvedAt = payment?.approved_at;
    
    const uid = Math.random().toString(36).slice(2);
    
    let showUploadModal = false;
    let showPreviewModal = false;
    let isUploading = false;
    let isConfirmingApprove = false;
    let isGeneratingEml = false;
    let statusDropdownOpen = false;
    
    let notificationMessage = '';
    let showNotification = false;

    $: isLocked = !!approvedBy;

    $: {
        if (payment) {
            amount = payment.amount ?? 150;
            notes = payment.notes ?? '';
            deliveryMethod = payment.delivery_method ?? 'Pick Up';
            status = payment.status ?? 'Draft';
            invoiceUrl = payment.invoice_url;
            approvedBy = payment.approved_by;
            approvedAt = payment.approved_at;
        }
    }

    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return {
            destroy() {
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            }
        };
    }

    function clickOutside(node: HTMLElement) {
        const handleClick = (event: MouseEvent) => {
            if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
                node.dispatchEvent(new CustomEvent('click_outside'));
            }
        };

        document.addEventListener('click', handleClick, true);

        return {
            destroy() {
                document.removeEventListener('click', handleClick, true);
            }
        };
    }

    function getStatusClasses(statusState: string) {
        switch(statusState?.toLowerCase()) {
            case 'draft': return "bg-gray1 border border-gray2 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]";
            case 'confirmed': return "bg-tentatif/20 border border-tentatif text-tentatif shadow-[0_0_10px_rgba(59,130,246,0.2)]"; 
            case 'invoiced': return "bg-proposed/20 border border-proposed text-proposed shadow-[0_0_10px_rgba(147,51,234,0.2)]"; 
            case 'approved': return "bg-question/20 border border-question text-question shadow-[0_0_10px_rgba(20,184,166,0.2)]"; 
            case 'submitted': return "bg-info/20 border border-info text-info shadow-[0_0_10px_rgba(234,179,8,0.2)]"; 
            case 'paid': return "bg-confirmed/20 border border-confirmed text-confirmed shadow-[0_0_10px_rgba(34,197,94,0.2)]"; 
            default: return "bg-gray1 border border-gray2 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]";
        }
    }

    function formatApprovalDate(dateString: string) {
        if (!dateString) return '';
        const d = new Date(dateString);
        const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        const month = d.toLocaleDateString('en-US', { month: 'long' });
        const day = d.getDate();
        const year = d.getFullYear();
        const suffix = (day > 3 && day < 21) ? 'th' : (day % 10 === 1) ? 'st' : (day % 10 === 2) ? 'nd' : (day % 10 === 3) ? 'rd' : 'th';
        return `Approved at, ${time}, ${dayName}, ${month} ${day}${suffix}, ${year}`;
    }

    function formatEventDate(dateString: string) {
        if (!dateString) return '';
        const d = new Date(dateString);
        const month = d.toLocaleDateString('en-US', { month: 'long' });
        const day = d.getDate();
        const year = d.getFullYear();
        const suffix = (day > 3 && day < 21) ? 'th' : (day % 10 === 1) ? 'st' : (day % 10 === 2) ? 'nd' : (day % 10 === 3) ? 'rd' : 'th';
        return `${month} ${day}${suffix} ${year}`;
    }

    async function updatePaymentField(field: string, value: any) {
        if (isLocked && field !== 'status' && field !== 'invoice_url') return;
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

    async function selectStatus(newStatus: string) {
        status = newStatus;
        statusDropdownOpen = false;
        await updatePaymentField('status', newStatus);
    }

    function toggleDelivery() {
        if (isLocked) return;
        const newMethod = deliveryMethod === 'Pick Up' ? 'Mail' : 'Pick Up';
        deliveryMethod = newMethod;
        updatePaymentField('delivery_method', newMethod);
    }

    async function handleApprove() {
        if (!currentUserProfile || !payment?.id || isLocked) return;
        
        if (!isConfirmingApprove) {
            isConfirmingApprove = true;
            setTimeout(() => isConfirmingApprove = false, 5000);
            return;
        }

        const userName = currentUserProfile.first_name || 'User';
        const now = new Date().toISOString();
        
        approvedBy = userName;
        approvedAt = now;
        status = 'Approved';
        
        const { error } = await supabase
            .from('talent_payments')
            .update({
                status: 'Approved',
                approved_by: userName,
                approved_at: now
            })
            .eq('id', payment.id);

        if(error) {
            console.error("Approval failed", error);
        } else {
            isConfirmingApprove = false;
        }
    }

    function handleShareLink() {
        if (!payment?.public_token) return;
        
        const link = `${window.location.origin}/public/invoice/${payment.public_token}`;
        navigator.clipboard.writeText(link);
        
        notificationMessage = 'Link copied to clipboard!';
        showNotification = true;
    }

    function openPublicLink() {
        if (!payment?.public_token) return;
        const link = `${window.location.origin}/public/invoice/${payment.public_token}`;
        window.open(link, '_blank');
    }

    async function handleUpload(e: CustomEvent) {
        isUploading = true;
        const file = e.detail.file;
        
        const dateStr = eventDate ? new Date(eventDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const cleanArtist = (advance.artist_name || 'Artist').replace(/\s+/g, '_');
        const ext = file.name.split('.').pop();
        const fileName = `${dateStr}__${cleanArtist}_Invoice_DJ.${ext}`;
        
        try {
            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(`invoices/locals/${fileName}`, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(`invoices/locals/${fileName}`);
            
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

    async function handleDeleteInvoice() {
        invoiceUrl = null;
        status = 'Confirmed';
        await updatePaymentField('invoice_url', null);
        await updatePaymentField('status', 'Confirmed');
        showPreviewModal = false;
    }

    async function generateEml() {
        if (!invoiceUrl) return;
        isGeneratingEml = true;

        try {
            // Update the Database Status locally and to server instantly
            status = 'Submitted';
            await updatePaymentField('status', 'Submitted');

            // 1. Fetch the actual PDF file and convert to Base64
            const response = await fetch(invoiceUrl);
            if (!response.ok) throw new Error("Failed to fetch invoice PDF");
            const blobFile = await response.blob();
            
            const base64Data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    // Extract pure base64 string without data-uri prefix
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blobFile);
            });

            // 2. Format details
            const ccList = ['charles@produkt.ca', 'mezz@produkt.ca', 'willis@produkt.ca']
                .filter(email => email !== currentUserProfile?.email)
                .join(', ');

            const formattedDate = formatEventDate(eventDate);
            const subject = `DJ Invoice - ${advance.artist_name} - ${formattedDate}`;
            const approvalText = approvedBy ? `Approved by ${approvedBy}` : 'To be Approved';

            const bodyText = `Hi Rachelle,\n\nHere's a DJ invoice for ${advance.artist_name} for the performance on ${formattedDate}.\n\n${approvalText}\n\nThanks,\n${currentUserProfile?.first_name || 'Team'}`;

            // 3. Construct Multipart MIME Document
            const boundary = `----=_NextPart_${Date.now().toString(16)}`;
            const cleanFileName = `Invoice_${advance.artist_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

            const emlContent = [
                `To: comptabilite@newcitygas.com`,
                `Cc: ${ccList}`,
                `From: ${currentUserProfile?.email || 'noreply@produkt.ca'}`,
                `Subject: ${subject}`,
                `X-Unsent: 1`,
                `MIME-Version: 1.0`,
                `Content-Type: multipart/mixed; boundary="${boundary}"`,
                ``,
                `This is a multi-part message in MIME format.`,
                `--${boundary}`,
                `Content-Type: text/plain; charset=utf-8`,
                ``,
                bodyText,
                ``,
                `--${boundary}`,
                `Content-Type: application/pdf; name="${cleanFileName}"`,
                `Content-Disposition: attachment; filename="${cleanFileName}"`,
                `Content-Transfer-Encoding: base64`,
                ``,
                base64Data,
                `--${boundary}--`
            ].join('\r\n');

            // 4. Download EML file
            const emlBlob = new Blob([emlContent], { type: 'message/rfc822' });
            const url = URL.createObjectURL(emlBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Email_${cleanFileName.replace('.pdf', '')}.eml`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Failed to generate EML:", error);
            alert("Error generating EML. The file might be protected or inaccessible.");
        } finally {
            isGeneratingEml = false;
        }
    }
</script>

<div class="flex flex-col h-full bg-navbar relative pb-6">
    <div class="flex-shrink-0 p-5 border-b border-gray1 bg-gray1/30">
        <h2 class="text-xl font-bold text-white truncate">{advance.artist_name}</h2>
        <p class="text-lime text-xs font-bold uppercase tracking-wider mt-1">Invoice Panel</p>
    </div>

    <div class="flex-1 overflow-y-auto p-5 space-y-6">
        
        <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col">
                <label for={`amount-${uid}`} class="block text-xs font-bold text-gray2 mb-2">Amount ($)</label>
                <input 
                    id={`amount-${uid}`}
                    type="number" 
                    step="25"
                    bind:value={amount} 
                    on:change={() => updatePaymentField('amount', amount)}
                    disabled={isLocked}
                    class="w-full bg-gray1 border border-gray2 rounded-2xl h-14 px-4 text-white font-bold text-lg focus:border-lime focus:outline-none disabled:opacity-50 transition-colors"
                />
            </div>

            <div class="flex flex-col">
                <span class="block text-xs font-bold text-gray2 mb-2">Delivery</span>
                <button 
                    on:click={toggleDelivery}
                    class="w-full bg-gray1 border border-gray2 rounded-2xl h-14 px-4 text-white font-bold text-lg focus:border-lime focus:outline-none hover:border-lime transition-colors flex items-center justify-between cursor-pointer"
                >
                    <span>{deliveryMethod}</span>
                    <svg class="w-5 h-5 text-gray2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                </button>
            </div>
        </div>

        <div class="space-y-4">
             {#if !invoiceUrl}
                <div class="grid grid-cols-2 gap-3">
                    <button 
                        on:click={() => showUploadModal = true}
                        class="py-3 rounded-2xl border border-dashed border-gray2 hover:border-lime hover:bg-gray1/50 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      <svg class="w-4 h-4 text-gray2 group-hover:text-lime" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Upload PDF
                    </button>
                    <div class="flex flex-col gap-1 items-center justify-center">
                        <button 
                            on:click={handleShareLink}
                            class="w-full py-3 rounded-2xl border border-gray2 hover:border-white hover:bg-gray1/50 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 group cursor-pointer"
                        >
                            <svg class="w-4 h-4 text-gray2 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                            Share Link
                        </button>
                        <button on:click={openPublicLink} class="text-[10px] text-lime hover:text-white hover:underline transition-colors cursor-pointer">
                            [View invoice upload link]
                        </button>
                    </div>
                </div>
            {:else}
                <div class="grid grid-cols-2 gap-3">
                    <button 
                        on:click={() => showPreviewModal = true}
                        class="py-3 rounded-2xl border border-lime bg-lime/10 hover:bg-lime/20 text-lime font-bold text-sm transition-all flex flex-col items-center justify-center gap-0.5 group cursor-pointer"
                    >
                        <div class="flex items-center gap-1.5">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span>Invoice Uploaded</span>
                        </div>
                        <span class="text-[10px] text-lime/70 uppercase tracking-wider">Preview File</span>
                    </button>

                    <div class="flex flex-col gap-1 items-center justify-center">
                        <button 
                            on:click={handleShareLink}
                            class="w-full py-3 rounded-2xl border border-gray2 hover:border-white hover:bg-gray1/50 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 group cursor-pointer"
                        >
                            <svg class="w-4 h-4 text-gray2 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                            Share Link
                        </button>
                        <button on:click={openPublicLink} class="text-[10px] text-gray2 hover:text-white hover:underline transition-colors cursor-pointer">
                            [View invoice upload link]
                        </button>
                    </div>
                </div>
            {/if}
        </div>

        <div class="relative mt-4" use:clickOutside on:click_outside={() => statusDropdownOpen = false}>
            <span class="block text-xs font-bold text-gray2 mb-2">Status</span>
            <button 
                on:click={() => (statusDropdownOpen = !statusDropdownOpen)} 
                class="w-full rounded-2xl p-4 flex justify-between items-center transition-all {getStatusClasses(status)} cursor-pointer"
            >
                <span class="font-bold uppercase tracking-wider text-sm">{status}</span>
                <svg class="w-4 h-4 transition-transform {statusDropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>

            {#if statusDropdownOpen}
                <div class="absolute top-full left-0 mt-2 w-full bg-[#1C1C1C] border border-gray2 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col gap-1 p-2">
                    {#each ['Draft', 'Confirmed', 'Invoiced', 'Approved', 'Submitted', 'Paid'] as opt}
                        <button 
                            on:click={() => selectStatus(opt)} 
                            class="w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer {getStatusClasses(opt)}"
                        >
                            {opt}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        <div class="space-y-2 pt-4 border-t border-gray1">
            <label for="notes-{uid}" class="block text-xs font-bold text-gray2">Notes</label>
            <textarea 
                id="notes-{uid}"
                bind:value={notes}
                on:blur={() => updatePaymentField('notes', notes)}
                placeholder="Add notes..."
                rows="2"
                class="w-full bg-gray1 rounded-2xl border border-gray2 text-sm text-white focus:border-lime focus:outline-none resize-none p-4 transition-colors"
            ></textarea>
        </div>

        <div class="pt-4 border-t border-gray1">
            
            {#if isLocked}
                <div class="text-center">
                    <button 
                        class="w-full bg-gray1 border border-lime/30 text-lime font-bold py-4 rounded-2xl text-sm cursor-not-allowed opacity-80"
                        disabled
                    >
                        Approved by {approvedBy}
                    </button>
                    {#if approvedAt}
                        <p class="text-[10px] text-gray2 mt-2 uppercase tracking-wide">
                            {formatApprovalDate(approvedAt)}
                        </p>
                    {/if}
                </div>
            {:else}
                <button 
                    on:click={handleApprove}
                    class="w-full py-4 rounded-2xl font-bold text-sm transition-all shadow-lg flex flex-col items-center justify-center gap-1 cursor-pointer
                    {isConfirmingApprove ? 'bg-red-500 text-white hover:bg-red-600 scale-[1.02]' : 'bg-gray3 text-black hover:bg-lime hover:scale-[1.02]'}"
                >
                    {#if isConfirmingApprove}
                        <span>Are you sure you want to approve this, {currentUserProfile?.first_name}?</span>
                    {:else}
                        <span>Approve Invoice</span>
                    {/if}
                </button>
            {/if}

            <div class="mt-6 pt-6 border-t border-gray1/50">
                <button 
                    on:click={generateEml}
                    disabled={!invoiceUrl || !['invoiced', 'approved', 'submitted', 'paid'].includes(status?.toLowerCase()) || isGeneratingEml}
                    class="w-full py-4 rounded-2xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 
                    {!invoiceUrl || !['invoiced', 'approved', 'submitted', 'paid'].includes(status?.toLowerCase()) ? 'bg-gray1 text-gray2 cursor-not-allowed opacity-80' : 'bg-gray2 text-black hover:bg-lime hover:text-black cursor-pointer'}"
                >
                    {#if isGeneratingEml}
                        <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        <span>Attaching file...</span>
                    {:else}
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                        <span>Email Invoice to Accounting</span>
                    {/if}
                </button>
            </div>

        </div>
    </div>
</div>

<div use:portal>
    <PopupNotification 
        bind:show={showNotification}
        message={notificationMessage}
        variant="white"
        iconType="success"
        duration={3000}
    />

    <UploadModal
        isOpen={showUploadModal}
        title={`Upload Invoice - ${advance.artist_name}`}
        acceptedTypes=".pdf,.jpg,.png"
        {isUploading}
        on:close={() => (showUploadModal = false)}
        on:upload={handleUpload}
    />

    {#if invoiceUrl}
        <PreviewModal
            isOpen={showPreviewModal}
            fileName="Invoice Preview"
            fileUrl={invoiceUrl}
            showDeleteButton={true}
            on:delete={handleDeleteInvoice}
            on:close={() => (showPreviewModal = false)}
        />
    {/if}
</div>