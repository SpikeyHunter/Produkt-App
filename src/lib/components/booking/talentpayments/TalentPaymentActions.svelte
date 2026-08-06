<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import UploadModal from '$lib/components/modals/UploadModal.svelte';
	import PreviewModal from '$lib/components/modals/PreviewModal.svelte';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
	import {
		PRIMARY_STATUSES,
		FINAL_STATUSES,
		normalizeStatus,
		statusTheme,
		formatOrdinalDate
	} from '$lib/components/booking/talentpayments/paymentStatus';

	export let advance: any;
	export let payment: any = {};
	export let eventDate: string;
	export let currentUserProfile: any;

	const dispatch = createEventDispatcher();

	/** Who signs off on invoices — used in the outgoing email copy. */
	const APPROVER = 'Willis';
	const ACCOUNTING_TO = 'comptabilite@newcitygas.com';
	const ACCOUNTING_CC = ['charles@produkt.ca', 'mezz@produkt.ca', 'willis@produkt.ca'];

	let amount = 150;
	let notes = '';
	let deliveryMethod = 'Pick Up';
	let status = 'Draft';
	let invoiceUrl: string | null = null;

	let showUploadModal = false;
	let showPreviewModal = false;
	let isUploading = false;
	let isGeneratingEml = false;
	let isGeneratingSpark = false;

	let notificationMessage = '';
	let showNotification = false;

	// Hot-swaps every input when a different artist is selected.
	$: {
		amount = payment?.amount ?? 150;
		notes = payment?.notes ?? '';
		deliveryMethod = payment?.delivery_method ?? 'Pick Up';
		status = normalizeStatus(payment?.status);
		invoiceUrl = payment?.invoice_url || null;
	}

	$: canEmail = !!invoiceUrl;

	async function updatePaymentField(field: string, value: any) {
		if (!payment?.id) {
			console.error('No payment ID found for update');
			return;
		}

		const { data, error } = await supabase
			.from('talent_payments')
			.update({ [field]: value, updated_at: new Date().toISOString() })
			.eq('id', payment.id)
			.select()
			.single();

		if (error) console.error('Error updating payment:', error);
		else payment = data;
	}

	async function selectStatus(newStatus: string) {
		if (status === newStatus) return;
		status = newStatus;
		await updatePaymentField('status', newStatus);
	}

	function setDelivery(method: string) {
		if (deliveryMethod === method) return;
		deliveryMethod = method;
		updatePaymentField('delivery_method', method);
	}

	function handleShareLink() {
		if (!payment?.public_token) return;
		navigator.clipboard.writeText(`${window.location.origin}/public/invoice/${payment.public_token}`);
		notificationMessage = 'Link copied to clipboard!';
		showNotification = true;
	}

	function openPublicLink() {
		if (!payment?.public_token) return;
		window.open(`${window.location.origin}/public/invoice/${payment.public_token}`, '_blank');
	}

	async function handleUpload(e: CustomEvent) {
		isUploading = true;
		const file = e.detail.file;

		let dateStr = new Date().toISOString().split('T')[0];
		try {
			if (eventDate) dateStr = new Date(eventDate).toISOString().split('T')[0];
		} catch (err) {
			/* keep today's date */
		}

		const cleanArtist = (advance?.artist_name || 'Artist').replace(/[^a-zA-Z0-9]/g, '_');
		const ext = file.name.split('.').pop() || 'pdf';
		const fileName = `${dateStr}__${cleanArtist}_Invoice_DJ.${ext}`;

		try {
			const { error: uploadError } = await supabase.storage
				.from('documents')
				.upload(`invoices/locals/${fileName}`, file, { upsert: true });

			if (uploadError) throw uploadError;

			const {
				data: { publicUrl }
			} = supabase.storage.from('documents').getPublicUrl(`invoices/locals/${fileName}`);

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
		status = 'Draft';
		await updatePaymentField('invoice_url', null);
		await updatePaymentField('status', 'Draft');
		showPreviewModal = false;
	}

	/* ------------------------------------------------------------ email ---- */

	function buildEmail() {
		const artistName = advance?.artist_name || 'Artist';
		const formattedDate = formatOrdinalDate(eventDate);
		const subject = `DJ Invoice - ${artistName} - ${formattedDate}`;
		const body = [
			`Hi Rachelle,`,
			``,
			`Here's a DJ invoice for ${artistName} for the performance on ${formattedDate}.`,
			``,
			`To be Approved by ${APPROVER}`,
			``,
			`Thanks,`,
			`${currentUserProfile?.first_name || 'Team'}`
		].join('\r\n');

		const cc = ACCOUNTING_CC.filter((email) => email !== currentUserProfile?.email);
		const fileName = `Invoice_${artistName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

		return { subject, body, cc, fileName };
	}

	async function downloadInvoicePdf(fileName: string) {
		const response = await fetch(invoiceUrl as string);
		if (!response.ok) throw new Error('Failed to fetch invoice PDF');
		const blobFile = await response.blob();
		const blobUrl = URL.createObjectURL(blobFile);
		triggerDownload(blobUrl, fileName);
		URL.revokeObjectURL(blobUrl);
		return blobFile;
	}

	function triggerDownload(href: string, fileName: string) {
		const a = document.createElement('a');
		a.href = href;
		a.download = fileName;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	/**
	 * FIXED: Spark (and every other mail client registered as a mailto: handler)
	 * will silently ignore the request if the protocol launch doesn't happen
	 * inside the original user gesture. The old version awaited a Supabase write
	 * AND supabase.auth.getUser() before setting window.location.href, so by the
	 * time the mailto fired the gesture had expired and nothing opened.
	 *
	 * Now the mailto is opened synchronously on click; the DB write and the PDF
	 * download happen afterwards. The non-standard `&from=` param was also
	 * dropped — it isn't part of RFC 6068 and newer Spark builds reject the whole
	 * URL when they see it.
	 */
	function handleSparkEmail() {
		if (!invoiceUrl || isGeneratingSpark || isGeneratingEml) return;

		const { subject, body, cc, fileName } = buildEmail();

		const params = new URLSearchParams();
		if (cc.length) params.set('cc', cc.join(','));
		params.set('subject', subject);
		params.set('body', body);

		// URLSearchParams encodes spaces as "+", which mail clients render literally.
		const query = params.toString().replace(/\+/g, '%20');
		const mailtoLink = `mailto:${ACCOUNTING_TO}?${query}`;

		// Synchronous — still inside the click gesture.
		const a = document.createElement('a');
		a.href = mailtoLink;
		a.rel = 'noopener';
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		// Everything else can safely run after.
		isGeneratingSpark = true;
		(async () => {
			try {
				status = 'Submitted';
				await updatePaymentField('status', 'Submitted');
				await downloadInvoicePdf(fileName);
				notificationMessage = 'Email opened — attach the downloaded PDF.';
				showNotification = true;
			} catch (error) {
				console.error('Spark email follow-up failed:', error);
				notificationMessage = 'Email opened, but the PDF download failed.';
				showNotification = true;
			} finally {
				isGeneratingSpark = false;
			}
		})();
	}

	/** .eml file with the PDF already attached — opens in any desktop client. */
	async function generateEml() {
		if (!invoiceUrl || isGeneratingEml || isGeneratingSpark) return;
		isGeneratingEml = true;

		try {
			status = 'Submitted';
			await updatePaymentField('status', 'Submitted');

			const { subject, body, cc, fileName } = buildEmail();

			const response = await fetch(invoiceUrl);
			if (!response.ok) throw new Error('Failed to fetch invoice PDF');
			const blobFile = await response.blob();

			const base64Data = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
				reader.onerror = reject;
				reader.readAsDataURL(blobFile);
			});

			const boundary = `----=_NextPart_${Date.now().toString(16)}`;
			const emlContent = [
				`To: ${ACCOUNTING_TO}`,
				`Cc: ${cc.join(', ')}`,
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
				body,
				``,
				`--${boundary}`,
				`Content-Type: application/pdf; name="${fileName}"`,
				`Content-Disposition: attachment; filename="${fileName}"`,
				`Content-Transfer-Encoding: base64`,
				``,
				base64Data,
				`--${boundary}--`
			].join('\r\n');

			const emlBlob = new Blob([emlContent], { type: 'message/rfc822' });
			const url = URL.createObjectURL(emlBlob);
			triggerDownload(url, `Email_${fileName.replace('.pdf', '')}.eml`);
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Failed to generate EML:', error);
			alert('Error generating EML. The file might be protected or inaccessible.');
		} finally {
			isGeneratingEml = false;
		}
	}

	function portal(node: HTMLElement, target: string = 'body') {
		const targetEl = document.querySelector(target);
		if (targetEl) targetEl.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
		};
	}

	function statusBtnClass(opt: string, active: boolean) {
		const t = statusTheme(opt);
		const base =
			'w-full rounded-lg border px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer truncate';
		return active
			? `${base} ${t.solid}`
			: `${base} border-white/10 bg-transparent text-gray2 hover:border-white/25 hover:text-white`;
	}
</script>

<div class="flex h-full flex-col bg-navbar">
	<!-- Header -->
	<div class="flex flex-shrink-0 items-start justify-between gap-2 border-b border-gray1 bg-gray1/30 px-4 py-3">
		<div class="min-w-0">
			<h2 class="truncate text-base font-extrabold leading-tight text-white">
				{advance?.artist_name || 'Artist'}
			</h2>
			<p class="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-lime">Invoice Panel</p>
		</div>
		<button
			on:click={() => dispatch('edit')}
			class="flex-shrink-0 cursor-pointer rounded-full border border-gray2 px-3 py-1 text-[11px] font-bold text-gray2 transition-colors hover:border-lime hover:bg-lime hover:text-black"
		>
			Edit
		</button>
	</div>

	<div class="flex-1 space-y-4 overflow-y-auto px-4 py-4">
		<!-- Amount + Delivery -->
		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col">
				<span class="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray2">Amount ($)</span>
				<input
					type="number"
					step="25"
					bind:value={amount}
					on:change={() => updatePaymentField('amount', amount)}
					class="h-10 w-full rounded-lg border border-white/10 bg-gray1 px-3 text-base font-bold text-white transition-colors focus:border-lime focus:outline-none"
				/>
			</label>

			<div class="flex flex-col">
				<span class="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray2">Delivery</span>
				<div class="flex h-10 gap-1 rounded-lg border border-white/10 bg-gray1 p-1">
					{#each ['Pick Up', 'Mail'] as method}
						<button
							on:click={() => setDelivery(method)}
							class="flex-1 cursor-pointer rounded-md text-[11px] font-bold transition-colors {deliveryMethod ===
							method
								? 'bg-white text-black'
								: 'text-gray2 hover:text-white'}"
						>
							{method}
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Invoice file -->
		<div>
			<span class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-gray2">Invoice</span>
			<div class="grid grid-cols-2 gap-2">
				{#if !invoiceUrl}
					<button
						on:click={() => (showUploadModal = true)}
						class="group flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray2 py-2.5 text-xs font-bold text-white transition-colors hover:border-lime hover:bg-gray1/50"
					>
						<svg class="h-4 w-4 text-gray2 group-hover:text-lime" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
						</svg>
						Upload PDF
					</button>
				{:else}
					<button
						on:click={() => (showPreviewModal = true)}
						class="flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-lime bg-lime/10 py-2 text-xs font-bold text-lime transition-colors hover:bg-lime/20"
					>
						<span class="flex items-center gap-1.5">
							<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							Uploaded
						</span>
						<span class="text-[9px] uppercase tracking-wider text-lime/70">Preview file</span>
					</button>
				{/if}

				<div class="flex flex-col items-center justify-center gap-1">
					<button
						on:click={handleShareLink}
						class="group flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-gray2 py-2.5 text-xs font-bold text-white transition-colors hover:border-white hover:bg-gray1/50"
					>
						<svg class="h-4 w-4 text-gray2 group-hover:text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
						</svg>
						Share Link
					</button>
					<button
						on:click={openPublicLink}
						class="cursor-pointer text-[9px] text-gray2 transition-colors hover:text-white hover:underline"
					>
						View upload page
					</button>
				</div>
			</div>
		</div>

		<!-- Status -->
		<div>
			<span class="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-gray2">Status</span>
			<div class="grid grid-cols-2 gap-1.5">
				{#each PRIMARY_STATUSES as opt}
					<button on:click={() => selectStatus(opt)} class={statusBtnClass(opt, status === opt)}>
						{opt}
					</button>
				{/each}
			</div>

			<div class="mt-2 rounded-xl border border-white/10 p-2">
				<span class="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-gray2">Completed as</span>
				<div class="grid grid-cols-3 gap-1.5">
					{#each FINAL_STATUSES as opt}
						<button on:click={() => selectStatus(opt)} class={statusBtnClass(opt, status === opt)}>
							{opt}
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Notes -->
		<label class="flex flex-col">
			<span class="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray2">Notes</span>
			<textarea
				bind:value={notes}
				on:blur={() => updatePaymentField('notes', notes)}
				placeholder="Add notes..."
				rows="2"
				class="w-full resize-none rounded-lg border border-white/10 bg-gray1 p-3 text-xs text-white transition-colors focus:border-lime focus:outline-none"
			></textarea>
		</label>

		<!-- Send -->
		<div class="space-y-2 border-t border-gray1 pt-4">
			<button
				on:click={handleSparkEmail}
				disabled={!canEmail || isGeneratingSpark || isGeneratingEml}
				class="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition-colors
				{!canEmail
					? 'cursor-not-allowed bg-gray1 text-gray2 opacity-70'
					: 'cursor-pointer bg-lime text-black hover:bg-lime/80'}"
			>
				{#if isGeneratingSpark}
					<div class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
					<span>Opening mail…</span>
				{:else}
					<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
					<span>Email Accounting (Spark)</span>
				{/if}
			</button>

			<button
				on:click={generateEml}
				disabled={!canEmail || isGeneratingEml || isGeneratingSpark}
				class="flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-bold transition-colors
				{!canEmail
					? 'cursor-not-allowed border-white/10 text-gray2 opacity-70'
					: 'cursor-pointer border-gray2 text-white hover:border-lime hover:text-lime'}"
			>
				{#if isGeneratingEml}
					<div class="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
					<span>Attaching file…</span>
				{:else}
					<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
					</svg>
					<span>Download .eml (PDF attached)</span>
				{/if}
			</button>

			{#if !canEmail}
				<p class="text-center text-[10px] text-gray2 opacity-70">Upload an invoice to enable sending.</p>
			{:else}
				<p class="text-center text-[10px] text-gray2 opacity-70">
					Sends to accounting — “To be Approved by {APPROVER}”.
				</p>
			{/if}
		</div>
	</div>
</div>

<div>
	<PopupNotification
		bind:show={showNotification}
		message={notificationMessage}
		variant="white"
		iconType="success"
		duration={3000}
	/>

	<UploadModal
		isOpen={showUploadModal}
		title={`Upload Invoice - ${advance?.artist_name || 'Artist'}`}
		acceptedTypes=".pdf,.jpg,.png"
		{isUploading}
		on:close={() => (showUploadModal = false)}
		on:upload={handleUpload}
	/>

	{#if invoiceUrl}
		<div use:portal>
			<PreviewModal
				isOpen={showPreviewModal}
				fileName="Invoice Preview"
				fileUrl={invoiceUrl}
				showDeleteButton={true}
				on:delete={handleDeleteInvoice}
				on:close={() => (showPreviewModal = false)}
			/>
		</div>
	{/if}
</div>