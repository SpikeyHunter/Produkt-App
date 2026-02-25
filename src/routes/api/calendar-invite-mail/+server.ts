import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

// Initialize the native AWS SES Client directly
const sesClient = new SESClient({
	region: env.AWS_REGION as string,
	credentials: {
		accessKeyId: env.AWS_ACCESS_KEY_ID as string,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY as string,
	}
});

// Nodemailer acts as our MIME/HTML builder
const transporter = nodemailer.createTransport({
	streamTransport: true,
	buffer: true
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { email, name } = await request.json();

		if (!email) {
			return json({ success: false, message: 'Email is required' }, { status: 400 });
		}

		const currentYear = new Date().getFullYear();
		const loginUrl = 'https://app.produkt.ca/calendar';
		const defaultPassword = 'Produkt2026$';

		const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>You've been invited to join Produkt Calendar</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Helvetica+Neue:wght@700&display=swap');
        
        :root {
            color-scheme: light dark;
            supported-color-schemes: light dark;
        }

        body, table, td, p, a, li, blockquote {
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }
        table, td {
            mso-table-lspace: 0pt;
            mso-table-rspace: 0pt;
        }
        img {
            -ms-interpolation-mode: bicubic;
            border: 0;
            height: auto;
            line-height: 100%;
            outline: none;
            text-decoration: none;
        }
        
        body {
            background-color: #FFFFFF;
            margin: 0 !important;
            padding: 0 !important;
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
            font-weight: 700;
            letter-spacing: -0.03em;
        }
        
        * {
            font-family: 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif;
            font-weight: 700;
            letter-spacing: -0.03em;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #FFFFFF;
        }
        
        .header {
            background-color: #FFFFFF;
            padding: 40px 30px 20px 30px;
            text-align: center;
            border-bottom: 2px solid #E4E4E4;
        }
        
        .logo {
            max-width: 200px;
            height: auto;
        }
        
        .content {
            padding: 50px 30px;
            text-align: center;
            background-color: #FFFFFF;
        }
        
        .welcome-title {
            color: #2F2F2F;
            font-size: 32px;
            font-weight: 700;
            margin: 0 0 16px 0;
            line-height: 1.2;
            letter-spacing: -0.03em;
        }
        
        .welcome-subtitle {
            color: #BDBDBB;
            font-size: 18px;
            font-weight: 700;
            margin: 0 0 40px 0;
            line-height: 1.4;
            letter-spacing: -0.03em;
        }
        
        .verification-box {
            background-color: #FFFFFF;
            border: 3px solid #E4E4E4;
            border-radius: 24px;
            padding: 40px 30px;
            margin: 30px 0;
        }
        
        .verification-text {
            color: #2F2F2F;
            font-size: 16px;
            font-weight: 700;
            margin: 0 0 15px 0;
            line-height: 1.5;
            letter-spacing: -0.03em;
        }

        .password-box {
            display: inline-block;
            background-color: #2F2F2F;
            color: #E1FF00;
            padding: 10px 20px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 18px;
            letter-spacing: 0.1em;
            margin-bottom: 30px;
        }
        
        .verify-button {
            display: inline-block;
            background-color: #E1FF00;
            color: #000000 !important;
            text-decoration: none;
            padding: 18px 36px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 16px;
            letter-spacing: -0.03em;
            transition: all 0.2s ease;
            border: none;
            cursor: pointer;
        }
        
        .security-notice {
            background-color: #E4E4E4;
            padding: 25px;
            margin: 30px 0;
            border-radius: 16px;
            border-left: 4px solid #E1FF00;
        }
        
        .security-text {
            color: #2F2F2F;
            font-size: 14px;
            font-weight: 700;
            margin: 0;
            line-height: 1.5;
            letter-spacing: -0.03em;
        }
        
        .alternative-link {
            color: #BDBDBB;
            font-size: 14px;
            font-weight: 700;
            margin-top: 30px;
            letter-spacing: -0.03em;
        }
        
        .alternative-link a {
            color: #2F2F2F;
            text-decoration: underline;
            word-break: break-all;
        }
        
        .footer {
            background-color: #F8F8F8;
            padding: 30px;
            text-align: center;
        }
        
        .footer-text {
            color: #BDBDBB;
            font-size: 14px;
            font-weight: 700;
            margin: 0 0 10px 0;
            line-height: 1.5;
            letter-spacing: -0.03em;
        }
        
        .footer-link {
            color: #2F2F2F;
            text-decoration: none;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
            }
            .header, .content, .footer {
                padding: 30px 20px !important;
            }
            .welcome-title {
                font-size: 28px !important;
            }
            .welcome-subtitle {
                font-size: 16px !important;
            }
            .verification-box {
                padding: 30px 20px !important;
                margin: 20px 0 !important;
            }
            .verify-button {
                padding: 16px 32px !important;
                font-size: 15px !important;
            }
        }

        /* --- TARGETED DARK MODE FIXES --- */
        @media (prefers-color-scheme: dark) {
            body, .email-container, .header, .content, .footer {
                background-color: #212121 !important; /* Forces gray1/navbar background */
            }
            .header {
                border-bottom: 1px solid #333333 !important;
            }
            .logo {
                filter: brightness(0) invert(1) !important; /* Forces logo to pure white */
            }
            .welcome-title, .verification-text, .security-text {
                color: #FFFFFF !important; /* Forces main text to white */
            }
            .verification-box {
                background-color: #212121 !important;
                border: 3px solid #333333 !important;
            }
            .security-notice {
                background-color: #2F2F2F !important;
                border-left: 4px solid #E1FF00 !important;
            }
            .password-box {
                background-color: #1a1a1a !important; /* Darker gray for code box */
            }
            .verify-button, .verify-button span {
                color: #000000 !important; /* Forces button text to black */
                background-color: #E1FF00 !important;
            }
            .footer-text, .footer-text span {
                color: #E4E4E4 !important; /* gray3 */
            }
            .footer-link, .footer-link span, .alternative-link a {
                color: #E1FF00 !important; /* Forces links to lime */
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <img src="https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/ProduktXX_LOGO2.png" alt="ProduktXX" class="logo">
        </div>
        
        <div class="content">
            <h1 class="welcome-title">Hi ${name},</h1>
            <p class="welcome-subtitle">You've been invited to join the Produkt Calendar</p>
            
            <div class="verification-box">
                <p class="verification-text">
                    Please sign in using your temporary password below. You'll be asked to configure your own password after logging in.
                </p>
                
                <div class="password-box">
                    ${defaultPassword}
                </div>
                <br>
                
                <a href="${loginUrl}" class="verify-button">
                    <span>Access Calendar</span>
                </a>
            </div>
            
            <div class="security-notice">
                <p class="security-text">
                    For your security, please do not share this temporary password with anyone. 
                </p>
            </div>
            
            <p class="alternative-link">
                Can't click the button? Copy and paste this link into your browser:<br>
                <a href="${loginUrl}">${loginUrl}</a>
            </p>
        </div>
        
        <div class="footer">
            <p class="footer-text">
                <span>If you have any questions, contact us at </span><a href="mailto:support@produkt.ca" class="footer-link"><span>support@produkt.ca</span></a>
            </p>
            <p class="footer-text">
                <span>Copyrights © ${currentYear} Produkt. All rights reserved.</span>
            </p>
        </div>
    </div>
</body>
</html>`;

		const mailOptions: any = {
			from: `"Produkt App" <support@produkt.ca>`,
			to: email,
			subject: `Produkt Calendar - Accept your invitation`,
			text: `Hi ${name},\n\nYou've been invited to join the Produkt Calendar.\n\nSign in with this temporary password: ${defaultPassword}\n\nYou'll be asked to configure yours after.\n\nLogin here: ${loginUrl}`,
			html: htmlTemplate
		};

		const info = await transporter.sendMail(mailOptions);
		const rawEmailBuffer = info.message as Buffer;

		const command = new SendRawEmailCommand({
			RawMessage: {
				Data: rawEmailBuffer 
			}
		});

		await sesClient.send(command);

		return json({ success: true, message: 'Invite sent successfully' });

	} catch (error) {
		console.error('Error sending invite:', error);
		return json({ success: false, message: 'Failed to send invite' }, { status: 500 });
	}
};