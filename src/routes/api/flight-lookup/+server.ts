import { json } from '@sveltejs/kit';
import { AMADEUS_API_KEY, AMADEUS_API_SECRET } from '$env/static/private';

const AMADEUS_TOKEN_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
const AMADEUS_FLIGHT_API_URL = 'https://test.api.amadeus.com/v2/schedule/flights';

let token = {
	value: '',
	expires: 0
};

async function getAmadeusToken() {
	if (token.value && Date.now() < token.expires) {
		return token.value;
	}
	const response = await fetch(AMADEUS_TOKEN_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: `grant_type=client_credentials&client_id=${AMADEUS_API_KEY}&client_secret=${AMADEUS_API_SECRET}`
	});
	if (!response.ok) {
		throw new Error('Failed to authenticate with Amadeus');
	}
	const data = await response.json();
	token = {
		value: data.access_token,
		expires: Date.now() + (data.expires_in - 1) * 1000
	};
	return token.value;
}

export async function GET({ url }) {
	const flightNumberParam = url.searchParams.get('flightNumber');
	const date = url.searchParams.get('date');

	if (!flightNumberParam || !date) {
		return json({ error: 'Flight number and date are required' }, { status: 400 });
	}

	const carrierCode = flightNumberParam.substring(0, 2);
	const flightNumber = flightNumberParam.substring(2);

	try {
		const accessToken = await getAmadeusToken();
		const apiUrl = `${AMADEUS_FLIGHT_API_URL}?carrierCode=${carrierCode}&flightNumber=${flightNumber}&scheduledDepartureDate=${date}`;
		const apiResponse = await fetch(apiUrl, {
			headers: { Authorization: `Bearer ${accessToken}` }
		});

		if (!apiResponse.ok) {
			return json({ error: 'Flight not found for the specified date.' }, { status: 404 });
		}

		const data = await apiResponse.json();

		if (!data.data || data.data.length === 0) {
			return json({ error: 'Flight not found for the specified date.' }, { status: 404 });
		}

		const flight = data.data[0];

		if (flight.flightPoints && flight.flightPoints.length >= 2 && flight.flightDesignator) {
			const departurePoint = flight.flightPoints[0];
			const arrivalPoint = flight.flightPoints[1];

			// FINAL FIX: Use the correct path to the full date-time string from the 'timings' array.
			const departureTime = departurePoint.departure.timings[0].value;
			const arrivalTime = arrivalPoint.arrival.timings[0].value;

			const flightDetails = {
				flightNumber: `${flight.flightDesignator.carrierCode}${flight.flightDesignator.flightNumber}`,
				from: departurePoint.iataCode,
				to: arrivalPoint.iataCode,
				departureTime: departureTime,
				arrivalTime: arrivalTime
			};

			return json(flightDetails);
		} else {
			console.warn('Amadeus returned a flight with an unknown structure:', flight);
			return json({ error: 'Flight data is in an unexpected format.' }, { status: 404 });
		}
	} catch (error) {
		console.error('API call failed:', (error as Error).message);
		return json({ error: 'Failed to fetch flight data from the provider.' }, { status: 500 });
	}
}