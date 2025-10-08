// src/lib/components/settings/AdvanceVariables.ts
// Centralized settings for advance sheet variables

export interface VenueSettings {
  city: string;
  venueAddress: string;
  artistEntrance:string;
}

export interface ContactPerson {
  name: string;
  phone: string;
  email: string;
}

export interface ContactSettings {
  talentBuyer: ContactPerson;
  production: ContactPerson;
  emergency: ContactPerson;
}
export interface GuestlistDefaults {
	ga: number;
	vip: number;
}

export const guestlistSettings: {
	[venue: string]: {
		[artistType: string]: GuestlistDefaults;
	};
} = {
	'Bazart': {
		'Local': { ga: 10, vip: 0 },
		'Support': { ga: 5, vip: 5 },
		'Headliner': { ga: 10, vip: 10 }
	},
	'New City Gas': {
		'Local': { ga: 5, vip: 0 },
		'Support': { ga: 5, vip: 5 },
		'Headliner': { ga: 10, vip: 10 }
	}
};

// Default venue settings
export const defaultVenueSettings: VenueSettings = {
  city: 'Montreal',
  venueAddress: '950 Ottawa Street',
  artistEntrance: '141 Ann Street'
};

// Contact information settings
export const contactSettings: ContactSettings = {
  talentBuyer: {
    name: 'Willis Daellenbach',
    phone: '416-500-8700',
    email: 'willis@produkt.ca'
  },
  production: {
    name: 'Janie Latendresse',
    phone: '514-889-6386',
    email: 'janie@produkt.ca'
  },
  emergency: {
    name: 'Alex K',
    phone: '514-242-1960',
    email: 'alexk@produkt.ca'
  }
};

// Day of Show contact mapping - maps DOS value from database to full contact info
export const dosContactMap: { [key: string]: ContactPerson } = {
  'Charles': {
    name: 'Charles Brousseau',
    phone: '514-805-9313',
    email: 'charles@produkt.ca'
  },
  'Olivia': {
    name: 'Olivia Nasr',
    phone: '514-991-1725',
    email: 'olivia@produkt.ca'
  },
  'Ziyaan': {
    name: 'Ziyaan Harji',
    phone: '778-323-1785',
    email: 'ziyaanh1995@gmail.com'
  },
  'Mezz': {
    name: 'Olivier Mezzari',
    phone: '514-941-0184',
    email: 'mezz@produkt.ca'
  }
};

// Driver contact mapping for ground transfers
export const driverContactMap: { [key: string]: string } = {
  'Eddy': '438-821-5937',
  'Reza': '438-985-7833',
  'Tarek': '438-969-3872',
  'Charles': '514-805-9313',
  'UBER': 'A Uber voucher link will be given to cover transportation'
};

// Vehicle information for ground transfers
export const vehicleInfo = 'Chevrolet Tahoe, Black SUV, FSN4714';

// **NEW**: Hotel address mapping
export const hotelAddressMap: { [key: string]: string } = {
  'W Hotel': '901 Rue du Square-Victoria, Montréal, QC H2Z 1J1',
  'Alt Hotel': '120 Peel St, Montreal, Quebec H3C 0L8',
  'Monville': '1041 Rue de Bleury, Montréal, QC H2Z 1M7'
};

// **NEW**: Production Contact mapping for custom settings
export const productionContactMap: { [key: string]: ContactPerson } = {
	'Janie': {
		name: 'Janie Latendresse',
		phone: '514-889-6386',
		email: 'janie@produkt.ca'
	},
	'Danny': {
		name: 'Danny Fréchette',
		phone: '514-207-6971',
		email: 'danny@produkt.ca'
	}
};

// You can add more settings here as needed
export const advanceSettings = {
  venue: defaultVenueSettings,
  contacts: contactSettings,
  dosContacts: dosContactMap,
  drivers: driverContactMap,
  vehicle: vehicleInfo,
  hotels: hotelAddressMap,
  guestlist: guestlistSettings,
  productionContacts: productionContactMap
};

// Helper function to format date to "3 October 2025" format
export function formatAdvanceDate(dateString: string): string {
  try {
    // Parse date parts directly to avoid timezone shifts
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    return `${day} ${monthName} ${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
}