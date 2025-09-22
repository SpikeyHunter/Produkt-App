// src/lib/utils/passportUtils.ts

// Import shared interfaces
export type { PassportInfo } from '$lib/types/events.js';
import type { PassportInfo, Person } from '$lib/types/events.js';

/**
 * Parse passport info JSON string into PassportInfo array
 */
export function parsePassportInfo(passportJson: string | null | undefined): PassportInfo[] {
  if (!passportJson) return [];
  
  try {
    const parsed = JSON.parse(passportJson);
    if (!Array.isArray(parsed)) return [];
    
    return parsed.map((passport: any) => ({
      id: passport.id || '',
      givenName: passport.givenName || '',
      lastName: passport.lastName || '',
      dateOfBirth: passport.dateOfBirth || '',
      country: passport.country || '',
      passportNumber: passport.passportNumber || '',
      passportImageUrl: passport.passportImageUrl || ''
    }));
  } catch (error) {
    console.error('Error parsing passport info:', error);
    return [];
  }
}

/**
 * Convert PassportInfo array to JSON string for storage
 */
export function stringifyPassportInfo(passports: PassportInfo[]): string {
  try {
    const validPassports = passports.filter(passport => 
      passport.givenName.trim() && passport.lastName.trim()
    );
    return JSON.stringify(validPassports);
  } catch (error) {
    console.error('Error stringifying passport info:', error);
    return '[]';
  }
}

/**
 * Get passport info by person ID
 */
export function getPassportByPersonId(passports: PassportInfo[], personId: string): PassportInfo | null {
  return passports.find(passport => passport.id === personId) || null;
}

/**
 * Initialize passport info for a list of people
 */
export function initializePassportInfo(people: Person[], existingPassports: PassportInfo[] = []): PassportInfo[] {
  const passports = [...existingPassports];
  
  people.forEach(person => {
    if (!passports.find(p => p.id === person.id)) {
      passports.push({
        id: person.id,
        givenName: person.firstName,
        lastName: person.lastName,
        dateOfBirth: '',
        country: '',
        passportNumber: '',
        passportImageUrl: ''
      });
    }
  });
  
  return passports;
}

/**
 * Check if passport info is complete
 */
export function isPassportComplete(passport: PassportInfo): boolean {
  return !!(
    passport.givenName.trim() &&
    passport.lastName.trim() &&
    passport.dateOfBirth.trim() &&
    passport.country.trim() &&
    passport.passportNumber.trim()
  );
}

/**
 * Get passport completion status for all people
 */
export function getPassportCompletionStatus(people: Person[], passports: PassportInfo[]): {
  completed: number;
  total: number;
  percentage: number;
} {
  const total = people.length;
  let completed = 0;
  
  people.forEach(person => {
    const passport = getPassportByPersonId(passports, person.id);
    if (passport && isPassportComplete(passport)) {
      completed++;
    }
  });
  
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return { completed, total, percentage };
}

/**
 * Format passport file name
 */
export function formatPassportFileName(passport: PassportInfo, extension: string = 'pdf'): string {
  const givenName = passport.givenName.trim();
  const lastName = passport.lastName.trim();
  
  if (!givenName || !lastName) {
    return `Passport.${extension}`;
  }
  
  return `Passport - ${givenName} ${lastName}.${extension}`;
}

/**
 * Clean passport data by removing entries for people who no longer exist
 */
export function cleanPassportData(passports: PassportInfo[], people: Person[]): PassportInfo[] {
  const validPersonIds = new Set(people.map(person => person.id));
  return passports.filter(passport => validPersonIds.has(passport.id));
}

/**
 * Update passport info for a specific person
 */
export function updatePassportInfo(
  passports: PassportInfo[], 
  personId: string, 
  updates: Partial<PassportInfo>
): PassportInfo[] {
  return passports.map(passport => 
    passport.id === personId 
      ? { ...passport, ...updates }
      : passport
  );
}

/**
 * Remove passport info for a specific person
 */
export function removePassportInfo(passports: PassportInfo[], personId: string): PassportInfo[] {
  return passports.filter(passport => passport.id !== personId);
}

/**
 * Validate passport data
 */
export function validatePassportData(passport: PassportInfo): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!passport.givenName.trim()) {
    errors.push('Given name is required');
  }
  
  if (!passport.lastName.trim()) {
    errors.push('Last name is required');
  }
  
  if (!passport.dateOfBirth.trim()) {
    errors.push('Date of birth is required');
  } else {
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(passport.dateOfBirth)) {
      errors.push('Date of birth must be in YYYY-MM-DD format');
    } else {
      const date = new Date(passport.dateOfBirth);
      if (isNaN(date.getTime())) {
        errors.push('Date of birth is not a valid date');
      }
    }
  }
  
  if (!passport.country.trim()) {
    errors.push('Country is required');
  }
  
  if (!passport.passportNumber.trim()) {
    errors.push('Passport number is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get people without passport info
 */
export function getPeopleWithoutPassports(people: Person[], passports: PassportInfo[]): Person[] {
  return people.filter(person => {
    const passport = getPassportByPersonId(passports, person.id);
    return !passport || !isPassportComplete(passport);
  });
}

/**
 * Get people with complete passport info
 */
export function getPeopleWithCompletePassports(people: Person[], passports: PassportInfo[]): Person[] {
  return people.filter(person => {
    const passport = getPassportByPersonId(passports, person.id);
    return passport && isPassportComplete(passport);
  });
}