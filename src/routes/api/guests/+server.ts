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
	ssid?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const guestData: GuestData = await request.json();
		
		console.log("Received payload:", guestData); // Server-side log

		// 1. Validation
		if (!guestData.firstName || !guestData.lastName || !guestData.email) {
			return json({ error: 'Missing required fields (Name or Email)' }, { status: 400 });
		}
		
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(guestData.email)) {
			return json({ error: 'Invalid email format' }, { status: 400 });
		}
		
		// 2. Map WiFi Name
		let networkName = 'Unknown';
		const ssid = (guestData.ssid || '').trim();

		if (ssid === 'NCG Corpo Wifi') {
			networkName = 'Corpo';
		} else if (ssid === 'NCG Wifi') {
			networkName = 'NCG';
		} else if (ssid.length > 0) {
			networkName = ssid;
		}

		// 3. Clean phone
		const cleanPhone = guestData.phone.replace(/[\s\-\(\)]/g, '');
		
		// 4. Insert into Supabase
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
					network_name: networkName,
					ip_address: request.headers.get('x-forwarded-for') || 'unknown'
				}
			])
			.select();
		
		if (error) {
			console.error('Supabase error:', error);
			if (error.code === '23505') {
				return json({ message: 'Welcome back (Email exists)' }, { status: 409 }); 
			}
			// Return the ACTUAL database error to the frontend for debugging
			return json({ error: `DB Error: ${error.message}` }, { status: 500 });
		}
		
		return json({ success: true, id: data?.[0]?.id });
		
	} catch (error: any) {
		console.error('Registration error:', error);
		// Return the ACTUAL server error
		return json({ error: `Server Error: ${error.message || 'Unknown'}` }, { status: 500 });
	}
};