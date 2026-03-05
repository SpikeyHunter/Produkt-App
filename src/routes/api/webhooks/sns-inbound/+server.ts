import type { RequestHandler } from './$types';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient } from '@supabase/supabase-js';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

// 1. Initialize Supabase Admin
const supabaseAdmin = createClient(
    publicEnv.PUBLIC_SUPABASE_URL || '', 
    privateEnv.SUPABASE_SERVICE_ROLE_KEY || ''
);

// 2. Initialize AWS SNS for sending the automated reply
const snsClient = new SNSClient({
    region: privateEnv.AWS_REGION || '',
    credentials: {
        accessKeyId: privateEnv.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: privateEnv.AWS_SECRET_ACCESS_KEY || ''
    }
});

export const POST: RequestHandler = async ({ request }) => {
    try {
        const rawBody = await request.text();
        const payload = JSON.parse(rawBody);

        // 1. Handle AWS SNS Subscription Confirmation
        if (payload.Type === 'SubscriptionConfirmation') {
            const subscribeUrl = payload.SubscribeURL;
            await fetch(subscribeUrl);
            console.log('AWS SNS Webhook Subscribed Successfully');
            return new Response('Subscribed', { status: 200 });
        }

        // 2. Handle Inbound SMS
        if (payload.Type === 'Notification') {
            const messageData = JSON.parse(payload.Message);
            
            // Fetch AWS SNS Configuration from DB (matching your outbound logic)
            const { data: configData } = await supabaseAdmin
                .from('calendar_settings')
                .select('setting_params')
                .eq('setting_type', 'CONFIG')
                .eq('setting_name', 'AWS_SNS')
                .maybeSingle();

            const dbAwsNumber = configData?.setting_params?.originationNumber || '+15067145757';

            const senderPhone = messageData.originationNumber || ''; // The user's phone number
            // Dynamically use the exact number they texted, fallback to DB config
            const destinationPhone = messageData.destinationNumber || dbAwsNumber; 
            const messageBody = (messageData.messageBody || '').trim().toUpperCase();

            const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END'];
            const optInKeywords = ['START', 'UNSTOP', 'RESUME', 'CONFIRM']; 

            const cleanSenderPhone = senderPhone.replace(/\D/g, '');
            const last10Digits = cleanSenderPhone.slice(-10);

            if (last10Digits.length === 10) {
                const isOptOut = optOutKeywords.includes(messageBody);
                const isOptIn = optInKeywords.includes(messageBody);

                if (isOptOut || isOptIn) {
                    // Fetch users.
                    const { data: users, error: fetchError } = await supabaseAdmin
                        .from('calendar_users')
                        .select('id, name, email, phone, confirmation_phone')
                        .not('phone', 'is', null);

                    if (fetchError || !users) {
                        console.error('Failed to fetch users:', fetchError);
                        return new Response('OK', { status: 200 });
                    }

                    // Find the exact user based on the last 10 digits
                    const matchedUser = users.find(u => {
                        const cleanDbPhone = u.phone.replace(/\D/g, '');
                        return cleanDbPhone.endsWith(last10Digits);
                    });

                    // Only process if the user ACTUALLY exists in your database
                    if (matchedUser) {
                        const newStatus = isOptIn ? true : false;
                        
                        // Update their confirmation status in the database
                        if (matchedUser.confirmation_phone !== newStatus) {
                            await supabaseAdmin
                                .from('calendar_users')
                                .update({ confirmation_phone: newStatus })
                                .eq('id', matchedUser.id);
                        }

                        // If they replied CONFIRM, send the login details
                        if (isOptIn) {
                            const loginUrl = 'https://app.produkt.ca/calendar';
                            const defaultPassword = 'Produkt2026$';
                            const userEmail = matchedUser.email || 'Your Email';

                            const welcomeMessage = `Hi ${matchedUser.name},\n\nYou've been invited to the Produkt Calendar!\n\nEmail: ${userEmail}\nTemp Password: ${defaultPassword}\nLogin: ${loginUrl}\n\nPlease update your password after logging in.`;

                            const command = new PublishCommand({
                                PhoneNumber: senderPhone, // Send back to the user
                                Message: welcomeMessage,
                                MessageAttributes: {
                                    'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
                                    'AWS.MM.SMS.OriginationNumber': { DataType: 'String', StringValue: destinationPhone }
                                }
                            });

                            await snsClient.send(command);
                            console.log(`Sent welcome details to ${matchedUser.name}`);
                        }

                    } else {
                        console.log(`Ignored message from uninvited number ending in ${last10Digits}`);
                    }
                }
            }
        }

        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('SNS Webhook error:', error);
        return new Response('Error processing webhook', { status: 500 });
    }
};