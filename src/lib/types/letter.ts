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

export interface PromoterLetterCrewData {
	crewFullName: string;
	crewLegalFullName: string;
	crewLastName: string;
	crewDob: string;
	crewCitizenship: string;
	passportNumber: string;
	artistName: string;
	performanceDate: string;
	arrivalDate: string;
	showDuration: number;
	stayDurationDays: number;
	letterDate: string;
	crewGender: 'male' | 'female';
	visaNumber?: string;
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