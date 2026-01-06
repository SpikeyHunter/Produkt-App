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
    let dateObj: Date;

    // FIX: Manually split the string to avoid Timezone offsets completely.
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = date.split('-').map(Number);
        dateObj = new Date(y, m - 1, d); // Months are 0-indexed
    } else if (typeof date === 'string') {
        dateObj = new Date(date);
    } else {
        dateObj = new Date(date.getTime());
    }
    
    const monthOptions: Intl.DateTimeFormatOptions = { month: 'long' };
    const month = dateObj.toLocaleDateString('en-US', monthOptions);
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();
    
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
    
    // We will store the single formatted date here
    let formattedDate = '';
    
    if (eventDate) {
        // Use the robust formatter on the event date
        formattedDate = formatDateShort(eventDate);
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
        
       // FIX: Force both dates to be exactly the same variable [cite: 1]
        arrivalDate: formattedDate,
        performanceDate: formattedDate,
        
        showDuration: 2,
        paymentCurrency: paymentCurrency || 'USD',
        paymentAmount: paymentAmount || '3,000',
        stayDurationDays: 2,
        letterDate: formatDateForLetter(today)
    };
}