<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { EmailTechEvent, TechEmailForm, CrewMember } from '$lib/types/emailtech';
	import { updateEventEmail, fetchCrewMembers } from '$lib/services/emailtechService';
	import { generateVJEmailString, generateVJFileName, stripHtml } from '$lib/utils/emailGenerator';
	import { generateTechEmailString, generateTechFileName } from '$lib/utils/emailTechGenerator';

	export let formData: TechEmailForm;
	export let selectedEvents: EmailTechEvent[] = [];
	const dispatch = createEventDispatcher();
	let isProcessing = false;

	$: isEventSelected = selectedEvents && selectedEvents.length > 0;

	const GENERAL_CC = ['janie@produkt.ca', 'danny@produkt.ca'];
	const TECH_ONLY_CC = ['e.nlamoureux@onedot.ca', 'smorrisson@hqaudio.ca', 'fchampagne@hqaudio.ca'];

	async function handleSendEmails() {
		if (!isEventSelected || isProcessing) return;
		isProcessing = true;

		try {
			// Identify Main Event (New City Gas)
			const mainEvent =
				selectedEvents.find((e) => e.event_venue === 'New City Gas') || selectedEvents[0];

			const {
				data: { user }
			} = await supabase.auth.getUser();
			const senderEmail = user?.email || 'tech@newcitygas.com';
			const senderName =
				user?.user_metadata?.first_name || user?.user_metadata?.name?.split(' ')[0] || 'Tech Team';

			// Resolve Emails
			const allCrew: CrewMember[] = await fetchCrewMembers();
			const toEmails = resolveCrewEmails(mainEvent.crew, allCrew);
			const toString = toEmails.join(', ');

			const vjEmailList = resolveCrewEmails({ VJ: mainEvent.crew?.['VJ'] || [] }, allCrew);
			const vjToEmails = vjEmailList.length > 0 ? vjEmailList : toEmails;
			const vjToString = vjToEmails.join(', ');

			const techCcString = [...GENERAL_CC, ...TECH_ONLY_CC]
				.filter(
					(ccEmail) =>
						!toEmails.some(
							(toEmail) => toEmail.toLowerCase().trim() === ccEmail.toLowerCase().trim()
						)
				)
				.join(', ');

			const vjCcString = GENERAL_CC.filter(
				(ccEmail) =>
					!vjToEmails.some(
						(toEmail) => toEmail.toLowerCase().trim() === ccEmail.toLowerCase().trim()
					)
			).join(', ');

			// Generate Content
			const techHtml = generateTechEmailString(selectedEvents, formData, senderName);
			const vjHtml = generateVJEmailString(selectedEvents, formData, senderName);

			// Save Content
			await updateEventEmail(mainEvent.event_id, 'tech', techHtml);
			await updateEventEmail(mainEvent.event_id, 'vj', vjHtml);

			const dateObj = new Date(mainEvent.event_date || '');
			const localDate = new Date(dateObj.valueOf() + dateObj.getTimezoneOffset() * 60 * 1000);
			const simpleDate = localDate.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
			const eventTitle = mainEvent.event_name || mainEvent.artist_name;

			const techSubject = `${eventTitle} | Set times + tech riders > ${simpleDate}`;
			const vjName = (mainEvent.crew?.['VJ'] || ['VJ'])[0].split(' ')[0];
			const vjSubject = `${vjName} VJ > ${eventTitle} > ${simpleDate}`;

			// --- FETCH RIDERS (Attachment Loop) ---
			const attachments = await fetchAndProcessRiders(selectedEvents);

			// --- DOWNLOAD TECH EMAIL (With Attachments) ---
			const techFileName = generateTechFileName(selectedEvents);
			downloadEml(
				techSubject,
				senderEmail,
				toString,
				techCcString,
				techHtml,
				'Tech_Email',
				techFileName,
				attachments
			);

			// --- DOWNLOAD VJ EMAIL (No Attachments) ---
			if (vjName && vjName !== 'VJ') {
				const vjFileName = generateVJFileName(selectedEvents);
				setTimeout(() => {
					downloadEml(
						vjSubject,
						senderEmail,
						vjToString,
						vjCcString,
						vjHtml,
						'VJ_Email',
						vjFileName,
						[]
					);
				}, 600);
			}
		} catch (e) {
			console.error('Error sending emails:', e);
			alert('Error generating email files. Check console.');
		} finally {
			isProcessing = false;
		}
	}

	function resolveCrewEmails(crewAssignments: any, allCrew: CrewMember[]): string[] {
		if (!crewAssignments) return [];
		const targetNames: string[] = [];
		Object.values(crewAssignments).forEach((names: any) => {
			if (Array.isArray(names)) targetNames.push(...names);
		});
		const uniqueEmails = new Set<string>();
		targetNames.forEach((name) => {
			const cleanName = name.trim().toLowerCase();
			const match = allCrew.find((c) => c.name.toLowerCase() === cleanName);
			if (match && match.email) uniqueEmails.add(match.email);
		});
		return Array.from(uniqueEmails);
	}

	// --- UPDATED: FETCH ALL FILES FOR ALL ROWS ---
	async function fetchAndProcessRiders(events: EmailTechEvent[]) {
		const attachments: { filename: string; content: string; mimeType: string }[] = [];

		for (const event of events) {
			if (!event.event_id) continue;

			try {
				// 1. Fetch ALL rows associated with this event_id
				const { data: advanceRows, error } = await supabase
					.from('events_advance')
					.select('rider_files, artist_name')
					.eq('event_id', event.event_id);

				if (error) {
					console.warn(`Error fetching riders for event ${event.event_id}:`, error);
					continue;
				}

				if (!advanceRows || advanceRows.length === 0) continue;

				// 2. Loop through EACH row (Artist 1, Artist 2, etc.)
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

					// 3. Check if THIS specific row has a tech rider URL
					const techRiderUrl = riderData?.tech_rider_url;

					if (techRiderUrl) {
						try {
							const response = await fetch(techRiderUrl);
							if (!response.ok) throw new Error(`Failed to fetch: ${techRiderUrl}`);

							const blob = await response.blob();
							const fullBase64 = await blobToBase64(blob);

							// Use the artist name from THIS specific row for the filename
							const artistName = row.artist_name || 'Artist';
							let cleanName = `${artistName}_Tech_Rider.pdf`;
							cleanName = cleanName.replace(/[^a-z0-9_\-\.]/gi, '_');

							attachments.push({
								filename: cleanName,
								content: fullBase64.split(',')[1],
								mimeType: blob.type || 'application/pdf'
							});
						} catch (err) {
							console.error(`Failed to attach rider for ${row.artist_name}`, err);
						}
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

	function downloadEml(
		subject: string,
		from: string,
		to: string,
		cc: string,
		htmlBody: string,
		filenamePrefix: string,
		exactFilename?: string,
		attachments: { filename: string; content: string; mimeType: string }[] = []
	) {
		const boundary = '----=_NextPart_000_0001';
		const mixedBoundary = '----=_NextPart_Mixed_000_0002';
		const plainText = stripHtml(htmlBody);

		let emlContent = `From: ${from}
To: ${to}
Cc: ${cc}
Subject: ${subject}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="${mixedBoundary}"

--${mixedBoundary}
Content-Type: multipart/alternative; boundary="${boundary}"

--${boundary}
Content-Type: text/plain; charset="utf-8"
Content-Transfer-Encoding: 7bit

${plainText}

--${boundary}
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: quoted-printable

${htmlBody.replace(/=/g, '=3D')}

--${boundary}--
`;

		attachments.forEach((file) => {
			emlContent += `
--${mixedBoundary}
Content-Type: ${file.mimeType}; name="${file.filename}"
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="${file.filename}"

${chunkString(file.content, 76)}
`;
		});

		emlContent += `--${mixedBoundary}--`;

		const blob = new Blob([emlContent], { type: 'message/rfc822' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;

		link.download = exactFilename
			? `${exactFilename}.eml`
			: `${filenamePrefix}_${subject.replace(/[^a-z0-9]/gi, '_')}.eml`;

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
	<div class="h-full flex flex-col p-4 justify-center">
		<h3 class="text-white text-sm font-bold mb-3">Actions</h3>

		<button
			type="button"
			on:click={handleSendEmails}
			disabled={!isEventSelected || isProcessing}
			class="w-full bg-lime text-black rounded-lg px-4 py-4 text-sm font-bold
               flex items-center justify-center gap-2 hover:bg-white
               transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
		>
			{#if isProcessing}
				<svg
					class="animate-spin h-4 w-4 text-black"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				Processing...
			{:else}
				Send Emails
			{/if}
		</button>

		<div class="mt-4 space-y-2 text-xs">
			<div class="flex items-center justify-between py-2 border-b border-gray1">
				<span class="text-gray2">Status:</span>
				<span class="text-white font-bold">
					{#if isEventSelected}
						<span class="text-lime">Ready to Send</span>
					{:else}
						<span class="text-gray2">Select Event</span>
					{/if}
				</span>
			</div>
		</div>
	</div>
</div>
