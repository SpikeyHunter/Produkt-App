// src/lib/types/passport/index.ts

// Define EventAdvance type if it doesn't exist elsewhere
export interface EventAdvance {
  event_id: number;
  artist_name: string;
  roles: any; // You may want to type this more specifically
  passport_info?: any;
  // Add other properties as needed
}

// Define Person type if it doesn't exist elsewhere
export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  // Add other properties as needed
}

export interface PassportInfo {
  id: string;
  givenName: string;
  lastName: string;
  dateOfBirth: string;
  country: string;
  passportNumber: string;
  passportImageUrl: string;
  exemption: boolean;
  fieldsVerified?: {
    givenName: boolean;
    lastName: boolean;
    dateOfBirth: boolean;
    country: boolean;
    passportNumber: boolean;
  };
}

export interface PassportModalProps {
  isOpen: boolean;
  event: EventAdvance | null;
}

export interface NameHints {
  expectedFirstName?: string;
  expectedLastName?: string;
}