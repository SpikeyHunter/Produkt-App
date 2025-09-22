// src/lib/utils/passportPatterns.ts

// Enhanced passport number detection patterns including letters
export const passportNumberPatterns = [
  /\b([A-Z]{1,2}[0-9]{6,9})\b/,              // Common format: A12345678, AB12345678
  /\b([A-Z][0-9]{8})\b/,                     // A12345678
  /\b([0-9]{8,10})\b/,                       // Numeric only: 12345678
  /(?:No\.?\s*|Number\s*:?\s*)([A-Z0-9]{6,12})/i,
  /\bP[A-Z0-9]{8}\b/,                        // P + 8 alphanumeric
  /\b[A-Z]{2}[0-9]{7}\b/,                    // 2 letters + 7 digits
  /Passport\s*(?:No\.?|Number)?\s*:?\s*([A-Z0-9]+)/i,
  /\b([0-9]{9})\b/,                          // 9 digits
  /\b([A-Z][0-9]{7})\b/,                     // Letter + 7 digits
  /\b([A-Z0-9]{2}[0-9]{7})\b/,               // 2 alphanumeric + 7 digits
  /\b([0-9]{2}[A-Z]{2}[0-9]{5})\b/,         // 2 digits + 2 letters + 5 digits
  /\b([A-Z]{3}[0-9]{6})\b/,                  // 3 letters + 6 digits
  /\b([0-9][A-Z]{2}[0-9]{6})\b/,            // 1 digit + 2 letters + 6 digits
  /\b([A-Z0-9]{8,12})\b/                     // General alphanumeric 8-12 chars
];