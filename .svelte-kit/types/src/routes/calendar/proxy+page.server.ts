// @ts-nocheck
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { supabase } from '$lib/supabase'; 

export const actions = {
	add_member: async ({ request }: import('./$types').RequestEvent) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const job = formData.get('job') as string;
		const role = formData.get('role') as string;
		const phone = formData.get('phone') as string;
		const confirmation_email = formData.get('confirmation_email') === 'true';
		const password = formData.get('password') as string || 'Produkt2026$';

		if (!name || !email || !job || !role) {
			return fail(400, { error: 'Missing required fields' });
		}

		const { error } = await supabase
			.from('calendar_users')
			.insert([{ 
				name, 
				email, 
				job, 
				role, 
				phone, 
				confirmation_email,
				password, 
				has_default_password: password === 'Produkt2026$'
			}]);

		if (error) {
			console.error("SUPABASE INSERT ERROR:", error);
			return fail(500, { error: error.message });
		}
		return { success: true };
	},

	update_member: async ({ request }: import('./$types').RequestEvent) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const name = formData.get('name') as string;
		const email = formData.get('email') as string;
		const job = formData.get('job') as string;
		const role = formData.get('role') as string;
		const phone = formData.get('phone') as string;
		const confirmation_email = formData.get('confirmation_email') === 'true';
		const reset_password = formData.get('reset_password') === 'true';

		const updates: any = { name, email, job, role, phone, confirmation_email };

		if (reset_password) {
			updates.password = 'Produkt2026$';
			updates.has_default_password = true;
		}

		const { error } = await supabase
			.from('calendar_users')
			.update(updates)
			.eq('id', id);

		if (error) {
			console.error("SUPABASE UPDATE ERROR:", error);
			return fail(500, { error: error.message });
		}
		return { success: true };
	},

	delete_member: async ({ request }: import('./$types').RequestEvent) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		const { error } = await supabase
			.from('calendar_users')
			.delete()
			.eq('id', id);

		if (error) {
			console.error("SUPABASE DELETE ERROR:", error);
			return fail(500, { error: error.message });
		}
		return { success: true };
	}
};;null as any as Actions;