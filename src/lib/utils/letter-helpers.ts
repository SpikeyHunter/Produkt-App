// File: src/lib/utils/letter-helpers.ts

import type { Gender, PromoterLetterData } from '$lib/types/letter';
import type { Person } from '$lib/types/events';

export function getPronouns(gender: Gender) {
    switch(gender) {
        case 'male':
            return {
                title: 'Mr.',
                subject: 'he',
                object: 'him',
                possessive: 'his',
                reflexive: 'himself'
            };
        case 'female':
            return {
                title: 'Ms.',
                subject: 'she',
                object: 'her',
                possessive: 'her',
                reflexive: 'herself'
            };
        case 'neutral':
            return {
                title: 'Mx.',
                subject: 'they',
                object: 'them',
                possessive: 'their',
                reflexive: 'themselves'
            };
    }
}

export function numberToWord(num: number): string {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    return words[num] || num.toString();
}

export function formatDateForLetter(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return dateObj.toLocaleDateString('en-US', options);
}

export function formatDateShort(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    };
    const formatted = dateObj.toLocaleDateString('en-US', options);
    // Convert to format like "25 May 2025"
    const parts = formatted.split(' ');
    return `${parts[1].replace(',', '')} ${parts[0]} ${parts[2]}`;
}

export function createDefaultLetterData(
    person?: Person, 
    eventName?: string, 
    eventDate?: string,
    passportNumber?: string,
    visaNumber?: string
): PromoterLetterData {
    const today = new Date();
    const arrivalDate = eventDate ? new Date(eventDate) : new Date();
    arrivalDate.setDate(arrivalDate.getDate() - 2); // Arrive 2 days before
    
    return {
        artistFullName: person ? `${person.firstName} ${person.lastName}` : '',
        // FIX: Add the missing property
        artistLegalFullName: person ? `${person.firstName} ${person.lastName}` : '',
        artistLastName: person?.lastName || '',
        artistDob: '',
        artistCitizenship: '',
        artistGender: 'male',
        passportNumber: passportNumber || '',
        visaNumber: visaNumber || undefined,
        performanceName: eventName || '',
        arrivalDate: formatDateShort(arrivalDate),
        performanceDate: eventDate ? formatDateShort(eventDate) : '',
        showDuration: 2,
        paymentCurrency: 'USD',
        paymentAmount: '3,000',
        stayDurationDays: 2,
        letterDate: formatDateForLetter(today)
    };
}