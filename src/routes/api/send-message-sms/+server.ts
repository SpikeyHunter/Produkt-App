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
        const body = await request.json();
        const { users, message } = body;

        if (!users || !Array.isArray(users) || !message) {
            return json({ success: false, message: 'Invalid payload' }, { status: 400 });
        }

        // Fetch AWS SNS Configuration
        const { data: configData } = await supabaseAdmin
            .from('calendar_settings')
            .select('setting_params')
            .eq('setting_type', 'CONFIG')
            .eq('setting_name', 'AWS_SNS')
            .maybeSingle();

        const originationNumber = configData?.setting_params?.originationNumber || '+15067145757';

        for (const user of users) {
            if (!user.phone) continue;

            // 1. Format the phone number
            let cleanPhone = user.phone.replace(/\D/g, '');
            if (cleanPhone.length === 10) cleanPhone = '1' + cleanPhone;
            const formattedPhone = `+${cleanPhone}`;

            // 2. Variable replacement
            let personalizedMessage = message
                .replace(/<name>/gi, user.name || '')
                .replace(/<email>/gi, user.email || '')
                .replace(/<phone>/gi, user.phone || '');

            // 3. Strip the button syntax down to just the URL for SMS texts
            // Matches: <https://link.com [alt=Text]> and replaces with just: https://link.com
            personalizedMessage = personalizedMessage.replace(/<(.*?)\s+\[alt=(.*?)\]>/gi, '$1');

            // 4. Send SNS Command
            const command = new PublishCommand({
                PhoneNumber: formattedPhone,
                Message: personalizedMessage,
                MessageAttributes: {
                    'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
                    'AWS.MM.SMS.OriginationNumber': { DataType: 'String', StringValue: originationNumber }
                }
            });

            try {
                await snsClient.send(command);
            } catch (snsError) {
                console.error(`Failed to send SMS to ${user.name} (${formattedPhone}):`, snsError);
            }
        }

        return json({ success: true, message: `Bulk SMS processing completed` });
    } catch (error) {
        console.error('Error in bulk SMS route:', error);
        return json({ success: false, message: 'Failed to process bulk SMS request' }, { status: 500 });
    }
};