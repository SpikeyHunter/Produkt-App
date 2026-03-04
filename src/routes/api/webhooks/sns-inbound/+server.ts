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

            // ADDED 'CONFIRM' to the opt-in list
            const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END'];
            const optInKeywords = ['START', 'UNSTOP', 'RESUME', 'CONFIRM']; 

            const cleanSenderPhone = senderPhone.replace(/\D/g, '');
            const last10Digits = cleanSenderPhone.slice(-10);

            if (last10Digits.length === 10) {
                const isOptOut = optOutKeywords.includes(messageBody);
                const isOptIn = optInKeywords.includes(messageBody);

                if (isOptOut || isOptIn) {
                    // Fetch users. If a random number texts, they won't be in this list.
                    const { data: users, error: fetchError } = await supabaseAdmin
                        .from('calendar_users')
                        .select('id, phone, confirmation_phone')
                        .not('phone', 'is', null);

                    if (fetchError || !users) {
                        console.error('Failed to fetch users:', fetchError);
                        return new Response('OK', { status: 200 });
                    }

                    const matchedUser = users.find(u => {
                        const cleanDbPhone = u.phone.replace(/\D/g, '');
                        return cleanDbPhone.endsWith(last10Digits);
                    });

                    // Only process if the user actually exists in your database
                    if (matchedUser) {
                        const newStatus = isOptIn ? true : false;
                        
                        // Prevent unnecessary database writes if they are already confirmed/unconfirmed
                        if (matchedUser.confirmation_phone !== newStatus) {
                            const { error: updateError } = await supabaseAdmin
                                .from('calendar_users')
                                .update({ confirmation_phone: newStatus })
                                .eq('id', matchedUser.id);

                            if (updateError) {
                                console.error('Failed to update user status in DB:', updateError);
                            } else {
                                console.log(`Successfully updated user ${matchedUser.id} to ${newStatus ? 'OPTED-IN' : 'OPTED-OUT'}`);
                            }
                        }
                    } else {
                        // A random number texted, so we ignore it completely.
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