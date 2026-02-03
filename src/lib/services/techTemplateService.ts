import type { EmailTechEvent, TechEmailForm, TimetableEntry } from '$lib/types/emailtech';

export const techTemplateSections = [
	{ id: 'header', label: 'Header & Liaison' },
	{ id: 'crew_call', label: 'Crew Call' },
	{ id: 'team_notes', label: 'Team Notes' },
	{ id: 'specs', label: 'Venue Specs' },
	{ id: 'projects', label: 'Projects' },
	{ id: 'visuals', label: 'Video & Visuals' },
	{ id: 'set_times', label: 'Set Times' },
	{ id: 'soundcheck', label: 'Soundcheck' },
    { id: 'lounge_ambiance', label: 'Lounge Ambiance' },
	{ id: 'backline', label: 'Backline / Riders' },
	{ id: 'travelling', label: 'Travelling Party' },
	{ id: 'vj_notes', label: 'VJ Notes' },
	{ id: 'vj_visuals', label: 'VJ Content' },
	{ id: 'vj', label: 'VJ Schedule' },
	{ id: 'lights', label: 'Lights Colors' },
	{ id: 'sfx', label: 'SFX' },
	{ id: 'sponsors', label: 'Footer' }
];

export const defaultTechForm: TechEmailForm = {
	visible_sections: {
		header: true,
		crew_call: true,
		team_notes: true,
		specs: true,
		projects: true,
		visuals: true,
		set_times: true,
		soundcheck: true,
        lounge_ambiance: true,
		backline: true,
		travelling: true,
		vj: true,
		lights: true,
		sfx: true,
		sponsors: true,
		vj_notes: false,
		vj_visuals: true
	},
	liaison: '',
	crew_calls: [
		{ time: '', names: '' },
		{ time: '', names: '' }
	],
	team_notes: '',
	vj_notes: '',
	specs_links: [
		{
			label: 'NCG Specs',
			url: 'https://drive.google.com/drive/folders/13_TFSl6-u6JF6mZ7XD9hJ9SRVAWTEc0e?usp=share_link'
		}
	],
	projects: [],
	projector_outdoor: '',
	visuals_interior: '',
	sponsor_name: 'None',
	sponsor_link: '',
	set_times: [],
	soundcheck: '',
	riders_attached: true,
	backline: [],
	travelling_party: '',
	vj_schedule: '',
	lights: [
		{ area: 'Niveau 1/Terrace', color: '' },
		{ area: 'Lounge', color: '' },
		{ area: 'Facade', color: '' },
		{ area: 'Main Room', color: '' },
		{ area: 'Laser GA', color: '' }
	],
	sfx: '',
	sponsors: '',
	post_show: '',
    
    lounge_ambiance: {
        terrasse_type: null,
        terrasse_option: '',
        terrasse_custom: '',
        lounge_option: '',
        lounge_custom: ''
    }
};

export function initSetTimes(events: EmailTechEvent[]) {
	const setTimes: { event_id: number; venue: string; entries: TimetableEntry[] }[] = [];
	events.forEach((evt) => {
		if (evt.timetable) {
			let entries: TimetableEntry[] = [];
			try {
				entries = typeof evt.timetable === 'string' ? JSON.parse(evt.timetable) : evt.timetable;
			} catch (e) {
				console.error('Error parsing timetable', e);
			}
			let venueLabel =
				evt.event_venue === 'New City Gas'
					? 'Main Room'
					: evt.event_venue === 'Bazart'
						? 'Bazart Lounge'
						: 'Set Times';
			setTimes.push({ event_id: evt.event_id, venue: venueLabel, entries: entries });
		}
	});
	return setTimes;
}

export function autofillTechForm(
	events: EmailTechEvent[],
	currentForm: TechEmailForm
): TechEmailForm {
	const mainEvent = events.find((e) => e.event_venue === 'New City Gas') || events[0];
	const bazartEvent = events.find((e) => e.event_venue === 'Bazart');
	const existingVisibility = currentForm.visible_sections || defaultTechForm.visible_sections;
    
    // Explicitly define the default object here to satisfy TypeScript
    // (We cannot rely on defaultTechForm.lounge_ambiance alone because TS views it as optional on the Type)
    const defaultLoungeValues = {
        terrasse_type: null as 'back-side' | 'back' | null,
        terrasse_option: '',
        terrasse_custom: '',
        lounge_option: '',
        lounge_custom: ''
    };

    const existingLounge = currentForm.lounge_ambiance || defaultLoungeValues;
    
	const form: TechEmailForm = { 
        ...currentForm, 
        visible_sections: { ...existingVisibility }, 
        lounge_ambiance: { ...existingLounge } 
    };

	form.liaison =
		bazartEvent && mainEvent.event_venue === 'New City Gas'
			? 'Charles (Main Room) and Émile (Bazart)'
			: 'Charles';

	if (mainEvent.crew) {
		const techs = [
			...(mainEvent.crew['LD'] || []),
			...(mainEvent.crew['Sound'] || []),
			...(mainEvent.crew['Stage/Tech'] || []),
			...(mainEvent.crew['Video'] || [])
		]
			.map((n) => n.split(' ')[0])
			.join(', ');
		const vjs = (mainEvent.crew['VJ'] || []).map((n) => n.split(' ')[0]).join(', ');
		form.crew_calls = [
			{ time: '19:00', names: techs },
			{ time: '21:00', names: vjs || 'Marco' }
		];
	}

	const eventNameUpper = (mainEvent.event_name || '').toUpperCase();
	const venue = mainEvent.event_venue || 'New City Gas';
	
	let specsLabel = 'NCG Specs';
	let specsUrl = 'https://drive.google.com/drive/folders/13_TFSl6-u6JF6mZ7XD9hJ9SRVAWTEc0e?usp=share_link';

	if (eventNameUpper.includes('DSTRKT')) {
		specsLabel = 'DSTRKT Specs';
		specsUrl = 'https://drive.google.com/drive/folders/13ZyO3sv6suZHnkxn8jN1mnS2N_Foqzyx?usp=share_link';
	} else if (eventNameUpper.includes('NCG360') || eventNameUpper.includes('360')) {
		specsLabel = 'NCG 360 Specs';
		specsUrl = 'https://drive.google.com/drive/folders/1F-q3_R9Cg3o3J-d6_F5g_u6_K7_y9_b_?usp=sharing';
	} else if (venue === 'Bazart' || eventNameUpper.includes('BAZART')) {
		specsLabel = 'Bazart Specs';
		specsUrl = 'https://drive.google.com/drive/folders/1f-twa-hlssqjpUD2CN0zdqGn8cYnbpWY?usp=share_link';
	}

	form.specs_links = [{ label: specsLabel, url: specsUrl }];

	if (!form.team_notes) form.team_notes = '@Team';
	form.projects = ['TBD'];
	form.projector_outdoor = '9:30 PM - NCG Logo';
	if (!form.visuals_interior)
		form.visuals_interior =
			'Link: https://link.produkt.ca/ncg-tv\nNCG: Folder #1\nShow Artwork: Folder #3\nPlease remove show artworks at 12:00 AM';

	form.set_times = initSetTimes(events);
	form.vj_schedule = `10PM-3:00AM: ${(mainEvent.crew?.['VJ'] || []).map((n) => n.split(' ')[0]).join(', ') || 'Marco'}`;

	if (!form.lights || form.lights.length === 0) form.lights = defaultTechForm.lights;

	const sfxLines = events.filter((e) => e.sfx_rider).map((e) => `${e.artist_name} - SFX`);
	form.sfx = sfxLines.length > 0 ? sfxLines.join('\n') : 'NONE';
	form.post_show = 'Please make sure your work space is clean THANK YOU! :)';

	return form;
}