// src/lib/services/techTemplateService.ts
import type { 
  EmailTechEvent, 
  TimetableEntry, 
  TechRider, 
  SfxRider, 
  SoundcheckInfo,
  RoleInfo,
  CrewAssignments
} from '$lib/types/emailtech';

function parseJson<T>(data: any, defaultValue: T): T {
  if (!data) return defaultValue;
  if (typeof data === 'string') {
    try { return JSON.parse(data) as T; } 
    catch { return defaultValue; }
  }
  return data as T;
}

function formatFullDate(dateStr: string | null): string {
  if (!dateStr) return 'TBD';
  try {
    const date = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[date.getDay()];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const suffix = day > 3 && day < 21 ? 'th' : ['th', 'st', 'nd', 'rd'][day % 10] || 'th';
    return `${dayName} ${month} ${day}${suffix} ${year}`;
  } catch {
    return dateStr;
  }
}

function formatTime(time: string): string {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${minutes}${ampm}`;
}

function highlight(text: string, shouldHighlight: boolean = true): string {
  return shouldHighlight ? `<span style="background-color: #FCA5A5;">${text}</span>` : text;
}

// ============= SECTION BUILDERS =============

export function buildHeader(events: EmailTechEvent[]): string {
  const mainEvent = events[0];
  const eventNames = events.map(e => e.event_name).join(' & ');
  const eventDate = formatFullDate(mainEvent.event_date);
  
  const dosName = mainEvent.dos || 'TBD';
  const dosText = dosName === 'TBD' ? highlight(dosName) : dosName;
  
  let dosLine = `Please note ${dosText} will be working with you for this show`;
  
  if (events.length === 2) {
    const bazartEvent = events.find(e => e.event_venue === 'Bazart');
    if (bazartEvent) {
      const bazartDos = bazartEvent.dos || 'TBD';
      const bazartDosText = bazartDos === 'TBD' ? highlight(bazartDos) : bazartDos;
      dosLine += ` and ${bazartDosText} at Bazart`;
    }
  }
  
  dosLine += '.';
  
  return `<p>Hello everyone,<br/>Here are the info for ${eventNames}, ${eventDate}</p><p>${dosLine}</p>`;
}

export function buildCrewCall(events: EmailTechEvent[], crewAssignments: CrewAssignments): string {
  let content = '<p><strong>Crew call:</strong></p>';
  
  const roles7pm = ['LD', 'Video', 'Sound', 'Technician', 'DT', 'Stage Manager'];
  const roles830pm = ['VJ'];
  
  const crew7pm = roles7pm.map(role => crewAssignments[role as keyof CrewAssignments]).filter(Boolean);
  const crew830pm = roles830pm.map(role => crewAssignments[role as keyof CrewAssignments]).filter(Boolean);
  
  if (crew7pm.length > 0) {
    content += `<p>7pm: ${crew7pm.join(', ')}</p>`;
  } else {
    content += `<p>7pm: ${highlight('TBD')}</p>`;
  }
  
  if (crew830pm.length > 0) {
    content += `<p>8:30pm: ${crew830pm.join(', ')}</p>`;
  }
  
  return content;
}

export function buildProjects(events: EmailTechEvent[]): string {
  let content = '<p><strong>Projects:</strong></p>';
  
  const ncgEvent = events.find(e => e.event_venue === 'New City Gas');
  const bazartEvent = events.find(e => e.event_venue === 'Bazart');
  
  if (ncgEvent) {
    content += '<p>Main Room</p>';
    content += '<ul><li>Project TBD</li></ul>';
  }
  
  if (bazartEvent) {
    content += '<p>Lounge</p>';
    content += '<ul><li>Project TBD</li></ul>';
  }
  
  const videoCrewName = events[0]?.crew?.Video;
  if (videoCrewName) {
    content += `<p>@${videoCrewName}</p>`;
  }
  
  content += '<p>Projecteur extérieur:</p>';
  content += '<p>9:30pm: Logo NCG<br/>https://drive.google.com/open?id=1RnDCHdyL0f6ClkOtpgUnRZNIUiZeYHMG&usp=drive_fs</p>';
  content += '<p>Visuals for TVS and Interior Projector:<br/>TVS Main room: https://link.produkt.ca/ncg-tv</p>';
  content += '<p>NCG: Folder #1 + Show artwork #3<br/>Please remove show artworks at 12am</p>';
  
  return content;
}

export function buildSetTimes(events: EmailTechEvent[]): string {
  let content = '<p><strong>Set Times:</strong></p>';
  
  const ncgEvent = events.find(e => e.event_venue === 'New City Gas');
  const bazartEvent = events.find(e => e.event_venue === 'Bazart');
  
  if (ncgEvent?.timetable) {
    const timetable = parseJson<TimetableEntry[]>(ncgEvent.timetable, []);
    if (timetable.length > 0) {
      content += '<p>Main Room - Set times:</p><ul>';
      timetable.forEach(entry => {
        content += `<li>${entry.time} - ${entry.artist}</li>`;
      });
      content += '</ul>';
    }
  }
  
  if (bazartEvent?.timetable) {
    const timetable = parseJson<TimetableEntry[]>(bazartEvent.timetable, []);
    if (timetable.length > 0) {
      content += '<p>Lounge - Set times:</p><ul>';
      timetable.forEach(entry => {
        content += `<li>${entry.time} - ${entry.artist}</li>`;
      });
      content += '</ul>';
    }
  }
  
  return content;
}

export function buildSoundcheck(events: EmailTechEvent[]): string {
  let soundchecks: Array<{ artist: string; startTime: string; endTime: string }> = [];
  
  events.forEach(event => {
    if (event.soundcheck) {
      const sc = parseJson<SoundcheckInfo>(event.soundcheck, { status: 'no' });
      if (sc.status === 'yes' && sc.start_time && sc.end_time) {
        soundchecks.push({
          artist: event.artist_name,
          startTime: formatTime(sc.start_time),
          endTime: formatTime(sc.end_time)
        });
      }
    }
  });
  
  if (soundchecks.length === 0) {
    return '<p><strong>Soundcheck/Video/Programmation:</strong> NO</p>';
  }
  
  soundchecks.sort((a, b) => a.startTime.localeCompare(b.startTime));
  
  let content = '<p><strong>Soundcheck/Video/Programmation:</strong></p><ul>';
  soundchecks.forEach(sc => {
    content += `<li>${sc.artist}: ${sc.startTime}-${sc.endTime}</li>`;
  });
  content += '</ul>';
  
  return content;
}

export function buildBazart(events: EmailTechEvent[]): string {
  const hasBazart = events.some(e => e.event_venue === 'Bazart');
  
  let content = '<p><strong>Bazart:</strong></p>';
  
  if (hasBazart) {
    content += '<p>Terrace: 5pm: Playlist / 12am: Bazart Music</p>';
    content += '<p>Lounge: 5pm: Playlist / 10pm: Bazart Music</p>';
  } else {
    content += '<p>Terrace: 5pm: Playlist / 12am: Main Room Music</p>';
    content += '<p>Lounge: 5pm: Playlist / 10pm: Main Room Music</p>';
  }
  
  return content;
}

export function buildRider(events: EmailTechEvent[]): string {
  let content = '<p><strong>ALL TECH RIDERS ATTACHED</strong></p>';
  
  const ncgEvent = events.find(e => e.event_venue === 'New City Gas');
  const bazartEvent = events.find(e => e.event_venue === 'Bazart');
  
  if (ncgEvent?.tech_rider) {
    const rider = parseJson<TechRider>(ncgEvent.tech_rider, {});
    content += '<p><strong>NCG BACKLINE</strong></p><ul>';
    
    if (rider.selected_mixer) {
      content += `<li>1x ${rider.selected_mixer}</li>`;
    }
    
    if (rider.equipment) {
      Object.entries(rider.equipment).forEach(([item, details]) => {
        if (details.selected) {
          content += `<li>${details.qty}x ${item}</li>`;
        }
      });
    }
    
    if (rider.other && rider.other.length > 0) {
      rider.other.forEach(item => {
        content += `<li>${item.text}</li>`;
      });
    }
    
    content += '</ul>';
  }
  
  if (bazartEvent?.tech_rider) {
    const rider = parseJson<TechRider>(bazartEvent.tech_rider, {});
    content += '<p><strong>Bazart BACKLINE</strong></p><ul>';
    
    if (rider.selected_mixer) {
      content += `<li>1x ${rider.selected_mixer} (TBD might change)</li>`;
    }
    
    if (rider.equipment) {
      Object.entries(rider.equipment).forEach(([item, details]) => {
        if (details.selected && item.includes('CDJ')) {
          content += `<li>${details.qty}x ${item}</li>`;
        }
      });
    }
    
    content += '</ul>';
  }
  
  return content;
}

export function buildTravellingParty(events: EmailTechEvent[]): string {
  let content = '<p><strong>Travelling party:</strong></p>';
  
  const ncgEvent = events.find(e => e.event_venue === 'New City Gas');
  const bazartEvent = events.find(e => e.event_venue === 'Bazart');
  
  const processEvent = (event: EmailTechEvent) => {
    if (!event.roles) return '';
    
    const roles = parseJson<RoleInfo[]>(event.roles, []);
    if (roles.length === 0) return '';
    
    let eventContent = `<p><strong>${event.artist_name}</strong></p><ul>`;
    
    roles.forEach(role => {
      const name = role.firstName;
      const roleName = role.customRole || role.role;
      eventContent += `<li>${name} - ${roleName}</li>`;
    });
    
    eventContent += '</ul>';
    return eventContent;
  };
  
  if (ncgEvent) content += processEvent(ncgEvent);
  if (bazartEvent) content += processEvent(bazartEvent);
  
  return content;
}

export function buildVJSchedule(events: EmailTechEvent[], crewAssignments: CrewAssignments): string {
  let content = '<p><strong>VJ:</strong></p>';
  
  const mainEvent = events[0];
  if (!mainEvent?.timetable) {
    content += '<p>TBD</p>';
    return content;
  }
  
  const timetable = parseJson<TimetableEntry[]>(mainEvent.timetable, []);
  const houseVJ = crewAssignments.VJ || 'VJ NAME';
  
  content += '<ul>';
  timetable.forEach((entry, index) => {
    if (entry.artist === 'DOORS') {
      const nextEntry = timetable[index + 1];
      if (nextEntry) {
        content += `<li>${entry.time}-${nextEntry.time} - ${houseVJ}</li>`;
      }
    } else if (entry.artist !== 'CURFEW') {
      content += `<li>${entry.time} - ${entry.artist}</li>`;
    }
  });
  content += '</ul>';
  
  return content;
}

export function buildLights(crewAssignments: CrewAssignments): string {
  const ldName = crewAssignments.LD || 'LD NAME';
  
  let content = '<p><strong>Lights:</strong></p>';
  content += '<p>Niveau 1 et terrace: Bazart Colours - 5pm-3am</p>';
  content += `<p>Lounge: 5pm-3am: Bazart Colours + Red Corridor @${ldName}</p>`;
  content += '<p>Facade: 5pm-3am: Red</p>';
  content += '<p>Main room: Red</p>';
  content += '<p>Lasers GA entrance outside: 10pm: Red</p>';
  
  return content;
}

export function buildSFX(events: EmailTechEvent[]): string {
  let sfxLines: string[] = [];
  
  const artistTypes = ['Headliner', 'Support', 'Local'];
  
  artistTypes.forEach(type => {
    events.forEach(event => {
      if (event.artist_type === type && event.sfx_rider) {
        const sfx = parseJson<SfxRider>(event.sfx_rider, {});
        let parts: string[] = [];
        
        if (sfx.cryo_jets?.enabled) {
          const qty = sfx.cryo_jets.qty || 4;
          const duration = sfx.cryo_jets.duration;
          parts.push(`${qty}x CO2 - ${duration} sec`);
        }
        
        if (sfx.sparkulars?.enabled) {
          const qty = sfx.sparkulars.qty || 4;
          const duration = sfx.sparkulars.duration;
          parts.push(`${qty}x Sparks - ${duration} sec`);
        }
        
        if (parts.length > 0) {
          sfxLines.push(`${event.artist_name}: ${parts.join(' / ')}`);
        }
      }
    });
  });
  
  if (sfxLines.length === 0) {
    return '<p><strong>Special FX:</strong> None</p>';
  }
  
  let content = '<p><strong>Special FX:</strong></p>';
  sfxLines.forEach(line => {
    content += `<p>${line}</p>`;
  });
  
  return content;
}

export function buildFooter(): string {
  return `
    <p><strong>Sponsors and/or branding:</strong></p>
    <p>${highlight('SPONSOR HERE')}</p>
    <p><strong>After the show projects:</strong></p>
    <p>${highlight('Project TBD')}</p>
    <p>Please make sure your work space is clean THANK YOU! :)</p>
    <p>Please confirm and let me know if you have any questions !</p>
    <p>Thanks a lot,<br/>Charles</p>
  `;
}

export const techTemplateSections = [
  { id: 'header', label: 'Header', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildHeader(events) },
  { id: 'crew_call', label: 'Crew Call', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildCrewCall(events, crew || {}) },
  { id: 'projects', label: 'Projects', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildProjects(events) },
  { id: 'set_times', label: 'Set Times', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildSetTimes(events) },
  { id: 'soundcheck', label: 'Soundcheck', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildSoundcheck(events) },
  { id: 'bazart', label: 'Bazart', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildBazart(events) },
  { id: 'rider', label: 'Rider', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildRider(events) },
  { id: 'travelling_party', label: 'Travelling Party', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildTravellingParty(events) },
  { id: 'vj_schedule', label: 'VJ Schedule', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildVJSchedule(events, crew || {}) },
  { id: 'lights', label: 'Lights', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildLights(crew || {}) },
  { id: 'sfx', label: 'Special FX', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildSFX(events) },
  { id: 'footer', label: 'Footer', generator: (events: EmailTechEvent[], crew?: CrewAssignments) => buildFooter() },
];