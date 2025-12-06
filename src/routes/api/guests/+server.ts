// FILE: src/routes/api/guest/+server.ts
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabase';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
    console.log("🚀 Registration API called (New Version)");

    try {
        const body = await request.json();
        
        // 1. SAFE DATA EXTRACTION (This prevents the crash)
        // We use || '' to ensure we never check .length on undefined
        const firstName = body.first_name || body.firstName || '';
        const lastName = body.last_name || body.lastName || '';
        const email = body.email || '';
        const rawPhone = body.phone || '';
        const phone = rawPhone.trim().length > 0 ? rawPhone : null;
        
        console.log(`📝 Registration attempt for: ${email}`);

        // 2. Validate using the safe variables
        if (!firstName || !lastName || !email) {
            console.error("❌ Missing required fields");
            return json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // 3. Get IP Address
        let clientIp = request.headers.get('x-forwarded-for') || getClientAddress();
        if (clientIp && clientIp.includes(',')) {
            clientIp = clientIp.split(',')[0].trim();
        }

        // 4. Determine Network Name
        let netName = 'NCG'; // Default fallback
        const ssid = body.ssid || ''; // Safe extraction prevents undefined errors

        if (ssid === 'NCG-Corpo-Wifi') {
            netName = 'CORPO';
        } else if (ssid === 'NCG-Wifi') {
            netName = 'NCG';
        }

        // 5. Insert into Supabase
        const { error } = await supabase
            .from('wifi_guests') 
            .insert({
                first_name: firstName,
                last_name: lastName,
                email: email,
                phone: phone,
                network_name: netName,
                redirect_url: body.redirect_url,
                ip_address: clientIp,
                tos_accepted: body.tos_accepted || false,
                marketing_consent: body.marketing_consent || false,
                registered_at: new Date().toISOString()
            });

        if (error) {
            console.error('💥 Supabase Error:', error);
            return json({ success: true, saved: false, error: error.message });
        }

        console.log('✅ Data saved successfully');
        return json({ success: true, saved: true });

    } catch (err: any) {
        console.error('💥 Unexpected Server Error:', err);
        return json({ success: true, saved: false, error: err.message });
    }
};