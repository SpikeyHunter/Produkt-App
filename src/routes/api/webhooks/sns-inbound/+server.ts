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

            const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END'];
            const optInKeywords = ['START', 'UNSTOP', 'RESUME'];

            // Clean the incoming AWS phone number to extract the core 10 digits
            const cleanSenderPhone = senderPhone.replace(/\D/g, '');
            const last10Digits = cleanSenderPhone.slice(-10);

            if (last10Digits.length === 10) {
                // Determine if this is an opt-out or opt-in
                const isOptOut = optOutKeywords.includes(messageBody);
                const isOptIn = optInKeywords.includes(messageBody);

                if (isOptOut || isOptIn) {
                    // Fetch all users with a phone number to do a clean JS match
                    const { data: users, error: fetchError } = await supabaseAdmin
                        .from('calendar_users')
                        .select('id, phone')
                        .not('phone', 'is', null);

                    if (fetchError || !users) {
                        console.error('Failed to fetch users:', fetchError);
                        return new Response('OK', { status: 200 });
                    }

                    // Find the matching user by stripping formatting from the DB phone numbers
                    const matchedUser = users.find(u => {
                        const cleanDbPhone = u.phone.replace(/\D/g, '');
                        return cleanDbPhone.endsWith(last10Digits);
                    });

                    if (matchedUser) {
                        const newStatus = isOptIn ? true : false;
                        
                        // Update the specific user by ID
                        const { error: updateError } = await supabaseAdmin
                            .from('calendar_users')
                            .update({ confirmation_phone: newStatus })
                            .eq('id', matchedUser.id);

                        if (updateError) {
                            console.error('Failed to update user status in DB:', updateError);
                        } else {
                            console.log(`Successfully updated user ${matchedUser.id} to ${newStatus ? 'OPTED-IN' : 'OPTED-OUT'}`);
                        }
                    } else {
                        console.log(`No user found in DB matching phone ending in ${last10Digits}`);
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