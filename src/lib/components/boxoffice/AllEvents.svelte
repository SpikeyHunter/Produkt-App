<script lang="ts">
	import { createEventDispatcher, tick, onMount, onDestroy } from 'svelte';

	export let events: any[] = [];
	export let dailyCounts: any[] = [];
	const dispatch = createEventDispatcher();

	// --- CUSTOMIZATION PARAMETERS ---

	// Helper function: Parses syntax like 'color-problem/15', '#ff0000/50', or 'rgba(...)'
	function resolveColor(input: string) {
		if (!input) return 'transparent';
		const [baseColor, opacityStr] = input.split('/');

		// Convert "color-xyz" to "var(--color-xyz)"
		let cssColor = baseColor.startsWith('color-') ? `var(--${baseColor})` : baseColor;
		if (opacityStr) {
			const percent = opacityStr.endsWith('%') ? opacityStr : `${opacityStr}%`;
			// Uses native CSS to apply exact opacity to ANY variable or hex code
			return `color-mix(in srgb, ${cssColor} ${percent}, transparent)`;
		}

		return cssColor;
	}

	function getStatStyle(val: number, isScan: boolean) {
		let colorName = '';
		if (isScan) {
			// Scan % Logic: High = Good (Confirmed), Low = Bad (Problem)
			if (val > 75) colorName = 'confirmed';
			else if (val > 50) colorName = 'tentatif';
			else if (val > 25) colorName = 'proposed';
			else colorName = 'problem';
		} else {
			// No-Show % Logic: High = Bad (Problem), Low = Good (Confirmed)
			if (val > 75) colorName = 'problem';
			else if (val > 50) colorName = 'proposed';
			else if (val > 25) colorName = 'tentatif';
			else colorName = 'confirmed';
		}

		// 5% opacity for Scan, 10% opacity for No-Show
		const opacity = isScan ? '5' : '10';
		return {
			bg: resolveColor(`color-${colorName}/${opacity}`),
			textClass: `text-${colorName} font-bold`
		};
	}

	// 1. Grid Border Settings
	const gridBorderThickness = '0.5px';
	const gridBorderColor = resolveColor('#333333');
	// 2. Section Background Colors (Cells)
	// Try changing these! E.g., 'color-problem/10', 'color-lime/5', '#3b82f6/15'
	const bgDetails = resolveColor('color-black/30');
	const bgAdvance = resolveColor('color-question/10');
	// Faint Blue
	const bgNightOfShow = resolveColor('color-info/8'); // Faint Purple
	const bgTotal = resolveColor('color-black/30');
	// Faint Lime
	// --------------------------------

	const columns = [
		{ id: 'date', label: 'Event Date', width: '100px', section: 'DETAILS', bg: bgDetails },
		{ id: 'id', label: 'Event ID', width: '70px', section: 'DETAILS', bg: bgDetails },
		{ id: 'venue', label: 'Venue', width: '110px', section: 'DETAILS', bg: bgDetails },
		{ id: 'name', label: 'Event Name', width: '280px', section: 'DETAILS', bg: bgDetails },

		{ id: 'presale', label: 'Presale', width: '60px', section: 'ADVANCE', bg: bgAdvance },
		{ id: 'onsale', label: 'On Sale', width: '70px', section: 'ADVANCE', bg: bgAdvance },
		{ id: 'dos', label: 'Day of Show', width: '100px', section: 'ADVANCE', bg: bgAdvance },

		{
			id: 'adv_sold',
			label: 'Advance Sold',
			width: '100px',
			section: 'NIGHT OF SHOW',
			bg: bgNightOfShow
		},
		{
			id: 'adv_scanned',
			label: 'Advance Scanned',
			width: '125px',
			section: 'NIGHT OF SHOW',
			bg: bgNightOfShow
		},
		{ id: 'door', label: 'Door Paid', width: '90px', section: 'NIGHT OF SHOW', bg: bgNightOfShow },
		{
			id: 'table',
			label: 'Table Paid',
			width: '90px',
			section: 'NIGHT OF SHOW',
			bg: bgNightOfShow
		},
		{ id: 'comps', label: 'Comps/GL', width: '90px', section: 'NIGHT OF SHOW', bg: bgNightOfShow },

		{ id: 'total_paid', label: 'Total Paid', width: '80px', section: 'TOTAL', bg: bgTotal },
		{ id: 'total_att', label: 'Total Attendance', width: '120px', section: 'TOTAL', bg: bgTotal },
		{ id: 'scan_pct', label: 'Scan (%)', width: '80px', section: 'TOTAL', bg: bgTotal },
		{ id: 'noshow_pct', label: 'No Show (%)', width: '100px', section: 'TOTAL', bg: bgTotal }
	];

	let tableContainer: HTMLDivElement;
	let hasScrolledToBottom = false;

	// --- Scrollbar Auto-Hide Logic ---
	let isScrolling = false;
	let scrollTimeout: any;
	function handleScroll() {
		isScrolling = true;
		clearTimeout(scrollTimeout);
		scrollTimeout = setTimeout(() => {
			isScrolling = false;
		}, 800);
		// Hides 800ms after scrolling stops
	}

	// --- Zoom Logic ---
	let zoomLevel: number | 'Fit' = 1;
	let actualZoom: number = 1;
	let showZoomDropdown = false;
	// Updated steps: 50, 60, 70, 80, 90, 100, 125, 150, 175, 200
	const zoomSteps = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.25, 1.5, 1.75, 2];
	let resizeObserver: ResizeObserver | null = null;
	const baseTableWidth = 1665; // Approximate sum of hardcoded column widths

	function setZoom(val: number | 'Fit') {
		zoomLevel = val;
		showZoomDropdown = false;
		updateZoom();
	}

	function zoomIn() {
		const current = zoomLevel === 'Fit' ? actualZoom : zoomLevel;
		const nextIdx = zoomSteps.findIndex((z) => z > current);
		if (nextIdx !== -1) setZoom(zoomSteps[nextIdx]);
		else setZoom(zoomSteps[zoomSteps.length - 1]);
	}

	function zoomOut() {
		const current = zoomLevel === 'Fit' ? actualZoom : zoomLevel;
		const nextIdx = zoomSteps.findLastIndex((z) => z < current);
		if (nextIdx !== -1) setZoom(zoomSteps[nextIdx]);
		else setZoom(zoomSteps[0]);
	}

	function updateZoom() {
		if (zoomLevel === 'Fit') {
			if (tableContainer) {
				const w = tableContainer.clientWidth;
				// 32px subtracted to account for container padding (16px * 2)
				actualZoom = (w - 32) / baseTableWidth;
			}
		} else {
			actualZoom = zoomLevel as number;
		}
	}

	onMount(() => {
		if (typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				if (zoomLevel === 'Fit') updateZoom();
			});
			if (tableContainer) resizeObserver.observe(tableContainer);
		}
	});

	onDestroy(() => {
		if (resizeObserver) resizeObserver.disconnect();
	});

	$: if (zoomLevel || tableContainer) {
		tick().then(updateZoom);
	}

	function getNextDay(dateStr: string) {
		if (!dateStr) return null;
		const parts = dateStr.split('-');
		const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
		date.setDate(date.getDate() + 1);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}

	function formatDateString(ds: string) {
		if (!ds) return 'Date TBD';
		const parts = ds.split('-');
		const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
		return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
	}

	function getVenueClass(venue: string) {
		const v = (venue || '').toLowerCase();
		if (v.includes('bazart')) return 'bg-[#ffe089] text-black font-bold';
		if (v.includes('new city gas') || v.includes('ncg')) return 'bg-[#c4ef9b] text-black font-bold';
		return 'bg-gray1/50 text-white';
	}

	function parseJsonArray(val: any) {
		if (!val) return [];
		if (typeof val === 'string') {
			try {
				const parsed = JSON.parse(val);
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return [];
			}
		}
		return Array.isArray(val) ? val : [];
	}

	$: tableData = events
		.filter((e) => {
			const rep = e.box_office_reports;
			if (!rep) return false;

			// Extracts status gracefully whether 'rep' is an Array or Object
			const reportStatus = Array.isArray(rep) ? rep[0]?.status : rep.status;
			return reportStatus && ['in_progress', 'done', 'approved'].includes(reportStatus);
		})
		.map((e) => {
			const rep = e.box_office_reports;

			// Normalizes it to a single object before parsing
			const report = Array.isArray(rep) ? rep[0] : rep;

			const online = parseJsonArray(report.online);
			const door = parseJsonArray(report.door);
			const table = parseJsonArray(report.table_tickets);
			const comp = parseJsonArray(report.comp);

			const sumField = (arr: any[], field: string, condition = (item: any) => true) =>
				arr.filter(condition).reduce((acc, item) => acc + (item[field] || 0), 0);

			const presale = sumField(online, 'sold', (t) =>
				(t.ticket || '').toLowerCase().includes('presale')
			);
			const onsale = sumField(online, 'sold', (t) => {
				const name = (t.ticket || '').toLowerCase();
				return name.includes('sale') && !name.includes('presale');
			});
			const nextDayStr = getNextDay(e.event_date);
			const dosRecord = dailyCounts.find(
				(dc) => String(dc.event_id) === String(e.event_id) && dc.report_date === nextDayStr
			);
			const dos = dosRecord ? dosRecord.total_yesterday || 0 : 0;

			const adv_sold = sumField(online, 'sold');
			const adv_scanned = sumField(online, 'scanned');
			const door_paid = sumField(door, 'sold');
			const table_paid = sumField(table, 'sold');
			const comps = sumField(comp, 'scanned');
			const total_paid = adv_sold + door_paid + table_paid;
			const total_att = adv_scanned + door_paid + table_paid + comps;
			const scan_pct = adv_sold > 0 ? (adv_scanned / adv_sold) * 100 : 0;
			const noshow_pct = adv_sold > 0 ? 100 - scan_pct : 0;

			return {
				id: e.event_id,
				date: e.event_date,
				venue: e.event_venue,
				name: e.event_name,
				presale,
				onsale,
				dos,
				adv_sold,
				adv_scanned,
				door_paid,
				table_paid,
				comps,
				total_paid,
				total_att,
				scan_pct,
				noshow_pct
			};
		})
		.sort((a, b) => {
			// Oldest at the top, most recent at the bottom
			if (!a.date) return -1;
			if (!b.date) return 1;
			return new Date(a.date).getTime() - new Date(b.date).getTime();
		});

	// Auto-scroll to the bottom when the component loads and populates data
	$: if (tableData.length > 0 && tableContainer && !hasScrolledToBottom) {
		tick().then(() => {
			tableContainer.scrollTop = tableContainer.scrollHeight;
			hasScrolledToBottom = true;
		});
	}
</script>

<div
	class="h-full flex flex-col bg-[#1e1e1e] w-full relative"
	style="--grid-border: {gridBorderThickness} solid {gridBorderColor};"
>
	<div class="p-4 border-b border-gray1/50 flex justify-between items-center bg-black/40 flex-shrink-0 relative z-50">
		<h2 class="text-xl font-black text-gray3 tracking-wide">ALL EVENTS - Scan Reports</h2>
		
		<div class="flex items-center gap-4">
			<div 
				class="flex items-center bg-black/40 border hover:cursor-pointer border-gray1/50 rounded-full text-white text-xs font-bold relative shadow-sm"
				on:mouseleave={() => showZoomDropdown = false}
				role="group"
				aria-label="Zoom controls"
			>
				<button 
					class="px-3 py-2 rounded-l-full hover:cursor-pointer hover:text-lime transition-colors"
					on:click={zoomOut}
				>
					-
				</button>
				
				<button 
					class="px-2 py-2 min-w-[65px] text-center cursor-pointer  hover:text-lime transition-colors"
					on:click={() => showZoomDropdown = !showZoomDropdown}
				>
					{zoomLevel === 'Fit' ? 'Fit' : Math.round((zoomLevel) * 100) + '%'}
				</button>
				
				<button 
					class="px-3 py-2 rounded-r-full hover:cursor-pointer hover:text-lime transition-colors"
					on:click={zoomIn}
				>
					+
				</button>

				{#if showZoomDropdown}
                <div class="absolute top-full cursor-pointer left-1/2 -translate-x-1/2 pt-2 z-[60] min-w-[90px]">
						<div class="bg-[#1e1e1e] cursor-pointer border border-gray1/50 rounded-lg shadow-xl py-2 flex flex-col w-full">
							<button 
								class="px-4 py-2 cursor-pointer hover:bg-white/10 text-center transition-colors {zoomLevel === 'Fit' ? 'text-lime' : ''}" 
								on:click={() => setZoom('Fit')}
							>
								Fit
							</button>
							{#each zoomSteps as step}
								<button 
									class="px-4 py-2 cursor-pointer hover:bg-white/10 text-center transition-colors {zoomLevel === step ? 'text-lime' : ''}" 
									on:click={() => setZoom(step)}
								>
									{Math.round(step * 100)}%
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<button
				class="px-4 py-2 bg-gray1 text-white text-xs font-bold rounded-full hover:bg-lime hover:text-black transition-colors cursor-pointer flex items-center gap-2"
				on:click={() => dispatch('close')}
			>
				Close View
			</button>
		</div>
	</div>

	<div
		bind:this={tableContainer}
		on:scroll={handleScroll}
		class="flex-1 overflow-auto custom-scrollbar  {isScrolling ? 'is-scrolling' : ''}"
	>
		<table 
			class="w-max text-left border-collapse text-[13px] text-white custom-grid-table"
			style="zoom: {actualZoom};"
		>
			<thead class="sticky top-0 z-10 shadow-md bg-[#1e1e1e]">
				<tr class="text-[11px] uppercase tracking-widest text-gray3">
					<th
						colspan="4"
						class="p-2 text-center text-gray3"
						style="background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), {bgDetails};"
						>Details</th
					>
					<th
						colspan="3"
						class="p-2 text-center text-question"
						style="background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), {bgAdvance};"
						>Advance</th
					>
					<th
						colspan="5"
						class="p-2 text-center text-info"
						style="background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), {bgNightOfShow};"
						>Night of Show</th
					>
					<th
						colspan="4"
						class="p-2 text-center text-gray3"
						style="background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), {bgTotal};"
						>Total</th
					>
				</tr>

				<tr class="text-xs font-semibold border-b-2 border-gray1/50 shadow-sm">
					{#each columns as col}
						<th
							class="p-3 text-center text-gray3"
							style="width: {col.width}; min-width: {col.width}; background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), {col.bg};"
						>
							{col.label}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#if tableData.length === 0}
					<tr>
						<td colspan="16" class="p-8 text-center text-gray2 italic border-none"
							>No active reports available.</td
						>
					</tr>
				{:else}
					{#each tableData as row}
						{@const scanStyle = getStatStyle(row.scan_pct, true)}
						{@const noShowStyle = getStatStyle(row.noshow_pct, false)}
						<tr class="hover:bg-white/[0.05] transition-colors">
							<td
								class="p-3 whitespace-nowrap text-white font-mono text-xs text-center"
								style="background: {bgDetails};">{formatDateString(row.date)}</td
							>
							<td class="p-3 text-white text-center" style="background: {bgDetails};">{row.id}</td>
							<td
								class="p-2 text-center text-[11px] tracking-wider"
								style="background: {bgDetails};"
							>
								<span class="px-2 py-1 rounded-3xl inline-block w-full {getVenueClass(row.venue)}">
									{row.venue || 'TBD'}
								</span>
							</td>
							<td
								class="p-3 font-bold truncate max-w-[280px] text-center"
								title={row.name}
								style="background: {bgDetails};">{row.name}</td
							>

							<td class="p-3 text-center text-white" style="background: {bgAdvance};"
								>{row.presale}</td
							>
							<td class="p-3 text-center text-white" style="background: {bgAdvance};"
								>{row.onsale}</td
							>
							<td class="p-3 text-center font-bold text-white" style="background: {bgAdvance};"
								>{row.dos}</td
							>

							<td class="p-3 text-center" style="background: {bgNightOfShow};">{row.adv_sold}</td>
							<td
								class="p-3 text-center text-limwhitee font-bold"
								style="background: {bgNightOfShow};">{row.adv_scanned}</td
							>
							<td class="p-3 text-center" style="background: {bgNightOfShow};">{row.door_paid}</td>
							<td class="p-3 text-center" style="background: {bgNightOfShow};">{row.table_paid}</td>
							<td class="p-3 text-center text-white" style="background: {bgNightOfShow};"
								>{row.comps}</td
							>

							<td class="p-3 text-center font-mono" style="background: {bgTotal};"
								>{row.total_paid}</td
							>
							<td class="p-3 text-center font-black text-white" style="background: {bgTotal};"
								>{row.total_att}</td
							>

							<td
								class="p-3 text-center text-xs {scanStyle.textClass}"
								style="background: {scanStyle.bg};"
							>
								{row.scan_pct.toFixed(2)}%
							</td>
							<td
								class="p-3 text-center text-xs {noShowStyle.textClass}"
								style="background: {noShowStyle.bg};"
							>
								{row.noshow_pct.toFixed(2)}%
							</td></tr
						>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>

<style>
	/* Grid Borders Setup */
	.custom-grid-table th,
	.custom-grid-table td {
		border: var(--grid-border);
	}

	/* Forcefully override global scrollbars using :global and !important */

	/* Firefox Support */
	.custom-scrollbar {
		scrollbar-width: none;
	}
	.custom-scrollbar.is-scrolling,
	.custom-scrollbar:hover {
		scrollbar-width: thin;
		scrollbar-color: var(--color-gray1) transparent;
	}

	/* WebKit (Chrome/Safari) Support */
	:global(.custom-scrollbar::-webkit-scrollbar) {
		width: 8px !important;
		height: 8px !important;
	}
	:global(.custom-scrollbar::-webkit-scrollbar-track) {
		background: transparent !important;
	}

	/* Default state: invisible thumb to simulate auto-hide */
	:global(.custom-scrollbar::-webkit-scrollbar-thumb) {
		background-color: transparent !important;
		border-radius: 4px !important;
	}

	/* Show the scrollbar thumb ONLY when actively scrolling OR explicitly hovering the container */
	:global(.custom-scrollbar.is-scrolling::-webkit-scrollbar-thumb),
	:global(.custom-scrollbar:hover::-webkit-scrollbar-thumb) {
		background-color: var(--color-gray1) !important;
	}

	/* Highlight the scrollbar thumb slightly when explicitly hovering over it */
	:global(.custom-scrollbar::-webkit-scrollbar-thumb:hover) {
		background-color: var(--color-gray2) !important;
	}
</style>