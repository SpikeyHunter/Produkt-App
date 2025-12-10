// src/lib/utils/passport/ocrUtils.ts
import { countryMappings } from './countryMappings';
import { passportNumberPatterns } from './patterns';
import { countries } from './countries'; // Ensure this matches your countries file export

export interface DetectedPassportInfo {
	givenName?: string;
	lastName?: string;
	dateOfBirth?: string;
	country?: string;
	country_birth?: string;
	passportNumber?: string;
}

export interface NameHints {
	expectedFirstName?: string;
	expectedLastName?: string;
}

// --- Credentials Management ---

export function getGoogleCredentials(credentialsString?: string) {
	try {
		const credentials = parseCredentials(credentialsString || '{}');
		const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
		for (const field of requiredFields) {
			if (!credentials[field]) throw new Error(`Missing required field: ${field}`);
		}
		return credentials;
	} catch (err) {
		console.error('❌ Error parsing Google credentials:', err);
		return null;
	}
}

function parseCredentials(credentialsString: string) {
	let credentials;
	try {
		credentials = JSON.parse(credentialsString);
	} catch (parseError) {
		let fixed = credentialsString.trim();
		if (fixed.startsWith('"') && fixed.endsWith('"')) fixed = fixed.slice(1, -1);
		fixed = fixed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
		credentials = JSON.parse(fixed);
	}
	if (credentials.private_key && credentials.private_key.includes('\\n')) {
		credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
	}
	return credentials;
}

// --- Main Parsing Logic ---

export function parsePassportText(text: string, nameHints?: NameHints): DetectedPassportInfo {
	console.log('🔍 Starting Smart Passport Parsing...');

	// 1. Try MRZ (Machine Readable Zone) Parsing First
	// This is the "Silver Bullet" - if this works, we ignore the visual text garbage.
	const mrzData = parseMRZ(text);
	if (mrzData && mrzData.passportNumber && mrzData.lastName) {
		console.log('✅ MRZ Detection Successful - Using strict data');

		// If MRZ gave us a country code (e.g., USA), normalize it to full name (United States)
		if (mrzData.country) {
			mrzData.country = normalizeCountry(mrzData.country);
			mrzData.country_birth = mrzData.country;
		}
		return mrzData;
	}

	// 2. Fallback: Visual Text Parsing
	// Only runs if MRZ fails. We apply stricter cleaning here.
	console.log('⚠️ MRZ not found or incomplete, falling back to visual text parsing...');

	const detectedInfo: DetectedPassportInfo = {};
	const lines = text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	// Extract and Clean Names
	const names = extractNames(text, lines, nameHints);
	if (names.givenName) detectedInfo.givenName = names.givenName;
	if (names.lastName) detectedInfo.lastName = names.lastName;

	// Extract Passport Number
	const passportNumber = extractPassportNumber(text);
	if (passportNumber) detectedInfo.passportNumber = passportNumber;

	// Extract and Normalize Country
	const rawCountry = extractCountry(text);
	if (rawCountry) {
		const normalized = normalizeCountry(rawCountry);
		detectedInfo.country = normalized;
		detectedInfo.country_birth = normalized;
	}

	// Extract DOB
	const dateOfBirth = extractDateOfBirth(text);
	if (dateOfBirth) detectedInfo.dateOfBirth = dateOfBirth;

	return detectedInfo;
}

// --- MRZ Parsing (The "Silver Bullet") ---

function parseMRZ(text: string): DetectedPassportInfo | null {
	const lines = text.split('\n').map((l) => l.trim().replace(/\s/g, '')); // Remove whitespace for MRZ
	// Look for lines containing '<<' and standard length (usually 44 chars, sometimes 30)
	const mrzLines = lines.filter((line) => line.includes('<<') && line.length > 28);

	if (mrzLines.length < 2) return null;

	// Typically the last two lines are the MRZ
	const bottomLine = mrzLines[mrzLines.length - 1]; // Contains ID, DOB, Expiry
	const topLine = mrzLines[mrzLines.length - 2]; // Contains Name, Country

	try {
		const info: DetectedPassportInfo = {};

		// 1. Parse Top Line: P<USA[SURNAME]<<[GIVEN_NAMES]
		// Country is usually chars 2-5 (3 letters)
		const countryCode = topLine.substring(2, 5).replace(/</g, '');
		info.country = mapCountryCodeToName(countryCode);
		info.country_birth = info.country;

		// Names are after char 5
		const nameSection = topLine.substring(5);
		const [rawSurname, rawGiven] = nameSection.split('<<');

		if (rawSurname) {
			info.lastName = formatNameFromMRZ(rawSurname);
		}
		if (rawGiven) {
			info.givenName = formatNameFromMRZ(rawGiven);
		}

		// 2. Parse Bottom Line: [PASSPORT_NO]...[DOB]...
		// Passport Num: chars 0-9
		let passportNum = bottomLine.substring(0, 9).replace(/</g, '');
		info.passportNumber = passportNum;

		// DOB: chars 13-19 (YYMMDD)
		const dobStr = bottomLine.substring(13, 19);
		if (/^\d{6}$/.test(dobStr)) {
			info.dateOfBirth = parseMRZDate(dobStr);
		}

		return info;
	} catch (e) {
		console.error('Error parsing MRZ lines:', e);
		return null;
	}
}

function formatNameFromMRZ(name: string): string {
	// Replace single filler chars (<) with space, trim, and title case
	const cleaned = name.replace(/</g, ' ').trim();
	return cleanOCRName(cleaned);
}

function mapCountryCodeToName(code: string): string {
	// Map common 3-letter codes to your system's names
	const map: Record<string, string> = {
		USA: 'United States',
		GBR: 'United Kingdom',
		CAN: 'Canada',
		AUS: 'Australia',
		DEU: 'Germany',
		FRA: 'France',
		ITA: 'Italy',
		ESP: 'Spain',
		NLD: 'Netherlands',
		IRL: 'Ireland',
		NZL: 'New Zealand'
		// Fallback: if strictly 3 letters, return it, otherwise empty
	};
	return map[code] || (countries.find((c) => c.substring(0, 3).toUpperCase() === code) ? code : '');
}

// --- Visual Text Helpers (Cleaners) ---

function normalizeCountry(rawCountry: string): string {
	const upper = rawCountry.toUpperCase();

	// 1. Handle specific "Bad" inputs
	if (upper.includes('UNITED STATES') || upper.includes('USA') || upper.includes('AMERICA')) {
		return 'United States';
	}
	if (upper.includes('UNITED KINGDOM') || upper.includes('GREAT BRITAIN') || upper.includes('UK')) {
		return 'United Kingdom';
	}

	// 2. Try to find exact match in your valid countries list
	const exactMatch = countries.find((c) => c.toLowerCase() === rawCountry.toLowerCase());
	if (exactMatch) return exactMatch;

	// 3. Fuzzy match: if valid country is contained in the raw string
	// (e.g. "Republic of France" -> "France")
	for (const validCountry of countries) {
		if (upper.includes(validCountry.toUpperCase())) {
			return validCountry;
		}
	}

	return rawCountry; // Return raw if no normalization found
}

function cleanOCRName(name: string): string {
	if (!name) return '';

	// Expanded garbage list
	const garbage = [
		'given names?',
		'first names?',
		'prénoms?',
		'nombres?',
		'nome',
		'vorname',
		'nationality',
		'nationalité',
		'ciudadanía',
		'nazionalità',
		'staatsangehörigkeit',
		'surname',
		'last names?',
		'family names?',
		'nom',
		'apellidos?',
		'cognome',
		'nachname',
		'place of birth',
		'date of birth',
		'sex',
		'authority',
		'type',
		'code',
		'passport no',
		'p<',
		'usa',
		'united states',
		'people' // Prevent country stuff leaking into names
	];

	let cleaned = name;

	// 1. Remove garbage phrases (case insensitive)
	const pattern = new RegExp(`\\b(${garbage.join('|')})\\b`, 'gi');
	cleaned = cleaned.replace(pattern, '').trim();

	// 2. Remove special chars at start
	cleaned = cleaned.replace(/^[:：\s\d<]+/, '');

	// 3. Remove content in parentheses (often "née...")
	cleaned = cleaned.replace(/\([^)]*\)/g, '');

	// 4. Proper Case Conversion
	return cleaned
		.split(/\s+/)
		.filter((w) => w.length > 0)
		.map((word) => {
			if (word.length === 1 || (word.length === 2 && word.endsWith('.'))) return word.toUpperCase(); // Initials
			if (word.includes('-')) {
				return word
					.split('-')
					.map((p) => capitalize(p))
					.join('-');
			}
			if (word.includes("'")) {
				const [a, b] = word.split("'");
				return `${capitalize(a)}'${b ? capitalize(b) : ''}`;
			}
			return capitalize(word);
		})
		.join(' ');
}

function capitalize(s: string) {
	return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// --- Visual Extraction Functions (Existing logic with tweaks) ---

function extractNames(
	text: string,
	lines: string[],
	nameHints?: NameHints
): Partial<DetectedPassportInfo> {
	const result: Partial<DetectedPassportInfo> = {};

	// 1. Hint-based extraction (Best for visual text)
	if (nameHints) {
		const hintNames = findNamesWithHints(text, nameHints);
		if (hintNames.givenName) result.givenName = hintNames.givenName;
		if (hintNames.lastName) result.lastName = hintNames.lastName;
	}

	// 2. Pattern-based extraction (Fallback)
	if (!result.givenName || !result.lastName) {
		const patternNames = findNamesWithPatterns(text);
		if (!result.givenName && patternNames.givenName) result.givenName = patternNames.givenName;
		if (!result.lastName && patternNames.lastName) result.lastName = patternNames.lastName;
	}

	return result;
}

function findNamesWithHints(text: string, nameHints: NameHints): Partial<DetectedPassportInfo> {
	const result: Partial<DetectedPassportInfo> = {};

	const findMatch = (target: string) => {
		if (!target) return null;
		const parts = target
			.toUpperCase()
			.split(' ')
			.filter((p) => p.length > 1);

		// Look for lines containing the name parts
		const lines = text.split('\n');
		for (const line of lines) {
			const upperLine = line.toUpperCase();
			if (parts.every((p) => upperLine.includes(p))) {
				return cleanOCRName(line); // Clean the whole line found
			}
		}
		return null;
	};

	if (nameHints.expectedLastName) {
		const found = findMatch(nameHints.expectedLastName);
		if (found) result.lastName = found;
	}
	if (nameHints.expectedFirstName) {
		const found = findMatch(nameHints.expectedFirstName);
		if (found) result.givenName = found;
	}

	return result;
}

function findNamesWithPatterns(text: string): Partial<DetectedPassportInfo> {
	const result: Partial<DetectedPassportInfo> = {};
	const surnamePatterns = [
		/(?:Surname|Nom|Apellidos|Cognome|Nachname)\s*[:：]?\s*([A-Z\s'-]+)/i,
		/([A-Z\s'-]+)\s*<<+/ // MRZ-style fallback in visual text
	];
	const givenPatterns = [/(?:Given Names?|Prénoms|Nombres|Nome|Vorname)\s*[:：]?\s*([A-Z\s'-]+)/i];

	for (const p of surnamePatterns) {
		const m = text.match(p);
		if (m) {
			result.lastName = cleanOCRName(m[1]);
			break;
		}
	}
	for (const p of givenPatterns) {
		const m = text.match(p);
		if (m) {
			result.givenName = cleanOCRName(m[1]);
			break;
		}
	}
	return result;
}

function extractPassportNumber(text: string): string | null {
	for (const pattern of passportNumberPatterns) {
		const match = pattern.exec(text);
		if (match) {
			let num = match[1] || match[0];
			num = num.replace(/[^A-Z0-9]/gi, '');
			// Basic validity checks
			if (num.length >= 6 && num.length <= 12 && !/JAN|FEB|MAR|APR/.test(num)) {
				console.log('✅ Found passport number:', num);
				return num;
			}
		}
	}
	return null;
}

function extractCountry(text: string): string | null {
	// 1. Try mapping patterns first (e.g. looking for "USA")
	for (const { patterns, country } of countryMappings) {
		if (patterns.some((pattern: RegExp) => pattern.test(text))) {
			return country;
		}
	}

	// 2. Scan for full country names from the imported list
	const upperText = text.toUpperCase();
	for (const country of countries) {
		if (upperText.includes(country.toUpperCase())) {
			return country;
		}
	}

	return null;
}

function extractDateOfBirth(text: string): string | null {
	// Reuse existing patterns
	const datePatterns = [
		{
			pattern: /(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{4})/i,
			parser: (m: any) => parseDateWithMonth(m[1], m[2], m[3])
		},
		{
			pattern: /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
			parser: (m: any) => formatDate(m[3], m[2], m[1])
		},
		{
			pattern: /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
			parser: (m: any) => formatDate(m[1], m[2], m[3])
		}
	];

	const dobIndicators = /(?:date\s*of\s*birth|dob|born|birth|né|née|geboren)/i;
	const dobMatch = text.match(dobIndicators);

	// Search strategy: Near indicator first, then global
	if (dobMatch) {
		const context = text.substring(
			Math.max(0, dobMatch.index! - 20),
			Math.min(text.length, dobMatch.index! + 100)
		);
		for (const { pattern, parser } of datePatterns) {
			const m = context.match(pattern);
			if (m && isValidBirthDate(parser(m))) return parser(m);
		}
	}

	for (const { pattern, parser } of datePatterns) {
		const matches = text.match(new RegExp(pattern, 'g'));
		if (matches) {
			for (const mStr of matches) {
				const m = mStr.match(pattern);
				if (m && isValidBirthDate(parser(m))) return parser(m);
			}
		}
	}
	return null;
}

// --- Date Helpers ---

function parseMRZDate(dateStr: string): string {
	if (dateStr.length !== 6) return '';
	const yy = parseInt(dateStr.substring(0, 2));
	const mm = dateStr.substring(2, 4);
	const dd = dateStr.substring(4, 6);
	// Pivot year strategy: >50 = 19xx, <=50 = 20xx
	const fullYear = yy > 50 ? 1900 + yy : 2000 + yy;
	return `${fullYear}-${mm}-${dd}`;
}

function parseDateWithMonth(day: string, monthName: string, year: string): string {
	const months: Record<string, string> = {
		JAN: '01',
		FEB: '02',
		MAR: '03',
		APR: '04',
		MAY: '05',
		JUN: '06',
		JUL: '07',
		AUG: '08',
		SEP: '09',
		OCT: '10',
		NOV: '11',
		DEC: '12'
	};
	return `${year}-${months[monthName.toUpperCase()] || '01'}-${day.padStart(2, '0')}`;
}

function formatDate(year: string, month: string, day: string): string {
	return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function isValidBirthDate(dateStr: string): boolean {
	const date = new Date(dateStr);
	const now = new Date();
	if (isNaN(date.getTime()) || date > now) return false;
	if (date.getFullYear() < 1900) return false;
	return true;
}
