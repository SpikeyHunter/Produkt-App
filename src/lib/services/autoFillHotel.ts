// lib/services/autoFillHotel.ts

export interface Role {
	id: string;
	firstName: string;
	lastName: string;
	role: string;
	customRole: string;
	immigration: boolean;
	showDropdown: boolean;
}

export interface Flight {
	id: number;
	to: string;
	date: string;
	from: string;
	time: string;
	flightNumber: string;
	assignedRoles: string[];
	timeAtAirport?: string;
	hoursBeforeDeparture?: number;
}

export interface GroundInfo {
	arrivals: Flight[];
	departures: Flight[];
}

export interface HotelRoom {
	id: string;
	reservationFirstName: string;
	reservationLastName: string;
	hotelName: string;
	customHotelName: string;
	customHotelAddress: string;
	roomType: string;
	checkInDate: string;
	checkInTime: string;
	checkOutDate: string;
	checkOutTime: string;
	notes: string;
	requestEarlyCheckIn: boolean;
	earlyCheckInTime: string;
	requestLateCheckOut: boolean;
	lateCheckOutTime: string;
	isPaidByUs: boolean;
	confirmationNumber: string;
}

export function autoFillHotel(roles: Role[], groundInfo: GroundInfo | null, eventDate?: string): HotelRoom[] {
	if (!roles || roles.length === 0) {
		return [];
	}

	const rooms: HotelRoom[] = [];

	// Create a room for each role
	roles.forEach((role) => {
		const fullName = `${role.firstName} ${role.lastName}`;
		
		// Find flights for this person
		const personArrival = findPersonFlight(fullName, groundInfo?.arrivals || []);
		const personDeparture = findPersonFlight(fullName, groundInfo?.departures || []);

		// Calculate check-in details
		const checkInDetails = calculateCheckIn(personArrival, eventDate);
		
		// Calculate check-out details
		const checkOutDetails = calculateCheckOut(personDeparture, eventDate);

		const room: HotelRoom = {
			id: crypto.randomUUID(),
			reservationFirstName: role.firstName,
			reservationLastName: role.lastName,
			hotelName: 'Monville',
			customHotelName: '',
			customHotelAddress: '',
			roomType: 'Standard',
			checkInDate: checkInDetails.date,
			checkInTime: checkInDetails.time,
			checkOutDate: checkOutDetails.date,
			checkOutTime: checkOutDetails.time,
			notes: '',
			requestEarlyCheckIn: checkInDetails.requestEarly,
			earlyCheckInTime: checkInDetails.earlyTime,
			requestLateCheckOut: checkOutDetails.requestLate,
			lateCheckOutTime: checkOutDetails.lateTime,
			isPaidByUs: true,
			confirmationNumber: '' // Added confirmation number field
		};

		rooms.push(room);
	});

	return rooms;
}

function findPersonFlight(personName: string, flights: Flight[]): Flight | null {
	return flights.find(flight => 
		flight.assignedRoles.includes(personName)
	) || null;
}

function calculateCheckIn(arrival: Flight | null, eventDate?: string): {
	date: string;
	time: string;
	requestEarly: boolean;
	earlyTime: string;
} {
	if (!arrival) {
		// Default to event date at 4:00 PM if no arrival info, fallback to today if no event date
		const defaultDate = eventDate || new Date().toISOString().split('T')[0];
		return {
			date: defaultDate,
			time: '16:00',
			requestEarly: false,
			earlyTime: '11:00'
		};
	}

	// Parse arrival time and add 30 minutes
	const arrivalTime = new Date(arrival.time);
	const checkInTime = new Date(arrivalTime.getTime() + 30 * 60 * 1000); // Add 30 minutes
	
	// Round to nearest 15-minute interval
	const roundedCheckInTime = roundToNearestQuarter(checkInTime);
	
	const checkInHour = roundedCheckInTime.getHours();
	const checkInMinute = roundedCheckInTime.getMinutes();
	const timeString = `${checkInHour.toString().padStart(2, '0')}:${checkInMinute.toString().padStart(2, '0')}`;
	
	// Check if before 4 PM (16:00)
	const isBefore4PM = checkInHour < 16;
	
	return {
		date: arrival.date,
		time: isBefore4PM ? '16:00' : timeString, // Use standard 4 PM if early, otherwise calculated time
		requestEarly: isBefore4PM,
		earlyTime: isBefore4PM ? timeString : '11:00'
	};
}

function calculateCheckOut(departure: Flight | null, eventDate?: string): {
	date: string;
	time: string;
	requestLate: boolean;
	lateTime: string;
} {
	if (!departure) {
		// Default to event date + 1 day at 12:00 PM if no departure info, fallback to tomorrow if no event date
		let checkoutDate: string;
		if (eventDate) {
			const eventDateObj = new Date(eventDate);
			eventDateObj.setDate(eventDateObj.getDate() + 1);
			checkoutDate = eventDateObj.toISOString().split('T')[0];
		} else {
			const tomorrow = new Date();
			tomorrow.setDate(tomorrow.getDate() + 1);
			checkoutDate = tomorrow.toISOString().split('T')[0];
		}
		
		return {
			date: checkoutDate,
			time: '12:00',
			requestLate: false,
			lateTime: '14:00'
		};
	}

	// Parse departure time
	const departureTime = new Date(departure.time);
	
	// Calculate checkout time: departure - hoursBeforeDeparture - 30min
	const hoursBeforeDeparture = departure.hoursBeforeDeparture || 2; // Default to 2 hours
	const totalMinutesEarly = (hoursBeforeDeparture * 60) + 30; // Convert hours to minutes and add 30
	const checkOutTime = new Date(departureTime.getTime() - totalMinutesEarly * 60 * 1000);
	
	// Round to nearest 15-minute interval
	const roundedCheckOutTime = roundToNearestQuarter(checkOutTime);
	
	const checkOutHour = roundedCheckOutTime.getHours();
	const checkOutMinute = roundedCheckOutTime.getMinutes();
	const timeString = `${checkOutHour.toString().padStart(2, '0')}:${checkOutMinute.toString().padStart(2, '0')}`;
	
	// Check if after 12 PM (12:00) - if calculated time is after standard checkout
	const isAfter12PM = checkOutHour > 12 || (checkOutHour === 12 && checkOutMinute > 0);
	
	return {
		date: departure.date,
		time: timeString, // Always use the calculated time
		requestLate: isAfter12PM,
		lateTime: isAfter12PM ? timeString : '14:00'
	};
}

function roundToNearestQuarter(date: Date): Date {
	const minutes = date.getMinutes();
	let roundedMinutes: number;
	
	if (minutes <= 7) {
		roundedMinutes = 0;
	} else if (minutes <= 22) {
		roundedMinutes = 15;
	} else if (minutes <= 37) {
		roundedMinutes = 30;
	} else if (minutes <= 52) {
		roundedMinutes = 45;
	} else {
		// Round up to next hour
		const newDate = new Date(date);
		newDate.setHours(date.getHours() + 1);
		newDate.setMinutes(0);
		return newDate;
	}
	
	const newDate = new Date(date);
	newDate.setMinutes(roundedMinutes);
	newDate.setSeconds(0);
	newDate.setMilliseconds(0);
	return newDate;
}