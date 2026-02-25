import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient } from '@supabase/supabase-js';

// Initialize the AWS SNS Client for text messaging
const snsClient = new SNSClient({
	region: privateEnv.AWS_REGION || '',
	credentials: {
		accessKeyId: privateEnv.AWS_ACCESS_KEY_ID || '',
		secretAccessKey: privateEnv.AWS_SECRET_ACCESS_KEY || ''
	}
});

// Setup Supabase Admin Client to bypass RLS
const supabaseAdmin = createClient(
	publicEnv.PUBLIC_SUPABASE_URL || '',
	privateEnv.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { eventId, eventTitle, eventType, eventDate, venueName, authUserName } =
			await request.json();

		// Fetch all users who opted into SMS
		const { data: users, error } = await supabaseAdmin
			.from('calendar_users')
			.select('phone, name')
			.eq('confirmation_phone', true)
			.not('phone', 'is', null)
			.neq('phone', '');

		if (error || !users || users.length === 0) {
			return json({ success: true, message: 'No users to SMS' });
		}

		const formattedDate = new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});

		// Removed the extra \n after 𝗘𝘃𝗲𝗻𝘁 𝗖𝗼𝗻𝗳𝗶𝗿𝗺𝗲𝗱!
		// Inside your POST function, update the message variable:
		const message = `𝗘𝘃𝗲𝗻𝘁 𝗖𝗼𝗻𝗳𝗶𝗿𝗺𝗲𝗱!\n${eventTitle} - [${eventType}]\n\n📅 ${formattedDate}\n📍 ${venueName}\n\nConfirmed by ${authUserName}\n\nhttps://app.produkt.ca/calendar/${eventId}\n\nReply STOP to cancel`;
		for (const user of users) {
			if (!user.phone) continue;

			// Clean the phone number and format to E.164
			let cleanPhone = user.phone.replace(/\D/g, '');
			if (cleanPhone.length === 10) cleanPhone = '1' + cleanPhone;
			const formattedPhone = `+${cleanPhone}`;

			const command = new PublishCommand({
				PhoneNumber: formattedPhone,
				Message: message,
				MessageAttributes: {
					'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
					'AWS.MM.SMS.OriginationNumber': { DataType: 'String', StringValue: '+17824923543' }
				}
			});

			await snsClient.send(command);
		}

		return json({ success: true, message: `Sent ${users.length} SMS confirmations` });
	} catch (error) {
		console.error('Error sending confirmation SMS:', error);
		return json({ success: false, message: 'Failed to send confirmation SMS' }, { status: 500 });
	}
};
