import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

// Initialize the native AWS SES Client directly
const sesClient = new SESClient({
	region: env.AWS_REGION as string,
	credentials: {
		accessKeyId: env.AWS_ACCESS_KEY_ID as string,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
	}
});

// Nodemailer acts as our MIME/HTML builder
const transporter = nodemailer.createTransport({
	streamTransport: true,
	buffer: true
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.formData();
		
		// Bug Report Details
		const title = data.get('title') as string;
		const page = data.get('page') as string;
		const description = data.get('description') as string;
		const occurrenceCount = data.get('occurrenceCount') as string;
		
		// User Details
		const firstName = data.get('firstName') as string || 'Unknown';
		const lastName = data.get('lastName') as string || 'User';
		const userEmail = data.get('userEmail') as string;

		const files = data.getAll('files') as File[];

		// Process file attachments
		const attachments = await Promise.all(files.map(async (file) => {
			const arrayBuffer = await file.arrayBuffer();
			return {
				filename: file.name,
				content: Buffer.from(arrayBuffer),
				contentType: file.type
			};
		}));

		// Format Current Date/Time
		const dateTime = new Date().toLocaleString('en-US', { 
			dateStyle: 'medium', 
			timeStyle: 'short' 
		});
		
		const currentYear = new Date().getFullYear();

		// Construct Email Options with HTML formatting
		const mailOptions: any = {
			// Formats the sender name beautifully
			from: `"Produkt App" <${env.BUG_REPORT_FROM_EMAIL}>`,
			to: env.BUG_REPORT_TO_EMAIL as string,
			subject: `Bug Report - ${title}`,
			
			// Plain text fallback (for email clients that block HTML)
			text: `Bug Report - ${title}\nDate: ${dateTime}\nSent by: ${firstName} ${lastName}\nPage: ${page || 'Not specified'}\nHow many times: ${occurrenceCount}\n\nDescription:\n${description}`,
			
			// The beautifully formatted HTML email
			html: `
				<div style="font-family: sans-serif; color: #1a1a1a; line-height: 1.5;">
                    <p><strong>Date: ${dateTime}</strong></p>
                <ul style="list-style-type: disc; padding-left: 20px;">
						<li><strong>Sent by:</strong> ${firstName} ${lastName}</li>
						<li><strong>Page:</strong> ${page || 'Not specified'}</li>
						<li><strong>How many times:</strong> ${occurrenceCount}</li>
					</ul>
					
					<p><strong>Description:</strong><br>
					${description.replace(/\n/g, '<br>')}</p>
					
					<br>

					<p style="font-size: 12px; color: #666666;">
						&copy; All rights reserved from Produkt ${currentYear}. If you have any issues please contact <a href="mailto:support@produkt.ca" style="color: #666666;">support@produkt.ca</a> and we'll help you sort it out!
					</p>
				</div>
			`,
			attachments: attachments
		};

		// Add CC
		if (userEmail) {
			mailOptions.cc = userEmail;
		}

		// Generate the raw MIME email buffer
		const info = await transporter.sendMail(mailOptions);
		const rawEmailBuffer = info.message as Buffer;

		// Send the raw buffer directly via AWS SDK
		const command = new SendRawEmailCommand({
			RawMessage: {
				Data: rawEmailBuffer 
			}
		});

		await sesClient.send(command);

		return json({ success: true, message: 'Bug report sent successfully' });

	} catch (error) {
		console.error('Error sending bug report:', error);
		return json({ success: false, message: 'Failed to send bug report' }, { status: 500 });
	}
};