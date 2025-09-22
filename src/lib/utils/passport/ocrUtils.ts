// src/lib/utils/passportOcrUtils.ts
import { countryMappings } from './countryMappings';
import { passportNumberPatterns } from './patterns';

export interface DetectedPassportInfo {
  givenName?: string;
  lastName?: string;
  dateOfBirth?: string;
  country?: string;
  passportNumber?: string;
}

export interface NameHints {
  expectedFirstName?: string;
  expectedLastName?: string;
}

// Parse Google credentials from environment
export function getGoogleCredentials(credentialsString?: string) {
  try {
    const credentials = parseCredentials(credentialsString || '{}');
    
    // Validate required fields
    const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
    for (const field of requiredFields) {
      if (!credentials[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    console.log('✅ Google credentials parsed successfully');
    console.log('📌 Project ID:', credentials.project_id);
    console.log('📧 Client email:', credentials.client_email);
    
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
    console.log('Initial parse failed, attempting to fix credentials format...');
    
    let fixed = credentialsString.trim();
    if (fixed.startsWith('"') && fixed.endsWith('"')) {
      fixed = fixed.slice(1, -1);
    }
    
    fixed = fixed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    credentials = JSON.parse(fixed);
  }
  
  // Ensure private key has proper newlines
  if (credentials.private_key) {
    if (credentials.private_key.includes('\\n')) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    if (!credentials.private_key.includes('BEGIN PRIVATE KEY')) {
      throw new Error('Invalid private key format');
    }
  }
  
  return credentials;
}

// Helper to clean and format names from OCR
function cleanOCRName(name: string): string {
  if (!name) return '';
  
  // Remove common field labels that might be included
  const labelsToRemove = [
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
    '姓',
    '名'
  ];
  
  let cleanedName = name;
  
  // Remove field labels
  const labelPattern = new RegExp(`\\b(${labelsToRemove.join('|')})\\b`, 'gi');
  cleanedName = cleanedName.replace(labelPattern, '').trim();
  
  // Remove any remaining colons or special characters at the start
  cleanedName = cleanedName.replace(/^[:：\s]+/, '');
  
  // Convert to proper case (first letter capital, rest lowercase)
  cleanedName = cleanedName.split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => {
      // Keep certain words uppercase (like middle initials)
      if (word.length === 1 || (word.length === 2 && word.endsWith('.'))) {
        return word.toUpperCase();
      }
      // Handle hyphenated names
      if (word.includes('-')) {
        return word.split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('-');
      }
      // Handle apostrophes (O'Brien, D'Angelo)
      if (word.includes("'")) {
        const parts = word.split("'");
        return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() + 
               "'" + (parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase() : '');
      }
      // Standard proper case
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
  
  return cleanedName;
}

// Enhanced passport text parser
export function parsePassportText(text: string, nameHints?: NameHints): DetectedPassportInfo {
  const detectedInfo: DetectedPassportInfo = {};
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  console.log('🔍 Parsing', lines.length, 'lines of text...');

  // Extract names
  const names = extractNames(text, lines, nameHints);
  if (names.givenName) detectedInfo.givenName = names.givenName;
  if (names.lastName) detectedInfo.lastName = names.lastName;

  // Extract passport number
  const passportNumber = extractPassportNumber(text);
  if (passportNumber) detectedInfo.passportNumber = passportNumber;

  // Extract country
  const country = extractCountry(text);
  if (country) detectedInfo.country = country;

  // Extract date of birth
  const dateOfBirth = extractDateOfBirth(text);
  if (dateOfBirth) detectedInfo.dateOfBirth = dateOfBirth;

  // Try MRZ parsing if we haven't found all info
  if (!detectedInfo.passportNumber || !detectedInfo.lastName || !detectedInfo.givenName || !detectedInfo.dateOfBirth) {
    const mrzData = tryMRZParsing(lines);
    
    // Only use MRZ data if we haven't found better data already
    Object.keys(mrzData).forEach(key => {
      if (!detectedInfo[key as keyof DetectedPassportInfo] && mrzData[key as keyof DetectedPassportInfo]) {
        (detectedInfo as any)[key] = (mrzData as any)[key];
      }
    });
  }

  return detectedInfo;
}

// Extract names with better handling of multiple names
function extractNames(text: string, lines: string[], nameHints?: NameHints): Partial<DetectedPassportInfo> {
  const result: Partial<DetectedPassportInfo> = {};
  
  // First try with name hints
  if (nameHints) {
    const hintBasedNames = findNamesWithHints(text, nameHints);
    if (hintBasedNames.givenName) result.givenName = hintBasedNames.givenName;
    if (hintBasedNames.lastName) result.lastName = hintBasedNames.lastName;
  }
  
  // If not found with hints, try pattern-based extraction
  if (!result.givenName || !result.lastName) {
    const patternNames = findNamesWithPatterns(text, lines);
    if (!result.givenName && patternNames.givenName) result.givenName = patternNames.givenName;
    if (!result.lastName && patternNames.lastName) result.lastName = patternNames.lastName;
  }
  
  return result;
}

// Find names using hints
function findNamesWithHints(text: string, nameHints: NameHints): Partial<DetectedPassportInfo> {
  const result: Partial<DetectedPassportInfo> = {};
  
  // Helper to find all parts of a name (handles multiple names)
  const findFullName = (expectedName: string, textToSearch: string): string | null => {
    const words = expectedName.split(' ').filter(w => w.length > 0);
    const upperText = textToSearch.toUpperCase();
    
    // Try to find all parts of the name
    const foundParts: string[] = [];
    let searchText = upperText;
    
    for (const word of words) {
      const upperWord = word.toUpperCase();
      if (searchText.includes(upperWord)) {
        foundParts.push(word);
        // Mark this word as found to avoid duplicates
        searchText = searchText.replace(upperWord, '###');
      }
    }
    
    // If we found at least one part, try to find the complete name
    if (foundParts.length > 0) {
      // Look for the complete name in the original text
      const namePattern = new RegExp(
        foundParts.map(part => `${part}\\s*`).join('') + '(?:[A-Z][a-z]+\\s*)*',
        'i'
      );
      const match = textToSearch.match(namePattern);
      if (match) {
        return cleanOCRName(match[0].trim());
      }
      
      // Return what we found
      return cleanOCRName(foundParts.join(' '));
    }
    
    return null;
  };
  
  if (nameHints.expectedLastName) {
    const lastName = findFullName(nameHints.expectedLastName, text);
    if (lastName) {
      result.lastName = lastName;
      console.log('✅ Found last name:', result.lastName);
    }
  }
  
  if (nameHints.expectedFirstName) {
    // For given names, we might have multiple names (first + middle)
    const givenName = findFullName(nameHints.expectedFirstName, text);
    if (givenName) {
      // Check if there are additional given names nearby
      const givenNameIndex = text.toUpperCase().indexOf(givenName.toUpperCase());
      if (givenNameIndex !== -1) {
        // Look for additional names after the found name
        const afterText = text.substring(givenNameIndex + givenName.length, givenNameIndex + givenName.length + 50);
        const additionalNameMatch = afterText.match(/^\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
        
        if (additionalNameMatch && !result.lastName?.includes(additionalNameMatch[1])) {
          result.givenName = cleanOCRName(`${givenName} ${additionalNameMatch[1]}`);
        } else {
          result.givenName = givenName;
        }
      } else {
        result.givenName = givenName;
      }
      console.log('✅ Found given name(s):', result.givenName);
    }
  }
  
  return result;
}

// Find names using patterns
function findNamesWithPatterns(text: string, lines: string[]): Partial<DetectedPassportInfo> {
  const result: Partial<DetectedPassportInfo> = {};
  
  // Surname patterns
  const surnamePatterns = [
    /(?:Surname|Nom|Apellidos?|Cognome|Nachname|姓)\s*[:：]\s*([A-Z][A-Z\s'-]+)/i,
    /(?:Last\s+Name|Family\s+Name)\s*[:：]\s*([A-Z][A-Z\s'-]+)/i
  ];
  
  // Given name patterns
  const givenNamePatterns = [
    /(?:Given\s+Names?|Prénoms?|Nombres?|Nome|Vorname|名)\s*[:：]\s*([A-Z][A-Z\s'-]+)/i,
    /(?:First\s+Name)\s*[:：]\s*([A-Z][A-Z\s'-]+)/i
  ];

  // Try surname patterns
  for (const pattern of surnamePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.lastName = cleanOCRName(match[1].trim());
      console.log('✅ Found last name from pattern:', result.lastName);
      break;
    }
  }

  // Try given name patterns
  for (const pattern of givenNamePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.givenName = cleanOCRName(match[1].trim());
      console.log('✅ Found given name from pattern:', result.givenName);
      break;
    }
  }
  
  return result;
}

// Extract passport number with enhanced patterns
function extractPassportNumber(text: string): string | null {
  for (const pattern of passportNumberPatterns) {
    const matches = text.match(new RegExp(pattern, 'g'));
    if (matches && matches.length > 0) {
      // Filter out dates and other false positives
      const validMatch = matches.find(match => {
        // Skip if it looks like a date
        if (/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(match)) return false;
        if (/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(match)) return false;
        if (/JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC/i.test(match)) return false;
        
        // Valid passport number length (including letters)
        const cleaned = match.replace(/[^A-Z0-9]/gi, '');
        return cleaned.length >= 6 && cleaned.length <= 12;
      });
      
      if (validMatch) {
        const passportNumber = validMatch.replace(/^\D+/, ''); // Remove leading non-alphanumeric if captured by pattern
        console.log('✅ Found passport number:', passportNumber);
        return passportNumber;
      }
    }
  }
  
  return null;
}

// Extract country
function extractCountry(text: string): string | null {
  for (const { patterns, country } of countryMappings) {
    if (patterns.some((pattern: RegExp) => pattern.test(text))) {
      console.log('✅ Found country:', country);
      return country;
    }
  }
  
  return null;
}

// Extract date of birth
function extractDateOfBirth(text: string): string | null {
  const datePatterns = [
    // DD MMM YYYY format
    {
      pattern: /(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{4})/i,
      parser: (match: RegExpMatchArray) => parseDateWithMonth(match[1], match[2], match[3])
    },
    // DD/MM/YYYY or DD-MM-YYYY
    {
      pattern: /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
      parser: (match: RegExpMatchArray) => {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        const monthNum = parseInt(month);
        const dayNum = parseInt(day);
        if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
          return `${year}-${month}-${day}`;
        }
        return null;
      }
    },
    // YYYY-MM-DD or YYYY/MM/DD
    {
      pattern: /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,
      parser: (match: RegExpMatchArray) => {
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        const monthNum = parseInt(month);
        const dayNum = parseInt(day);
        if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
          return `${year}-${month}-${day}`;
        }
        return null;
      }
    },
    // DD.MM.YYYY
    {
      pattern: /(\d{2})\.(\d{2})\.(\d{4})/,
      parser: (match: RegExpMatchArray) => `${match[3]}-${match[2]}-${match[1]}`
    }
  ];

  // Look for date of birth - search near DOB indicators first
  const dobIndicators = /(?:date\s*of\s*birth|dob|born|birth|né|née|geboren|nacido|nato|生年月日)/i;
  const dobMatch = text.match(dobIndicators);
  
  if (dobMatch) {
    // Search for date near the DOB indicator
    const searchStart = Math.max(0, dobMatch.index! - 50);
    const searchEnd = Math.min(text.length, dobMatch.index! + 100);
    const nearbyText = text.substring(searchStart, searchEnd);
    
    for (const { pattern, parser } of datePatterns) {
      const match = nearbyText.match(pattern);
      if (match) {
        const parsed = parser(match);
        if (parsed && isValidBirthDate(parsed)) {
          console.log('✅ Found date of birth (near indicator):', parsed);
          return parsed;
        }
      }
    }
  }

  // If no date found near DOB indicator, search entire text
  for (const { pattern, parser } of datePatterns) {
    const matches = text.match(new RegExp(pattern, 'g'));
    if (matches) {
      for (const matchStr of matches) {
        const match = matchStr.match(pattern);
        if (match) {
          const parsed = parser(match);
          if (parsed && isValidBirthDate(parsed)) {
            console.log('✅ Found date of birth:', parsed);
            return parsed;
          }
        }
      }
    }
  }
  
  return null;
}

// Try MRZ parsing
function tryMRZParsing(lines: string[]): DetectedPassportInfo {
  const mrzLines = lines.filter(line => 
    line.includes('<<') || 
    (line.length > 30 && line.match(/^[A-Z0-9<]+$/))
  );

  if (mrzLines.length >= 2) {
    console.log('🔍 Found MRZ lines, parsing...');
    return parseMRZ(mrzLines);
  }
  
  return {};
}

// Parse MRZ (Machine Readable Zone) data
function parseMRZ(mrzLines: string[]): DetectedPassportInfo {
  const info: DetectedPassportInfo = {};
  
  if (mrzLines.length >= 2) {
    const line1 = mrzLines[0];
    const line2 = mrzLines[1];
    
    // Parse first MRZ line for names
    if (line1.includes('<<')) {
      const parts = line1.split('<<');
      if (parts.length >= 2) {
        // Extract last name (after country code, before <<)
        const beforeDoubleArrow = parts[0];
        const lastNameMatch = beforeDoubleArrow.match(/[A-Z]{3}([A-Z]+)$/);
        if (lastNameMatch) {
          info.lastName = cleanOCRName(lastNameMatch[1].replace(/</g, ' ').trim());
        }
        
        // Extract given names (after <<)
        const givenNamePart = parts[1];
        if (givenNamePart) {
          const givenNames = givenNamePart.split('<').filter(name => name.length > 0);
          if (givenNames.length > 0) {
            info.givenName = givenNames.map(name => cleanOCRName(name)).join(' ');
          }
        }
      }
    }
    
    // Parse second MRZ line
    if (line2.length >= 20) {
      // Extract passport number (first 9 characters)
      const passportMatch = line2.match(/^([A-Z0-9]{9})/);
      if (passportMatch) {
        info.passportNumber = passportMatch[1].replace(/</g, '');
      }
      
      // Extract date of birth (positions 13-19, YYMMDD format)
      if (line2.length >= 19) {
        const dobMatch = line2.substring(13, 19).match(/(\d{6})/);
        if (dobMatch) {
          info.dateOfBirth = parseMRZDate(dobMatch[1]);
        }
      }
    }
  }
  
  return info;
}

function parseMRZDate(mrzDate: string): string {
  if (mrzDate.length !== 6) return '';
  
  const year = parseInt(mrzDate.substring(0, 2));
  const month = mrzDate.substring(2, 4);
  const day = mrzDate.substring(4, 6);
  
  // Determine century
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const currentYearInCentury = currentYear % 100;
  
  let fullYear: number;
  if (year <= currentYearInCentury + 10) {
    fullYear = currentCentury + year;
  } else {
    fullYear = currentCentury - 100 + year;
  }
  
  return `${fullYear}-${month}-${day}`;
}

function parseDateWithMonth(day: string, monthName: string, year: string): string {
  const months: Record<string, string> = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
    'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
    'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };
  
  const month = months[monthName.toUpperCase()] || '01';
  return `${year}-${month}-${day.padStart(2, '0')}`;
}

function isValidBirthDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  
  if (isNaN(date.getTime())) return false;
  if (date > now) return false;
  
  const oldestDate = new Date();
  oldestDate.setFullYear(oldestDate.getFullYear() - 120);
  if (date < oldestDate) return false;
  
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  if (date > futureDate) return false;
  
  return true;
}