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
        // AWS SNS sends JSON payloads but uses the 'text/plain' content type
        const rawBody = await request.text();
        const payload = JSON.parse(rawBody);

        // 1. Handle AWS SNS Subscription Confirmation
        // When you first connect AWS to this URL, it sends a confirmation link.
        if (payload.Type === 'SubscriptionConfirmation') {
            const subscribeUrl = payload.SubscribeURL;
            await fetch(subscribeUrl);
            console.log('AWS SNS Webhook Subscribed Successfully');
            return new Response('Subscribed', { status: 200 });
        }

        // 2. Handle Inbound SMS
        if (payload.Type === 'Notification') {
            // The actual SMS details are stringified inside the "Message" property
            const messageData = JSON.parse(payload.Message);
            
            const senderPhone = messageData.originationNumber || '';
            const messageBody = (messageData.messageBody || '').trim().toUpperCase();

            // Common opt-out keywords recognized by carriers
            const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END'];

            if (optOutKeywords.includes(messageBody)) {
                // Clean the incoming AWS phone number to extract the core 10 digits
                const cleanSenderPhone = senderPhone.replace(/\D/g, '');
                const last10Digits = cleanSenderPhone.slice(-10);

                if (last10Digits.length === 10) {
                    // Update Supabase where the saved phone contains these 10 digits
                    const { error } = await supabaseAdmin
                        .from('calendar_users')
                        .update({ confirmation_phone: false })
                        .like('phone', `%${last10Digits}%`);

                    if (error) {
                        console.error('Failed to opt-out user in DB:', error);
                    } else {
                        console.log(`User with phone ending in ${last10Digits} opted out.`);
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