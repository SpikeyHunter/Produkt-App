import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { env } from '$env/dynamic/private';

// Initialize the AWS SNS Client for text messaging
const snsClient = new SNSClient({
	region: env.AWS_REGION as string,
	credentials: {
		accessKeyId: env.AWS_ACCESS_KEY_ID as string,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
	}
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { phone, name } = await request.json();

		if (!phone) {
			return json({ success: false, message: 'Phone number is required' }, { status: 400 });
		}

		// Clean the phone number and format to E.164 (AWS requirement)
		// Assuming North American numbers (+1) for this setup
		let cleanPhone = phone.replace(/\D/g, '');
		if (cleanPhone.length === 10) cleanPhone = '1' + cleanPhone;
		const formattedPhone = `+${cleanPhone}`;

		const loginUrl = 'https://app.produkt.ca/calendar';
		const defaultPassword = 'Produkt2026$';

		// Keep the text message concise to save on segment costs
		const message = `Hi ${name},\n\nYou've been invited to the Produkt Calendar!\n\nTemp Password: ${defaultPassword}\nLogin: ${loginUrl}\n\nPlease update your password after logging in.`;

		const command = new PublishCommand({
			PhoneNumber: formattedPhone,
			Message: message,
			MessageAttributes: {
				'AWS.SNS.SMS.SMSType': {
					DataType: 'String',
					StringValue: 'Transactional' // Crucial for instant delivery
				},
				'AWS.MM.SMS.OriginationNumber': {
					DataType: 'String',
					StringValue: '+17824923543' // Your new AWS Long Code
				}
			}
		});

		await snsClient.send(command);

		return json({ success: true, message: 'SMS invite sent successfully' });

	} catch (error) {
		console.error('Error sending SMS invite:', error);
		return json({ success: false, message: 'Failed to send SMS invite' }, { status: 500 });
	}
};