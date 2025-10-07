// src/lib/utils/sectionParser.ts

/**
 * Extracts individual sections from full email content
 * Identifies sections by their distinctive markers (headers, keywords)
 */
export function extractSectionsFromContent(
  fullContent: string,
  activeSectionIds: string[]
): Record<string, string> {
  if (!fullContent || !fullContent.trim()) return {};

  const extracted: Record<string, string> = {};
  
  // Section markers to identify boundaries
  const sectionMarkers: Record<string, RegExp> = {
    header: /^<p[^>]*>Hello everyone/i,
    crew_call: /<p[^>]*><strong[^>]*>Crew call:/i,
    projects: /<p[^>]*><strong[^>]*>Projects:/i,
    set_times: /<p[^>]*><strong[^>]*>Set Times:/i,
    soundcheck: /<p[^>]*><strong[^>]*>Soundcheck/i,
    bazart: /<p[^>]*><strong[^>]*>Bazart:/i,
    rider: /<p[^>]*><strong[^>]*>ALL TECH RIDERS/i,
    travelling_party: /<p[^>]*><strong[^>]*>Travelling party:/i,
    vj_schedule: /<p[^>]*><strong[^>]*>VJ:/i,
    lights: /<p[^>]*><strong[^>]*>Lights:/i,
    sfx: /<p[^>]*><strong[^>]*>Special FX:/i,
    footer: /<p[^>]*><strong[^>]*>Sponsors and\/or branding:/i
  };

  // Split content into segments by <br/> or <p> tags
  const segments = fullContent.split(/(?=<p[^>]*>)/g).filter(s => s.trim());
  
  let currentSection: string | null = null;
  let currentContent: string[] = [];

  segments.forEach((segment, index) => {
    // Check if this segment starts a new section
    let foundSection = false;
    
    for (const sectionId of activeSectionIds) {
      const marker = sectionMarkers[sectionId];
      if (marker && marker.test(segment)) {
        // Save previous section if exists
        if (currentSection && currentContent.length > 0) {
          extracted[currentSection] = currentContent.join('').trim();
        }
        
        // Start new section
        currentSection = sectionId;
        currentContent = [segment];
        foundSection = true;
        break;
      }
    }
    
    // If not a new section header, add to current section
    if (!foundSection && currentSection) {
      currentContent.push(segment);
    }
  });

  // Save last section
  if (currentSection && currentContent.length > 0) {
    extracted[currentSection] = currentContent.join('').trim();
  }

  return extracted;
}

/**
 * Merges template content with custom modifications
 */
export function mergeSectionContent(
  templateContent: string,
  customContent: string | undefined
): string {
  // If custom content exists and is not empty, use it
  if (customContent && customContent.trim() && customContent !== templateContent) {
    return customContent;
  }
  // Otherwise use template
  return templateContent;
}

/**
 * Checks if content has been modified from template
 */
export function isContentModified(
  currentContent: string,
  templateContent: string
): boolean {
  // Normalize both strings for comparison (remove extra whitespace, etc)
  const normalize = (str: string) => 
    str.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
  
  return normalize(currentContent) !== normalize(templateContent);
}