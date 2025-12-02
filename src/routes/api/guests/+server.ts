import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase.js';

interface GuestData {
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
	timestamp: string;
	redirectUrl?: string;
	ssid?: string; // We now expect this from the frontend
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const guestData: GuestData = await request.json();
		
		// 1. Validation
		if (!guestData.firstName || !guestData.lastName || !guestData.email) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}
		
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(guestData.email)) {
			return json({ error: 'Invalid email format' }, { status: 400 });
		}
		
		// 2. Map WiFi Name (SSID) to Network Column
		// Logic: "NCG Wifi" > NCG, "NCG Corpo Wifi" > Corpo
		let networkName = 'Unknown';
		const ssid = (guestData.ssid || '').trim();

		if (ssid === 'NCG Corpo Wifi') {
			networkName = 'Corpo';
		} else if (ssid === 'NCG Wifi') {
			networkName = 'NCG';
		} else if (ssid.length > 0) {
			networkName = ssid; // Fallback to storing the raw name if it doesn't match
		}

		// 3. Clean phone
		const cleanPhone = guestData.phone.replace(/[\s\-\(\)]/g, '');
		
		// 4. Insert into Supabase
		// We use the anon key here, so the SQL RLS policy MUST allow public inserts.
		const { data, error } = await supabase
			.from('wifi_guests')
			.insert([
				{
					first_name: guestData.firstName.trim(),
					last_name: guestData.lastName.trim(),
					email: guestData.email.toLowerCase().trim(),
					phone: cleanPhone,
					registered_at: guestData.timestamp,
					redirect_url: guestData.redirectUrl,
					network_name: networkName, // <--- New Mapped Column
					ip_address: request.headers.get('x-forwarded-for') || 'unknown'
				}
			])
			.select();
		
		if (error) {
			console.error('Supabase error:', error);
			// If email exists, we still want to return success to the user so they get redirected
			if (error.code === '23505') {
				return json({ message: 'Welcome back' }, { status: 409 }); 
			}
			return json({ error: 'Database error' }, { status: 500 });
		}
		
		return json({ success: true, id: data?.[0]?.id });
		
	} catch (error) {
		console.error('Registration error:', error);
		return json({ error: 'Registration failed' }, { status: 500 });
	}
};