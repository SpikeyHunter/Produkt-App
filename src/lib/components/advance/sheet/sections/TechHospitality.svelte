<script lang="ts">
	import Section from '../Section.svelte';
	import { parseFoodBuyout } from '$lib/utils/foodBuyout';
	import ContentBox from '../ContentBox.svelte';
	import type { EventAdvance } from '$lib/types/events';

	export let event: EventAdvance;

	// --- HELPER FUNCTION ---
	function parseRiderData(data: any): any {
		if (!data) return null;
		if (typeof data === 'object') return data; // Already parsed
		try {
			return JSON.parse(data);
		} catch (e) {
			console.error('Failed to parse rider JSON:', e);
			return null;
		}
	}

	// --- BACKLINE & TECH ---
	$: backlineItems = ((): string[] => {
		const techData = parseRiderData(event.tech_rider);
		if (!techData) return [];

		const items: string[] = [];
		const equipmentOrder = ['CDJ-3000', 'RMX-1000', 'Wired Mic', 'Wireless Mic', 'Laptop Stand'];

		if (techData.selected_mixer) {
			items.push(`1x ${techData.selected_mixer}`);
		}

		const equipment = techData.equipment || {};
		const sortedKeys = Object.keys(equipment)
			.filter((key) => equipment[key].selected)
			.sort((a, b) => {
				const indexA = equipmentOrder.indexOf(a);
				const indexB = equipmentOrder.indexOf(b);
				if (indexA === -1) return 1;
				if (indexB === -1) return -1;
				return indexA - indexB;
			});

		for (const key of sortedKeys) {
			items.push(`${equipment[key].qty}x ${key}`);
		}

		if (techData.other && techData.other.length > 0) {
			techData.other.forEach((item: { text: string }) => items.push(item.text));
		}

		return items;
	})();

	$: sfxItems = ((): string[] => {
		const sfxData = parseRiderData(event.sfx_rider);
		if (!sfxData) return [];

		const items: string[] = [];

		if (sfxData.cryo_jets?.enabled) {
			if (parseInt(sfxData.cryo_jets.duration, 10) === 0) {
				items.push(`${sfxData.cryo_jets.qty}x Cryo Jets - Empty Tanks`);
			} else {
				items.push(`${sfxData.cryo_jets.qty}x Cryo Jets (CO2) - ${sfxData.cryo_jets.duration}sec`);
			}
		}
		if (sfxData.sparkulars?.enabled) {
			if (parseInt(sfxData.sparkulars.duration, 10) === 0) {
				items.push(`${sfxData.sparkulars.qty}x Sparkulars - Empty Reservoir`);
			} else {
				items.push(`${sfxData.sparkulars.qty}x Sparkulars - ${sfxData.sparkulars.duration}sec`);
			}
		}
		if (sfxData.lasers?.enabled) {
			items.push(`${sfxData.lasers.qty}x Lasers`);
		}

		if (sfxData.other && sfxData.other.length > 0) {
			sfxData.other.forEach((item: { text: string }) => items.push(item.text));
		}

		return items;
	})();

	// --- HOSPITALITY ---
	$: hospitalityItems = ((): string[] => {
		const hospoData = parseRiderData(event.hospo_rider);
		if (!hospoData) return [];

		const items: string[] = ['1x shared green room'];

		const processCategory = (category: object) => {
			if (!category) return;
			for (const [name, details] of Object.entries(category)) {
				if (details.selected) {
					items.push(`${details.qty}x ${name}`);
				}
			}
		};

		processCategory(hospoData.spirits);
		processCategory(hospoData.beers_wine?.beers);
		processCategory(hospoData.beers_wine?.wine);
		processCategory(hospoData.beers_wine?.juice);
		processCategory(hospoData.other_drinks);

		if (hospoData.custom_requests && hospoData.custom_requests.length > 0) {
			hospoData.custom_requests.forEach((item: { text: string }) => items.push(item.text));
		}

		return items;
	})();

	// --- SOUNDCHECK ---
	// One line under SFX: the window when it's booked, otherwise its status.
	// Nothing prints when there's no soundcheck.
	$: soundcheckLine = ((): string | null => {
		const sc = parseRiderData(event.soundcheck);
		if (!sc) return null;

		const to12h = (t: string): string => {
			const [h, m] = String(t || '').split(':');
			let hour = parseInt(h, 10);
			if (isNaN(hour)) return '';
			const ampm = hour >= 12 ? 'PM' : 'AM';
			hour = hour % 12 || 12;
			return `${hour}:${m}${ampm}`;
		};

		// Legacy shape: { enabled: boolean, start_time, end_time }
		const status = sc.status ?? (sc.enabled === true ? 'yes' : sc.enabled === false ? 'no' : null);
		if (!status || status === 'no') return null;

		if (status === 'yes' && sc.start_time && sc.end_time) {
			const from = to12h(sc.start_time);
			const to = to12h(sc.end_time);
			return from && to ? `From ${from} to ${to}` : 'TBD';
		}
		if (status === 'asked') return 'Asked';
		return 'TBD';
	})();

	// --- FOOD BUYOUT / ROOM CREDIT / DINNER ---
	// Printed under the hospitality list: a heading plus its bullet(s), or a
	// single inline line for a cash buyout. None prints nothing.
	$: foodBuyoutBlock = ((): { title: string; items: string[]; inline: boolean } | null => {
		const fb = parseFoodBuyout(event.food_buyout);
		if (!fb.type) return null;

		if (fb.type === 'room_credit') {
			const items: string[] = [];
			if ((fb.artist || 0) > 0) items.push(`${fb.artist}$CAD/Artist`);
			if ((fb.crew || 0) > 0) items.push(`${fb.crew}$CAD/Crew`);
			return items.length > 0 ? { title: 'Room Credit:', items, inline: false } : null;
		}

		if (fb.type === 'dinner') {
			const detail = String(fb.details || '').trim();
			return { title: 'Dinner:', items: [detail || 'Dinner provided'], inline: false };
		}

		// Cash buyout — one line: "Food Buyout: 50$CAD cash"
		const amount = String(fb.details || '').match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.');
		return {
			title: 'Food Buyout:',
			items: [amount ? `${amount}$CAD cash` : 'cash'],
			inline: true
		};
	})();

	// --- GUESTLIST (FIXED) ---
	$: guestlistText = ((): string => {
		const guestlistData = parseRiderData(event.guestlist);
		if (!guestlistData) return '';

		const vip = guestlistData.vip || 0;
		const ga = guestlistData.ga || 0;

		const parts: string[] = [];
		if (vip > 0) parts.push(`${vip}x VIP`);
		if (ga > 0) parts.push(`${ga}x GA`);

		if (parts.length === 0) return '';

		const allocation = parts.join(' and ');
		// Using a more concise second sentence to prevent wrapping
		return `• The artist will be allocated <strong>${allocation}</strong> guests.<br>• Names must be sent to the DOS contact by 7pm day-of-show.`;
	})();
</script>

<Section title="TECH & HOSPITALITY">
	<div class="space-y-5">
		<div class="grid grid-cols-2 gap-5">
			<ContentBox class="!bg-black/15 text-sm">
				<h3 class="text-lime text-sm font-bold uppercase tracking-wider mb-2">
					Backline Confirmed:
				</h3>
				<div class="text-white space-y-1">
					{#each backlineItems as item}
						<div>• {item}</div>
					{/each}
				</div>

				{#if event.event_venue === 'New City Gas' && sfxItems.length > 0}
					<h3 class="text-lime text-sm font-bold uppercase tracking-wider mt-4 mb-2">SFX:</h3>
					<div class="text-white space-y-1">
						{#each sfxItems as item}
							<div>• {item}</div>
						{/each}
					</div>
				{/if}

				{#if soundcheckLine}
					<h3 class="text-lime text-sm font-bold uppercase tracking-wider mt-4 mb-2">Soundcheck:</h3>
					<div class="text-white">• {soundcheckLine}</div>
				{/if}
			</ContentBox>

			<ContentBox class="!bg-black/15 text-sm">
				<h3 class="text-lime text-sm font-bold uppercase tracking-wider mb-2">Hospitality:</h3>
				<div class="text-white space-y-1">
					{#each hospitalityItems as item}
						<div>• {item}</div>
					{/each}
				</div>

				{#if foodBuyoutBlock}
					{#if foodBuyoutBlock.inline}
						<div class="text-white mt-3">
							<span class="font-bold">{foodBuyoutBlock.title}</span>
							{foodBuyoutBlock.items[0]}
						</div>
					{:else}
						<h4 class="text-white text-sm font-bold mt-3 mb-1">{foodBuyoutBlock.title}</h4>
						<div class="text-white space-y-1">
							{#each foodBuyoutBlock.items as item}
								<div>• {item}</div>
							{/each}
						</div>
					{/if}
				{/if}
			</ContentBox>
		</div>

		{#if guestlistText}
			<ContentBox class="!bg-black/15 text-sm">
				<h3 class="text-lime text-sm font-bold uppercase tracking-wider mb-2">Guestlist:</h3>
				<div class="text-white">
					{@html guestlistText}
				</div>
			</ContentBox>
		{/if}
	</div>
</Section>
