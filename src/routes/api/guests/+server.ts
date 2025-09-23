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
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const guestData: GuestData = await request.json();
		
		// Validate required fields
		if (!guestData.firstName || !guestData.lastName || !guestData.email || !guestData.phone) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}
		
		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(guestData.email)) {
			return json({ error: 'Invalid email format' }, { status: 400 });
		}
		
		// Clean phone number (remove formatting)
		const cleanPhone = guestData.phone.replace(/[\s\-\(\)]/g, '');
		
		// Save to Supabase
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
					ip_address: request.headers.get('x-forwarded-for') || 
					           request.headers.get('x-real-ip') || 
					           'unknown'
				}
			])
			.select();
		
		if (error) {
			console.error('Supabase error:', error);
			
			// Handle duplicate email
			if (error.code === '23505' && error.message.includes('email')) {
				return json({ error: 'Email already registered' }, { status: 409 });
			}
			
			return json({ error: 'Database error occurred' }, { status: 500 });
		}
		
		console.log('Guest registered successfully:', data);
		
		return json({ 
			success: true, 
			message: 'Guest registered successfully',
			id: data[0]?.id 
		});
		
	} catch (error) {
		console.error('Registration error:', error);
		return json({ error: 'Registration failed' }, { status: 500 });
	}
};