<script lang="ts">
	import Section from '../Section.svelte';
	import ContentBox from '../ContentBox.svelte';
	import type { EventAdvance } from '$lib/services/eventsService'; // <-- ADD THIS IMPORT
	import { parseCustomLines } from '$lib/components/settings/AdvanceVariables';

	// Accept the official EventAdvance type
	export let event: EventAdvance; // <-- CHANGE THIS LINE

	// This derived variable keeps the Mosh Pits section working as before
	$: event_venue = event.venue;

	// Reactive variable to determine which PA System text to show
	// Returns 'Bazart', 'Other', or falls through to 'New City Gas' (default)
	$: paVenueToShow = (() => {
		// Check if the override is enabled in custom settings
		if (event.custom_settings?.PA_System_Enabled && event.custom_settings.PA_System) {
			if (event.custom_settings.PA_System === 'Bazart') return 'Bazart';
			if (event.custom_settings.PA_System === 'Other') return 'Other';
			return 'New City Gas';
		}
		// If no override, fall back to the event's actual venue
		return event.venue;
	})();

	// Custom PA System bullet lines, only relevant when paVenueToShow === 'Other'
	$: paCustomLines = parseCustomLines(event.custom_settings?.PA_System_Custom);

	// Reactive variable to determine which DJ Monitor text to show
	// Returns 'Bazart', 'Other', or falls through to 'New City Gas' (default)
	$: djVenueToShow = (() => {
		// Check if the override is enabled in custom settings
		if (event.custom_settings?.DJ_Monitor_Enabled && event.custom_settings.DJ_Monitor) {
			if (event.custom_settings.DJ_Monitor === 'Bazart') return 'Bazart';
			if (event.custom_settings.DJ_Monitor === 'Other') return 'Other';
			return 'New City Gas';
		}
		// If no override, fall back to the event's actual venue
		return event.venue;
	})();

	// Custom DJ Monitor bullet lines, only relevant when djVenueToShow === 'Other'
	$: djCustomLines = parseCustomLines(event.custom_settings?.DJ_Monitor_Custom);
</script>

<Section title="HOUSE RULES">
	<div class="space-y-3">
		<ContentBox class="!bg-black/15 border-r-15 border-r-black border-l-3 border-question">
			<div class="text-question text-sm uppercase tracking-wider mb-1">Sound Limitations</div>
			<div class="text-gray2 text-sm">
				• Please note that our venue sound limits are 101dBA / 110dBC as measured at FOH position.
			</div>
		</ContentBox>

		<ContentBox class="!bg-black/15 border-r-15 border-r-black border-l-3 border-proposed">
			<div class="text-proposed text-sm uppercase tracking-wider mb-1">Smoking Policy</div>
			<div class="text-gray2 text-sm space-y-2">
				<div>
					• Smoking is not allowed in any part of New City Gas except in restricted smoking areas.
				</div>
				<div>
					• No marijuana is permitted on venue grounds due to the nature of New City Gas liquor
					license - despite legalization the regulations in Quebec are still fairly tight as it
					pertains to establishments serving alcohol.
				</div>
			</div>
		</ContentBox>

		{#if event_venue !== 'Bazart'}
			<ContentBox class="!bg-black/15 border-r-15 border-r-black border-l-3 border-problem">
				<div class="text-problem text-sm uppercase tracking-wider mb-1">
					Mosh Pits / Wall Of Death
				</div>
				<div class="text-gray2 text-sm">
					<div>
						• The artist may not use the microphone at any time to encourage or incite a mosh pit or
						wall of death.
					</div>
					<div>
						• In order to guarantee the safety and security of our guests, local law enforcement has
						requested we institute this in our contracts.
					</div>
				</div>
			</ContentBox>
		{/if}

		<ContentBox class="!bg-black/15 border-r-15 border-r-black border-l-3 border-confirmed">
			{#if paVenueToShow === 'Bazart'}
				<div class="text-confirmed text-sm uppercase tracking-wider mb-1">PA SYSTEM – LOUNGE</div>
				<div class="text-gray2 text-sm space-y-1">
					<div>
						• The Lounge is equipped with a Meyer Sound system providing full coverage and tonal
						balance.
					</div>
					<div>
						• Setup combines UPA, UPQ, UPJ, Ultra-X40, and UPM series cabinets with 900-LFC subs.
					</div>
					<div>• Auxiliary hallway zones powered with 02x Crown CTs-3000.</div>
					<div>
						• Processing and control via Allen&Heath SQ5, BSS London Blu, and Meyer Galileo.
					</div>
					<div>• Kit is fully tuned, calibrated, and phase-aligned for the Lounge environment.</div>
				</div>
			{:else if paVenueToShow === 'Other'}
				<div class="text-confirmed text-sm uppercase tracking-wider mb-1">PA System</div>
				<div class="text-gray2 text-sm space-y-1">
					{#each paCustomLines as line}
						<div>• {line}</div>
					{/each}
				</div>
			{:else}
				<div class="text-confirmed text-sm uppercase tracking-wider mb-1">
					PA System – Main Room
				</div>
				<div class="text-gray2 text-sm space-y-1">
					<div>
						• The venue has an installed JBL Professional PA using the Application engineered series
						boxes for full coverage to within 2dB.
					</div>
					<div>
						• Subwoofers are arrayed in 3 separate cardioid clusters beneath the stage in properly
						ventilated chambers.
					</div>
					<div>
						• All drivers amplified with Crown iTech HD & Macro-Tech HD and managed by a Soundweb
						London Blu. Kit is fully calibrated and phase-aligned.
					</div>
				</div>
			{/if}
		</ContentBox>

		<ContentBox class="!bg-black/15 border-r-15 border-r-black border-l-3 border-info">
			{#if djVenueToShow === 'Bazart'}
				<div class="text-info text-sm uppercase tracking-wider mb-1">DJ MONITORS – LOUNGE</div>
				<div class="text-gray2 text-sm space-y-1">
					<div>• In-booth monitoring consists of 02x EV ETX-12P powered speakers.</div>
					<div>
						• Kit is capable of delivering clean, distortion-free output at professional DJ levels.
					</div>
				</div>
			{:else if djVenueToShow === 'Other'}
				<div class="text-info text-sm uppercase tracking-wider mb-1">DJ Monitors</div>
				<div class="text-gray2 text-sm space-y-1">
					{#each djCustomLines as line}
						<div>• {line}</div>
					{/each}
				</div>
			{:else}
				<div class="text-info text-sm uppercase tracking-wider mb-1">DJ Monitors – Main Room</div>
				<div class="text-gray2 text-sm space-y-1">
					<div>
						• In house DJ monitors consist of 6x Vertec VT4886 powered by a Crown iTech HD9000 and
						2x JBL Professional ASB7128.
					</div>
					<div>
						• Kit is capable of generating 117dBA before limiting distortion free at DJ position.
					</div>
				</div>
			{/if}
		</ContentBox>

		<ContentBox class="!bg-black/15 border-r-15 border-r-black border-l-3 border-tentatif">
			<div class="text-tentatif text-sm uppercase tracking-wider mb-1">Media Policy</div>
			<div class="text-gray2 text-sm space-y-1">
				<div>
					• Outside media using professional equipment must provide a valid COI (minimum
					requirements available on request).
				</div>
				<div>
					• Any camera setup at FOH, DJ booth, or use of an audio recorder must be advanced and
					approved in advance.
				</div>
				<div>
					• Our in-house photo/video team (subject to availability) can capture content and share it
					with you after the show.
				</div>
			</div>
		</ContentBox>
	</div>
</Section>