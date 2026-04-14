import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient } from '@supabase/supabase-js';

// Setup AWS SES
const sesClient = new SESClient({
	region: privateEnv.AWS_REGION || '',
	credentials: {
		accessKeyId: privateEnv.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: privateEnv.AWS_SECRET_ACCESS_KEY || ''
	}
});

const transporter = nodemailer.createTransport({
	streamTransport: true,
	buffer: true
});

// Setup Supabase Admin Client to bypass RLS
const supabaseAdmin = createClient(
	publicEnv.PUBLIC_SUPABASE_URL || '',
	privateEnv.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const POST: RequestHandler = async ({ request }) => {
	try {
		// 1. Extract eventDates (array) in addition to eventDate (fallback)
		const { eventId, eventTitle, eventType, eventDate, eventDates, venueName, authUserName, action } =
			await request.json();

		// Add display modifier for Bazart Nuits
		const displayEventType = eventType === 'Bazart Nuits' ? 'Nuits Bazart' : eventType;

		// Fetch all users who opted into emails AND pull their exempt status
		const { data: users, error } = await supabaseAdmin
			.from('calendar_users')
			.select('id, email, name, confirmation_exempt') // ADDED confirmation_exempt
			.eq('confirmation_email', true)
			.not('email', 'is', null)
			.neq('email', '');

		if (error || !users || users.length === 0) {
			return json({ success: true, message: 'No users to email' });
		}

		// 2. Determine the dates array and sort them chronologically
		const dates = (eventDates && eventDates.length > 0) ? eventDates : (eventDate ? [eventDate] : []);
		dates.sort();

		// 3. Format the dates for the Email Body and Subject Line
		let formattedDateText = '';
		let subjectDateText = '';

		if (dates.length === 0) {
			formattedDateText = 'for the selected date(s)';
			subjectDateText = 'TBD';
		} else if (dates.length === 1) {
			// Single Date Logic
			const d = new Date(dates[0] + 'T00:00:00');
			formattedDateText = `for ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
			subjectDateText = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
		} else {
			// Multiple Dates Logic (Range)
			const first = new Date(dates[0] + 'T00:00:00');
			const last = new Date(dates[dates.length - 1] + 'T00:00:00');

			const firstFormatted = first.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
			const lastFormatted = last.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
			
			formattedDateText = `from ${firstFormatted} to ${lastFormatted}`;

			const fDay = first.getDate().toString().padStart(2, '0');
			const fMonth = (first.getMonth() + 1).toString().padStart(2, '0');
			const fYear = first.getFullYear();

			const lDay = last.getDate().toString().padStart(2, '0');
			const lMonth = (last.getMonth() + 1).toString().padStart(2, '0');
			const lYear = last.getFullYear();

			// If same month and year: 18-20/06/2026. If different: 18/06/2026 - 20/07/2026
			if (fMonth === lMonth && fYear === lYear) {
				subjectDateText = `${fDay}-${lDay}/${fMonth}/${fYear}`;
			} else {
				subjectDateText = `${fDay}/${fMonth}/${fYear} - ${lDay}/${lMonth}/${lYear}`;
			}
		}

		const currentYear = new Date().getFullYear();
		const isCancel = action === 'cancel';
		const subjectText = isCancel ? 'CANCELED' : 'CONFIRMED';
		const titleText = isCancel ? 'Canceled' : 'Confirmed!';
		const subtitleText = isCancel ? 'canceled' : 'confirmed';

		const buttonHtml = isCancel
			? `<p style="color: #FF4D4D; font-weight: 700; font-size: 16px;">Event Canceled</p>`
			: `<a href="https://app.produkt.ca/calendar/${eventId}" class="verify-button"><span>View in Calendar</span></a>`;

		// EXEMPTION LOGIC
		const exemptAllowedTypes = ['NCG Show', 'NCG 360', 'DSTRKT', 'Tour Prod'];
		const isAllowedType = exemptAllowedTypes.includes(eventType);

		for (const user of users) {
			if (!user.email) continue;
			
			// Skip user if they are exempt and the event is not one of the allowed types
			if (user.confirmation_exempt && !isAllowedType) continue;

			const eventUrl = `https://app.produkt.ca/calendar/${eventId}`;
			const unsubscribeUrl = `https://app.produkt.ca/calendar/unsubscribe?id=${user.id}`;

			const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subjectText}: ${subjectDateText} - ${eventTitle} - [${displayEventType}]</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Helvetica+Neue:wght@400;700&display=swap');
        :root { color-scheme: light dark; supported-color-schemes: light dark; }
        body { background-color: #FFFFFF; margin: 0; padding: 0; font-family: 'Helvetica Neue', sans-serif; letter-spacing: -0.01em; }
        .email-container { max-width: 100%; width: 100%; background-color: #FFFFFF; }
        .header { background-color: #FFFFFF; padding: 40px 30px 20px 30px; text-align: center; border-bottom: 2px solid #E4E4E4; }
        .logo { width: 100%; max-width: 300px; height: auto; max-height: 80px; display: block; margin: 0 auto; color: #2F2F2F; font-size: 18px; font-weight: bold; text-align: center; }
        .content { padding: 40px 30px; text-align: center; background-color: #FFFFFF; }
        .welcome-title { color: #2F2F2F; font-size: 20px; font-weight: 700; margin: 0 0 16px 0; line-height: 1.3; }
        .welcome-subtitle { color: #7A7A7A; font-size: 14px; font-weight: 400; margin: 0 0 40px 0; line-height: 1.5; }
        .verify-button { display: inline-block; background-color: #E1FF00; color: #000000 !important; text-decoration: none; padding: 16px 32px; border-radius: 50px; font-weight: 700; font-size: 14px; transition: all 0.2s ease; margin-bottom: 30px; }
        .alternative-link { color: #7A7A7A; font-size: 12px; margin-top: 30px; line-height: 1.5; }
        .alternative-link a { color: #2F2F2F; text-decoration: underline; word-break: break-all; }
        .signature { margin-top: 30px; font-size: 14px; color: #7A7A7A; line-height: 1.5; }
        .footer { background-color: #F8F8F8; padding: 30px; text-align: center; border-top: 1px solid #E4E4E4; }
        .footer-text { color: #BDBDBB; font-size: 12px; margin: 0 0 10px 0; }
        .footer-link { color: #2F2F2F; text-decoration: underline; }
        @media (prefers-color-scheme: dark) {
            body, .email-container, .header, .content, .footer { background-color: #1e1e1e !important; }
            .header { border-bottom: 1px solid #333333 !important; }
            .footer { border-top: 1px solid #333333 !important; }
            .logo { filter: brightness(0) invert(1) !important; }
            .welcome-title { color: #FFFFFF !important; }
            .welcome-subtitle { color: #BDBDBB !important; }
            .verify-button { color: #000000 !important; background-color: #E1FF00 !important; }
            .signature, .alternative-link { color: #BDBDBB !important; }
            .footer-text { color: #BDBDBB !important; }
            .footer-link, .alternative-link a { color: #E1FF00 !important; }
        }
    </style>
</head>
<body>
    <div class="email-container">
       <div class="header">
    <img src="https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/NCG_ProduktXX_NOIR.png" alt="ProduktXX" class="logo">
</div>
        <div class="content">
            <h1 class="welcome-title">Event: ${eventTitle} - [${displayEventType}] ${titleText}</h1>
            <p class="welcome-subtitle">
                ${authUserName} has ${subtitleText} the event ${formattedDateText}.
            </p>
            
            ${buttonHtml}
            
            ${
							!isCancel
								? `
            <p class="alternative-link">
                If you're having trouble clicking the "View in Calendar" button, copy and paste the URL below into your web browser:<br><br>
                <a href="${eventUrl}">${eventUrl}</a>
            </p>`
								: ''
						}
            
            <div class="signature">
                Regards,<br/>
                Produkt App
            </div>
        </div>
        <div class="footer">
            <p class="footer-text">Copyrights © ${currentYear} Produkt App. All rights reserved.</p>
            <p class="footer-text">
                <a href="${unsubscribeUrl}" class="footer-link">Unsubscribe</a>
            </p>
        </div>
    </div>
</body>
</html>`;

			const mailOptions: any = {
				from: `"Produkt App" <support@produkt.ca>`,
				to: user.email,
				subject: `${subjectText}: ${subjectDateText} - ${eventTitle} - [${displayEventType}]`,
				text: `Event: ${eventTitle} - [${displayEventType}] ${titleText}\n\n${authUserName} has ${subtitleText} the event ${formattedDateText}.\n\n${isCancel ? 'Event Canceled' : `View in Calendar: ${eventUrl}`}\n\nUnsubscribe: ${unsubscribeUrl}`,
				html: htmlTemplate
			};

			const info = await transporter.sendMail(mailOptions);
			const rawEmailBuffer = info.message as Buffer;

			const command = new SendRawEmailCommand({
				RawMessage: { Data: rawEmailBuffer }
			});

			await sesClient.send(command);
		}

		return json({ success: true, message: `Sent ${users.length} notifications` });
	} catch (error) {
		console.error('Error sending emails:', error);
		return json({ success: false, message: 'Failed to send emails' }, { status: 500 });
	}
};