import type { RequestHandler } from './$types';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    publicEnv.PUBLIC_SUPABASE_URL || '', 
    privateEnv.SUPABASE_SERVICE_ROLE_KEY || ''
);

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
            
            const senderPhone = messageData.originationNumber || '';
            const messageBody = (messageData.messageBody || '').trim().toUpperCase();

            // Keywords recognized by carriers
            const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END'];
            const optInKeywords = ['START', 'UNSTOP', 'RESUME'];

            // Clean the incoming AWS phone number to extract the core 10 digits
            const cleanSenderPhone = senderPhone.replace(/\D/g, '');
            const last10Digits = cleanSenderPhone.slice(-10);

            if (last10Digits.length === 10) {
                if (optOutKeywords.includes(messageBody)) {
                    // Update DB to FALSE
                    const { error } = await supabaseAdmin
                        .from('calendar_users')
                        .update({ confirmation_phone: false })
                        .like('phone', `%${last10Digits}%`);

                    if (error) console.error('Failed to opt-out user in DB:', error);
                    else console.log(`User with phone ending in ${last10Digits} opted OUT.`);
                    
                } else if (optInKeywords.includes(messageBody)) {
                    // Update DB to TRUE
                    const { error } = await supabaseAdmin
                        .from('calendar_users')
                        .update({ confirmation_phone: true })
                        .like('phone', `%${last10Digits}%`);

                    if (error) console.error('Failed to opt-in user in DB:', error);
                    else console.log(`User with phone ending in ${last10Digits} opted IN.`);
                }
            }
        }

        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('SNS Webhook error:', error);
        return new Response('Error processing webhook', { status: 500 });
    }
};