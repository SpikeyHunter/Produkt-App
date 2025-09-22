// File: src/lib/types/letter.ts

export type Gender = 'male' | 'female' | 'neutral';

export interface PromoterLetterData {
    // Artist Information
    artistFullName: string;
     artistLegalFullName: string; 
    artistLastName: string;
    artistDob: string;
    artistCitizenship: string;
    artistGender: Gender;
    
    // Documents
    passportNumber: string;
    visaNumber?: string;
    
    // Performance Details
    performanceName: string;
    arrivalDate: string;
    performanceDate: string;
    showDuration: number;
    
    // Payment
    paymentCurrency: string;
    paymentAmount: string;
    
    // Stay Duration
    stayDurationDays: number;
    
    // Letter Metadata
    letterDate: string;
}

export interface ImmigrationInfo {
    letterType: string;
    promoter: {
        visaRequired: boolean;
        visaNumber: string;
        letterFilled: boolean;
        letterSent: boolean;
        letterData?: PromoterLetterData;
    };
    imm5686e: {
        immigrationSent: boolean;
        letterReceived: boolean;
        letterSent: boolean;
    };
}