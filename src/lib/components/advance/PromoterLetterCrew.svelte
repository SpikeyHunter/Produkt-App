<script lang="ts">
	import type { PromoterLetterCrewData } from '$lib/types/letter';
	import { getPronouns, numberToWord } from '$lib/utils/letter-helpers';

	export let data: PromoterLetterCrewData;
	$: pronouns = getPronouns(data.crewGender);
	$: visaLabel = data.visaNumber ? '& Visa #' : '';
	$: passportVisaNumbers = data.visaNumber
		? `${data.passportNumber} & ${data.visaNumber}`
		: data.passportNumber;
	$: stayDurationWord = numberToWord(data.stayDurationDays);
</script>

<div id="letter-content-crew" style="background-color: #ffffff; width: 8.5in; height: 11in; box-sizing: border-box;" class="text-black text-[12pt] leading-tight mx-auto p-[0.5in] print:p-[0.5in] print:m-0">
	<div class="text-center mb-3 letter-header leading-tight">
		<div class="font-bold underline text-[14pt] mb-0.5">4427319 Canada INC.</div>
		<div class="font-bold mb-0.5">315 Place d'Youville, Suite #187</div>
		<div class="font-bold">Montreal Quebec H2Y 0A4 Canada</div>
	</div>

	<div class="mb-2">{data.letterDate}</div>

	<div class="mb-3 leading-tight">
		<div class="mb-0.5">Canadian Border Service Agency (CBSA)</div>
		<div class="mb-0.5">Trudeau International Airport</div>
		<div class="mb-0.5">Dorval (Quebec)</div>
	</div>

	<div class="mt-1 mb-1 pb-1 border-b-2 border-black">
		<div class="font-bold whitespace-pre-wrap">RE:     REQUEST FOR ADMISSION AS A BUSINESS VISITOR</div>
		<div class="ml-11 leading-tight">
			<div class="flex mb-0.5">
				<span class="font-bold inline-block w-36">Name:</span>
				<span class="font-bold">{data.crewFullName}</span>
			</div>
			<div class="flex mb-0.5">
				<span class="font-bold inline-block w-36">D.O.B.:</span>
				<span class="font-bold">{data.crewDob}</span>
			</div>
			<div class="flex mb-0.5">
				<span class="font-bold inline-block w-36">Citizenship:</span>
				<span class="font-bold">{data.crewCitizenship} Citizen</span>
			</div>
			<div class="flex mb-2">
				<span class="font-bold inline-block w-36">Passport #{visaLabel}:</span>
				<span class="font-bold">{passportVisaNumbers}</span>
			</div>
		</div>
	</div>
  
	<div class="mb-1.5">Dear CBSA Officer,</div>

	<div class="mb-1.5 text-justify">
		We are writing this letter in support of {pronouns.title}
		<span class="font-bold">{data.crewLegalFullName}</span>, a
		<span class="font-bold">{data.crewCitizenship}</span>
		Citizen, so that
		{pronouns.subject} may be permitted to enter Canada as a Business Visitor on
		<span class="font-bold">{data.arrivalDate}</span> to provide {pronouns.possessive} essential support services
		as support crew for <span class="font-bold">{data.artistName}</span>.
	</div>

	<div class="mb-1.5 text-justify">
		{pronouns.title} <span class="font-bold">{data.crewLastName}</span> will be
		<span class="font-bold">part of the support team</span> for <span class="font-bold">{data.artistName}</span> (<span>{data.showDuration}</span>) hour show on
		<span class="font-bold">{data.performanceDate}</span> at New City Gas Concert Hall. Upon the
		conclusion of this one (1) night performance,
		{pronouns.title} <span class="font-bold">{data.crewLastName}</span> will travel back and
		{pronouns.subject} will resume {pronouns.possessive} freelance work activities.
	</div>

	<div class="mb-1.5 text-justify">
		Please note that {pronouns.title} <span class="font-bold">{data.crewLastName}</span> will
		not be remunerated by 4427319 Canada inc. for {pronouns.possessive} participation for
		<span class="font-bold">{data.artistName}</span> on
		<span class="font-bold">{data.performanceDate}</span> at New City Gas Concert Hall.
		{pronouns.title} <span class="font-bold">{data.crewLastName}</span> is being remunerated via
		<span class="font-bold">{data.artistName}</span> who will in turn be remunerated by our company.
	</div>

	<div class="mb-3 text-justify">
		Since {pronouns.title} <span class="font-bold">{data.crewLastName}</span> will be entering
		Canada as a member of the essential support crew to a foreign-based musical performance artist
		for a time-limited live performance at a concert hall, we respectfully request that you allow
		{pronouns.possessive} entry into Canada for the <span>{data.stayDurationDays}</span> (<span
			>{stayDurationWord}</span>) day period.
	</div>

	<div class="">Sincerely,</div>
	<div class="mb-3 font-bold">4427319 CANADA INC.</div>

	<div class="mt-6">
		<div>Janie Latendresse</div>
		<div>514-889-6386</div>
		<div>Encls.</div>
	</div>
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap');
	@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');
	@import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
	@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&display=swap');
	
	/* Set default font with better rendering for crisp text */
	#letter-content-crew {
		font-family: 'Times New Roman', Times, serif !important;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		text-rendering: optimizeLegibility;
		font-feature-settings: "liga", "kern";
		background-color: #ffffff !important;
	}

	/* Forcefully reset font-weight for the container and EVERYTHING inside it */
	#letter-content-crew,
	#letter-content-crew * {
		font-weight: normal;
	}

	/* Header font styling with typewriter-like fonts */
	.letter-header div {
		font-family: 'Courier Prime', 'IBM Plex Mono', Consolas, 'Courier New', 'Lucida Console', Monaco, monospace !important;
		font-weight: bold !important;
		letter-spacing: 0.02em !important;
	}

	/* Re-apply font-bold where it's needed, using !important to override global styles */
	#letter-content-crew .font-bold {
		font-weight: bold !important;
	}

	/* Ensure crisp borders */
	#letter-content-crew .border-black {
		border-color: #000000 !important;
	}

	@media print {
		#letter-content-crew {
			margin: 0 !important;
			padding: 0.75in !important;
			max-width: none !important;
			min-height: 11in !important;
			width: 8.5in !important;
			box-sizing: border-box !important;
			background: #ffffff !important;
		}
		
		/* Ensure no page breaks within content */
		#letter-content-crew > div {
			page-break-inside: avoid;
		}
	}

	/* For PDF generation - ensure proper sizing */
	@media screen {
		#letter-content-crew {
			box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		}
	}
</style>