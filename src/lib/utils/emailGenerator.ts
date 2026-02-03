import type { EmailTechEvent, TechEmailForm, TimetableEntry } from '$lib/types/emailtech';

/**
 * Generates a file name for the VJ email: VJ_Name_Month_Day_Year
 */
export function generateVJFileName(events: EmailTechEvent[]): string {
    const mainEvent = events.find((e) => e.event_venue === 'New City Gas') || events[0];
    if (!mainEvent) return 'VJ_Email_Export';

    const vjCrew = mainEvent.crew?.['VJ'] || [];
    const vjName = vjCrew.length > 0 ? vjCrew[0].split(' ')[0] : 'VJ';
    
    if (!mainEvent.event_date) return `VJ_${vjName}_Date_TBD`;

    const date = new Date(mainEvent.event_date);
    const localDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
    
    const month = localDate.toLocaleString('en-US', { month: 'long' });
    const day = localDate.getDate();
    const year = localDate.getFullYear();

    return `VJ_${vjName}_${month}_${day}_${year}`;
}

/**
 * Generates the VJ Email
 */
export function generateVJEmailString(events: EmailTechEvent[], form: TechEmailForm, senderName: string): string {
    const mainEvent = events.find((e) => e.event_venue === 'New City Gas') || events[0];
    if (!mainEvent) return '';

    const vjName = (mainEvent.crew?.['VJ'] || ['VJ'])[0].split(' ')[0];
    const dateStr = formatDate(mainEvent.event_date);
    const titleNames = events.map((e) => e.event_name || e.artist_name).join(' / ');

    const formatTime = (time: string) => {
        if (!time) return 'TBD';
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes}${ampm}`;
    };

    let vjCall24 = '21:00';
    const vjCallEntry = form.crew_calls.find(c => 
        c.names.toLowerCase().includes(vjName.toLowerCase()) || 
        c.names.toLowerCase().includes('vj')
    );
    if (vjCallEntry) vjCall24 = vjCallEntry.time;

    let html = `<div style="font-family: sans-serif; font-size: 10pt; color: #000; line-height: 1.3;">`;

    html += `<p style="margin: 0 0 10px 0;">Hi ${vjName},<br>
    Here's all the information for <strong>${titleNames} - ${dateStr}</strong><br>
    Please be on site at <strong>${formatTime(vjCall24)}</strong></p>`;

    // --- SET TIMES (WITH BOLD HEADLINER) ---
    const isHeadliner = (entry: TimetableEntry) => {
        // Casting as any to bypass TS error since TimetableEntry is missing artist_type
        return (entry as any).artist_type === 'Headliner';
    };

    const mainSetTimes = form.set_times.find(st => st.venue.includes('Main') || st.venue.includes('New City Gas'));
    if (mainSetTimes) {
        html += `<p style="margin: 0;"><strong style="text-decoration: underline;">Main Room - Set times:</strong></p>
                 <div style="margin: 0 0 10px 0;">`;
        (mainSetTimes.entries || []).forEach((t) => {
            const line = `${t.time} - ${t.artist}`;
            if (isHeadliner(t)) {
                html += `<strong>${line}</strong><br>`;
            } else {
                html += `${line}<br>`;
            }
        });
        html += `</div>`;
    }

    if (form.vj_notes && form.vj_notes.trim()) {
        html += `<p style="margin: 0 0 10px 0;">@${vjName}: ${form.vj_notes.replace(/\n/g, '<br>')}</p>`;
    }

    html += `<p style="margin: 0 0 10px 0;"><strong>Branding/Sponsor:</strong> ${form.sponsors || 'NONE'}</p>`;

    (form.specs_links || []).forEach((l) => {
        html += `<p style="margin: 0;"><strong>${l.label}</strong>: <a href="${l.url}">${l.url}</a></p>`;
    });
    html += `<br>`;

    if (form.soundcheck) {
        html += `<p style="margin: 0;"><strong>Soundcheck/Video/Programmation:</strong></p>
        <ul style="margin: 0 0 10px 0; padding-left: 20px; list-style-type: disc;">`;
        form.soundcheck.split('\n').forEach(line => {
            if (line.trim()) html += `<li>${line.trim()}</li>`;
        });
        html += `</ul>`;
    }

    html += `<p style="margin: 0;"><strong style="text-decoration: underline;">Visual Links:</strong></p>`;
    if (form.vj_visuals && form.vj_visuals !== 'WAITING') {
        const lines = form.vj_visuals.split('\n');
        let currentArtist = "";
        const artistLinks: { [key: string]: string[] } = {};
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (trimmed.startsWith('- ')) {
                const url = trimmed.replace('- ', '');
                if (currentArtist) {
                    if (!artistLinks[currentArtist]) artistLinks[currentArtist] = [];
                    artistLinks[currentArtist].push(url);
                }
            } else {
                currentArtist = trimmed;
            }
        });
        
        Object.entries(artistLinks).forEach(([artist, links]) => {
            if (links.length === 1) {
                html += `<p style="margin: 0 0 5px 0;">${artist}: <a href="${links[0]}">${links[0]}</a></p>`;
            } else {
                html += `<p style="margin: 0;">${artist}</p>
                         <ul style="margin: 0 0 10px 0; padding-left: 20px; list-style-type: disc;">`;
                links.forEach(link => {
                    html += `<li><a href="${link}">${link}</a></li>`;
                });
                html += `</ul>`;
            }
        });
    } else {
        html += `<p style="margin: 0 0 10px 0;">WAITING</p>`;
    }

    html += `<p style="margin: 10px 0 0 0;">Let me know if there's anything :)</p>
             <p style="margin: 0;">Thanks,<br>${senderName}</p>`;
    html += `</div>`;

    return html;
}

export function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    const localDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
    return localDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function stripHtml(html: string): string {
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<li>/gi, '• ').replace(/<\/li>/gi, '\n').replace(/<[^>]+>/g, '');
}