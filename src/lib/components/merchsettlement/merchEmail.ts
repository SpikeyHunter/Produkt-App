import type { SupabaseClient } from '@supabase/supabase-js';

function getOrdinalNum(n: number) {
	return n + (n > 0 ? ['th', 'st', 'nd', 'rd'][(n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10] : '');
}

function formatEventDate(dateString: string | null): string {
	if (!dateString) return 'TBD';
	try {
		const d = new Date(dateString);
		d.setDate(d.getDate() + 1); // Adjust for UTC
		const month = d.toLocaleDateString('en-US', { month: 'long' });
		const year = d.getFullYear();
		const day = getOrdinalNum(d.getDate());
		return `${month} ${day}, ${year}`;
	} catch (error) {
		return dateString;
	}
}

const blobToBase64 = (blob: Blob): Promise<string> => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const dataUrl = reader.result as string;
			// Strip the Data URI prefix and return just the raw Base64 string
			resolve(dataUrl.split(',')[1]);
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
};

export async function generateMerchEmail(settlement: any, supabase: SupabaseClient, htmlContent: string) {
	// Get authenticated user
	const { data: { user } } = await supabase.auth.getUser();
	
	if (!user || !user.email) {
		console.error('No authenticated user found');
		throw new Error('User must be authenticated to generate email');
	}

	// Fetch user profile for first name
	const { data: profile } = await supabase
		.from('user_profiles')
		.select('first_name')
		.eq('id', user.id)
		.single();

	const firstName = profile?.first_name || user.email.split('@')[0];
	const eventName = settlement.event_name || 'TBD';
	const rawDate = settlement.event_date || 'YYYY-MM-DD';
	const formattedDate = formatEventDate(settlement.event_date);
	
	// Format currency string
	let currencyDisplay = 'CAD ($)';
	if (settlement.currency === 'USD') currencyDisplay = 'USD ($)';
	if (settlement.currency === 'EUR') currencyDisplay = 'EUR (€)';

	const subject = `Merch Settlement - ${eventName} - ${rawDate}`;
	const fromEmail = user.email;

	// Prepare CC List (exclude sender if they are in the default list)
	const defaultCcs = ['janie@produkt.ca', 'charles@produkt.ca', 'allanah@produkt.ca'];
	const ccList = defaultCcs
		.filter(email => email.toLowerCase() !== fromEmail.toLowerCase())
		.join(', ');

	const pdfFilename = `Merch_Settlement_${eventName.replace(/[\s/]+/g, '_')}.pdf`;

	// Request PDF Generation from the server
	const res = await fetch('/api/generate-merch-pdf', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			htmlContent,
			eventName: settlement.event_name,
			eventDate: settlement.event_date
		})
	});

	if (!res.ok) throw new Error('Failed to generate PDF for attachment');
	const pdfBlob = await res.blob();
	const pdfBase64 = await blobToBase64(pdfBlob);

	const htmlBody = `
		<p>Hi X,</p>
		<p>Please find merch settlement attached below for the <b>${eventName}</b> on the <b>${formattedDate}</b>.</p>
		
		<p>Payment shall be made in <b>${currencyDisplay}</b> within <b>fifteen (15) days</b> following receipt of a valid invoice.</p>
		
		<p><b><u>All invoices must be issued to:</u></b></p>
		<p>
			4427319 Canada Inc.<br>
			1055 Place Lucien L’Allier<br>
			Montreal, Quebec<br>
			Canada H3C 1S4
		</p>
		
		<p>Please ensure that complete wire transfer details (including beneficiary name, bank name, branch address, account number, transit number, SWIFT/BIC code, and any other relevant banking information) are clearly indicated on the invoice.</p>
		
		<p>Best,<br>${firstName.charAt(0).toUpperCase() + firstName.slice(1)}</p>
	`.replace(/\t/g, '').trim();

	// Construct Multipart MIME EML File
	const boundary = "=_NextPart_" + Date.now().toString(16);
	const base64Formatted = pdfBase64.match(/.{1,76}/g)?.join('\r\n') || pdfBase64; // Wrap lines to 76 characters to respect RFC MIME standards

	const emlContent = [
		`Subject: ${subject}`,
		`From: ${fromEmail}`,
		`To: `,
		`CC: ${ccList}`,
		`X-Unsent: 1`,
		`MIME-Version: 1.0`,
		`Content-Type: multipart/mixed; boundary="${boundary}"`,
		``,
		`--${boundary}`,
		`Content-Type: text/html; charset=utf-8`,
		`Content-Transfer-Encoding: 7bit`,
		``,
		htmlBody,
		``,
		`--${boundary}`,
		`Content-Type: application/pdf; name="${pdfFilename}"`,
		`Content-Disposition: attachment; filename="${pdfFilename}"`,
		`Content-Transfer-Encoding: base64`,
		``,
		base64Formatted,
		`--${boundary}--`
	].join('\r\n');

	// Trigger File Download
	const blob = new Blob([emlContent], { type: 'message/rfc822' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `Merch_Settlement_${eventName.replace(/[\s/]+/g, '_')}.eml`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}