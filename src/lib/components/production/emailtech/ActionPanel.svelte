<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { EmailTechEvent, TechEmailForm, CrewMember, EmailFormat } from '$lib/types/emailtech';
	import { normalizeCrew } from '$lib/types/emailtech';
	import { emailSettings, renderSubject, subjectDateParts } from '$lib/services/emailSettingsService';
	import { liaisonNamesOf } from '$lib/services/techTemplateService';
	import { dosContactMap } from '$lib/components/settings/AdvanceVariables';
	import { generateVJEmailString, generateVJEmailText, generateVJFileName } from '$lib/utils/emailGenerator';
	import { generateTechEmailString, generateTechEmailText, generateTechFileName } from '$lib/utils/emailTechGenerator';

	export let formData: TechEmailForm;
	export let selectedEvents: EmailTechEvent[] = [];
	export let crewMembers: CrewMember[] = [];
	export let senderName = 'Tech Team';

	const dispatch = createEventDispatcher<{
		change: void;
		preview: 'tech' | 'vj';
		mails: { tech: string; vj: string };
	}>();
	let isProcessing = false;

	$: isEventSelected = selectedEvents && selectedEvents.length > 0;
	$: settings = $emailSettings;
	$: format = (formData?.email_format || settings.format) as EmailFormat;

	function setFormat(f: EmailFormat) {
		if (!formData || formData.email_format === f) return;
		formData.email_format = f;
		dispatch('change');
	}

	/* ------------------------------------------------------- recipients */

	const lower = (s: string) => s.trim().toLowerCase();
	const dedupe = (list: string[], not: string[] = []) => {
		const seen = new Set(not.map(lower));
		return list.filter((e) => {
			const k = lower(e);
			if (!k || seen.has(k)) return false;
			seen.add(k);
			return true;
		});
	};

	function crewEmails(crew: any, roles?: string[]): string[] {
		const c = normalizeCrew(crew);
		const names = (roles || Object.keys(c)).flatMap((r) => c[r] || []);
		return dedupe(
			names
				.map((n) => crewMembers.find((m) => lower(m.name) === lower(n))?.email || '')
				.filter(Boolean)
		);
	}

	function liaisonEmails(events: EmailTechEvent[]): string[] {
		return dedupe(
			events
				.flatMap((e) => liaisonNamesOf(e))
				.map((n) => dosContactMap[n]?.email || '')
				.filter(Boolean)
		);
	}

	// The selected event owns the crew; linked events only add their info.
	$: mainEvent = selectedEvents[0];
	$: allCrew = mainEvent ? normalizeCrew(mainEvent.crew) : {};
	$: techTo = mainEvent && settings.autoPeople.crewTo
		? crewEmails(mainEvent.crew, ['LD', 'VIDEO', 'VJ', 'SOUND', 'TECH', 'DT'])
		: [];
	$: liaisonCc = settings.autoPeople.liaisonCc ? liaisonEmails(selectedEvents) : [];
	$: techCc = dedupe([...liaisonCc, ...settings.tech.cc], techTo);
	$: techBcc = dedupe(settings.tech.bcc, [...techTo, ...techCc]);

	$: vjName = ((allCrew.VJ || [])[0] || '').split(' ')[0] || '';
	$: vjTo = mainEvent ? crewEmails(mainEvent.crew, ['VJ']) : [];
	$: vjCc = dedupe([...liaisonCc, ...settings.vj.cc], vjTo);
	$: vjBcc = dedupe(settings.vj.bcc, [...vjTo, ...vjCc]);

	$: subjectCtx = (() => {
		const d = subjectDateParts(mainEvent?.event_date);
		return {
			events: Array.from(new Set(selectedEvents.map((e) => e.event_name || e.artist_name))).join(' / '),
			event: mainEvent?.event_name || mainEvent?.artist_name || '',
			artist: mainEvent?.artist_name || '',
			date: d.long,
			date_short: d.short,
			weekday: d.weekday,
			venue: Array.from(new Set(selectedEvents.map((e) => e.event_venue).filter(Boolean))).join(' + '),
			liaison: Array.from(new Set(selectedEvents.flatMap((e) => liaisonNamesOf(e)))).join(' & '),
			vj: vjName || 'VJ'
		};
	})();
	$: techSubject = renderSubject(settings.tech.subject, subjectCtx);
	$: vjSubject = renderSubject(settings.vj.subject, subjectCtx);

	/* --------------------------------------------------------- generate */

	async function handleSendEmails() {
		if (!isEventSelected || isProcessing) return;
		isProcessing = true;

		try {
			const { data: { user } } = await supabase.auth.getUser();
			const senderEmail = user?.email || 'tech@newcitygas.com';

			const techHtml = generateTechEmailString(selectedEvents, formData, senderName, format);
			const techText = generateTechEmailText(selectedEvents, formData, senderName);
			const vjHtml = generateVJEmailString(selectedEvents, formData, senderName, format);
			const vjText = generateVJEmailText(selectedEvents, formData, senderName);

			// The page stores both through the sync engine.
			dispatch('mails', { tech: techHtml, vj: vjHtml });

			const attachments = await fetchAndProcessRiders(selectedEvents);

			downloadEml({
				subject: techSubject,
				from: senderEmail,
				to: techTo,
				cc: techCc,
				bcc: techBcc,
				html: techHtml,
				text: techText,
				filename: generateTechFileName(selectedEvents),
				attachments
			});

			if (vjName) {
				setTimeout(() => {
					downloadEml({
						subject: vjSubject,
						from: senderEmail,
						to: vjTo,
						cc: vjCc,
						bcc: vjBcc,
						html: vjHtml,
						text: vjText,
						filename: generateVJFileName(selectedEvents),
						attachments: []
					});
				}, 600);
			}
		} catch (e) {
			console.error('Error generating emails:', e);
			alert('Error generating email files. Check console.');
		} finally {
			isProcessing = false;
		}
	}

	// --- Riders: every advance row of every selected event ---
	async function fetchAndProcessRiders(events: EmailTechEvent[]) {
		const attachments: { filename: string; content: string; mimeType: string }[] = [];
		const seen = new Set<number>();

		for (const event of events) {
			if (!event.event_id || seen.has(event.event_id)) continue;
			seen.add(event.event_id);

			try {
				const { data: advanceRows, error } = await supabase
					.from('events_advance')
					.select('rider_files, artist_name')
					.eq('event_id', event.event_id);

				if (error) {
					console.warn(`Error fetching riders for event ${event.event_id}:`, error);
					continue;
				}
				if (!advanceRows || advanceRows.length === 0) continue;

				for (const row of advanceRows) {
					if (!row.rider_files) continue;

					let riderData = row.rider_files;
					if (typeof riderData === 'string') {
						try {
							riderData = JSON.parse(riderData);
						} catch (e) {
							continue;
						}
					}

					const techRiderUrl = riderData?.tech_rider_url;
					if (!techRiderUrl) continue;

					try {
						const response = await fetch(techRiderUrl);
						if (!response.ok) throw new Error(`Failed to fetch: ${techRiderUrl}`);

						const blob = await response.blob();
						const fullBase64 = await blobToBase64(blob);

						const artistName = row.artist_name || 'Artist';
						const cleanName = `${artistName}_Tech_Rider.pdf`.replace(/[^a-z0-9_\-\.]/gi, '_');

						attachments.push({
							filename: cleanName,
							content: fullBase64.split(',')[1],
							mimeType: blob.type || 'application/pdf'
						});
					} catch (err) {
						console.error(`Failed to attach rider for ${row.artist_name}`, err);
					}
				}
			} catch (outerErr) {
				console.error(`Error processing event ${event.event_id}`, outerErr);
			}
		}
		return attachments;
	}

	function blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	/* -------------------------------------------------------------- eml */

	// RFC 2047 so accents in the subject survive every client.
	function encodeHeader(v: string): string {
		return /^[\x20-\x7e]*$/.test(v) ? v : `=?utf-8?B?${toBase64Utf8(v)}?=`;
	}

	function toBase64Utf8(s: string): string {
		const bytes = new TextEncoder().encode(s);
		let bin = '';
		bytes.forEach((b) => (bin += String.fromCharCode(b)));
		return btoa(bin);
	}

	function downloadEml(opts: {
		subject: string;
		from: string;
		to: string[];
		cc: string[];
		bcc: string[];
		html: string;
		text: string;
		filename: string;
		attachments: { filename: string; content: string; mimeType: string }[];
	}) {
		const boundary = '----=_NextPart_000_0001';
		const mixedBoundary = '----=_NextPart_Mixed_000_0002';

		const headers = [
			`From: ${opts.from}`,
			`To: ${opts.to.join(', ')}`,
			opts.cc.length ? `Cc: ${opts.cc.join(', ')}` : '',
			opts.bcc.length ? `Bcc: ${opts.bcc.join(', ')}` : '',
			`Subject: ${encodeHeader(opts.subject)}`,
			`Date: ${new Date().toUTCString()}`,
			'MIME-Version: 1.0',
			'X-Unsent: 1',
			`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
		].filter(Boolean);

		let emlContent = `${headers.join('\r\n')}\r\n\r\n--${mixedBoundary}\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${chunkString(toBase64Utf8(opts.text), 76)}\r\n\r\n--${boundary}\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${chunkString(toBase64Utf8(opts.html), 76)}\r\n\r\n--${boundary}--\r\n`;

		opts.attachments.forEach((file) => {
			emlContent += `\r\n--${mixedBoundary}\r\nContent-Type: ${file.mimeType}; name="${file.filename}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${file.filename}"\r\n\r\n${chunkString(file.content, 76)}\r\n`;
		});

		emlContent += `--${mixedBoundary}--\r\n`;

		const blob = new Blob([emlContent], { type: 'message/rfc822' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${opts.filename}.eml`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	function chunkString(str: string, length: number) {
		return str.match(new RegExp('.{1,' + length + '}', 'g'))?.join('\r\n') || str;
	}

</script>

<div
	class="h-full flex flex-col bg-navbar border border-gray1 rounded-xl transition-all duration-300
    {!isEventSelected ? 'opacity-50 grayscale cursor-not-allowed' : ''}"
>
	<div class="h-full flex flex-col p-4 justify-center gap-3">
		<div class="flex items-center justify-between">
			<h3 class="text-white text-sm font-bold">Actions</h3>
			<div class="flex gap-1 bg-gray1 p-0.5 rounded-lg" title="Email body format">
				<button type="button" disabled={!isEventSelected} on:click={() => setFormat('html')}
					class="px-2.5 text-[10px] font-bold py-1 rounded-md transition-all cursor-pointer {format === 'html' ? 'bg-lime text-black' : 'text-gray-400 hover:text-white'}">HTML</button>
				<button type="button" disabled={!isEventSelected} on:click={() => setFormat('text')}
					class="px-2.5 text-[10px] font-bold py-1 rounded-md transition-all cursor-pointer {format === 'text' ? 'bg-lime text-black' : 'text-gray-400 hover:text-white'}">Text</button>
			</div>
		</div>

		<div class="flex gap-2">
			<button
				type="button"
				on:click={handleSendEmails}
				disabled={!isEventSelected || isProcessing}
				class="flex-1 bg-lime text-black rounded-lg px-3 py-2.5 text-xs font-bold
	               flex items-center justify-center gap-2 hover:bg-white
	               transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
			>
				{#if isProcessing}
					<svg class="animate-spin h-3.5 w-3.5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Processing…
				{:else}
					<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
					Download .eml
				{/if}
			</button>

			<button
				type="button"
				on:click={() => dispatch('preview', 'tech')}
				disabled={!isEventSelected}
				class="flex-1 rounded-lg px-3 py-2.5 text-xs font-bold border border-gray1 text-gray2 hover:text-white hover:border-gray2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
			>
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
				Preview
			</button>
		</div>
	</div>
</div>
