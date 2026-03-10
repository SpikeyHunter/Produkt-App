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

function formatDateString(dates: string[]) {
    if (!dates || dates.length === 0) return 'TBD';
    const sorted = [...dates].sort();
    if (sorted.length === 1) {
        return new Date(sorted[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const first = new Date(sorted[0] + 'T00:00:00');
    const last = new Date(sorted[sorted.length - 1] + 'T00:00:00');
    return `${first.toLocaleDateString('en-US', {month: 'short', day:'numeric'})} - ${last.toLocaleDateString('en-US', {month: 'short', day:'numeric', year:'numeric'})}`;
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { eventId, eventTitle, oldDates, newDates, oldType, newType, venueName, authUserName } = await request.json();

        const { data: users, error } = await supabaseAdmin
            .from('calendar_users')
            .select('phone, name')
            .eq('confirmation_phone', true)
            .not('phone', 'is', null)
            .neq('phone', '');

        if (error || !users || users.length === 0) {
            return json({ success: true, message: 'No users to SMS' });
        }

        const { data: configData } = await supabaseAdmin
            .from('calendar_settings')
            .select('setting_params')
            .eq('setting_type', 'CONFIG')
            .eq('setting_name', 'AWS_SNS')
            .maybeSingle();

        const originationNumber = configData?.setting_params?.originationNumber || '+17824923543';

        const hasDateChange = JSON.stringify([...(oldDates||[])].sort()) !== JSON.stringify([...(newDates||[])].sort());
        const hasTypeChange = oldType !== newType && oldType !== '' && newType !== '';

        let changesText = '';
        if (hasDateChange) {
            changesText += `\n${formatDateString(oldDates)} ➡️ ${formatDateString(newDates)}`;
        }
        if (hasTypeChange) {
            changesText += `\n${oldType} ➡️ ${newType}`;
        }

        const headerText = `✏️ 𝗘𝘃𝗲𝗻𝘁 𝗠𝗼𝗱𝗶𝗳𝗶𝗲𝗱!`;
        const finalType = newType || oldType; 
        
        // Prevent empty bracket display
        const typeDisplay = finalType && finalType !== 'Select Type' ? ` - [${finalType}]` : '';
        const venueDisplay = venueName ? `\n📍 ${venueName}` : '';
        
        let message = `${headerText}\n\n${eventTitle}${typeDisplay}${venueDisplay}\n\nUpdated by ${authUserName}\n${changesText}\n\nhttps://app.produkt.ca/calendar/${eventId}\n\nReply STOP to unsubscribe`;

        for (const user of users) {
            if (!user.phone) continue;

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