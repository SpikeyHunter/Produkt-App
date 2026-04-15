import { supabaseAdmin } from './supabaseAdmin';

export async function processTourDateGeocoding(dateId: string, addressString: string) {
    const { data: current } = await supabaseAdmin
        .from('ss_tour_dates')
        .select('address')
        .eq('id', dateId)
        .single();

    // Only geocode if needed
    if (current?.address?.full_address === addressString && current?.address?.lat) return;

    // Replace with your actual Geocoding API (e.g., Google or Mapbox)
    const response = await fetch(`https://api.geocoding-provider.com/search?q=${encodeURIComponent(addressString)}`);
    const geo = await response.json();

    const updatedAddress = {
        full_address: addressString,
        lat: geo.lat,
        lng: geo.lng,
        country_code: geo.country_code,
        formatted_address: geo.display_name,
        geocoded_at: new Date().toISOString()
    };

    await supabaseAdmin
        .from('ss_tour_dates')
        .update({ address: updatedAddress })
        .eq('id', dateId);
}