import type {
	EmailTechEvent,
	CrewAssignments,
	TimetableEntry,
	TechRider,
	SfxRider,
	RoleInfo,
	SoundcheckInfo
} from '$lib/types/emailtech';

// Helper to parse JSON
function parseJson<T>(data: any, defaultValue: T): T {
	if (!data) return defaultValue;
	if (typeof data === 'string') {
		try {
			return JSON.parse(data) as T;
		} catch {
			return defaultValue;
		}
	}
	return data as T;
}

// Form Data Interface - Matches your Form Sections
export interface TechEmailFormData {
	liaison: string;
	dos: string;
	crewCallTime7pm: string;
	crewCallTime830pm: string;
    crewNotes: string; // For the "@Team" section
	stageName: string;
	stageLink: string;
	projects: string;
	projectorInfo: string;
	visualsInfo: string;
	sponsors: string;
	postShow: string;
	lightColorLounge: string;
	lightColorFacade: string;
	lightColorFacadeLate: string;
	lightColorMain: string;
	lightColorLaser: string;
    sectionVisibility: Record<string, boolean>;
}

// Default Data Factory
export const createDefaultFormData = (): TechEmailFormData => ({
    liaison: '',
    dos: '',
    crewCallTime7pm: '19:00',
    crewCallTime830pm: '20:30',
    crewNotes: "@Team,\nI’m adjusting the crew call to 8:00 PM.\nWe may need to run house/ambiance music at 3:00 AM, keep lights on and maintain the NCG logo on the LED wall to support the coat check team until approximately 3:15–3:30 AM, depending on the line.\nCharles will confirm at 3:00 AM whether we need to proceed! Thank you in advance for your help !",
    stageName: 'Regular Stage',
    stageLink: 'https://link.produkt.ca/regular',
    projects: '',
    projectorInfo: '9:30pm: Logo NCG',
    visualsInfo: 'TVS Main room: https://link.produkt.ca/ncg-tv\nNCG: Folder #1\n+\nShow artwork: Folder #3\n\nPlease remove show artworks at 12am',
    sponsors: 'NONE',
    postShow: 'Please make sure your work space is clean THANK YOU! :)',
    lightColorLounge: 'Bazart Colours',
    lightColorFacade: 'Bazart Colours',
    lightColorFacadeLate: 'Red',
    lightColorMain: 'Red',
    lightColorLaser: 'Red',
    sectionVisibility: {
        crew_call: true,
        specs: true,
        projects: true,
        set_times: true,
        soundcheck: true,
        bazart_ambiance: true,
        riders: true,
        travelling_party: true,
        vj: true,
        lights: true,
        sfx: true
    }
});

// Helper for Date Formatting: "Friday January 23rd 2026"
function formatEventDate(dateStr: string | null): string {
	if (!dateStr) return 'TBD';
	const date = new Date(dateStr);
    const localDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
    
	const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
    };
	const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(localDate);
    
    const day = parts.find(p => p.type === 'day')?.value;
    let daySuffix = 'th';
    if(day) {
        const d = parseInt(day);
        if (d > 3 && d < 21) daySuffix = 'th';
        else {
            switch (d % 10) {
                case 1: daySuffix = "st"; break;
                case 2: daySuffix = "nd"; break;
                case 3: daySuffix = "rd"; break;
                default: daySuffix = "th"; break;
            }
        }
    }

    return parts.map(p => p.type === 'day' ? `${p.value}${daySuffix}` : p.value).join('');
}

function formatTime(time: string): string {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m}${ampm}`;
}

export function generateTechEmail(
	events: EmailTechEvent[],
	crew: CrewAssignments,
	formData: TechEmailFormData
): string {
	const mainEvent = events.find(e => e.event_venue === 'New City Gas') || events[0];
    const bazartEvent = events.find(e => e.event_venue === 'Bazart');
    
    const formattedDate = formatEventDate(mainEvent.event_date);
    const eventName = mainEvent.event_name || 'Event';
    const liaison = formData.liaison || 'Charles'; 

	let html = '';

    // --- Header ---
	html += `<p>Hello everyone,</p>
    <p>Here are the info for <strong>${eventName} - ${formattedDate}</strong><br>
    Please note <strong>${liaison}</strong> will be working with you for this show.</p><p>&nbsp;</p>`;

    // --- Crew Call ---
    if (formData.sectionVisibility['crew_call']) {
        html += `<p><strong>Crew call:</strong></p>`;
        
        // 7PM/8PM Call
        const crew7pm = [
            ...(crew['LD'] || []),
            ...(crew['Video'] || []),
            ...(crew['Sound'] || []),
            ...(crew['Stage/Tech'] || []),
            ...(crew['DT'] || [])
        ].join(', ');
        html += `<p>${formData.crewCallTime7pm}: ${crew7pm || 'TBD'}</p>`;

        // VJ Call
        const crewVJ = (crew['VJ'] || []).join(', ');
        html += `<p>${formData.crewCallTime830pm}: ${crewVJ || 'TBD'}</p>`;
        
        // Notes
        if (formData.crewNotes) {
            html += `<p>&nbsp;</p><p>${formData.crewNotes.replace(/\n/g, '<br>')}</p>`;
        }
        html += `<p>&nbsp;</p>`;
    }

    // --- Specs ---
    if (formData.sectionVisibility['specs']) {
        if(formData.stageName && formData.stageLink) {
            html += `<p><strong>${formData.stageName}:</strong> <a href="${formData.stageLink}">${formData.stageLink}</a></p>`;
        }
        
        const specs = [
            { label: 'Bazart Specs', link: 'https://drive.google.com/drive/folders/1f-twa-hlssqjpUD2CN0zdqGn8cYnbpWY?usp=share_link' },
            { label: 'DSTRKT Specs', link: 'https://drive.google.com/drive/folders/13ZyO3sv6suZHnkxn8jN1mnS2N_Foqzyx?usp=share_link' },
            { label: 'NCG Specs', link: 'https://drive.google.com/drive/folders/13_TFSl6-u6JF6mZ7XD9hJ9SRVAWTEc0e?usp=share_link' },
            { label: 'NCG 360 Specs', link: 'https://drive.google.com/file/d/13VNqmW0KWzLnsQTqn8bDEJpJGYJ35Tpq/view?usp=share_link' }
        ];

        specs.forEach(s => {
            html += `<p>${s.label}: <a href="${s.link}">${s.link}</a></p>`;
        });
        html += `<p>&nbsp;</p>`;
    }

    // --- Projects ---
    if (formData.sectionVisibility['projects']) {
        html += `<p><strong>Projects:</strong></p>`;
        if (formData.projects) {
            html += `<p>${formData.projects.replace(/\n/g, '<br>')}</p>`;
        } else {
            html += `<p>None</p>`;
        }
        html += `<p>&nbsp;</p>`;
        
        // Video Lead + Projector
        const videoLead = (crew['Video']?.[0] || 'Video').split(' ')[0];
        html += `<p>@${videoLead}<br>
        Projecteur extérieur:<br><br>
        ${formData.projectorInfo.replace(/\n/g, '<br>')}</p><p>&nbsp;</p>`;

        html += `<p>Visuals for TVS and Interior Projector:<br><br>
        ${formData.visualsInfo.replace(/\n/g, '<br>')}</p><p>&nbsp;</p>`;
    }

    // --- Set Times ---
    if (formData.sectionVisibility['set_times']) {
        // Main Room
        if (mainEvent && mainEvent.timetable) {
            html += `<p><strong>Main Room - Set times:</strong></p>`;
            const tt = parseJson<TimetableEntry[]>(mainEvent.timetable, []);
            tt.forEach(t => html += `<p>${t.time} - ${t.artist}</p>`);
        }

        // Lounge / Bazart
        if (bazartEvent && bazartEvent.timetable) {
            html += `<p>&nbsp;</p><p><strong>Lounge Bazart - Set times:</strong></p>`;
            const tt = parseJson<TimetableEntry[]>(bazartEvent.timetable, []);
            tt.forEach(t => html += `<p>${t.time} - ${t.artist}</p>`);
        }
        html += `<p>&nbsp;</p>`;
    }

    // --- Soundcheck ---
    if (formData.sectionVisibility['soundcheck']) {
        html += `<p><strong>Soundcheck/Video/Programmation:</strong></p>`;
        let hasSoundcheck = false;
        
        events.forEach(e => {
            if (e.soundcheck) {
                const sc = parseJson<SoundcheckInfo>(e.soundcheck, { status: 'no' });
                if (sc.status === 'yes' && sc.start_time && sc.end_time) {
                    hasSoundcheck = true;
                    html += `<p>${e.artist_name}: ${formatTime(sc.start_time)}-${formatTime(sc.end_time)}</p>`;
                }
            }
        });

        if (!hasSoundcheck) {
            html += `<p>NONE</p>`;
        }
        html += `<p>&nbsp;</p>`;
    }

    // --- Bazart Specifics ---
    if (formData.sectionVisibility['bazart_ambiance']) {
        html += `<p><strong>Bazart:</strong><br>
        Back Terrace: 10pm: Main Room Music (not loud/ambiance music for coatcheck)<br>
        Lounge: 5pm: Playlist- 11pm Music from main room</p><p>&nbsp;</p>`;
    }

    // --- Riders / Backline ---
    if (formData.sectionVisibility['riders']) {
        html += `<p><strong>ALL TECH RIDERS ATTACHED</strong></p>`;
        
        // Main Room Backline
        if (mainEvent?.tech_rider) {
            html += generateBacklineHtml(mainEvent.tech_rider, 'BACKLINE MAIN ROOM');
        }
        // Bazart Backline
        if (bazartEvent?.tech_rider) {
            html += generateBacklineHtml(bazartEvent.tech_rider, 'BACKLINE BAZART');
        }
        html += `<p>&nbsp;</p>`;
    }

    // --- Travelling Party ---
    if (formData.sectionVisibility['travelling_party']) {
        html += `<p><strong>Travelling party:</strong></p>`;
        events.forEach(e => {
            if(e.roles) {
                const roles = parseJson<RoleInfo[]>(e.roles, []);
                if (roles.length > 0) {
                    html += `<p><strong>${e.artist_name.toUpperCase()}</strong></p>`;
                    roles.forEach(r => {
                        html += `<p>${r.firstName} - ${r.customRole || r.role}</p>`;
                    });
                    html += `<p>&nbsp;</p>`;
                }
            }
        });
    }

    // --- VJ ---
    if (formData.sectionVisibility['vj']) {
        html += `<p><strong>VJ:</strong></p>`;
        const vjs = (crew['VJ'] || []).join(', ');
        // Find main event duration roughly or hardcode as requested
        html += `<p>10PM-3AM: ${vjs || 'TBD'}</p><p>&nbsp;</p>`;
    }

    // --- Lights ---
    if (formData.sectionVisibility['lights']) {
        html += `<p><strong>Lights:</strong><br>
        Lounge: 5pm-3am: ${formData.lightColorLounge}<br>
        Facade: 5pm-10pm: ${formData.lightColorFacade}<br>
        Facade: 10pm-3am: ${formData.lightColorFacadeLate}<br>
        Main room: ${formData.lightColorMain}<br>
        Lasers GA entrance outside: 10pm: ${formData.lightColorLaser}</p><p>&nbsp;</p>`;
    }

    // --- SFX ---
    if (formData.sectionVisibility['sfx']) {
        html += `<p><strong>SFX:</strong></p>`;
        let hasSfx = false;
        events.forEach(e => {
            if (e.sfx_rider) {
                const sfx = parseJson<SfxRider>(e.sfx_rider, {});
                let line = [];
                if (sfx.sparkulars?.enabled) line.push(`${sfx.sparkulars.qty || 4}x Sparks (${sfx.sparkulars.duration}s)`);
                if (sfx.cryo_jets?.enabled) line.push(`${sfx.cryo_jets.qty || 4}x CO2 (${sfx.cryo_jets.duration}s)`);
                
                if (line.length > 0) {
                    hasSfx = true;
                    html += `<p>${e.artist_name}: ${line.join(' + ')}</p>`;
                }
            }
        });
        if (!hasSfx) html += `<p>NONE</p>`;
        html += `<p>&nbsp;</p>`;
    }

    // --- Sponsors & Footer ---
    html += `<p><strong>Sponsors and/or branding:</strong> ${formData.sponsors || 'NONE'}</p>`;
    html += `<p><strong>After the show projects:</strong><br>${formData.postShow || 'Please make sure your work space is clean THANK YOU! :)'}</p>`;
    
    html += `<p>&nbsp;</p><p>Please confirm and let me know if you have any questions !</p>
    <p>Thanks a lot,<br>Charles</p>`;

	return html;
}

function generateBacklineHtml(riderJson: any, title: string): string {
    const rider = parseJson<TechRider>(riderJson, {});
    let html = `<p><strong>${title}</strong></p>`;
    
    if (rider.selected_mixer) html += `<p>1x ${rider.selected_mixer}</p>`;
    if (rider.equipment) {
        Object.entries(rider.equipment).forEach(([key, val]: [string, any]) => {
            if (val.selected) html += `<p>${val.qty}x ${key}</p>`;
        });
    }
    return html;
}