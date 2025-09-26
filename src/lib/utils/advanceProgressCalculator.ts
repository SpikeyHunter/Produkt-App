// advanceProgressCalculator.ts
import type { EventAdvance } from '$lib/services/eventsService';

interface ProgressItem {
  name: string;
  value: number;
  weight: number;
  included: boolean;
}

export function calculateAdvanceProgress(event: EventAdvance): number {
  if (!event) return 0;

  // If advance_status is "Completed", override everything
  if (event.advance_status === "Completed") {
    return 100;
  }

  const progressItems: ProgressItem[] = [];

  // 1. Advance Status
  const advanceStatusValue = 
    event.advance_status === "Completed" ? 100 :
    event.advance_status === "Asked" ? 50 :
    0; // "To Do" or null
  progressItems.push({
    name: 'advance_status',
    value: advanceStatusValue,
    weight: 1,
    included: true
  });

  // 2. DOS (Director of Show)
  progressItems.push({
    name: 'dos',
    value: event.dos ? 100 : 0,
    weight: 1,
    included: true
  });

  // 3. Main Contact
  progressItems.push({
    name: 'main_contact',
    value: event.main_contact ? 100 : 0,
    weight: 1,
    included: true
  });

  // 4. Role List
  progressItems.push({
    name: 'role_list',
    value: event.role_list === true ? 100 : 0,
    weight: 1,
    included: true
  });

  // 5. Roles with Immigration and Passport Info
  const rolesProgress = calculateRolesProgress(event);
  // Always include if there are roles, even if progress is 0
  if (rolesProgress.included) {
    progressItems.push({
      name: 'roles_immigration_passport',
      value: rolesProgress.value,
      weight: 1,
      included: true
    });
    console.log('Roles/Passport/Immigration progress:', rolesProgress.value + '%');
  }

  // 6. Immigration Status
  const immigrationStatusValue = 
    event.immigration_status === "Sent" ? 100 :
    event.immigration_status === "Waiting" ? 50 :
    0; // "To Do" or null
  progressItems.push({
    name: 'immigration_status',
    value: immigrationStatusValue,
    weight: 1,
    included: true
  });

  // 7. Hotel Info
  const hotelProgress = calculateHotelProgress(event);
  progressItems.push({
    name: 'hotel_info',
    value: hotelProgress,
    weight: 1,
    included: true
  });

  // 8. Ground Info (Flights)
  const flightsEnabled = event.flights_enabled !== false; // Default to true if not specified
  if (flightsEnabled) {
    const flightsProgress = calculateFlightsProgress(event);
    progressItems.push({
      name: 'ground_info',
      value: flightsProgress,
      weight: 1,
      included: true
    });
  }

  // 9. Soundcheck
  const soundcheckData = parseJson(event.soundcheck);
  if (soundcheckData?.enabled === true) {
    const hasSoundcheck = soundcheckData.start_time && soundcheckData.end_time;
    progressItems.push({
      name: 'soundcheck',
      value: hasSoundcheck ? 100 : 0,
      weight: 1,
      included: true
    });
  }

  // 10. Ground Transport
  const groundTransportProgress = calculateGroundTransportProgress(event);
  if (groundTransportProgress.included) {
    progressItems.push({
      name: 'ground_transport',
      value: groundTransportProgress.value,
      weight: 1,
      included: true
    });
  }

  // 11. Rider Files
  const riderProgress = calculateRiderProgress(event);
  progressItems.push({
    name: 'rider_files',
    value: riderProgress,
    weight: 1,
    included: true
  });

  // 12. Visual Received (skip for Bazart venue)
  if (event.event_venue !== 'Bazart') {
    progressItems.push({
      name: 'visual_received',
      value: event.visual_received === true ? 100 : 0,
      weight: 1,
      included: true
    });
  }

  // 13. Calendar Synced
  progressItems.push({
    name: 'calendar_synced',
    value: event.calendar_synced === true ? 100 : 0,
    weight: 1,
    included: true
  });

  // Calculate final percentage
  const includedItems = progressItems.filter(item => item.included);
  if (includedItems.length === 0) return 0;

  const totalScore = includedItems.reduce((sum, item) => sum + (item.value * item.weight), 0);
  const totalWeight = includedItems.reduce((sum, item) => sum + item.weight, 0);
  
  const percentage = Math.round((totalScore / totalWeight));
  
  console.log('Progress Calculation Details:', {
    items: includedItems,
    totalScore,
    totalWeight,
    percentage
  });

  return percentage;
}

function calculatePassportProgress(event: EventAdvance): { value: number, included: boolean } {
  const roles = parseJson(event.roles);
  
  if (!Array.isArray(roles) || roles.length === 0) {
    return { value: 0, included: false };
  }

  // Find roles that require immigration (and thus passports)
  const rolesRequiringPassport = roles.filter((role: any) => role.immigration === true);
  
  if (rolesRequiringPassport.length === 0) {
    console.log('No roles require passports');
    return { value: 0, included: false };
  }

  const passportInfo = parseJson(event.passport_info);
  
  if (!passportInfo) {
    console.log('No passport info provided yet');
    return { value: 0, included: true };
  }

  const passports = Array.isArray(passportInfo) ? passportInfo : [passportInfo];
  let completedPassports = 0;

  rolesRequiringPassport.forEach((role: any) => {
    const hasCompletePassport = passports.some((p: any) => {
      const matchesRole = p.id === role.id;
      const hasAllFields = p.passportNumber && p.givenName && p.lastName && 
                          p.dateOfBirth && p.country;
      
      if (matchesRole && hasAllFields) {
        console.log(`✓ Passport complete for ${role.firstName} ${role.lastName}`);
        return true;
      } else if (matchesRole && !hasAllFields) {
        console.log(`✗ Passport incomplete for ${role.firstName} ${role.lastName}`);
      }
      return false;
    });
    
    if (hasCompletePassport) completedPassports++;
  });

  const percentage = Math.round((completedPassports / rolesRequiringPassport.length) * 100);
  console.log(`Passport progress: ${completedPassports}/${rolesRequiringPassport.length} = ${percentage}%`);
  
  return { value: percentage, included: true };
}

function calculateImmigrationProgress(event: EventAdvance): { value: number, included: boolean } {
  const roles = parseJson(event.roles);
  
  if (!Array.isArray(roles) || roles.length === 0) {
    return { value: 0, included: false };
  }

  const rolesRequiringImmigration = roles.filter((role: any) => role.immigration === true);
  
  if (rolesRequiringImmigration.length === 0) {
    return { value: 0, included: false };
  }

  const immigrationInfo = parseJson(event.immigration_info);
  
  if (!immigrationInfo || typeof immigrationInfo !== 'object') {
    console.log('No immigration info provided yet');
    return { value: 0, included: true };
  }

  let completedImmigration = 0;

  rolesRequiringImmigration.forEach((role: any) => {
    const roleImmigration = immigrationInfo[role.id];
    
    if (roleImmigration) {
      const hasImmigrationDoc = !!(roleImmigration.letter_url || roleImmigration.letter_sent);
      if (hasImmigrationDoc) {
        console.log(`✓ Immigration complete for ${role.firstName} ${role.lastName}`);
        completedImmigration++;
      } else {
        console.log(`✗ Immigration incomplete for ${role.firstName} ${role.lastName}`);
      }
    } else {
      console.log(`✗ No immigration info for ${role.firstName} ${role.lastName}`);
    }
  });

  const percentage = Math.round((completedImmigration / rolesRequiringImmigration.length) * 100);
  console.log(`Immigration docs progress: ${completedImmigration}/${rolesRequiringImmigration.length} = ${percentage}%`);
  
  return { value: percentage, included: true };
}

// Remove or update the old combined function
function calculateRolesProgress(event: EventAdvance): { value: number, included: boolean } {
  const roles = parseJson(event.roles);
  console.log('Checking roles for passport/immigration:', roles);
  
  if (!Array.isArray(roles) || roles.length === 0) {
    console.log('No roles found, skipping roles progress');
    return { value: 0, included: false };
  }

  const rolesWithImmigration = roles.filter((role: any) => role.immigration === true);
  console.log('Roles requiring immigration:', rolesWithImmigration);
  
  if (rolesWithImmigration.length === 0) {
    console.log('No roles require immigration, skipping');
    return { value: 0, included: false };
  }

  const passportInfo = parseJson(event.passport_info);
  const immigrationInfo = parseJson(event.immigration_info);
  
  console.log('Passport info:', passportInfo);
  console.log('Immigration info:', immigrationInfo);
  
  let totalTasks = rolesWithImmigration.length * 2; // Each role needs passport + immigration
  let completedTasks = 0;
  
  rolesWithImmigration.forEach((role: any) => {
    // Check passport info
    let hasPassport = false;
    if (passportInfo) {
      const passports = Array.isArray(passportInfo) ? passportInfo : [passportInfo];
      hasPassport = passports.some((p: any) => {
        // Check if passport belongs to this role and has required info
        const matchesRole = p.id === role.id;
        const hasRequiredInfo = p.passportNumber && p.givenName && p.lastName && 
                               p.dateOfBirth && p.country;
        
        if (matchesRole && hasRequiredInfo) {
          console.log(`Role ${role.firstName} ${role.lastName} has complete passport info`);
          return true;
        }
        return false;
      });
    }
    if (hasPassport) completedTasks++;
    
    // Check immigration info
    let hasImmigration = false;
    if (immigrationInfo && typeof immigrationInfo === 'object') {
      const roleImmigration = immigrationInfo[role.id];
      if (roleImmigration) {
        hasImmigration = !!(roleImmigration.letter_url || roleImmigration.letter_sent);
        if (hasImmigration) {
          console.log(`Role ${role.firstName} ${role.lastName} has immigration info`);
        }
      }
    }
    if (hasImmigration) completedTasks++;
  });

  const percentage = Math.round((completedTasks / totalTasks) * 100);
  console.log(`Roles progress: ${completedTasks}/${totalTasks} tasks = ${percentage}%`);
  
  return { value: percentage, included: true };
}

function calculateHotelProgress(event: EventAdvance): number {
  const hotelInfo = parseJson(event.hotel_info);
  if (!hotelInfo || !Array.isArray(hotelInfo) || hotelInfo.length === 0) {
    return 0;
  }

  let completedRooms = 0;
  
  hotelInfo.forEach((room: any) => {
    const hasAllInfo = 
      room.reservationFirstName &&
      room.reservationLastName &&
      room.hotelName &&
      room.roomType &&
      room.checkInDate &&
      room.checkOutDate &&
      room.confirmationNumber;
    
    if (hasAllInfo) completedRooms++;
  });

  return (completedRooms / hotelInfo.length) * 100;
}

function calculateFlightsProgress(event: EventAdvance): number {
  const groundInfo = parseJson(event.ground_info);
  if (!groundInfo) return 0;

  const arrivals = groundInfo.arrivals || [];
  const departures = groundInfo.departures || [];

  // Minimum requirement: 1 arrival and 1 departure
  if (arrivals.length === 0 || departures.length === 0) {
    return 0;
  }

  return 100;
}

function calculateGroundTransportProgress(event: EventAdvance): { value: number, included: boolean } {
  const groundTransport = parseJson(event.ground_transport);
  const soundcheck = parseJson(event.soundcheck);
  const flightsEnabled = event.flights_enabled !== false;
  
  if (!Array.isArray(groundTransport) || groundTransport.length === 0) {
    return { value: 0, included: true };
  }

  const requirements = {
    arrival: flightsEnabled ? 1 : 0,
    departure: flightsEnabled ? 1 : 0,
    show: 1,
    postShow: 1,
    soundcheck: soundcheck?.enabled ? 1 : 0,
    postSoundcheck: soundcheck?.enabled ? 1 : 0
  };

  const counts = {
    arrival: groundTransport.filter((t: any) => t.type === 'Arrival').length,
    departure: groundTransport.filter((t: any) => t.type === 'Departure').length,
    show: groundTransport.filter((t: any) => t.type === 'Show').length,
    postShow: groundTransport.filter((t: any) => t.type === 'Post Show').length,
    soundcheck: groundTransport.filter((t: any) => t.type === 'Soundcheck').length,
    postSoundcheck: groundTransport.filter((t: any) => t.type === 'Post-SC').length
  };

  let totalRequired = 0;
  let totalMet = 0;

  Object.keys(requirements).forEach(key => {
    const req = requirements[key as keyof typeof requirements];
    if (req > 0) {
      totalRequired++;
      if (counts[key as keyof typeof counts] >= req) {
        totalMet++;
      }
    }
  });

  if (totalRequired === 0) return { value: 100, included: true };

  return { 
    value: (totalMet / totalRequired) * 100,
    included: true
  };
}

function calculateRiderProgress(event: EventAdvance): number {
  const riderFiles = parseJson(event.rider_files);
  if (!riderFiles) return 0;

  const hasTechRider = riderFiles.tech_rider_url && riderFiles.tech_rider_url.trim() !== '';
  
  if (riderFiles.hospitality_included === 'No') {
    const hasHospoRider = riderFiles.hospo_rider_url && riderFiles.hospo_rider_url.trim() !== '';
    if (hasTechRider && hasHospoRider) return 100;
    if (hasTechRider || hasHospoRider) return 50;
    return 0;
  }
  
  // hospitality_included is 'Yes' or not specified
  return hasTechRider ? 100 : 0;
}

function parseJson(data: any): any {
  if (!data) return null;
  if (typeof data === 'object') return data;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }
  return null;
}