<script lang="ts">
	import type { PromoterLetterData } from '$lib/types/letter';
	import { getPronouns, numberToWord, formatDateShort } from '$lib/utils/letter-helpers';

	export let data: PromoterLetterData;

	$: pronouns = getPronouns(data.artistGender);
	$: visaLabel = data.visaNumber ? '& Visa #' : '';
	$: passportVisaNumbers = data.visaNumber
		? `${data.passportNumber} & ${data.visaNumber}`
		: data.passportNumber;
	$: stayDurationWord = numberToWord(data.stayDurationDays);
	
	// FIX: Force arrivalDateFormatted to use performanceDate so they are identical in the letter text
	$: arrivalDateFormatted = data.arrivalDate ? formatDateShort(data.arrivalDate) : '';
	$: performanceDateFormatted = data.performanceDate ? formatDateShort(data.performanceDate) : '';
</script>

<div id="letter-content" class="letter-container">
	<div class="header-section">
		<div class="company-name">4427319 Canada INC.</div>
		<div class="company-address">315 Place d'Youville, Suite #187</div>
		<div class="company-address">Montreal Quebec H2Y 0A4 Canada</div>
	</div>

	<div class="date-section">{data.letterDate}</div>

	<div class="recipient-section">
		<div class="recipient-line">Canadian Border Service Agency (CBSA)</div>
		<div class="recipient-line">Trudeau International Airport</div>
		<div class="recipient-line">Dorval (Quebec)</div>
	</div>

	<div class="subject-section">
		<div class="subject-title">RE:     REQUEST FOR ADMISSION AS A BUSINESS VISITOR</div>
		<div class="subject-details">
			<div class="detail-row">
				<span class="detail-label">Name:</span>
				<span class="detail-value">{data.artistFullName}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">D.O.B.:</span>
				<span class="detail-value">{data.artistDob}</span>
			</div>
			<div class="detail-row">
				<span class="detail-label">Citizenship:</span>
				<span class="detail-value"><span class="bold-text">{data.artistCitizenship}</span> Citizen</span>
			</div>
			<div class="detail-row mb-small">
				<span class="detail-label">Passport #{visaLabel}:</span>
				<span class="detail-value">{passportVisaNumbers}</span>
			</div>
		</div>
	</div>
  
	<div class="salutation">Dear CBSA Officer,</div>

	<div class="body-paragraph">
		We are writing this letter in support of {pronouns.title}
		<span class="bold-text">{data.artistLegalFullName}</span>, a
		<span class="bold-text">{data.artistCitizenship}</span>
		Citizen, so that
		{pronouns.subject} may be permitted to enter Canada as a Business Visitor on
		<span class="bold-text">{arrivalDateFormatted}</span> to provide {pronouns.possessive} essential services
		as performing artist for <span class="bold-text">{data.performanceName}</span>.
	</div>

	<div class="body-paragraph">
		{pronouns.title} <span class="bold-text">{data.artistLastName}</span> will be
		<span class="bold-text">performing for {data.performanceName}</span> (<span>{data.showDuration}</span>) hour show on
		<span class="bold-text">{performanceDateFormatted}</span> at New City Gas Concert hall.
		Upon the
		conclusion of this one (1) night performance,
		{pronouns.title} <span class="bold-text">{data.artistLastName}</span> will travel back and
		will resume {pronouns.possessive} freelance work activities as an independent musical artist.
	</div>

	<div class="body-paragraph">
		Please note that {pronouns.title} <span class="bold-text">{data.artistLastName}</span> will
		be remunerated by 4427319 Canada inc.
		in the amount of
		<span class="bold-text">{data.paymentCurrency} ${data.paymentAmount}</span> for {pronouns.possessive} participation in
		<span class="bold-text">{data.performanceName}</span>.
	</div>

	<div class="body-paragraph mb-medium">
		Since {pronouns.title} <span class="bold-text">{data.artistLastName}</span> will be entering
		Canada as an Artist to a foreign-based musical performance for a time-limited live performance
		at a concert hall, we respectfully request that you allow {pronouns.possessive}
		entry into Canada for the <span>{data.stayDurationDays}</span> (<span
			>{stayDurationWord}</span>) day period.
	</div>

	<div class="closing">Sincerely,</div>
	<div class="closing-company">4427319 CANADA INC.</div>

	<div class="signature-block">
		<div>Janie Latendresse</div>
		<div>514-889-6386</div>
		<div>Encls.</div>
	</div>
</div>

<style>
	/* Global Reset for this component */
	.letter-container {
		background-color: #ffffff;
		width: 816px; /* Explicit width for PDF generation (approx 8.5in) */
		height: 1056px; /* Explicit height (approx 11in) */
		box-sizing: border-box;
		color: #000000;
		font-size: 12pt;
		line-height: 1.25;
		margin: 0 auto;
		padding: 0.75in;
		font-family: 'Times New Roman', Times, serif;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		text-rendering: optimizeLegibility;
	}

	.letter-container * {
		font-weight: normal;
	}

	.header-section {
		text-align: center;
		margin-bottom: 0.75rem;
		line-height: 1.2;
	}

	.header-section div {
		font-family: 'Courier Prime', 'IBM Plex Mono', Consolas, 'Courier New', monospace;
		font-weight: bold;
		letter-spacing: 0.02em;
	}

	.company-name {
		text-decoration: underline;
		font-size: 14pt;
		margin-bottom: 0.125rem;
	}

	.company-address {
		margin-bottom: 0.125rem;
	}

	.date-section {
		margin-bottom: 0.5rem;
	}

	.recipient-section {
		margin-bottom: 0.75rem;
		line-height: 1.2;
	}

	.recipient-line {
		margin-bottom: 0.125rem;
	}

	.subject-section {
		margin-top: 0.25rem;
		margin-bottom: 0.25rem;
		padding-bottom: 0.25rem;
		border-bottom: 2px solid #000000;
	}

	.subject-title {
		font-weight: bold;
		white-space: pre-wrap;
	}

	.subject-details {
		margin-left: 2.75rem; /* Equivalent to ml-11 */
		line-height: 1.2;
	}

	.detail-row {
		display: flex;
		margin-bottom: 0.125rem;
	}

	.detail-label {
		font-weight: bold;
		display: inline-block;
		width: 9rem; /* Equivalent to w-36 */
	}

	.detail-value {
		font-weight: bold;
	}

	.mb-small {
		margin-bottom: 0.5rem;
	}
	
	.mb-medium {
		margin-bottom: 0.75rem;
	}

	.salutation {
		margin-bottom: 0.375rem;
	}

	.body-paragraph {
		margin-bottom: 0.375rem;
		text-align: justify;
	}

	.bold-text {
		font-weight: bold;
	}

	.closing {
		margin-top: 0;
	}

	.closing-company {
		margin-bottom: 0.75rem;
		font-weight: bold;
	}

	.signature-block {
		margin-top: 1.5rem;
	}

	/* Re-apply font-bold for bold-text class explicitly */
	.bold-text, .subject-title, .detail-label, .detail-value, .closing-company, .header-section div {
		font-weight: bold !important;
	}

	@media print {
		.letter-container {
			margin: 0 !important;
			padding: 0.75in !important;
			width: 8.5in !important;
			height: 11in !important;
			background: #ffffff !important;
			box-shadow: none !important;
		}
		
		.letter-container > div {
			page-break-inside: avoid;
		}
	}
</style>