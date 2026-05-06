import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import { env as privateEnv } from '$env/dynamic/private';

const sesClient = new SESClient({
    region: privateEnv.AWS_REGION as string,
    credentials: {
        accessKeyId: privateEnv.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: privateEnv.AWS_SECRET_ACCESS_KEY as string
    }
});

const transporter = nodemailer.createTransport({
    streamTransport: true,
    buffer: true
});

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { users, message, subject } = await request.json();

        if (!users || !Array.isArray(users) || !message) {
            return json({ success: false, message: 'Invalid payload' }, { status: 400 });
        }

        const currentYear = new Date().getFullYear();
        const emailSubject = subject || 'Message from Produkt App';

        for (const user of users) {
            if (!user.email) continue; 

            // 1. Variable Replacement
            const personalizedText = message
                .replace(/<name>/gi, user.name || '')
                .replace(/<email>/gi, user.email || '')
                .replace(/<phone>/gi, user.phone || '');

            // 2. Plain Text Version (Strip custom syntax down to just the URL)
            const plainTextBody = personalizedText.replace(/<(.*?)\s+\[alt=(.*?)\]>/gi, '$1');

            // 3. HTML Version
            // First safely escape standard HTML to prevent injection
            let safeHtmlText = personalizedText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/\n/g, "<br>");

            // Then parse the custom button syntax which is now safely encoded as &lt;URL [alt=TEXT]&gt;
            // Replaces it with the styled HTML button.
            safeHtmlText = safeHtmlText.replace(
                /&lt;(.*?)\s+\[alt=(.*?)\]&gt;/gi, 
                '<br><br><a href="$1" style="display: inline-block; background-color: #E1FF00; color: #000000 !important; text-decoration: none; padding: 16px 36px; border-radius: 50px; font-weight: 700; font-size: 15px; margin: 10px 0; letter-spacing: -0.02em;">$2</a><br><br>'
            );

            const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: 'Helvetica Neue', -apple-system, sans-serif; background-color: #FFFFFF; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #FFFFFF; }
        .header { background-color: #FFFFFF; padding: 40px 30px; text-align: center; border-bottom: 2px solid #E4E4E4; }
        .logo { max-width: 200px; height: auto; }
        .content { padding: 40px 30px; text-align: left; background-color: #FFFFFF; color: #2F2F2F; line-height: 1.6; font-size: 16px; font-weight: 500; }
        .footer { background-color: #F8F8F8; padding: 30px; text-align: center; font-size: 14px; color: #BDBDBB; font-weight: 700; }
        @media (prefers-color-scheme: dark) {
            body, .container, .header, .content, .footer { background-color: #212121 !important; }
            .header { border-bottom: 1px solid #333333 !important; }
            .logo { filter: brightness(0) invert(1) !important; }
            .content { color: #FFFFFF !important; }
            .footer { color: #E4E4E4 !important; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/NCG_ProduktXX_NOIR.png" alt="ProduktXX" class="logo">
        </div>
        <div class="content">
            ${safeHtmlText}
        </div>
        <div class="footer">
            <p>Copyrights © ${currentYear} Produkt. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

            const mailOptions: any = {
                from: `"Produkt App" <support@produkt.ca>`,
                to: user.email,
                subject: emailSubject,
                text: plainTextBody,
                html: htmlTemplate
            };

            try {
                const info = await transporter.sendMail(mailOptions);
                const rawEmailBuffer = info.message as Buffer;

                const command = new SendRawEmailCommand({
                    RawMessage: {
                        Data: rawEmailBuffer
                    }
                });

                await sesClient.send(command);
            } catch (emailError) {
                console.error(`Failed to send email to ${user.email}:`, emailError);
            }
        }

        return json({ success: true, message: 'Bulk email processing completed' });
    } catch (error) {
        console.error('Error in bulk email route:', error);
        return json({ success: false, message: 'Failed to process bulk email request' }, { status: 500 });
    }
};