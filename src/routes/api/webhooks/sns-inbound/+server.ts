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

// 2. Initialize AWS SNS
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

        if (payload.Type === 'SubscriptionConfirmation') {
            const subscribeUrl = payload.SubscribeURL;
            await fetch(subscribeUrl);
            return new Response('Subscribed', { status: 200 });
        }

        if (payload.Type === 'Notification') {
            const messageData = JSON.parse(payload.Message);
            
            const { data: configData } = await supabaseAdmin
                .from('calendar_settings')
                .select('setting_params')
                .eq('setting_type', 'CONFIG')
                .eq('setting_name', 'AWS_SNS')
                .maybeSingle();

            const dbAwsNumber = configData?.setting_params?.originationNumber || '+15067145757';
            const senderPhone = messageData.originationNumber || ''; 
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
                    // Added has_default_password to the select query
                    const { data: users, error: fetchError } = await supabaseAdmin
                        .from('calendar_users')
                        .select('id, name, email, phone, confirmation_phone, invite_confirm_sms, has_default_password')
                        .not('phone', 'is', null);

                    if (fetchError || !users) return new Response('OK', { status: 200 });

                    const matchedUser = users.find(u => {
                        const cleanDbPhone = u.phone.replace(/\D/g, '');
                        return cleanDbPhone.endsWith(last10Digits);
                    });

                    if (matchedUser) {
                        const newStatus = isOptIn ? true : false;
                        const dbUpdates: any = {};

                        // 1. Check if we need to update their opt-in status
                        if (matchedUser.confirmation_phone !== newStatus) {
                            dbUpdates.confirmation_phone = newStatus;
                        }

                        // 2. If they opted IN, and haven't received the SMS yet
                        if (isOptIn) {
                            if (matchedUser.invite_confirm_sms === true) {
                                console.log(`User ${matchedUser.name} already received credentials. Ignoring.`);
                            } else {
                                const loginUrl = 'https://app.produkt.ca/calendar';
                                const registeredUrl = 'https://app.produkt.ca/';
                                const userEmail = matchedUser.email || 'Your Email';
                                let welcomeMessage = '';

                                // 3. The New Feature: Check password status for dynamic messaging
                                if (matchedUser.has_default_password) {
                                    const defaultPassword = 'Produkt2026$';
                                    welcomeMessage = `Here are your credentials:\n\nEmail: ${userEmail}\nTemp Password: ${defaultPassword}\n\n${loginUrl}\n\nPlease update your password after logging in!`;
                                } else {
                                    welcomeMessage = `You're already part of the Produkt App!\n\nUse your credentials to login:\n${registeredUrl}\n\nYou'll get notified by SMS for confirmed or canceled events`;
                                }

                                const command = new PublishCommand({
                                    PhoneNumber: senderPhone,
                                    Message: welcomeMessage,
                                    MessageAttributes: {
                                        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
                                        'AWS.MM.SMS.OriginationNumber': { DataType: 'String', StringValue: destinationPhone }
                                    }
                                });

                                await snsClient.send(command);
                                console.log(`Sent dynamic welcome details to ${matchedUser.name}`);
                                
                                // Flag that they have now received the SMS
                                dbUpdates.invite_confirm_sms = true;
                            }
                        }

                        // 4. Run a single database update if anything changed
                        if (Object.keys(dbUpdates).length > 0) {
                            await supabaseAdmin
                                .from('calendar_users')
                                .update(dbUpdates)
                                .eq('id', matchedUser.id);
                        }
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