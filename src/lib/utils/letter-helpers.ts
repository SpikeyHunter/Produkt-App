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
    // Parse the input date
    let dateObj: Date;
    if (typeof date === 'string') {
        dateObj = new Date(date);
    } else {
        dateObj = new Date(date.getTime());
    }
    
    // Extract just the month and day (no year)
    const monthOptions: Intl.DateTimeFormatOptions = { month: 'long' };
    const month = dateObj.toLocaleDateString('en-US', monthOptions);
    const day = dateObj.getDate();
    
    // Get year from the *provided date*
    const year = dateObj.getFullYear();
    
    // Rebuild as: Month Day, Year
    return `${month} ${day}, ${year}`;
}

export function createDefaultLetterData(
    person?: Person, 
    eventName?: string, 
    eventDate?: string,
    explicitArrivalDate?: string,
    passportNumber?: string,
    visaNumber?: string,
    paymentAmount?: string,
    paymentCurrency?: string
): PromoterLetterData {
    const today = new Date();
    
    // If eventDate is provided, parse it
    let performanceDate = '';
    let arrivalDate = '';
    
    if (eventDate) {
        const eventDateObj = new Date(eventDate);
        // Use the event's *actual* year, not the current year
        const eventYear = eventDateObj.getFullYear();
        
        // Create performance date
        const perfDate = new Date(eventYear, eventDateObj.getMonth(), eventDateObj.getDate());
        performanceDate = formatDateShort(perfDate);
        
        if (explicitArrivalDate) {
            // If an explicit arrival date is given, use it
            arrivalDate = formatDateShort(new Date(explicitArrivalDate));
        } else {
            // Otherwise, fall back to the old logic (2 days before)
            const arrDate = new Date(eventYear, eventDateObj.getMonth(), eventDateObj.getDate() - 2);
            arrivalDate = formatDateShort(arrDate);
        }
    }
    
    return {
        artistFullName: person ? `${person.firstName} ${person.lastName}` : '',
        artistLegalFullName: person ? `${person.firstName} ${person.lastName}` : '',
        artistLastName: person?.lastName || '',
        artistDob: '',
        artistCitizenship: '',
        artistGender: 'male',
        passportNumber: passportNumber || '',
        visaNumber: visaNumber || undefined,
        performanceName: eventName || '',
        arrivalDate: arrivalDate,
        performanceDate: performanceDate,
        showDuration: 2,
        paymentCurrency: paymentCurrency || 'USD',
        paymentAmount: paymentAmount || '3,000',
        stayDurationDays: 2,
        letterDate: formatDateForLetter(today)
    };
}