// src/lib/utils/passport/modalUtils.ts
import type { PassportInfo } from '$lib/types/passport';

export function createEmptyPassportInfo(personId: string): PassportInfo {
	return {
		id: personId,
		givenName: '',
		lastName: '',
		dateOfBirth: '',
		country: '',
		passportNumber: '',
		passportImageUrl: '',
		exemption: false, // Added back to satisfy the type
		fieldsVerified: {
			givenName: true,
			lastName: true,
			dateOfBirth: true,
			country: true,
			passportNumber: true
		}
	};
}

// Helper function to check if an entry is completely empty
function isPassportEmpty(info: PassportInfo | undefined): boolean {
	if (!info) return true;
	return (
		!info.passportImageUrl &&
		!info.givenName?.trim() &&
		!info.lastName?.trim() &&
		!info.dateOfBirth?.trim() &&
		!info.country?.trim() &&
		!info.passportNumber?.trim()
	);
}

// Helper function to check if an entry is fully complete
function isPassportFullyComplete(info: PassportInfo | undefined): boolean {
	if (!info) return false;
	return !!(
		info.passportImageUrl &&
		info.givenName?.trim() &&
		info.lastName?.trim() &&
		info.dateOfBirth?.trim() &&
		info.country?.trim() &&
		info.passportNumber?.trim()
	);
}

/**
 * Determines if the form can be saved.
 * Returns true if all entries are either completely empty or fully complete.
 * Returns false if any entry is partially filled.
 */
export function isFormReadyToSave(passportInfos: PassportInfo[]): boolean {
	if (passportInfos.length === 0) {
		return true;
	}
	// The form is ready to save if there are NO entries that are "partially filled".
	const hasPartiallyFilledEntry = passportInfos.some((info) => !isPassportEmpty(info) && !isPassportFullyComplete(info));
	return !hasPartiallyFilledEntry;
}

export function parsePassportData(data: any): PassportInfo[] {
	if (!data) return [];
	try {
		const parsed = typeof data === 'string' ? JSON.parse(data) : data;
		if (!Array.isArray(parsed)) return [];
		const seenIds = new Set<string>();
		return parsed.filter((info) => {
			if (!info.id || seenIds.has(info.id)) return false;
			seenIds.add(info.id);
			return true;
		});
	} catch (error) {
		console.error('Error parsing passport info:', error);
		return [];
	}
}

/**
 * Restored function to format date input as YYYY-MM-DD.
 */
export function formatDateInput(value: string): string {
	if (value.length <= 10) {
		if (value.length === 4 && !value.includes('-')) {
			value += '-';
		} else if (value.length === 7 && value.split('-').length === 2) {
			value += '-';
		}
	}
	return value;
}

export function preparePassportDataForSave(passportInfos: PassportInfo[]): any[] {
	// Filter out empty passport infos and remove verification/exemption fields
	return passportInfos
		.filter((info) => !isPassportEmpty(info))
		.map((info) => {
			const { fieldsVerified, exemption, ...dataToSave } = info;
			return dataToSave;
		});
}