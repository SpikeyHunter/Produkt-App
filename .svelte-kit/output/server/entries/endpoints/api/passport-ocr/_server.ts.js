import { error, json } from "@sveltejs/kit";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { b as private_env } from "../../../../chunks/shared-server.js";
const countryMappings = [
  { patterns: [/UNITED\s+STATES\s+OF\s+AMERICA/i, /\bUSA\b/, /\bU\.?S\.?A\.?\b/i, /UNITED\s+STATES/i], country: "United States" },
  { patterns: [/CANADA/i, /\bCAN\b/], country: "Canada" },
  { patterns: [/UNITED\s+KINGDOM/i, /\bGBR\b/, /\bUK\b/, /GREAT\s+BRITAIN/i], country: "United Kingdom" },
  { patterns: [/FRANCE/i, /\bFRA\b/, /RÉPUBLIQUE\s+FRANÇAISE/i], country: "France" },
  { patterns: [/GERMANY/i, /\bDEU\b/, /DEUTSCHLAND/i], country: "Germany" },
  { patterns: [/AUSTRALIA/i, /\bAUS\b/], country: "Australia" },
  { patterns: [/JAPAN/i, /\bJPN\b/, /日本国/], country: "Japan" },
  { patterns: [/CHINA/i, /\bCHN\b/, /中华人民共和国/], country: "China" },
  { patterns: [/INDIA/i, /\bIND\b/], country: "India" },
  { patterns: [/BRAZIL/i, /\bBRA\b/, /BRASIL/i], country: "Brazil" },
  { patterns: [/MEXICO/i, /\bMEX\b/, /MÉXICO/i], country: "Mexico" },
  { patterns: [/ITALY/i, /\bITA\b/, /ITALIA/i], country: "Italy" },
  { patterns: [/SPAIN/i, /\bESP\b/, /ESPAÑA/i], country: "Spain" },
  { patterns: [/NETHERLANDS/i, /\bNLD\b/, /NEDERLAND/i], country: "Netherlands" },
  { patterns: [/BELGIUM/i, /\bBEL\b/, /BELGIQUE/i, /BELGIË/i], country: "Belgium" },
  { patterns: [/SWITZERLAND/i, /\bCHE\b/, /SUISSE/i, /SCHWEIZ/i], country: "Switzerland" },
  { patterns: [/AUSTRIA/i, /\bAUT\b/, /ÖSTERREICH/i], country: "Austria" },
  { patterns: [/SWEDEN/i, /\bSWE\b/, /SVERIGE/i], country: "Sweden" },
  { patterns: [/NORWAY/i, /\bNOR\b/, /NORGE/i], country: "Norway" },
  { patterns: [/DENMARK/i, /\bDNK\b/, /DANMARK/i], country: "Denmark" },
  { patterns: [/FINLAND/i, /\bFIN\b/, /SUOMI/i], country: "Finland" },
  { patterns: [/POLAND/i, /\bPOL\b/, /POLSKA/i], country: "Poland" },
  { patterns: [/PORTUGAL/i, /\bPRT\b/], country: "Portugal" },
  { patterns: [/GREECE/i, /\bGRC\b/, /ΕΛΛΆΔΑ/i], country: "Greece" },
  { patterns: [/TURKEY/i, /\bTUR\b/, /TÜRKİYE/i], country: "Turkey" },
  { patterns: [/RUSSIA/i, /\bRUS\b/, /РОССИЙСКАЯ/i], country: "Russia" },
  { patterns: [/UKRAINE/i, /\bUKR\b/, /УКРАЇНА/i], country: "Ukraine" },
  { patterns: [/SOUTH\s+KOREA/i, /\bKOR\b/, /REPUBLIC\s+OF\s+KOREA/i, /대한민국/], country: "South Korea" },
  { patterns: [/SINGAPORE/i, /\bSGP\b/], country: "Singapore" },
  { patterns: [/NEW\s+ZEALAND/i, /\bNZL\b/], country: "New Zealand" },
  { patterns: [/IRELAND/i, /\bIRL\b/, /ÉIRE/i], country: "Ireland" },
  { patterns: [/ISRAEL/i, /\bISR\b/, /ישראל/], country: "Israel" },
  { patterns: [/SOUTH\s+AFRICA/i, /\bZAF\b/], country: "South Africa" },
  { patterns: [/ARGENTINA/i, /\bARG\b/], country: "Argentina" },
  { patterns: [/CHILE/i, /\bCHL\b/], country: "Chile" },
  { patterns: [/COLOMBIA/i, /\bCOL\b/], country: "Colombia" },
  { patterns: [/PERU/i, /\bPER\b/, /PERÚ/i], country: "Peru" },
  { patterns: [/VENEZUELA/i, /\bVEN\b/], country: "Venezuela" },
  { patterns: [/EGYPT/i, /\bEGY\b/, /مصر/], country: "Egypt" },
  { patterns: [/SAUDI\s+ARABIA/i, /\bSAU\b/, /السعودية/], country: "Saudi Arabia" },
  { patterns: [/UNITED\s+ARAB\s+EMIRATES/i, /\bARE\b/, /UAE/i], country: "United Arab Emirates" },
  { patterns: [/THAILAND/i, /\bTHA\b/, /ประเทศไทย/], country: "Thailand" },
  { patterns: [/MALAYSIA/i, /\bMYS\b/], country: "Malaysia" },
  { patterns: [/INDONESIA/i, /\bIDN\b/], country: "Indonesia" },
  { patterns: [/PHILIPPINES/i, /\bPHL\b/, /PILIPINAS/i], country: "Philippines" },
  { patterns: [/VIETNAM/i, /\bVNM\b/, /VIỆT\s+NAM/i], country: "Vietnam" },
  { patterns: [/PAKISTAN/i, /\bPAK\b/], country: "Pakistan" },
  { patterns: [/BANGLADESH/i, /\bBGD\b/], country: "Bangladesh" },
  { patterns: [/NIGERIA/i, /\bNGA\b/], country: "Nigeria" },
  { patterns: [/KENYA/i, /\bKEN\b/], country: "Kenya" },
  { patterns: [/MOROCCO/i, /\bMAR\b/, /المغرب/], country: "Morocco" },
  { patterns: [/TUNISIA/i, /\bTUN\b/, /تونس/], country: "Tunisia" },
  { patterns: [/ALGERIA/i, /\bDZA\b/, /الجزائر/], country: "Algeria" },
  { patterns: [/CZECH\s+REPUBLIC/i, /\bCZE\b/, /ČESKÁ\s+REPUBLIKA/i], country: "Czech Republic" },
  { patterns: [/HUNGARY/i, /\bHUN\b/, /MAGYARORSZÁG/i], country: "Hungary" },
  { patterns: [/ROMANIA/i, /\bROU\b/, /ROMÂNIA/i], country: "Romania" },
  { patterns: [/BULGARIA/i, /\bBGR\b/, /БЪЛГАРИЯ/i], country: "Bulgaria" },
  { patterns: [/SLOVAKIA/i, /\bSVK\b/, /SLOVENSKO/i], country: "Slovakia" },
  { patterns: [/CROATIA/i, /\bHRV\b/, /HRVATSKA/i], country: "Croatia" },
  { patterns: [/SERBIA/i, /\bSRB\b/, /СРБИЈА/i], country: "Serbia" },
  { patterns: [/LITHUANIA/i, /\bLTU\b/, /LIETUVA/i], country: "Lithuania" },
  { patterns: [/LATVIA/i, /\bLVA\b/, /LATVIJA/i], country: "Latvia" },
  { patterns: [/ESTONIA/i, /\bEST\b/, /EESTI/i], country: "Estonia" },
  { patterns: [/ICELAND/i, /\bISL\b/, /ÍSLAND/i], country: "Iceland" },
  { patterns: [/LUXEMBOURG/i, /\bLUX\b/], country: "Luxembourg" },
  { patterns: [/MALTA/i, /\bMLT\b/], country: "Malta" },
  { patterns: [/CYPRUS/i, /\bCYP\b/, /ΚΎΠΡΟΣ/i], country: "Cyprus" },
  { patterns: [/SLOVENIA/i, /\bSVN\b/, /SLOVENIJA/i], country: "Slovenia" },
  { patterns: [/ALBANIA/i, /\bALB\b/, /SHQIPËRI/i], country: "Albania" },
  { patterns: [/MONTENEGRO/i, /\bMNE\b/, /CRNA\s+GORA/i], country: "Montenegro" },
  { patterns: [/BOSNIA\s+AND\s+HERZEGOVINA/i, /\bBIH\b/, /BOSNA\s+I\s+HERCEGOVINA/i], country: "Bosnia and Herzegovina" },
  { patterns: [/NORTH\s+MACEDONIA/i, /\bMKD\b/, /МАКЕДОНИЈА/i], country: "North Macedonia" },
  { patterns: [/ARMENIA/i, /\bARM\b/, /ՀԱՅԱՍՏԱՆ/i], country: "Armenia" },
  { patterns: [/AZERBAIJAN/i, /\bAZE\b/, /AZƏRBAYCAN/i], country: "Azerbaijan" },
  { patterns: [/GEORGIA/i, /\bGEO\b/, /საქართველო/i], country: "Georgia" },
  { patterns: [/KAZAKHSTAN/i, /\bKAZ\b/, /ҚАЗАҚСТАН/i], country: "Kazakhstan" },
  { patterns: [/UZBEKISTAN/i, /\bUZB\b/, /O'ZBEKISTON/i], country: "Uzbekistan" },
  { patterns: [/KYRGYZSTAN/i, /\bKGZ\b/, /КЫРГЫЗСТАН/i], country: "Kyrgyzstan" },
  { patterns: [/TAJIKISTAN/i, /\bTJK\b/, /ТОҶИКИСТОН/i], country: "Tajikistan" },
  { patterns: [/TURKMENISTAN/i, /\bTKM\b/, /TÜRKMENISTAN/i], country: "Turkmenistan" },
  { patterns: [/BELARUS/i, /\bBLR\b/, /БЕЛАРУСЬ/i], country: "Belarus" },
  { patterns: [/MOLDOVA/i, /\bMDA\b/], country: "Moldova" },
  { patterns: [/MONACO/i, /\bMCO\b/], country: "Monaco" },
  { patterns: [/ANDORRA/i, /\bAND\b/], country: "Andorra" },
  { patterns: [/SAN\s+MARINO/i, /\bSMR\b/], country: "San Marino" },
  { patterns: [/VATICAN\s+CITY/i, /\bVAT\b/, /HOLY\s+SEE/i], country: "Vatican City" },
  { patterns: [/LIECHTENSTEIN/i, /\bLIE\b/], country: "Liechtenstein" }
];
const passportNumberPatterns = [
  /\b([A-Z]{1,2}[0-9]{6,9})\b/,
  // Common format: A12345678, AB12345678
  /\b([A-Z][0-9]{8})\b/,
  // A12345678
  /\b([0-9]{8,10})\b/,
  // Numeric only: 12345678
  /(?:No\.?\s*|Number\s*:?\s*)([A-Z0-9]{6,12})/i,
  /\bP[A-Z0-9]{8}\b/,
  // P + 8 alphanumeric
  /\b[A-Z]{2}[0-9]{7}\b/,
  // 2 letters + 7 digits
  /Passport\s*(?:No\.?|Number)?\s*:?\s*([A-Z0-9]+)/i,
  /\b([0-9]{9})\b/,
  // 9 digits
  /\b([A-Z][0-9]{7})\b/,
  // Letter + 7 digits
  /\b([A-Z0-9]{2}[0-9]{7})\b/,
  // 2 alphanumeric + 7 digits
  /\b([0-9]{2}[A-Z]{2}[0-9]{5})\b/,
  // 2 digits + 2 letters + 5 digits
  /\b([A-Z]{3}[0-9]{6})\b/,
  // 3 letters + 6 digits
  /\b([0-9][A-Z]{2}[0-9]{6})\b/,
  // 1 digit + 2 letters + 6 digits
  /\b([A-Z0-9]{8,12})\b/
  // General alphanumeric 8-12 chars
];
function getGoogleCredentials(credentialsString) {
  try {
    const credentials = parseCredentials(credentialsString || "{}");
    const requiredFields = ["type", "project_id", "private_key", "client_email"];
    for (const field of requiredFields) {
      if (!credentials[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    console.log("✅ Google credentials parsed successfully");
    console.log("📌 Project ID:", credentials.project_id);
    console.log("📧 Client email:", credentials.client_email);
    return credentials;
  } catch (err) {
    console.error("❌ Error parsing Google credentials:", err);
    return null;
  }
}
function parseCredentials(credentialsString) {
  let credentials;
  try {
    credentials = JSON.parse(credentialsString);
  } catch (parseError) {
    console.log("Initial parse failed, attempting to fix credentials format...");
    let fixed = credentialsString.trim();
    if (fixed.startsWith('"') && fixed.endsWith('"')) {
      fixed = fixed.slice(1, -1);
    }
    fixed = fixed.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    credentials = JSON.parse(fixed);
  }
  if (credentials.private_key) {
    if (credentials.private_key.includes("\\n")) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
    }
    if (!credentials.private_key.includes("BEGIN PRIVATE KEY")) {
      throw new Error("Invalid private key format");
    }
  }
  return credentials;
}
function cleanOCRName(name) {
  if (!name) return "";
  const labelsToRemove = [
    "given names?",
    "first names?",
    "prénoms?",
    "nombres?",
    "nome",
    "vorname",
    "nationality",
    "nationalité",
    "ciudadanía",
    "nazionalità",
    "staatsangehörigkeit",
    "surname",
    "last names?",
    "family names?",
    "nom",
    "apellidos?",
    "cognome",
    "nachname",
    "姓",
    "名"
  ];
  let cleanedName = name;
  const labelPattern = new RegExp(`\\b(${labelsToRemove.join("|")})\\b`, "gi");
  cleanedName = cleanedName.replace(labelPattern, "").trim();
  cleanedName = cleanedName.replace(/^[:：\s]+/, "");
  cleanedName = cleanedName.split(/\s+/).filter((word) => word.length > 0).map((word) => {
    if (word.length === 1 || word.length === 2 && word.endsWith(".")) {
      return word.toUpperCase();
    }
    if (word.includes("-")) {
      return word.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join("-");
    }
    if (word.includes("'")) {
      const parts = word.split("'");
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() + "'" + (parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase() : "");
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
  return cleanedName;
}
function parsePassportText(text, nameHints) {
  const detectedInfo = {};
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  console.log("🔍 Parsing", lines.length, "lines of text...");
  const names = extractNames(text, lines, nameHints);
  if (names.givenName) detectedInfo.givenName = names.givenName;
  if (names.lastName) detectedInfo.lastName = names.lastName;
  const passportNumber = extractPassportNumber(text);
  if (passportNumber) detectedInfo.passportNumber = passportNumber;
  const country = extractCountry(text);
  if (country) detectedInfo.country = country;
  const dateOfBirth = extractDateOfBirth(text);
  if (dateOfBirth) detectedInfo.dateOfBirth = dateOfBirth;
  if (!detectedInfo.passportNumber || !detectedInfo.lastName || !detectedInfo.givenName || !detectedInfo.dateOfBirth) {
    const mrzData = tryMRZParsing(lines);
    Object.keys(mrzData).forEach((key) => {
      if (!detectedInfo[key] && mrzData[key]) {
        detectedInfo[key] = mrzData[key];
      }
    });
  }
  return detectedInfo;
}
function extractNames(text, lines, nameHints) {
  const result = {};
  if (nameHints) {
    const hintBasedNames = findNamesWithHints(text, nameHints);
    if (hintBasedNames.givenName) result.givenName = hintBasedNames.givenName;
    if (hintBasedNames.lastName) result.lastName = hintBasedNames.lastName;
  }
  if (!result.givenName || !result.lastName) {
    const patternNames = findNamesWithPatterns(text);
    if (!result.givenName && patternNames.givenName) result.givenName = patternNames.givenName;
    if (!result.lastName && patternNames.lastName) result.lastName = patternNames.lastName;
  }
  return result;
}
function findNamesWithHints(text, nameHints) {
  const result = {};
  const findFullName = (expectedName, textToSearch) => {
    const words = expectedName.split(" ").filter((w) => w.length > 0);
    const upperText = textToSearch.toUpperCase();
    const foundParts = [];
    let searchText = upperText;
    for (const word of words) {
      const upperWord = word.toUpperCase();
      if (searchText.includes(upperWord)) {
        foundParts.push(word);
        searchText = searchText.replace(upperWord, "###");
      }
    }
    if (foundParts.length > 0) {
      const namePattern = new RegExp(
        foundParts.map((part) => `${part}\\s*`).join("") + "(?:[A-Z][a-z]+\\s*)*",
        "i"
      );
      const match = textToSearch.match(namePattern);
      if (match) {
        return cleanOCRName(match[0].trim());
      }
      return cleanOCRName(foundParts.join(" "));
    }
    return null;
  };
  if (nameHints.expectedLastName) {
    const lastName = findFullName(nameHints.expectedLastName, text);
    if (lastName) {
      result.lastName = lastName;
      console.log("✅ Found last name:", result.lastName);
    }
  }
  if (nameHints.expectedFirstName) {
    const givenName = findFullName(nameHints.expectedFirstName, text);
    if (givenName) {
      const givenNameIndex = text.toUpperCase().indexOf(givenName.toUpperCase());
      if (givenNameIndex !== -1) {
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
      console.log("✅ Found given name(s):", result.givenName);
    }
  }
  return result;
}
function findNamesWithPatterns(text, lines) {
  const result = {};
  const surnamePatterns = [
    /(?:Surname|Nom|Apellidos?|Cognome|Nachname|姓)\s*[:：]\s*([A-Z][A-Z\s'-]+)/i,
    /(?:Last\s+Name|Family\s+Name)\s*[:：]\s*([A-Z][A-Z\s'-]+)/i
  ];
  const givenNamePatterns = [
    /(?:Given\s+Names?|Prénoms?|Nombres?|Nome|Vorname|名)\s*[:：]\s*([A-Z][A-Z\s'-]+)/i,
    /(?:First\s+Name)\s*[:：]\s*([A-Z][A-Z\s'-]+)/i
  ];
  for (const pattern of surnamePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.lastName = cleanOCRName(match[1].trim());
      console.log("✅ Found last name from pattern:", result.lastName);
      break;
    }
  }
  for (const pattern of givenNamePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.givenName = cleanOCRName(match[1].trim());
      console.log("✅ Found given name from pattern:", result.givenName);
      break;
    }
  }
  return result;
}
function extractPassportNumber(text) {
  for (const pattern of passportNumberPatterns) {
    const matches = text.match(new RegExp(pattern, "g"));
    if (matches && matches.length > 0) {
      const validMatch = matches.find((match) => {
        if (/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(match)) return false;
        if (/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(match)) return false;
        if (/JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC/i.test(match)) return false;
        const cleaned = match.replace(/[^A-Z0-9]/gi, "");
        return cleaned.length >= 6 && cleaned.length <= 12;
      });
      if (validMatch) {
        const passportNumber = validMatch.replace(/^\D+/, "");
        console.log("✅ Found passport number:", passportNumber);
        return passportNumber;
      }
    }
  }
  return null;
}
function extractCountry(text) {
  for (const { patterns, country } of countryMappings) {
    if (patterns.some((pattern) => pattern.test(text))) {
      console.log("✅ Found country:", country);
      return country;
    }
  }
  return null;
}
function extractDateOfBirth(text) {
  const datePatterns = [
    // DD MMM YYYY format
    {
      pattern: /(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{4})/i,
      parser: (match) => parseDateWithMonth(match[1], match[2], match[3])
    },
    // DD/MM/YYYY or DD-MM-YYYY
    {
      pattern: /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,
      parser: (match) => {
        const day = match[1].padStart(2, "0");
        const month = match[2].padStart(2, "0");
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
      parser: (match) => {
        const year = match[1];
        const month = match[2].padStart(2, "0");
        const day = match[3].padStart(2, "0");
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
      parser: (match) => `${match[3]}-${match[2]}-${match[1]}`
    }
  ];
  const dobIndicators = /(?:date\s*of\s*birth|dob|born|birth|né|née|geboren|nacido|nato|生年月日)/i;
  const dobMatch = text.match(dobIndicators);
  if (dobMatch) {
    const searchStart = Math.max(0, dobMatch.index - 50);
    const searchEnd = Math.min(text.length, dobMatch.index + 100);
    const nearbyText = text.substring(searchStart, searchEnd);
    for (const { pattern, parser } of datePatterns) {
      const match = nearbyText.match(pattern);
      if (match) {
        const parsed = parser(match);
        if (parsed && isValidBirthDate(parsed)) {
          console.log("✅ Found date of birth (near indicator):", parsed);
          return parsed;
        }
      }
    }
  }
  for (const { pattern, parser } of datePatterns) {
    const matches = text.match(new RegExp(pattern, "g"));
    if (matches) {
      for (const matchStr of matches) {
        const match = matchStr.match(pattern);
        if (match) {
          const parsed = parser(match);
          if (parsed && isValidBirthDate(parsed)) {
            console.log("✅ Found date of birth:", parsed);
            return parsed;
          }
        }
      }
    }
  }
  return null;
}
function tryMRZParsing(lines) {
  const mrzLines = lines.filter(
    (line) => line.includes("<<") || line.length > 30 && line.match(/^[A-Z0-9<]+$/)
  );
  if (mrzLines.length >= 2) {
    console.log("🔍 Found MRZ lines, parsing...");
    return parseMRZ(mrzLines);
  }
  return {};
}
function parseMRZ(mrzLines) {
  const info = {};
  if (mrzLines.length >= 2) {
    const line1 = mrzLines[0];
    const line2 = mrzLines[1];
    if (line1.includes("<<")) {
      const parts = line1.split("<<");
      if (parts.length >= 2) {
        const beforeDoubleArrow = parts[0];
        const lastNameMatch = beforeDoubleArrow.match(/[A-Z]{3}([A-Z]+)$/);
        if (lastNameMatch) {
          info.lastName = cleanOCRName(lastNameMatch[1].replace(/</g, " ").trim());
        }
        const givenNamePart = parts[1];
        if (givenNamePart) {
          const givenNames = givenNamePart.split("<").filter((name) => name.length > 0);
          if (givenNames.length > 0) {
            info.givenName = givenNames.map((name) => cleanOCRName(name)).join(" ");
          }
        }
      }
    }
    if (line2.length >= 20) {
      const passportMatch = line2.match(/^([A-Z0-9]{9})/);
      if (passportMatch) {
        info.passportNumber = passportMatch[1].replace(/</g, "");
      }
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
function parseMRZDate(mrzDate) {
  if (mrzDate.length !== 6) return "";
  const year = parseInt(mrzDate.substring(0, 2));
  const month = mrzDate.substring(2, 4);
  const day = mrzDate.substring(4, 6);
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const currentYearInCentury = currentYear % 100;
  let fullYear;
  if (year <= currentYearInCentury + 10) {
    fullYear = currentCentury + year;
  } else {
    fullYear = currentCentury - 100 + year;
  }
  return `${fullYear}-${month}-${day}`;
}
function parseDateWithMonth(day, monthName, year) {
  const months = {
    "JAN": "01",
    "FEB": "02",
    "MAR": "03",
    "APR": "04",
    "MAY": "05",
    "JUN": "06",
    "JUL": "07",
    "AUG": "08",
    "SEP": "09",
    "OCT": "10",
    "NOV": "11",
    "DEC": "12"
  };
  const month = months[monthName.toUpperCase()] || "01";
  return `${year}-${month}-${day.padStart(2, "0")}`;
}
function isValidBirthDate(dateStr) {
  const date = new Date(dateStr);
  const now = /* @__PURE__ */ new Date();
  if (isNaN(date.getTime())) return false;
  if (date > now) return false;
  const oldestDate = /* @__PURE__ */ new Date();
  oldestDate.setFullYear(oldestDate.getFullYear() - 120);
  if (date < oldestDate) return false;
  const futureDate = /* @__PURE__ */ new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  if (date > futureDate) return false;
  return true;
}
const POST = async ({ request }) => {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw error(401, "Unauthorized");
    }
    const { imageUrl, nameHints } = await request.json();
    if (!imageUrl) {
      throw error(400, "Image URL is required");
    }
    console.log("🔍 Starting Google Vision OCR...");
    const credentials = getGoogleCredentials(private_env.GOOGLE_CREDENTIALS);
    if (!credentials) {
      throw error(500, "Google Cloud credentials not configured");
    }
    const client = new ImageAnnotatorClient({
      credentials,
      projectId: credentials.project_id
    });
    let imageInput;
    if (imageUrl.startsWith("data:image/")) {
      console.log("📷 Processing base64 image...");
      const base64Data = imageUrl.split(",")[1];
      if (!base64Data) {
        throw error(400, "Invalid base64 image format");
      }
      imageInput = {
        image: {
          content: base64Data
        }
      };
    } else if (imageUrl.startsWith("http")) {
      console.log("📷 Processing image URL...");
      imageInput = {
        image: {
          source: { imageUri: imageUrl }
        }
      };
    } else if (imageUrl.startsWith("blob:")) {
      throw error(400, "Blob URLs not supported. Please upload the image first.");
    } else {
      throw error(400, "Invalid image format");
    }
    console.log("🔍 Calling Google Vision API...");
    let result;
    try {
      const response = await client.textDetection(imageInput);
      result = response[0];
    } catch (apiError) {
      console.error("❌ Google Vision API error:", apiError);
      if (apiError.message?.includes("Invalid image content")) {
        throw error(400, "Invalid image format. Please use JPEG, PNG, or PDF format.");
      }
      if (apiError.message?.includes("Image too large")) {
        throw error(413, "Image file is too large. Please use a smaller image (max 20MB).");
      }
      if (apiError.code === 7) {
        throw error(500, "Google Cloud Vision API access denied. Please check credentials.");
      }
      throw error(500, `Vision API error: ${apiError.message || "Unknown error"}`);
    }
    if (result.error) {
      console.error("❌ Google Vision API error:", result.error);
      throw error(500, `Vision API error: ${result.error.message}`);
    }
    const detections = result.textAnnotations;
    if (!detections || detections.length === 0) {
      console.log("❌ No text found in image");
      return json({
        success: false,
        detectedInfo: {},
        message: "No text could be detected in the image. Please ensure the passport image is clear and try again."
      });
    }
    const fullText = detections[0].description || "";
    console.log("📄 Detected text length:", fullText.length);
    const detectedInfo = parsePassportText(fullText, nameHints);
    console.log("✅ Parsed passport data:", detectedInfo);
    return json({
      success: true,
      detectedInfo,
      rawText: fullText.substring(0, 500) + (fullText.length > 500 ? "..." : "")
      // Truncate for logging
    });
  } catch (err) {
    console.error("❌ Passport OCR error:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to process passport image. Please try again.");
  }
};
export {
  POST
};
