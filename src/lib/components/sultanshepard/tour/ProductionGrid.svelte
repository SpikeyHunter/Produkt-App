<script lang="ts">
	// ============================================================
	// PRODUCTION GRID — full-page spreadsheet of every SHOW date.
	//
	// One row per Tour Date. Most cells read/write the same jsonb
	// columns the Venue Info + Production tabs use (ss_tour_data
	// .venue_info / .production) through saveTabData(), kept live via
	// a realtime subscription on ss_tour_data. The Capacity column is
	// different: it's shared with the Tour Budget tab and lives on
	// ss_tour.budget.grid[dateId].capacity instead, saved through
	// saveTourBudget() and kept live via a second realtime subscription
	// on ss_tour (filtered to this tour's id).
	// ============================================================
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type {
		SSTour,
		SSTourDate,
		VenueInfoData,
		ProductionData,
		TourBudget,
		TriState
	} from '$lib/types/tour';
	import { MIXER_OPTIONS, PLAYER_OPTIONS, backlineLabel } from '$lib/types/tour';
	import { fetchTourDataForDates, saveTabData, saveTourBudget } from '$lib/services/tourService';
	import UploadModal from '$lib/components/modals/UploadModal.svelte';
	import PreviewModal from '$lib/components/modals/PreviewModal.svelte';

	export let tour: SSTour;
	export let tourDates: SSTourDate[] = [];

	// Only real shows become rows (same rule as the budget grid).
	$: showDates = tourDates.filter((d) => (d.type || 'Tour Date') === 'Tour Date');

	const VENUE_TYPES = ['Concert Hall', 'Theatre', 'Festival', 'Club', 'Other'];

	// ---- per-date state ----
	type Row = { venue_info: VenueInfoData; production: ProductionData; capacity: number };
	let rows: Record<string, Row> = {};
	let loading = true;

	let status: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
	let pdfBusy = false;
	let pdfError = false;

	// jsonb cells sometimes arrive as JSON-encoded text — normalise to an object.
	function asObj<T>(v: unknown): T {
		if (v && typeof v === 'string') {
			try {
				return JSON.parse(v);
			} catch {
				return {} as T;
			}
		}
		return (v || {}) as T;
	}

	function blankRow(): Row {
		return { venue_info: {}, production: {}, capacity: 0 };
	}

	// ---- load / reload when the set of shows changes ----
	let loadedKey = '';
	$: idsKey = showDates.map((d) => d.id).join(',');
	$: if (idsKey !== loadedKey) {
		loadedKey = idsKey;
		loadAll();
	}

	async function loadAll() {
		const ids = showDates.map((d) => d.id);
		if (!ids.length) {
			rows = {};
			loading = false;
			return;
		}
		loading = true;
		try {
			const data = await fetchTourDataForDates(ids);
			const budgetGrid = asObj<TourBudget>(tour?.budget).grid || {};
			const next: Record<string, Row> = {};
			for (const id of ids) next[id] = blankRow();
			for (const r of data) {
				next[r.tour_date_id] = {
					venue_info: asObj<VenueInfoData>((r as any).venue_info),
					production: asObj<ProductionData>((r as any).production),
					capacity: 0 // set below, uniformly, from the budget grid
				};
			}
			// Capacity is tracked per-date on the Tour Budget object, independent
			// of whether an ss_tour_data row exists yet for that date.
			for (const id of ids) {
				next[id].capacity = Number(budgetGrid[id]?.capacity) || 0;
			}
			rows = next;
		} catch (e) {
			console.error('ProductionGrid load failed', e);
		} finally {
			loading = false;
		}
	}

	// ---- realtime sync with the Venue Info / Production tabs, and with
	// Capacity from the Tour Budget tab (a different table: ss_tour) ----
	let channel: any;
	onMount(() => {
		channel = supabase
			.channel('prodgrid_' + tour.id)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'ss_tour_data' },
				(payload: any) => {
					const nw = payload.new;
					const id = (nw || payload.old)?.tour_date_id;
					if (!id || !(id in rows)) return;
					applyRemote(id, nw);
				}
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'ss_tour', filter: `id=eq.${tour.id}` },
				(payload: any) => {
					if (payload.new) applyRemoteCapacity(payload.new);
				}
			)
			.subscribe();
	});
	onDestroy(() => {
		if (channel) supabase.removeChannel(channel);
		Object.values(saveTimers).forEach((t) => clearTimeout(t));
	});

	// Merge an incoming DB row, but never clobber a column the user is
	// actively editing (one we still have a pending save for).
	function applyRemote(id: string, nw: any) {
		if (!nw) return;
		const d = dirty[id];
		const cur = rows[id] || blankRow();
		const venue = !d || !d.has('venue_info') ? asObj<VenueInfoData>(nw.venue_info) : cur.venue_info;
		const prod = !d || !d.has('production') ? asObj<ProductionData>(nw.production) : cur.production;
		rows[id] = { ...cur, venue_info: venue, production: prod };
		rows = { ...rows };
	}

	// Same clobber-guard as applyRemote, but for the Capacity column sourced
	// from ss_tour.budget.grid (edits made here OR in the Tour Budget tab).
	function applyRemoteCapacity(nw: any) {
		const budgetGrid = asObj<TourBudget>(nw.budget).grid || {};
		const next: Record<string, Row> = { ...rows };
		let changed = false;
		for (const id of Object.keys(next)) {
			const d = dirty[id];
			if (d && d.has('capacity')) continue; // an edit here is still saving — don't overwrite it
			const val = Number(budgetGrid[id]?.capacity) || 0;
			if (next[id].capacity !== val) {
				next[id] = { ...next[id], capacity: val };
				changed = true;
			}
		}
		if (changed) rows = next;
	}

	// ---- persistence (debounced autosave, per date + per column) ----
	type Col = 'venue_info' | 'production' | 'capacity';
	let saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};
	let dirty: Record<string, Set<Col>> = {};
	let savedTimer: ReturnType<typeof setTimeout>;

	function queueSave(id: string, col: Col) {
		(dirty[id] ||= new Set<Col>()).add(col);
		status = 'saving';
		const key = id + ':' + col;
		clearTimeout(saveTimers[key]);
		saveTimers[key] = setTimeout(() => flush(id, col), 600);
	}

	async function flush(id: string, col: Col) {
		try {
			if (col === 'capacity') {
				// Capacity lives on ss_tour.budget.grid (shared with the Tour Budget
				// tab), not ss_tour_data — merge into the freshest known budget so
				// sibling budget data (money columns, sections, other dates) is
				// never clobbered by this narrower write.
				const next: TourBudget = structuredClone(tour.budget || {});
				if (!next.grid) next.grid = {};
				if (!next.grid[id]) next.grid[id] = {};
				next.grid[id].capacity = rows[id]?.capacity || 0;
				await saveTourBudget(tour.id, next);
			} else {
				await saveTabData(id, col, rows[id][col]);
			}
			dirty[id]?.delete(col);
			if (!anyDirty()) {
				status = 'saved';
				clearTimeout(savedTimer);
				savedTimer = setTimeout(() => status === 'saved' && (status = 'idle'), 1400);
			}
		} catch (e) {
			console.error('ProductionGrid save failed', e);
			status = 'error';
		}
	}
	const anyDirty = () => Object.values(dirty).some((s) => s.size > 0);

	// ---- mutators ----
	function setVenue(id: string, patch: Partial<VenueInfoData>) {
		const r = rows[id] || blankRow();
		rows[id] = { ...r, venue_info: { ...r.venue_info, ...patch } };
		rows = { ...rows };
		queueSave(id, 'venue_info');
	}
	function setProd(id: string, patch: Partial<ProductionData>) {
		const r = rows[id] || blankRow();
		rows[id] = { ...r, production: { ...r.production, ...patch } };
		rows = { ...rows };
		queueSave(id, 'production');
	}
	function setCapacity(id: string, val: number) {
		const r = rows[id] || blankRow();
		rows[id] = { ...r, capacity: val || 0 };
		rows = { ...rows };
		queueSave(id, 'capacity');
	}
	function onCapacityInput(id: string, node: HTMLInputElement) {
		const cleaned = node.value.replace(/[^0-9]/g, '');
		setCapacity(id, cleaned === '' ? 0 : Number(cleaned));
	}
	const numFmt = (n: number) => (n ? Math.round(n).toLocaleString('en-US') : '');

	// ---- feet/inches formatter (matches ProductionSection) ----
	function formatFeetInches(val: string): string {
		if (!val) return '';
		const numbers = val.split(/[^0-9]+/).filter(Boolean);
		if (numbers.length === 1) return `${numbers[0]}'`;
		if (numbers.length >= 2) return `${numbers[0]}' ${numbers[1]}"`;
		return val;
	}

	// Uncontrolled input: only rewrite the DOM value when the field isn't
	// focused, so live/realtime updates never fight the user's typing.
	function fieldSync(node: HTMLInputElement | HTMLTextAreaElement, value: string) {
		node.value = value ?? '';
		return {
			update(v: string) {
				if (document.activeElement !== node) node.value = v ?? '';
			}
		};
	}

	function onDimInput(id: string, key: 'stage_height' | 'stage_width' | 'stage_depth' | 'led_width' | 'led_height', node: HTMLInputElement) {
		setProd(id, { [key]: node.value } as Partial<ProductionData>);
	}
	function onDimBlur(id: string, key: 'stage_height' | 'stage_width' | 'stage_depth' | 'led_width' | 'led_height', node: HTMLInputElement) {
		const formatted = formatFeetInches(node.value);
		node.value = formatted;
		setProd(id, { [key]: formatted } as Partial<ProductionData>);
	}

	function onNotesInput(id: string, node: HTMLTextAreaElement) {
		const v = node.value;
		// Typing turns the venue-notes section on; emptying it turns it off.
		setVenue(id, { notes: v, notes_enabled: v.trim().length > 0 });
	}

	// ---- LED wall toggle also gates the two wall-dimension cells ----
	function toggleLed(id: string) {
		setProd(id, { led_wall: !rows[id]?.production?.led_wall });
	}
	function toggleProdBool(id: string, key: 'elevator' | 'forklift' | 'rigging' | 'table_riser') {
		const current = rows[id]?.production?.[key] ?? null;
		const ORDER: TriState[] = [null, true, false];
		const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
		setProd(id, { [key]: next } as Partial<ProductionData>);
	}

	// ============================================================
	// CUSTOM DROPDOWNS (Location + Type) — rendered position:fixed
	// outside the scroll container so they can't be clipped.
	// ============================================================
	type MenuField = 'location' | 'type' | 'backline_mixer' | 'backline_players';

	let menu: { id: string; field: MenuField; x: number; y: number; w: number } | null = null;

	// Backline triggers are deliberately tiny (two stacked controls inside one
	// row), so their menus get a sane minimum width instead of matching the
	// button.
	const MENU_MIN_W: Partial<Record<MenuField, number>> = {
		backline_mixer: 168,
		backline_players: 168
	};

	function openMenu(e: MouseEvent, id: string, field: MenuField) {
		e.stopPropagation();
		closeMonitors();
		if (menu && menu.id === id && menu.field === field) {
			menu = null;
			return;
		}
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		menu = {
			id,
			field,
			x: r.left,
			y: r.bottom + 4,
			w: Math.max(r.width, MENU_MIN_W[field] ?? 0)
		};
	}
	const closeMenu = () => {
		menu = null;
		closeMonitors();
	};

	function pickLocation(id: string, val: 'indoor' | 'outdoor' | '') {
		setVenue(id, { indoor_outdoor: val });
		menu = null;
	}
	function pickType(id: string, val: string) {
		const patch: Partial<VenueInfoData> = { venue_type: val as VenueInfoData['venue_type'] };
		if (val !== 'Other') patch.venue_type_custom = '';
		setVenue(id, patch);
		if (val === 'Other') focusOtherId = id; // focus the specify input once it mounts
		menu = null;
	}

	// "Other" swaps the dropdown for a text input. Focus it only when the user
	// just picked Other (not for every already-Other row on initial load).
	let focusOtherId: string | null = null;
	function autoFocus(node: HTMLInputElement, active: boolean) {
		const run = (a: boolean) => {
			if (a) {
				requestAnimationFrame(() => node.focus());
				focusOtherId = null;
			}
		};
		run(active);
		return { update: run };
	}
	// Emptying the specify input reverts the cell back to the dropdown button.
	function otherBlur(id: string, node: HTMLInputElement) {
		if (!node.value.trim()) setVenue(id, { venue_type: '', venue_type_custom: '' });
	}

	const locationLabel = (v?: string) => (v === 'indoor' ? 'Indoor' : v === 'outdoor' ? 'Outdoor' : '');
	function typeLabel(vi?: VenueInfoData) {
		if (!vi) return '';
		if (vi.venue_type === 'Other') return vi.venue_type_custom || 'Other';
		return vi.venue_type || '';
	}

	// ============================================================
	// SUPPORT — Backline (Mixer + Players), Monitors, Table/Riser.
	// Same fields the Production tab writes, so both views stay in sync
	// through the existing ss_tour_data realtime subscription.
	// ============================================================
	type BacklineField = {
		key: 'backline_mixer' | 'backline_players';
		customKey: 'backline_mixer_custom' | 'backline_players_custom';
		field: MenuField;
		label: string;
		options: readonly string[];
	};

	const BACKLINE_FIELDS: BacklineField[] = [
		{
			key: 'backline_mixer',
			customKey: 'backline_mixer_custom',
			field: 'backline_mixer',
			label: 'Mixer',
			options: MIXER_OPTIONS
		},
		{
			key: 'backline_players',
			customKey: 'backline_players_custom',
			field: 'backline_players',
			label: 'Players',
			options: PLAYER_OPTIONS
		}
	];

	const backlineFieldFor = (f: MenuField) => BACKLINE_FIELDS.find((b) => b.field === f);

	// "<dateId>:<key>" of the cell that just switched to Other, so only that
	// input steals focus (not every already-Other row on load).
	let focusBacklineKey: string | null = null;

	function pickBackline(id: string, f: BacklineField, val: string) {
		const patch: Partial<ProductionData> = { [f.key]: val } as Partial<ProductionData>;
		if (val !== 'Other') (patch as any)[f.customKey] = '';
		else focusBacklineKey = `${id}:${f.key}`;
		setProd(id, patch);
		menu = null;
	}

	// Markup can't carry TS casts, so the write goes through here.
	function setBacklineCustom(id: string, f: BacklineField, value: string) {
		setProd(id, { [f.customKey]: value } as Partial<ProductionData>);
	}

	// Emptying the specify input reverts the cell back to the dropdown.
	function backlineOtherBlur(id: string, f: BacklineField, node: HTMLInputElement) {
		if (!node.value.trim()) {
			setProd(id, { [f.key]: '', [f.customKey]: '' } as Partial<ProductionData>);
		}
	}

	function autoFocusBackline(node: HTMLInputElement, active: boolean) {
		const run = (a: boolean) => {
			if (a) {
				requestAnimationFrame(() => node.focus());
				focusBacklineKey = null;
			}
		};
		run(active);
		return { update: run };
	}

	// ---- Monitors: compact cell that expands into a fixed popup on click ----
	let monitorPop: { id: string; x: number; y: number; w: number } | null = null;

	function openMonitors(e: MouseEvent, id: string) {
		e.stopPropagation();
		menu = null;
		if (monitorPop && monitorPop.id === id) {
			monitorPop = null;
			return;
		}
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		monitorPop = { id, x: r.left, y: r.bottom + 4, w: Math.max(r.width, 240) };
	}
	const closeMonitors = () => (monitorPop = null);

	function onMonitorsInput(id: string, node: HTMLTextAreaElement) {
		setProd(id, { monitors: node.value });
	}
	function autoFocusArea(node: HTMLTextAreaElement) {
		requestAnimationFrame(() => {
			node.focus();
			node.setSelectionRange(node.value.length, node.value.length);
		});
	}

	// ============================================================
	// STAGE SPECS — paste a link OR upload a file (venue_specs_link)
	//
	// Uploads go straight to Supabase Storage from the browser (no app-server
	// round trip), which avoids request-body size limits (413 errors) on
	// hosted server routes. Files are named "{DD-Mon}_{Venue-Name}_Venue-Specs.ext"
	// and stored at documents/sstour/venuespecs/. Deleting a stored file removes
	// the object from Storage first, then clears the saved path from the row.
	// ============================================================
	const isUrl = (s: string) => /^https?:\/\//.test(s || '');
	const isFile = (s: string) =>
		isUrl(s) && (s || '').includes('supabase.co/storage/v1/object/public/documents/sstour/');

	function formatFileDate(dateStr?: string): string {
		if (!dateStr) return 'Date';
		try {
			const dt = new Date(dateStr + 'T00:00:00');
			const day = String(dt.getDate()).padStart(2, '0');
			const month = dt.toLocaleDateString('en-US', { month: 'short' });
			return `${day}-${month}`; // e.g. "26-Feb"
		} catch {
			return 'Date';
		}
	}
	function slugifyVenue(venue?: string): string {
		return (
			(venue || 'Venue')
				.trim()
				.replace(/\s+/g, '-')
				.replace(/[^a-zA-Z0-9-]/g, '') || 'Venue'
		);
	}
	function buildSpecsPath(date: SSTourDate | undefined, ext: string): string {
		const dateLabel = formatFileDate(date?.date);
		const venueLabel = slugifyVenue(date?.venue);
		return `sstour/venuespecs/${dateLabel}_${venueLabel}_Venue-Specs.${ext}`;
	}
	// Extracts the storage object path (bucket-relative) from a Supabase public URL.
	function storagePathFromUrl(url: string): string | null {
		const marker = '/object/public/documents/';
		const idx = url.indexOf(marker);
		if (idx === -1) return null;
		return decodeURIComponent(url.slice(idx + marker.length));
	}
	async function deleteStoredFile(url: string): Promise<boolean> {
		if (!isFile(url)) return true; // pasted (non-uploaded) links have nothing to delete
		const path = storagePathFromUrl(url);
		if (!path) return true;
		try {
			const { error } = await supabase.storage.from('documents').remove([path]);
			if (error) {
				console.error('Failed to delete stored file:', error.message);
				return false;
			}
			return true;
		} catch (err) {
			console.error('Failed to delete stored file:', err);
			return false;
		}
	}
	// The real filename this URL was stored as (the last path segment) — used
	// so downloads/previews show the actual file, not a generic hardcoded label.
	function fileNameFromUrl(url: string, fallback: string): string {
		const path = storagePathFromUrl(url);
		if (!path) return fallback;
		const parts = path.split('/');
		return decodeURIComponent(parts[parts.length - 1] || fallback);
	}

	// While a specs cell is focused we show the text input; on blur, a committed
	// link/file collapses to a compact chip (so the full URL is never shown).
	let specsEditing: Record<string, boolean> = {};
	const setSpecsEditing = (id: string, v: boolean) =>
		(specsEditing = { ...specsEditing, [id]: v });

	function onSpecsInput(id: string, node: HTMLInputElement) {
		setProd(id, { venue_specs_link: node.value });
	}
	async function clearSpecs(id: string) {
		const prevLink = rows[id]?.production?.venue_specs_link || '';
		if (prevLink) {
			const ok = await deleteStoredFile(prevLink);
			if (!ok) {
				alert('Failed to delete the file from storage. The link was not removed — please try again.');
				return;
			}
		}
		setProd(id, { venue_specs_link: '' });
		setSpecsEditing(id, true);
	}
	function openLink(url?: string) {
		if (url) window.open(url, '_blank');
	}

	// file upload (mirrors ProductionSection)
	let uploadForId: string | null = null;
	let showUploadModal = false;
	let isUploading = false;

	let previewUrl = '';
	let previewName = '';
	let showPreviewModal = false;

	function openUpload(id: string) {
		uploadForId = id;
		showUploadModal = true;
	}
	// The exact base name this upload will be saved as (no extension) — shown
	// in the modal's preview so it never lies about the real stored filename.
	$: pendingUploadDate = uploadForId ? showDates.find((d) => d.id === uploadForId) : undefined;
	$: pendingSpecsName = `${formatFileDate(pendingUploadDate?.date)}_${slugifyVenue(pendingUploadDate?.venue)}_Venue-Specs`;
	function openPreview(url: string, name: string) {
		previewUrl = url;
		previewName = name;
		showPreviewModal = true;
	}

	async function handleUploadEvent(e: CustomEvent) {
		if (!uploadForId) return;
		const id = uploadForId;
		const { file, fileName } = e.detail;
		isUploading = true;
		try {
			const date = showDates.find((d) => d.id === id);
			const ext = (fileName.split('.').pop() || 'pdf').toLowerCase();
			const path = buildSpecsPath(date, ext);

			const { error: uploadError } = await supabase.storage
				.from('documents')
				.upload(path, file, { upsert: true, cacheControl: '3600' });
			if (uploadError) throw uploadError;

			const { data: pub } = supabase.storage.from('documents').getPublicUrl(path);

			// Re-uploading (venue/date since changed, new filename) should orphan
			// whatever file used to be stored here rather than leave it stranded.
			const prevLink = rows[id]?.production?.venue_specs_link || '';
			if (prevLink && prevLink !== pub.publicUrl) await deleteStoredFile(prevLink);

			setProd(id, { venue_specs_link: pub.publicUrl });
			showUploadModal = false;
		} catch (err) {
			console.error('File upload failed', err);
			alert('Failed to upload file.');
		} finally {
			isUploading = false;
			uploadForId = null;
		}
	}

	// ---- misc ----
	function fmtDate(d: string) {
		try {
			return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
				weekday: 'short',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return d;
		}
	}

	// ============================================================
	// PDF EXPORT — black & white, data-only (no buttons/toggles;
	// toggles become YES/NO), the whole grid scaled to fit one
	// landscape page. Called from the parent page via bind:this.
	// Requires the `pdf-lib` npm package (client-side, no backend).
	// ============================================================
	// Presence-only, matching the other YES/NO toggle columns.
	const specsText = (pr: ProductionData) => (pr.venue_specs_link ? 'YES' : 'NO');
	// Elevator/Forklift/Rig/Table-Riser are 3-state (TBD/Yes/No) — render all three in the PDF.
	const triText = (v: TriState | undefined) => (v === true ? 'YES' : v === false ? 'NO' : 'TBD');
	// Backline prints as "Mixer / Players", collapsing to a single "None" when
	// neither piece has been specified.
	const backlineText = (pr: ProductionData) => {
		const mixer = backlineLabel(pr.backline_mixer, pr.backline_mixer_custom);
		const players = backlineLabel(pr.backline_players, pr.backline_players_custom);
		if (mixer === 'None' && players === 'None') return 'None';
		return `${mixer} / ${players}`;
	};

	type PdfCol = {
		header: string;
		width: number;
		get: (vi: VenueInfoData, pr: ProductionData, capacity: number) => string;
		/**
		 * Optional stacked rendering — [top line, bottom line]. Used when the row
		 * is tall enough (same threshold the SHOW column uses); on very dense
		 * tours the rows get too short for two lines and `get` is used instead.
		 */
		lines?: (vi: VenueInfoData, pr: ProductionData) => [string, string];
	};
	const PDF_COLUMNS: PdfCol[] = [
		{ header: 'LOCATION', width: 120, get: (vi) => locationLabel(vi.indoor_outdoor) || '—' },
		{ header: 'TYPE', width: 128, get: (vi) => typeLabel(vi) || '—' },
		// Stage dimensions always print WIDTH → DEPTH → HEIGHT.
		{ header: 'WIDTH', width: 78, get: (_v, pr) => pr.stage_width || '—' },
		{ header: 'DEPTH', width: 78, get: (_v, pr) => pr.stage_depth || '—' },
		{ header: 'HEIGHT', width: 78, get: (_v, pr) => pr.stage_height || '—' },
		{ header: 'STAGE SPECS', width: 131, get: (_v, pr) => specsText(pr) },
		{ header: 'LED WALL', width: 98, get: (_v, pr) => (pr.led_wall ? 'YES' : 'NO') },
		{ header: 'WIDTH', width: 78, get: (_v, pr) => pr.led_width || '—' },
		{ header: 'HEIGHT', width: 78, get: (_v, pr) => pr.led_height || '—' },
		{ header: 'ELEV', width: 66, get: (_v, pr) => triText(pr.elevator) },
		{ header: 'FORK', width: 66, get: (_v, pr) => triText(pr.forklift) },
		{ header: 'RIG', width: 60, get: (_v, pr) => triText(pr.rigging) },
		{
			header: 'BACKLINE',
			width: 158,
			get: (_v, pr) => backlineText(pr),
			// Mixer on top, players underneath — mirrors the on-screen cell.
			lines: (_v, pr) => [
				backlineLabel(pr.backline_mixer, pr.backline_mixer_custom),
				backlineLabel(pr.backline_players, pr.backline_players_custom)
			]
		},
		// Long monitor notes are simply clipped to the column.
		{ header: 'MONITORS', width: 150, get: (_v, pr) => (pr.monitors || '').replace(/\s+/g, ' ').trim() || '—' },
		{ header: 'TABLE', width: 72, get: (_v, pr) => triText(pr.table_riser) },
		{ header: 'CAPACITY', width: 98, get: (_v, _p, cap) => (cap ? cap.toLocaleString('en-US') : '—') },
		{ header: 'NOTES', width: 175, get: (vi) => (vi.notes || '').replace(/\s+/g, ' ').trim() || '—' }
	];
	const PDF_SHOW_COL_WIDTH = 180;

	export async function downloadPdf() {
		if (pdfBusy) return;
		pdfBusy = true;
		pdfError = false;
		try {
			const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

			// Letter, landscape — familiar print size for North American crews.
			const PAGE_W = 792;
			const PAGE_H = 612;
			const MARGIN = 24;
			const contentW = PAGE_W - MARGIN * 2;

			const doc = await PDFDocument.create();
			const page = doc.addPage([PAGE_W, PAGE_H]);
			const font = await doc.embedFont(StandardFonts.Helvetica);
			const bold = await doc.embedFont(StandardFonts.HelveticaBold);

			const black = rgb(0, 0, 0);
			const gray = rgb(0.4, 0.4, 0.4);
			const lineGray = rgb(0.55, 0.55, 0.55);
			const headerFill = rgb(0.9, 0.9, 0.9);
			const zebraFill = rgb(0.96, 0.96, 0.96);

			// Column widths scaled (proportionally, same ratios as the on-screen grid)
			// to exactly fill the printable width.
			const rawWidths = [PDF_SHOW_COL_WIDTH, ...PDF_COLUMNS.map((c) => c.width)];
			const rawSum = rawWidths.reduce((a, b) => a + b, 0);
			const scale = contentW / rawSum;
			const colWidths = rawWidths.map((w) => w * scale);
			const headers = ['SHOW', ...PDF_COLUMNS.map((c) => c.header)];

			const truncate = (text: string, f: typeof font, size: number, maxWidth: number) => {
				let t = (text || '').replace(/\s+/g, ' ').trim();
				if (!t) return '—';
				if (f.widthOfTextAtSize(t, size) <= maxWidth) return t;
				const ell = '';
				while (t.length > 1 && f.widthOfTextAtSize(t + ell, size) > maxWidth) {
					t = t.slice(0, -1);
				}
				return t + ell;
			};
			// Horizontally centers text within a column's [colX, colX + colW] span.
			const centerX = (t: string, f: typeof font, size: number, colX: number, colW: number) => {
				const tw = f.widthOfTextAtSize(t, size);
				return colX + Math.max(2, (colW - tw) / 2);
			};

			let y = PAGE_H - MARGIN;

			// ---- title ----
			const title = `Production — ${tour?.name || 'Tour'}`;
			const genDate = new Date().toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
			page.drawText(title, { x: MARGIN, y: y - 12, size: 13, font: bold, color: black });
			page.drawText(
				`Generated ${genDate} · ${showDates.length} show${showDates.length === 1 ? '' : 's'}`,
				{ x: MARGIN, y: y - 25, size: 8, font, color: gray }
			);
			y -= 38;

			// ---- header row ----
			const headerH = 18;
			const tableTop = y;
			page.drawRectangle({ x: MARGIN, y: tableTop - headerH, width: contentW, height: headerH, color: headerFill });

			let hx = MARGIN;
			headers.forEach((h, i) => {
				const w = colWidths[i];
				const size = 6.5;
				const t = truncate(h, bold, size, w - 6);
				page.drawText(t, { x: centerX(t, bold, size, hx, w), y: tableTop - headerH + 6.5, size, font: bold, color: black });
				hx += w;
			});

			// ---- body rows (scaled to fit exactly one page) ----
			const numRows = showDates.length;
			const availableH = tableTop - headerH - MARGIN;
			const rowH = numRows > 0 ? availableH / numRows : 0;
			const fontSize = Math.max(4.5, Math.min(7.5, rowH - 4));
			const showTwoLine = rowH >= 16;
			// Stacked data cells (BACKLINE) size their own text so two lines always
			// fit the row rather than overlapping. Only once that would drop below
			// 4.5pt do they fall back to the single-line `get`.
			const STACK_GAP = 1.5;
			const stackFont = Math.min(fontSize, (rowH - 4 - STACK_GAP) / 2);
			const stackBlockH = stackFont * 2 + STACK_GAP;
			const stackTwoLine = stackFont >= 4.5;

			showDates.forEach((d, i) => {
				const vi = rows[d.id]?.venue_info || {};
				const pr = rows[d.id]?.production || {};
				const rowTop = tableTop - headerH - rowH * i;
				const rowBottom = rowTop - rowH;

				if (i % 2 === 1) {
					page.drawRectangle({ x: MARGIN, y: rowBottom, width: contentW, height: rowH, color: zebraFill });
				}

				let cx = MARGIN;
				// SHOW column
				const showW = colWidths[0];
				if (showTwoLine) {
					const venueT = truncate(d.venue || 'Untitled', bold, fontSize, showW - 6);
					const dateT = truncate(fmtDate(d.date), font, fontSize - 1, showW - 6);
					page.drawText(venueT, { x: centerX(venueT, bold, fontSize, cx, showW), y: rowTop - fontSize - 1, size: fontSize, font: bold, color: black });
					page.drawText(dateT, { x: centerX(dateT, font, fontSize - 1, cx, showW), y: rowBottom + 3, size: fontSize - 1, font, color: gray });
				} else {
					const combined = `${d.venue || 'Untitled'} — ${fmtDate(d.date)}`;
					const t = truncate(combined, bold, fontSize, showW - 6);
					page.drawText(t, { x: centerX(t, bold, fontSize, cx, showW), y: rowBottom + (rowH - fontSize) / 2 + 1, size: fontSize, font: bold, color: black });
				}
				cx += showW;

				// data columns
				PDF_COLUMNS.forEach((col, ci) => {
					const w = colWidths[ci + 1];
					if (col.lines && stackTwoLine) {
						// Two stacked values sharing one cell (BACKLINE: mixer over
						// players), centered as a block so they never collide.
						const [top, bottom] = col.lines(vi, pr);
						const botBase = rowBottom + (rowH - stackBlockH) / 2;
						const topBase = botBase + stackFont + STACK_GAP;
						const t1 = truncate(top, font, stackFont, w - 4);
						const t2 = truncate(bottom, font, stackFont, w - 4);
						page.drawText(t1, { x: centerX(t1, font, stackFont, cx, w), y: topBase, size: stackFont, font, color: black });
						page.drawText(t2, { x: centerX(t2, font, stackFont, cx, w), y: botBase, size: stackFont, font, color: black });
					} else {
						const raw = col.get(vi, pr, rows[d.id]?.capacity || 0);
						const t = truncate(raw, font, fontSize, w - 6);
						page.drawText(t, { x: centerX(t, font, fontSize, cx, w), y: rowBottom + (rowH - fontSize) / 2 + 1, size: fontSize, font, color: black });
					}
					cx += w;
				});
			});

			// ---- grid lines (drawn last so they sit crisply over the fills) ----
			const tableBottom = tableTop - headerH - rowH * numRows;
			let lx = MARGIN;
			for (let i = 0; i <= headers.length; i++) {
				page.drawLine({
					start: { x: lx, y: tableTop },
					end: { x: lx, y: tableBottom },
					thickness: 0.5,
					color: lineGray
				});
				if (i < headers.length) lx += colWidths[i];
			}
			// header separators (bold) + row separators (thin)
			page.drawLine({ start: { x: MARGIN, y: tableTop }, end: { x: MARGIN + contentW, y: tableTop }, thickness: 0.75, color: black });
			page.drawLine({ start: { x: MARGIN, y: tableTop - headerH }, end: { x: MARGIN + contentW, y: tableTop - headerH }, thickness: 0.75, color: black });
			for (let i = 1; i < numRows; i++) {
				const ly = tableTop - headerH - rowH * i;
				page.drawLine({ start: { x: MARGIN, y: ly }, end: { x: MARGIN + contentW, y: ly }, thickness: 0.3, color: lineGray });
			}
			page.drawLine({ start: { x: MARGIN, y: tableBottom }, end: { x: MARGIN + contentW, y: tableBottom }, thickness: 0.75, color: black });

			// ---- download ----
			const pdfBytes = await doc.save();
			const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			const safeName = (tour?.name || 'Tour').replace(/[^a-zA-Z0-9]+/g, '_');
			a.href = url;
			a.download = `Production_${safeName}.pdf`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (e) {
			console.error('PDF export failed', e);
			pdfError = true;
			setTimeout(() => (pdfError = false), 3000);
		} finally {
			pdfBusy = false;
		}
	}
</script>

<section class="relative bg-navbar rounded-2xl h-full flex flex-col min-h-0 overflow-hidden">

    

	<!-- body -->
	<div class="flex-1 min-h-0 overflow-auto custom-scrollbar" on:scroll={closeMenu}>
		{#if loading}
			<div class="flex justify-center items-center h-full">
				<div class="animate-spin w-7 h-7 text-lime">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
				</div>
			</div>
		{:else if showDates.length === 0}
			<p class="text-sm text-gray2 italic p-6">No Tour Dates yet — add shows to build the grid.</p>
		{:else}
			<table class="w-full table-fixed border-collapse text-sm min-w-[1684px]">
				<colgroup>
					<col style="width:180px" />
					<!-- location -->
					<col style="width:108px" />
					<col style="width:116px" />
					<!-- stage: width / depth / height / specs -->
					<col style="width:64px" />
					<col style="width:64px" />
					<col style="width:64px" />
					<col style="width:158px" />
					<!-- video & rigging -->
					<col style="width:58px" />
					<col style="width:66px" />
					<col style="width:66px" />
					<col style="width:54px" />
					<col style="width:54px" />
					<col style="width:50px" />
					<!-- support: backline / monitors / table -->
					<col style="width:122px" />
					<col style="width:128px" />
					<col style="width:66px" />
					<!-- capacity -->
					<col style="width:70px" />
					<!-- notes -->
					<col style="width:196px" />
				</colgroup>

				<thead>
					<!-- group row -->
					<tr class="bg-navbar">
						<th rowspan="2" class="sticky left-0 top-0 z-40 bg-navbar text-center px-2 align-middle text-[11px] font-black uppercase tracking-widest text-lime border-b border-gray1">Show Dates</th>
						<th colspan="2" class="sticky top-0 z-30 bg-navbar h-7 text-[10px] font-black uppercase tracking-widest text-lime border-l-2 border-gray1">Location</th>
						<th colspan="4" class="sticky top-0 z-30 bg-navbar h-7 text-[10px] font-black uppercase tracking-widest text-lime border-l-2 border-gray1">Stage</th>
						<th colspan="6" class="sticky top-0 z-30 bg-navbar h-7 text-[10px] font-black uppercase tracking-widest text-lime border-l-2 border-gray1">Video &amp; Rigging</th>
						<th colspan="3" class="sticky top-0 z-30 bg-navbar h-7 text-[10px] font-black uppercase tracking-widest text-lime border-l-2 border-gray1">Support</th>
						<th class="sticky top-0 z-30 bg-navbar h-7 text-[10px] font-black uppercase tracking-widest text-lime border-l-2 border-gray1">Capacity</th>
						<th class="sticky top-0 z-30 bg-navbar h-7 text-[10px] font-black uppercase tracking-widest text-lime border-l-2 border-gray1">Notes</th>
					</tr>
					<!-- column row -->
					<tr class="bg-navbar">
						<th class="sticky top-7 z-30 bg-navbar px-1 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1 border-l-2 border-l-gray1">Location</th>
						<th class="sticky top-7 z-30 bg-navbar px-1 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1">Type</th>

						<th class="sticky top-7 z-30 bg-navbar px-0.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1 border-l-2 border-l-gray1">Width</th>
						<th class="sticky top-7 z-30 bg-navbar px-0.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1">Depth</th>
						<th class="sticky top-7 z-30 bg-navbar px-0.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1">Height</th>
						<th class="sticky top-7 z-30 bg-navbar px-1 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1">Stage Specs</th>

						<th class="sticky top-7 z-30 bg-navbar px-0.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1 border-l-2 border-l-gray1">LED Wall</th>
						<th class="sticky top-7 z-30 bg-navbar px-0.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1">Width</th>
						<th class="sticky top-7 z-30 bg-navbar px-0.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1">Height</th>
						<th class="sticky top-7 z-30 bg-navbar px-0.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1">Elev</th>
						<th class="sticky top-7 z-30 bg-navbar px-0.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1">Fork</th>
						<th class="sticky top-7 z-30 bg-navbar px-0.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1">Rig</th>

						<th class="sticky top-7 z-30 bg-navbar px-1 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1 border-l-2 border-l-gray1">Backline</th>
						<th class="sticky top-7 z-30 bg-navbar px-1 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1">Monitors</th>
						<th class="sticky top-7 z-30 bg-navbar px-0.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1">Table</th>

						<th class="sticky top-7 z-30 bg-navbar px-0.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1 border-l-2 border-l-gray1">Capacity</th>
						<th class="sticky top-7 z-30 bg-navbar px-1 py-2 text-[10px] font-bold uppercase tracking-wider text-gray2 text-center border-b border-gray1 border-l-2 border-l-gray1">Notes</th>
					</tr>
				</thead>

				<tbody>
					{#each showDates as d (d.id)}
						{@const vi = rows[d.id]?.venue_info || {}}
						{@const pr = rows[d.id]?.production || {}}
						{@const cap = rows[d.id]?.capacity || 0}
						<tr class="border-t border-gray1/60 group hover:bg-white/[0.06] align-top">
							<!-- Venue (row generator) -->
							<td class="sticky left-0 z-10 bg-navbar group-hover:brightness-125 transition-[filter] px-1 py-2">
								<div class="text-sm font-bold text-white truncate">{d.venue || 'Untitled'}</div>
								<div class="text-[11px] text-gray2">{fmtDate(d.date)}</div>
							</td>

							<!-- Location -->
							<td class="px-1 py-2 border-l-2 border-gray1">
								<button
									type="button"
									class="w-full flex items-center justify-between gap-1 bg-black/20 rounded-full pl-3 pr-2 h-8 text-sm outline-none border border-transparent hover:border-lime/40 transition-colors cursor-pointer"
									on:click={(e) => openMenu(e, d.id, 'location')}
								>
									<span class="truncate {vi.indoor_outdoor ? 'text-white' : 'text-gray2/50'}">
										{locationLabel(vi.indoor_outdoor) || 'Select'}
									</span>
									<svg class="w-3.5 h-3.5 text-gray2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
								</button>
							</td>

							<!-- Type (dropdown; "Other" swaps the whole control for an input) -->
							<td class="px-1 py-2">
								{#if vi.venue_type === 'Other'}
									<input
										class="w-full bg-black/20 rounded-full px-3 h-8 text-sm text-white placeholder-gray2/40 outline-none border border-lime/60 transition-colors"
										placeholder="Specify"
										use:fieldSync={vi.venue_type_custom || ''}
										use:autoFocus={focusOtherId === d.id}
										on:input={(e) => setVenue(d.id, { venue_type_custom: e.currentTarget.value })}
										on:blur={(e) => otherBlur(d.id, e.currentTarget)}
									/>
								{:else}
									<button
										type="button"
										class="w-full flex items-center justify-between gap-1 bg-black/20 rounded-full pl-3 pr-2 h-8 text-sm outline-none border border-transparent hover:border-lime/40 transition-colors cursor-pointer"
										on:click={(e) => openMenu(e, d.id, 'type')}
									>
										<span class="truncate {vi.venue_type ? 'text-white' : 'text-gray2/50'}">
											{typeLabel(vi) || 'Select'}
										</span>
										<svg class="w-3.5 h-3.5 text-gray2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>
									</button>
								{/if}
							</td>

							<!-- Stage H / W / D -->
							
							<td class="px-0.5 py-2 border-l-2 border-gray1 ">
								<input
									class="w-full bg-black/20 rounded-full px-1 h-8 text-sm text-white text-center placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
									placeholder="—"
									use:fieldSync={pr.stage_width || ''}
									on:input={(e) => onDimInput(d.id, 'stage_width', e.currentTarget)}
									on:blur={(e) => onDimBlur(d.id, 'stage_width', e.currentTarget)}
								/>
							</td>
							<td class="px-0.5 py-2">
								<input
									class="w-full bg-black/20 rounded-full px-1 h-8 text-sm text-white text-center placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
									placeholder="—"
									use:fieldSync={pr.stage_depth || ''}
									on:input={(e) => onDimInput(d.id, 'stage_depth', e.currentTarget)}
									on:blur={(e) => onDimBlur(d.id, 'stage_depth', e.currentTarget)}
								/>
							</td>
                            <td class="px-0.5 py-2">
								<input
									class="w-full bg-black/20 rounded-full px-1 h-8 text-sm text-white text-center placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
									placeholder="—"
									use:fieldSync={pr.stage_height || ''}
									on:input={(e) => onDimInput(d.id, 'stage_height', e.currentTarget)}
									on:blur={(e) => onDimBlur(d.id, 'stage_height', e.currentTarget)}
								/>
							</td>

							<!-- Stage Specs (fixed width, no full URL) -->
							<td class="px-1 py-2">
								{#if !specsEditing[d.id] && isUrl(pr.venue_specs_link || '')}
									<div class="flex items-center gap-1 bg-black/15 rounded-full pl-3 pr-1 h-8">
										<span class="flex-1 min-w-0 truncate text-xs text-lime font-bold select-none">
											{isFile(pr.venue_specs_link || '') ? 'Specs File' : 'Specs Link'}
										</span>
										{#if isFile(pr.venue_specs_link || '')}
											<button
												type="button"
												class="shrink-0 px-2 h-6 flex items-center rounded-full bg-lime text-black text-[10px] font-bold hover:brightness-110 transition-all cursor-pointer"
												on:click={() => openPreview(pr.venue_specs_link || '', fileNameFromUrl(pr.venue_specs_link || '', 'Venue Specs'))}
											>Preview</button>
										{:else}
											<button
												type="button"
												class="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-gray2 hover:text-lime transition-colors cursor-pointer"
												title="Open link"
												on:click={() => openLink(pr.venue_specs_link)}
											>
												<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
											</button>
											<button
												type="button"
												class="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-gray2 hover:text-white transition-colors cursor-pointer"
												title="Edit link"
												on:click={() => setSpecsEditing(d.id, true)}
											>
												<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
											</button>
										{/if}
										<button
											type="button"
											class="shrink-0 h-6 w-6 flex items-center justify-center rounded-full text-gray2 hover:text-problem transition-colors cursor-pointer"
											title="Clear"
											on:click={() => clearSpecs(d.id)}
										>
											<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
										</button>
									</div>
								{:else}
									<div class="flex items-center gap-1">
										<input
											class="min-w-0 flex-1 bg-black/20 rounded-full px-3 h-8 text-xs text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
											placeholder="Paste link"
											use:fieldSync={pr.venue_specs_link || ''}
											on:focus={() => setSpecsEditing(d.id, true)}
											on:input={(e) => onSpecsInput(d.id, e.currentTarget)}
											on:blur={() => setSpecsEditing(d.id, false)}
										/>
										<button
											type="button"
											class="shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-black text-white hover:bg-lime hover:text-black transition-all cursor-pointer"
											title="Upload file"
											on:click={() => openUpload(d.id)}
										>
											<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
										</button>
									</div>
								{/if}
							</td>

							<!-- LED Wall toggle -->
							<td class="px-0.5 py-2 border-l-2 border-gray1 align-middle">
								<div class="h-8 flex items-center justify-center">
									<button type="button" role="switch" aria-label="LED Wall" title="LED Wall" aria-checked={!!pr.led_wall} on:click={() => toggleLed(d.id)}
										class="relative inline-flex w-9 h-5 rounded-full transition-colors cursor-pointer {pr.led_wall ? 'bg-lime' : 'bg-gray1 hover:bg-gray1/70'}">
										<span class="absolute top-0.5 w-4 h-4 rounded-full bg-black transition-all {pr.led_wall ? 'left-[18px]' : 'left-0.5 ring-1 ring-white/10'}"></span>
									</button>
								</div>
							</td>

							<!-- Wall W / H (locked unless LED wall on) -->
							<td class="px-0.5 py-2 align-middle">
								{#if pr.led_wall}
									<input
										class="w-full bg-black/20 rounded-full px-1 h-8 text-sm text-white text-center placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
										placeholder="—"
										use:fieldSync={pr.led_width || ''}
										on:input={(e) => onDimInput(d.id, 'led_width', e.currentTarget)}
										on:blur={(e) => onDimBlur(d.id, 'led_width', e.currentTarget)}
									/>
								{:else}
									<div class="w-full h-8 flex items-center justify-center rounded-full bg-black/10 text-gray2/30">
										<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
									</div>
								{/if}
							</td>
							<td class="px-0.5 py-2 align-middle">
								{#if pr.led_wall}
									<input
										class="w-full bg-black/20 rounded-full px-1 h-8 text-sm text-white text-center placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
										placeholder="—"
										use:fieldSync={pr.led_height || ''}
										on:input={(e) => onDimInput(d.id, 'led_height', e.currentTarget)}
										on:blur={(e) => onDimBlur(d.id, 'led_height', e.currentTarget)}
									/>
								{:else}
									<div class="w-full h-8 flex items-center justify-center rounded-full bg-black/10 text-gray2/30">
										<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
									</div>
								{/if}
							</td>

							<!-- Elevator / Forklift / Rig — 3-state: TBD (proposed) / Yes (confirmed) / No (problem) -->
							<td class="px-0.5 py-2 align-middle">
								<div class="h-8 flex items-center justify-center">
									<button type="button" aria-label="Elevator"
										title="Elevator — click to cycle: TBD → Yes → No"
										on:click={() => toggleProdBool(d.id, 'elevator')}
										class="px-3 h-6 rounded-full text-[10px] font-black uppercase tracking-wide border flex items-center justify-center transition-colors cursor-pointer
											{pr.elevator === true
											? 'bg-confirmed/15 border-confirmed text-confirmed'
											: pr.elevator === false
												? 'bg-problem/15 border-problem text-problem'
												: 'bg-proposed/15 border-proposed text-proposed'}">
										{pr.elevator === true ? 'YES' : pr.elevator === false ? 'NO' : 'TBD'}
									</button>
								</div>
							</td>
							<td class="px-0.5 py-2 align-middle">
								<div class="h-8 flex items-center justify-center">
									<button type="button" aria-label="Forklift"
										title="Forklift — click to cycle: TBD → Yes → No"
										on:click={() => toggleProdBool(d.id, 'forklift')}
										class="px-3 h-6 rounded-full text-[10px] font-black uppercase tracking-wide border flex items-center justify-center transition-colors cursor-pointer
											{pr.forklift === true
											? 'bg-confirmed/15 border-confirmed text-confirmed'
											: pr.forklift === false
												? 'bg-problem/15 border-problem text-problem'
												: 'bg-proposed/15 border-proposed text-proposed'}">
										{pr.forklift === true ? 'YES' : pr.forklift === false ? 'NO' : 'TBD'}
									</button>
								</div>
							</td>
							<td class="px-0.5 py-2 align-middle">
								<div class="h-8 flex items-center justify-center">
									<button type="button" aria-label="Rig"
										title="Rig — click to cycle: TBD → Yes → No"
										on:click={() => toggleProdBool(d.id, 'rigging')}
										class="px-3 h-6 rounded-full text-[10px] font-black uppercase tracking-wide border flex items-center justify-center transition-colors cursor-pointer
											{pr.rigging === true
											? 'bg-confirmed/15 border-confirmed text-confirmed'
											: pr.rigging === false
												? 'bg-problem/15 border-problem text-problem'
												: 'bg-proposed/15 border-proposed text-proposed'}">
										{pr.rigging === true ? 'YES' : pr.rigging === false ? 'NO' : 'TBD'}
									</button>
								</div>
							</td>

							<!-- ===== SUPPORT ===== -->

							<!-- Backline — two stacked dropdowns (Mixer over Players).
							     Picking "Other" swaps that one control for a text input;
							     clearing it on blur reverts to the dropdown. -->
							<td class="px-0.5 py-2 border-l-2 border-gray1 align-middle">
								<div class="h-8 flex flex-col justify-center gap-[3px]">
									{#each BACKLINE_FIELDS as f (f.key)}
										{#if pr[f.key] === 'Other'}
											<input
												class="w-full bg-black/20 rounded-full px-2 h-[14px] text-[9px] leading-none text-white placeholder-gray2/40 outline-none border border-lime/60 transition-colors"
												placeholder={f.label}
												title={f.label}
												use:fieldSync={pr[f.customKey] || ''}
												use:autoFocusBackline={focusBacklineKey === `${d.id}:${f.key}`}
												on:input={(e) => setBacklineCustom(d.id, f, e.currentTarget.value)}
												on:blur={(e) => backlineOtherBlur(d.id, f, e.currentTarget)}
											/>
										{:else}
											<button
												type="button"
												title="{f.label} — {backlineLabel(pr[f.key], pr[f.customKey])}"
												class="w-full flex items-center justify-between gap-0.5 bg-black/20 rounded-full pl-2 pr-1 h-[14px] text-[9px] leading-none outline-none border border-transparent hover:border-lime/40 transition-colors cursor-pointer"
												on:click={(e) => openMenu(e, d.id, f.field)}
											>
												<span
													class="truncate {pr[f.key] && pr[f.key] !== 'None'
														? 'text-white'
														: 'text-gray2/50'}"
												>
													{backlineLabel(pr[f.key], pr[f.customKey])}
												</span>
												<svg class="w-2.5 h-2.5 text-gray2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6" /></svg>
											</button>
										{/if}
									{/each}
								</div>
							</td>

							<!-- Monitors — compact cell, expands to a popup editor on click -->
							<td class="px-0.5 py-2 align-middle">
								<button
									type="button"
									title={pr.monitors || 'Monitors'}
									class="w-full h-8 flex items-center justify-between gap-1 bg-black/20 rounded-full pl-3 pr-2 text-sm outline-none border border-transparent hover:border-lime/40 transition-colors cursor-pointer {monitorPop?.id ===
									d.id
										? 'border-lime/60'
										: ''}"
									on:click={(e) => openMonitors(e, d.id)}
								>
									<span class="truncate text-left {pr.monitors ? 'text-white' : 'text-gray2/50'}">
										{pr.monitors || '—'}
									</span>
									<svg class="w-3.5 h-3.5 text-gray2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
								</button>
							</td>

							<!-- Table — 3-state: TBD (default) / Yes / No -->
							<td class="px-0.5 py-2 align-middle">
								<div class="h-8 flex items-center justify-center">
									<button type="button" aria-label="Table"
										title="Table — click to cycle: TBD → Yes → No"
										on:click={() => toggleProdBool(d.id, 'table_riser')}
										class="px-3 h-6 rounded-full text-[10px] font-black uppercase tracking-wide border flex items-center justify-center transition-colors cursor-pointer
											{pr.table_riser === true
											? 'bg-confirmed/15 border-confirmed text-confirmed'
											: pr.table_riser === false
												? 'bg-problem/15 border-problem text-problem'
												: 'bg-proposed/15 border-proposed text-proposed'}">
										{pr.table_riser === true ? 'YES' : pr.table_riser === false ? 'NO' : 'TBD'}
									</button>
								</div>
							</td>

							<!-- Capacity — linked to the Tour Budget tab (ss_tour.budget.grid) -->
							<td class="px-0.5 py-2 border-l-2 border-gray1">
								<input
									class="w-full bg-black/20 rounded-full px-1 h-8 text-sm text-white text-center placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors"
									placeholder="—"
									inputmode="numeric"
									use:fieldSync={numFmt(cap)}
									on:input={(e) => onCapacityInput(d.id, e.currentTarget)}
									on:blur={(e) => (e.currentTarget.value = numFmt(rows[d.id]?.capacity || 0))}
								/>
							</td>

							<!-- Notes (typing enables the section; emptying disables it) -->
							<td class="px-1 py-2 border-l-2 border-gray1">
								<textarea
									rows="1"
									class="w-full bg-black/20 rounded-2xl px-3 py-1.5 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors resize-none min-h-[32px]"
									placeholder="Venue notes"
									use:fieldSync={vi.notes || ''}
									on:input={(e) => onNotesInput(d.id, e.currentTarget)}
								></textarea>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</section>

<!-- ===== custom dropdown (position:fixed, outside the scroll container) ===== -->
{#if menu}
	{@const m = menu}
	<button type="button" class="fixed inset-0 z-[90] cursor-default" aria-label="Close menu" on:click={closeMenu}></button>
	<div
		class="fixed z-[100] bg-[#2A2A2A] rounded-xl shadow-xl overflow-hidden border border-gray1/60 py-1"
		style="left:{m.x}px; top:{m.y}px; width:{m.w}px"
	>
		{#if m.field === 'location'}
			<button type="button" class="w-full text-left px-3 py-2 text-sm cursor-pointer text-gray2 hover:text-white hover:bg-gray1/60 transition-colors" on:click={() => pickLocation(m.id, '')}>Select</button>
			<button type="button" class="w-full text-left px-3 py-2 text-sm cursor-pointer text-white hover:bg-gray1/60 transition-colors" on:click={() => pickLocation(m.id, 'indoor')}>Indoor</button>
			<button type="button" class="w-full text-left px-3 py-2 text-sm cursor-pointer text-white hover:bg-gray1/60 transition-colors" on:click={() => pickLocation(m.id, 'outdoor')}>Outdoor</button>
		{:else if m.field === 'type'}
			<button type="button" class="w-full text-left px-3 py-2 text-sm cursor-pointer text-gray2 hover:text-white hover:bg-gray1/60 transition-colors" on:click={() => pickType(m.id, '')}>Select</button>
			{#each VENUE_TYPES as vt}
				<button type="button" class="w-full text-left px-3 py-2 text-sm cursor-pointer text-white hover:bg-gray1/60 transition-colors" on:click={() => pickType(m.id, vt)}>{vt}</button>
			{/each}
		{:else}
			{@const bf = backlineFieldFor(m.field)}
			{#if bf}
				<div class="px-3 pt-1 pb-1.5 text-[9px] font-black uppercase tracking-widest text-gray2/70">
					{bf.label}
				</div>
				{#each bf.options as opt}
					<button
						type="button"
						class="w-full text-left px-3 py-2 text-sm cursor-pointer hover:bg-gray1/60 transition-colors {(rows[m.id]
							?.production?.[bf.key] || 'None') === opt
							? 'text-lime font-bold'
							: 'text-white'}"
						on:click={() => pickBackline(m.id, bf, opt)}>{opt}</button
					>
				{/each}
			{/if}
		{/if}
	</div>
{/if}

<!-- ===== monitors popup (expands the compact cell; closes on outside click) ===== -->
{#if monitorPop}
	{@const mp = monitorPop}
	<button type="button" class="fixed inset-0 z-[90] cursor-default" aria-label="Close monitors" on:click={closeMonitors}></button>
	<div
		class="fixed z-[100] bg-[#2A2A2A] rounded-2xl shadow-xl overflow-hidden border border-lime/40 p-2"
		style="left:{mp.x}px; top:{mp.y}px; width:{mp.w}px"
	>
		<div class="px-1 pb-1 text-[9px] font-black uppercase tracking-widest text-gray2/70">Monitors</div>
		<textarea
			rows="3"
			class="w-full bg-black/30 rounded-xl px-3 py-2 text-sm text-white placeholder-gray2/40 outline-none border border-transparent focus:border-lime/60 transition-colors resize-none"
			placeholder="e.g. 2x wedges + side fills"
			use:fieldSync={rows[mp.id]?.production?.monitors || ''}
			use:autoFocusArea
			on:input={(e) => onMonitorsInput(mp.id, e.currentTarget)}
			on:keydown={(e) => e.key === 'Escape' && closeMonitors()}
		></textarea>
	</div>
{/if}

<UploadModal
	isOpen={showUploadModal}
	{isUploading}
	title="Upload File"
	acceptedTypes=".pdf,.jpg,.jpeg,.png,.zip"
	fileNameTemplate={pendingSpecsName}
	on:upload={handleUploadEvent}
	on:close={() => (showUploadModal = false)}
/>

{#if showPreviewModal}
	<PreviewModal
		isOpen={showPreviewModal}
		fileName={previewName}
		fileUrl={previewUrl}
		showDeleteButton={false}
		on:close={() => (showPreviewModal = false)}
	/>
{/if}

<style>
	.custom-scrollbar {
		scrollbar-width: thin; /* Firefox */
		scrollbar-color: #444 transparent; /* Firefox */
		overscroll-behavior: contain;
	}
	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #555;
	}
</style>