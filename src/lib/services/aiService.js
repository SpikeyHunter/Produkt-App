import { PUBLIC_OPENAI_API_KEY } from '$env/static/public';
import { GENRE_OPTIONS } from '$lib/services/constants.js';

/**
 * Suggests an event genre based on the event name using the OpenAI API.
 * @param {string} eventName - The name of the event.
 * @param {string} eventVenue - The venue of the event (optional).
 * @returns {Promise<string>} The suggested genre from the predefined list.
 */
export async function suggestGenre(eventName, eventVenue = '') {
	if (!PUBLIC_OPENAI_API_KEY) {
		throw new Error('OpenAI API key is not configured.');
	}

	// Filter out 'Other' from the list - we should NEVER return 'Other'
	const validGenres = GENRE_OPTIONS.filter(g => g !== 'Other');

	const prompt = `Based on the event name "${eventName}", classify it into exactly one of the following music genres: ${validGenres.join(
		', '
	)}. Respond with only the single, most appropriate genre name from this list. Choose the closest match even if it's not perfect. Do not respond with "Other" or any genre not in this list.`;

	try {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${PUBLIC_OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: 'gpt-3.5-turbo',
				messages: [{ role: 'user', content: prompt }],
				temperature: 0,
				max_tokens: 15
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error('OpenAI API Error:', errorData);
			throw new Error('Failed to get suggestion from AI.');
		}

		const data = await response.json();
		const suggestion = data.choices[0].message.content.trim();

		// Validate that the suggestion is in our valid genres list (excluding 'Other')
		if (validGenres.includes(suggestion)) {
			return suggestion;
		} else {
			// If AI returns something unexpected, use venue-based defaults
			console.warn(`AI returned unexpected genre: "${suggestion}". Using venue-based default.`);
			
			// Venue-based defaults
			if (eventVenue === 'Bazart') {
				return 'House';
			} else if (eventVenue === 'New City Gas') {
				return 'Electronic'; // Note: 'EDM' is not in your genre list, using 'Electronic'
			} else {
				return 'Electronic'; // Default for other venues
			}
		}
	} catch (error) {
		console.error('Error suggesting genre:', error);
		throw error;
	}
}