import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient } from '@supabase/supabase-js';

const snsClient = new SNSClient({
    region: privateEnv.AWS_REGION || '',
    credentials: {
        accessKeyId: privateEnv.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: privateEnv.AWS_SECRET_ACCESS_KEY || ''
    }
});

const supabaseAdmin = createClient(
    publicEnv.PUBLIC_SUPABASE_URL || '',
    privateEnv.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const POST: RequestHandler = async ({ request }) => {
    try {
        // 1. Extract the specific phone and name sent by the frontend button click
        const body = await request.json();
        const { phone, name } = body;

        // If no phone number is provided, stop immediately
        if (!phone) {
            return json({ success: false, message: 'Phone number is required' }, { status: 400 });
        }

        // 2. Fetch AWS SNS Configuration
        const { data: configData } = await supabaseAdmin
            .from('calendar_settings')
            .select('setting_params')
            .eq('setting_type', 'CONFIG')
            .eq('setting_name', 'AWS_SNS')
            .maybeSingle();

        const originationNumber = configData?.setting_params?.originationNumber || '+15067145757';
        
        // REPLACE THIS URL with your actual hosted .vcf file URL
        const vcfUrl = 'http://app.produkt.ca/contact-card';

        // 3. Format the single requested phone number
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = '1' + cleanPhone;
        const formattedPhone = `+${cleanPhone}`;

        // 4. Create the invite message
        const message = `Hi ${name || 'there'}! You've been invited to join Produkt Calendar.\n\nStart by adding this contact card to your phone: ${vcfUrl}\n\nClick on "Create New Contact"\n\nReply CONFIRM to get your access.`;

        // 5. Send the SNS command ONLY to this specific user
        const command = new PublishCommand({
            PhoneNumber: formattedPhone,
            Message: message,
            MessageAttributes: {
                'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
                'AWS.MM.SMS.OriginationNumber': { DataType: 'String', StringValue: originationNumber }
            }
        });

        await snsClient.send(command);

        return json({ success: true, message: `Invite sent securely to ${name}` });
    } catch (error) {
        console.error('Error sending SMS:', error);
        return json({ success: false, message: 'Failed to send SMS' }, { status: 500 });
    }
};