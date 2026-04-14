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
        const { eventId, eventTitle, eventType, eventDate, venueName, authUserName, action } =
            await request.json();

        // Add display modifier for Bazart Nuits
        const displayEventType = eventType === 'Bazart Nuits' ? 'Nuits Bazart' : eventType;

        // Fetch all users who opted into SMS AND pull their exempt status
        const { data: users, error } = await supabaseAdmin
            .from('calendar_users')
            .select('phone, name, confirmation_exempt') // ADDED confirmation_exempt
            .eq('confirmation_phone', true)
            .not('phone', 'is', null)
            .neq('phone', '');

        if (error || !users || users.length === 0) {
            return json({ success: true, message: 'No users to SMS' });
        }

        // Fetch SMS template
        const { data: templateData } = await supabaseAdmin
            .from('calendar_settings')
            .select('setting_params')
            .eq('setting_type', 'TEMPLATE')
            .eq('setting_name', 'SMS')
            .maybeSingle();

        // Fetch AWS SNS Configuration for the dynamic phone number
        const { data: configData } = await supabaseAdmin
            .from('calendar_settings')
            .select('setting_params')
            .eq('setting_type', 'CONFIG')
            .eq('setting_name', 'AWS_SNS')
            .maybeSingle();

        // Extract the number, falling back to the hardcoded one if the DB entry is missing
        const originationNumber = configData?.setting_params?.originationNumber || '+17824923543';

        const formattedDate = new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        const isCancel = action === 'cancel';
        const actionWord = isCancel ? '𝗖𝗮𝗻𝗰𝗲𝗹𝗲𝗱' : '𝗖𝗼𝗻𝗳𝗶𝗿𝗺𝗲𝗱';
        const actionLabel = isCancel ? 'Canceled' : 'Confirmed';
        const emoji = isCancel ? '🚫' : '✅';
        
        // Header stays consistent but gains emojis
        const headerText = `${emoji} 𝗘𝘃𝗲𝗻𝘁 ${actionWord}!`;

        // Apply fallback template if none found in DB
        const templateBodyString = templateData?.setting_params?.body || `{eventTitle} - [{eventType}]\n\n📅 {eventDate}\n📍 {venueName}\n\n{actionLabel} by {authUserName}`;

        // Replace tags with actual variables (Using displayEventType)
        const parsedBody = templateBodyString
            .replace(/{eventTitle}/g, eventTitle || '')
            .replace(/{eventType}/g, displayEventType || '')
            .replace(/{eventDate}/g, formattedDate || '')
            .replace(/{venueName}/g, venueName || '')
            .replace(/{actionLabel}/g, actionLabel)
            .replace(/{authUserName}/g, authUserName || '');

        let message = `${headerText}\n${parsedBody}\n\n`;
        
        // Only append the URL if the event is being confirmed
        if (!isCancel) {
            message += `https://app.produkt.ca/calendar/${eventId}\n\n`;
        }
        
        // Updated Footer
        message += `Reply STOP to unsubscribe`;

        // EXEMPTION LOGIC
        const exemptAllowedTypes = ['NCG Show', 'NCG 360', 'DSTRKT', 'Tour Prod'];
        const isAllowedType = exemptAllowedTypes.includes(eventType);

        for (const user of users) {
            if (!user.phone) continue;

            // Skip user if they are exempt and the event is not one of the allowed types
            if (user.confirmation_exempt && !isAllowedType) continue;

            // Clean the phone number and format to E.164
            let cleanPhone = user.phone.replace(/\D/g, '');
            if (cleanPhone.length === 10) cleanPhone = '1' + cleanPhone;
            const formattedPhone = `+${cleanPhone}`;

            const command = new PublishCommand({
                PhoneNumber: formattedPhone,
                Message: message,
                MessageAttributes: {
                    'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
                    'AWS.MM.SMS.OriginationNumber': { DataType: 'String', StringValue: originationNumber }
                }
            });

            await snsClient.send(command);
        }

        return json({ success: true, message: `Sent ${users.length} SMS notifications` });
    } catch (error) {
        console.error('Error sending SMS:', error);
        return json({ success: false, message: 'Failed to send SMS' }, { status: 500 });
    }
};