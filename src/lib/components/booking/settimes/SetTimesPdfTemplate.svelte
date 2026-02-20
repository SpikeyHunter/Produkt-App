<script lang="ts">
	import type { TimetableEntry } from '$lib/services/eventsService';

	export let eventDate: string = '';
	export let headlinerName: string = 'TBA';
	export let eventType: string = 'Event';
	export let timetable: TimetableEntry[] = [];

	// Format date to "Friday February 20" (stripping out commas)
	$: formattedDate = (() => {
		if (!eventDate) return '';
		try {
			const date = new Date(eventDate);
			date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
			return date
				.toLocaleDateString('en-US', {
					weekday: 'long',
					month: 'long',
					day: 'numeric'
				})
				.replace(/,/g, '');
		} catch (e) {
			return eventDate;
		}
	})();

	// Format eventType to strip " Show" if it exists (e.g., "NCG Show" -> "NCG")
	$: displayEventType = eventType.replace(' Show', '');

	// Combine the text to calculate its length
	$: headerText = `${displayEventType} - ${headlinerName}`;

	// Dynamically shrink the font size if the text is longer than 20 characters
	$: headerFontSize =
		headerText.length > 20 ? Math.max(18, 30 - (headerText.length - 20) * 0.7) : 30;

	// Convert 10:00PM -> 22H00, 12:30AM -> 12H30
	function formatPromoterTime(timeStr: string) {
		if (!timeStr) return '';
		const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
		if (!match) return timeStr;
		let [_, hoursStr, minutes, ampm] = match;
		let hours = parseInt(hoursStr, 10);
		ampm = ampm.toUpperCase();

		if (ampm === 'PM' && hours < 12) hours += 12;
		if (ampm === 'AM' && hours === 12) hours = 12;

		return `${hours}H${minutes}`;
	}
</script>

<div
	id="set-times-print-container"
	style="background-color: white; width: 8.5in; height: 11in; padding: 0; font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; position: relative; box-sizing: border-box; color: black; overflow: hidden;"
>
	<div
		style="position: absolute; top: 0.5in; bottom: 0.5in; left: 0.5in; width: 1.2in; background-color: black;"
	>
		<div
			style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-90deg); color: white; font-size: 30pt; font-weight: 400; white-space: nowrap; letter-spacing: 1px;"
		>
			{formattedDate}
		</div>
	</div>

	<div style="position: absolute; top: 0.8in; right: 1in; text-align: right;">
		<h1
			style="font-size: 40pt; font-weight: 800; margin: 0; color: black; line-height: 1; letter-spacing: -1px;"
		>
			SET TIMES
		</h1>
	</div>

	<div style="position: absolute; top: 2.2in; left: 2.3in; right: 1in; overflow: hidden;">
		<h2
			style="font-size: {headerFontSize}pt; font-weight: 700; margin: 0 0 35px 0; color: black; line-height: 1.2; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;"
		>
			{headerText}
		</h2>

		<div style="display: flex; flex-direction: column; gap: 12px;">
			{#each timetable as entry}
				<div style="display: flex; font-size: 26pt; color: black; line-height: 1.2;">
					<div
						style="width: 135px; flex-shrink: 0; font-weight: {entry.notes === 'Headliner'
							? '700'
							: '400'}; font-style: {entry.artist === 'DOORS' || entry.artist === 'CURFEW'
							? 'italic'
							: 'normal'};"
					>
						{formatPromoterTime(entry.time)}
					</div>
					<div
						style="font-weight: {entry.notes === 'Headliner'
							? '700'
							: '400'}; font-style: {entry.artist === 'DOORS' || entry.artist === 'CURFEW'
							? 'italic'
							: 'normal'}; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;"
					>
						{entry.artist}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div style="position: absolute; bottom: 0.8in; right: 1in; text-align: right;">
		<img src="LOGO_PLACEHOLDER" alt="Produkt" style="height: 60px; width: auto;" />
	</div>
</div>
