export interface SSTour {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    description: string;
    maps_info?: string;
    year: number; 
}

export interface SSTourDateAddress {
    full_address: string;
    city: string;
    country: string;
    lat: number;
    lng: number;
    country_code: string;
}

export interface SSTourDate {
    id: string;
    tour_id: string;
    date: string;
    venue: string;
    address: SSTourDateAddress;
}