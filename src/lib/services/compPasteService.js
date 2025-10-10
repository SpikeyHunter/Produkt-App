// /src/lib/services/compPasteService.js
import { PUBLIC_OPENAI_API_KEY } from '$env/static/public';

/**
 * Validates if the pasted text contains at least one email address
 * @param {string} text - The pasted text to validate
 * @returns {boolean} True if text contains at least one email
 */
export function hasEmailAddress(text) {
	const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/;
	return emailRegex.test(text);
}

/**
 * Extracts and normalizes guest list data using OpenAI API
 * @param {string} pastedText - The raw pasted text from user
 * @returns {Promise<Array<{firstName: string, lastName: string, email: string, quantity: number}>>}
 */
export async function extractGuestListData(pastedText) {
	if (!PUBLIC_OPENAI_API_KEY) {
		throw new Error('OpenAI API key is not configured.');
	}

	// Validate that text contains at least one email
	if (!hasEmailAddress(pastedText)) {
		throw new Error('No email address found in pasted text. Please paste valid guest list data with email addresses.');
	}

	const systemPrompt = `You are a data extraction assistant specializing in normalizing messy event guest list data. 

Your task:
1. Extract guest information from messy text lines
2. Parse names intelligently from email addresses when full names aren't provided
3. Identify quantities (default to 1 if not specified)
4. Handle various formats (with/without "VIP", "GA", numbers at start/end, etc.)

CRITICAL RULES:
- Each line MUST contain an email address to be valid
- Skip any line without an email address
- Output ONLY valid CSV format: FirstName,LastName,Email,Quantity
- No headers, no explanations, just the data
- Extract first and last names intelligently from emails when names aren't explicit
- Default quantity to 1 if not found
- Remove keywords like "VIP", "GA", "BRESH" from name fields

Examples:
Input: "2 VIP v.arango1@hotmail.com"
Output: V,Arango,v.arango1@hotmail.com,2

Input: "1 VIP BRESH maricharmz@gmail.com"
Output: Mari,Charmz,maricharmz@gmail.com,1

Input: "jasifuentespachas@gmail.com 2"
Output: Jasi Fuentes,Pachas,jasifuentespachas@gmail.com,2

Input: "John Smith jsmith@example.com"
Output: John,Smith,jsmith@example.com,1`;

	try {
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${PUBLIC_OPENAI_API_KEY}`
			},
			body: JSON.stringify({
				model: 'gpt-3.5-turbo',
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: pastedText }
				],
				temperature: 0,
				max_tokens: 500
			})
		});

		if (!response.ok) {
			const errorData = await response.json();
			console.error('OpenAI API Error:', errorData);
			throw new Error('Failed to process guest list data with AI.');
		}

		const data = await response.json();
		const csvOutput = data.choices[0].message.content.trim();

		// Parse CSV output into structured data
		const lines = csvOutput.split('\n').filter(/** @param {string} line */ (line) => line.trim() !== '');
		const entries = lines.map(/** @param {string} line */ (line) => {
			// Remove any leading/trailing quotes and split by comma
			const parts = line.replace(/^"|"$/g, '').split(',').map(/** @param {string} p */ (p) => p.trim());
			
			if (parts.length < 4) {
				console.warn(`Invalid line format: ${line}`);
				return null;
			}

			return {
				firstName: parts[0] || '',
				lastName: parts[1] || '',
				email: parts[2] || '',
				quantity: parseInt(parts[3]) || 1
			};
		}).filter(/** @param {any} entry */ (entry) => entry !== null && entry.email !== '');

		if (entries.length === 0) {
			throw new Error('No valid entries could be extracted from the pasted text.');
		}

		return entries;
	} catch (error) {
		console.error('Error extracting guest list data:', error);
		throw error;
	}
}

/**
 * Fallback extraction method (used if AI fails or is unavailable)
 * @param {string} pastedText - The raw pasted text
 * @returns {Array<{firstName: string, lastName: string, email: string, quantity: number}>}
 */
export function extractGuestListDataFallback(pastedText) {
	if (!hasEmailAddress(pastedText)) {
		throw new Error('No email address found in pasted text.');
	}

	const lines = pastedText.split('\n').filter(line => line.trim() !== '');
	const emailRegex = /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
	
	return lines.map(line => {
		const emailMatch = line.match(emailRegex);
		if (!emailMatch) return null;

		const email = emailMatch[0];
		const emailParts = emailMatch[1].split(/[._-]/);
		
		// Remove email from line and clean up
		let remaining = line.replace(email, '').trim();
		remaining = remaining.replace(/^(vip|ga|bresh)\s+/gi, '');
		
		// Extract quantity
		const quantityMatch = remaining.match(/\b(\d+)\b/);
		const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
		
		// Remove quantity from remaining text
		if (quantityMatch) {
			remaining = remaining.replace(quantityMatch[0], '').trim();
		}
		
		// Parse names
		const nameParts = remaining.split(/\s+/).filter(p => p.length > 0);
		let firstName = emailParts[0] || '';
		let lastName = emailParts[1] || emailParts[0] || '';
		
		if (nameParts.length > 0) {
			firstName = nameParts[0];
			lastName = nameParts.slice(1).join(' ') || nameParts[0];
		}
		
		// Capitalize first letter
		firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
		lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase();
		
		return { firstName, lastName, email, quantity };
	}).filter(entry => entry !== null);
}