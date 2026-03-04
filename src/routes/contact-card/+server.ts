import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    // Your long Supabase URL
    const supabaseVcfUrl = 'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/contact_card/Produkt%20Calendar.vcf';
    
    // 302 Redirect sends the user straight to the file to download it
    throw redirect(302, supabaseVcfUrl);
};