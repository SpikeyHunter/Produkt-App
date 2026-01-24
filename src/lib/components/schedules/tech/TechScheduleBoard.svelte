<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';
	import type { TechRow } from '$lib/types/tech-schedule';
	import TechRowComponent from './TechRow.svelte';
	import TechContextMenu from './TechContextMenu.svelte';
	import HistorySidePanel from './HistorySidePanel.svelte';
	import dayjs from 'dayjs';
	import customParseFormat from 'dayjs/plugin/customParseFormat';
	import { syncRowToCalendar } from '$lib/services/calendar';

	dayjs.extend(customParseFormat);

	export let year: number;
	export let hidePastMonths: boolean;
	export let userPermissions: {
		role: string;
		canAddYear: boolean;
		canEditAll: boolean;
		allowedColumns: string[];
	} = { role: 'viewer', canAddYear: false, canEditAll: false, allowedColumns: [] };
	export let isDeleteMode = false;
	export let rows: TechRow[] = [];
	export let loading: boolean = false;
	export let saveStatus: 'idle' | 'saving' | 'success' | 'error' = 'idle';

	// --- STATE MANAGEMENT ---
	let isMounted = false;
	let channel: RealtimeChannel | null = null;
	let activeEdit: { rowId: string; field: keyof TechRow } | null = null;
	type PresenceState = Record<
		string,
		{ user: string; color: string; field: string; rowId: string }
	>;
	let remotePresences: PresenceState = {};
	const USER_COLORS = [
		'#ffadad',
		'#ffd6a5',
		'#fdffb6',
		'#caffbf',
		'#9bf6ff',
		'#a0c4ff',
		'#bdb2ff',
		'#ffc6ff'
	];
	// --- UPDATED SAVE QUEUE ---
	// Now stores oldRow snapshot
	let saveQueue: Array<{
		id: string;
		field: string;
		value: any;
		isRestore: boolean;
		oldRow?: TechRow;
	}> = [];
	let isProcessingQueue = false;
	// --- COLUMN CONFIG ---
	const COL_WIDTHS = {
		index: '40px',
		day: '80px',
		date: '70px',
		type: '130px',
		event: '400px',
		hours: '120px',
		call: '120px',
		ld: '90px',
		video: '90px',
		vj: '90px',
		sound: '120px',
		tsm: '140px', 
		dt: '90px',
		liaison: '120px',
		notes: '400px'
	};
	const COL_FIELD_MAP: Record<string, keyof TechRow | '__ROW__' | null> = {
		index: '__ROW__',
		day: null,
		date: 'date',
		type: 'type',
		event: 'event_name',
		hours: 'op_hours',
		call: 'crew_call',
		ld: 'ld',
		video: 'video',
		vj: 'vj',
		sound: 'sound',
		tsm: 'tech_sm',
		dt: 'dt',
		liaison: 'artist_liaison',
		notes: 'notes'
	};
	let columnRanges: { key: string; end: number }[] = [];
	let accum = 0;
	for (const [key, widthStr] of Object.entries(COL_WIDTHS)) {
		accum += parseInt(widthStr);
		columnRanges.push({ key, end: accum });
	}
	const gridStyle = `display: grid;
	grid-template-columns: ${Object.values(COL_WIDTHS).join(' ')}; min-width: max-content;`;

	// --- UI STATE ---
	let contextMenu = {
		show: false,
		x: 0,
		y: 0,
		row: null as TechRow | null,
		field: null as string | null
	};
	
	// [CHANGED] Clipboard now tracks if it's a cell or a row
	let clipboardData: { type: 'row' | 'cell'; data: any; field?: string } | null = null;
	
	let activeDropdownId: string | null = null;
	let historyPanel = {
		open: false,
		rowId: null as string | null,
		rowIndex: 0,
		field: null as string | null,
		date: null as string | null
	};
	let contextMenuHasHistory = false;
	let contextMenuCheckingHistory = false;
	let hoveredRowId: string | null = null;
	let hoveredColumnKey: string | null = null;
	let gridContainer: HTMLDivElement;
	
	// --- LIFECYCLE ---
	onMount(async () => {
		isMounted = true;
		if (year) {
			loading = true;
			await refreshData();
			setupRealtime();
			loading = false;
			await tick();
			restoreScrollPosition();
		}
		document.addEventListener('visibilitychange', handleVisibilityChange);
	});
	
	$: if (rows.length > 0 && isMounted) {
		tick().then(() => {
			if (gridContainer && gridContainer.scrollTop === 0) {
				restoreScrollPosition();
			}
		});
	}

	onDestroy(() => {
		isMounted = false;
		if (typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		}
		if (channel) {
			supabase.removeChannel(channel);
			channel = null;
		}
	});

	function handleVisibilityChange() {
		if (!document.hidden) {
			console.log('[TechBoard] Tab active. Forcing full page reload.');
			window.location.reload();
		}
	}

	const SCROLL_KEY = 'techBoardScrollPosition';
	function handleScroll(e: Event) {
		const target = e.target as HTMLDivElement;
		sessionStorage.setItem(
			SCROLL_KEY,
			JSON.stringify({
				left: target.scrollLeft,
				top: target.scrollTop
			})
		);
	}

	function restoreScrollPosition() {
		if (!gridContainer) return;
		const saved = sessionStorage.getItem(SCROLL_KEY);
		if (saved) {
			try {
				const { left, top } = JSON.parse(saved);
				gridContainer.scrollTo({ left, top, behavior: 'instant' as ScrollBehavior });
			} catch (e) {
				console.warn('Failed to restore scroll position', e);
			}
		} else {
			scrollToToday();
		}
	}

	function scrollToToday() {
		const today = dayjs().format('YYYY-MM-DD');
		const rowEl = gridContainer.querySelector(`[data-row-date="${today}"]`);
		if (rowEl) {
			rowEl.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
		}
	}

	// --- REALTIME ---
	function setupRealtime() {
		if (channel) return;

		const channelName = `tech-schedule-${year}`;
		channel = supabase.channel(channelName, {
			config: {
				presence: { key: userPermissions.role },
				broadcast: { ack: true }
			}
		});
		channel
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'schedule_techs', filter: `year=eq.${year}` },
				(payload) => handleRealtimePayload(payload as RealtimePostgresChangesPayload<TechRow>)
			)
			.on('presence', { event: 'sync' }, () => {
				const state = channel!.presenceState();
				updateRemotePresences(state);
			})
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') {
					channel?.track({ user: 'Me', editing: null });
				}
			});
	}

	async function refreshData() {
		const { data, error } = await supabase
			.from('schedule_techs')
			.select('*')
			.eq('year', year)
			.order('sort_order', { ascending: true });
		if (!error && data && isMounted) {
			const newRows = data;
			if (activeEdit) {
				const editingRowIndex = newRows.findIndex((r) => r.id === activeEdit!.rowId);
				if (editingRowIndex !== -1) {
					const localRow = rows.find((r) => r.id === activeEdit!.rowId);
					if (localRow) {
						(newRows[editingRowIndex] as any)[activeEdit!.field] = (localRow as any)[
							activeEdit!.field
						];
					}
				}
			}
			rows = newRows;
		}
	}

	function updateRemotePresences(state: any) {
		const newPresences: PresenceState = {};
		Object.keys(state).forEach((key) => {
			const presences = state[key];
			presences.forEach((p: any) => {
				if (p.editing) {
					const uniqueKey = `${p.editing.rowId}_${p.editing.field}`;
					const colorIndex = (key.length + uniqueKey.length) % USER_COLORS.length;
					newPresences[uniqueKey] = {
						user: p.user || 'Unknown',
						color: USER_COLORS[colorIndex],
						rowId: p.editing.rowId,
						field: p.editing.field
					};
				}
			});
		});
		remotePresences = newPresences;
	}

	function handleRealtimePayload(payload: RealtimePostgresChangesPayload<TechRow>) {
		if (!isMounted) return;
		let newRows = [...rows];
		if (payload.eventType === 'INSERT') {
			if (!newRows.find((r) => r.id === payload.new.id)) {
				newRows.push(payload.new);
				newRows.sort((a, b) => a.sort_order - b.sort_order);
			}
		} else if (payload.eventType === 'UPDATE') {
			const idx = newRows.findIndex((r) => r.id === payload.new.id);
			if (idx !== -1) {
				const incomingRow = payload.new;
				if (activeEdit && activeEdit.rowId === incomingRow.id) {
					const field = activeEdit.field;
					(incomingRow as any)[field] = newRows[idx][field];
				}
				newRows[idx] = incomingRow;
			}
		} else if (payload.eventType === 'DELETE') {
			newRows = newRows.filter((r) => r.id !== payload.old.id);
		}
		rows = newRows;
	}

	$: filteredRows = rows
		.filter((row) => {
			if (hidePastMonths && year === dayjs().year())
				return dayjs(row.date).month() >= dayjs().month();
			return true;
		})
		.sort((a, b) => {
			if (a.date !== b.date) {
				return a.date < b.date ? -1 : 1;
			}
			return a.sort_order - b.sort_order;
		});

	async function handleCellFocus(e: CustomEvent) {
		const { id, field } = e.detail;
		activeEdit = { rowId: id, field };
		if (channel && channel.state === 'joined') {
			await channel.track({ user: 'User', editing: { rowId: id, field } });
		}
	}

	async function handleCellBlur() {
		setTimeout(async () => {
			if (!isMounted) return;
			activeEdit = null;
			if (channel && channel.state === 'joined') {
				await channel.track({ user: 'User', editing: null });
			}
		}, 200);
	}

	// --- SAVE LOGIC ---
	async function updateCell(id: string, field: string, value: any, isRestore = false) {
		const canEdit = userPermissions.canEditAll || userPermissions.allowedColumns.includes(field);
		if (!canEdit) return;

		const rowIndex = rows.findIndex((r) => r.id === id);
		let oldRowSnapshot: TechRow | undefined;
		if (rowIndex !== -1) {
			oldRowSnapshot = { ...rows[rowIndex] };
			const updatedRow = { ...rows[rowIndex], [field]: value };
			rows = rows.map((r) => (r.id === id ? updatedRow : r));
		}

		saveQueue.push({ id, field, value, isRestore, oldRow: oldRowSnapshot });
		if (!isProcessingQueue) processSaveQueue();
	}

	async function processSaveQueue() {
		if (isProcessingQueue || saveQueue.length === 0 || !isMounted || document.hidden) return;
		isProcessingQueue = true;
		saveStatus = 'saving';
		const task = saveQueue.shift();
		if (!task) {
			isProcessingQueue = false;
			return;
		}

		try {
			const { error } = await supabase
				.from('schedule_techs')
				.update({ [task.field]: task.value })
				.eq('id', task.id);
			if (error) throw error;
			
			// [CHANGED] Fixed History Logging Structure
			// Before: { field: "notes" }, { value: "hi" } -> History panel couldn't match "notes" in old_data
			// Now: { notes: "old value" }, { notes: "hi" } -> History panel finds "notes" key correctly
			if (!task.isRestore && task.oldRow) {
				const oldValue = task.oldRow[task.field as keyof TechRow];
				logHistory(
					task.id, 
					'UPDATE', 
					{ [task.field]: oldValue }, 
					{ [task.field]: task.value }
				);
			}

			// --- GOOGLE CALENDAR SYNC ---
			const CALENDAR_FIELDS = [
				'date',
				'type',
				'event_name',
				'crew_call',
				'ld',
				'video',
				'vj',
				'sound',
				'tech_sm',
				'dt',
				'artist_liaison',
				'notes',
				'op_hours'
			];
			if (CALENDAR_FIELDS.includes(task.field)) {
				const newRow = rows.find((r) => r.id === task.id);
				if (newRow) {
					syncRowToCalendar(newRow, 'UPDATE', task.oldRow);
				}
			}

			// SUCCESS
			if (saveQueue.length > 0) {
				setTimeout(() => {
					isProcessingQueue = false;
					processSaveQueue();
				}, 50);
			} else {
				isProcessingQueue = false;
				saveStatus = 'success';
				setTimeout(() => {
					if (saveQueue.length === 0 && isMounted) saveStatus = 'idle';
				}, 2000);
			}
		} catch (err: any) {
			console.error('Save failed:', err);
			saveQueue.unshift(task);
			saveStatus = 'error';
			isProcessingQueue = false;
			if (!document.hidden) {
				setTimeout(() => {
					if (isMounted) processSaveQueue();
				}, 3000);
			}
		}
	}

	function logHistory(
		rowId: string,
		action: 'UPDATE' | 'DELETE' | 'INSERT',
		oldData: any,
		newData: any
	) {
		supabase.auth.getUser().then(({ data }) => {
			if (data.user) {
				supabase
					.from('schedule_techs_history')
					.insert({
						row_id: rowId,
						action,
						old_data: oldData,
						new_data: newData,
						changed_by: data.user.id
					})
					.then(() => {});
			}
		});
	}

	// [CHANGED] Modified performCopy to handle specific cells vs rows
	function performCopy(row: TechRow, field?: string | null) {
		if (field && field !== '__ROW__' && field !== 'index') {
			// Single Cell Copy
			const value = row[field as keyof TechRow];
			clipboardData = { type: 'cell', data: value, field };
			
			// Optional: Also write to browser clipboard for external paste
			if (navigator.clipboard && value) {
				navigator.clipboard.writeText(String(value));
			}
		} else {
			// Entire Row Copy
			clipboardData = { type: 'row', data: { ...row } };
		}
	}

	// [CHANGED] Modified performPaste to handle specific cells vs rows
	async function performPaste(targetRow: TechRow, targetField?: string | null) {
		if (!userPermissions.canEditAll) return;
		if (!clipboardData) return;

		// CASE 1: Paste into a specific cell
		if (clipboardData.type === 'cell' && targetField && targetField !== '__ROW__') {
			updateCell(targetRow.id, targetField, clipboardData.data);
			return;
		}

		// CASE 2: Paste a whole row
		if (clipboardData.type === 'row') {
			const {
				id: _,
				sort_order: __,
				date: ___,
				year: ____,
				calendar_event_id: _____,
				...dataToPaste
			} = clipboardData.data;

			rows = rows.map((r) => (r.id === targetRow.id ? { ...r, ...dataToPaste } : r));
			const { error } = await supabase
				.from('schedule_techs')
				.update(dataToPaste)
				.eq('id', targetRow.id);

			if (error) {
				console.error('Paste failed:', error);
				saveStatus = 'error';
			} else {
				const updatedRow = rows.find((r) => r.id === targetRow.id);
				if (updatedRow) syncRowToCalendar(updatedRow, 'UPDATE', targetRow);
			}
		}
	}

	// [CHANGED] Modified performCut to handle specific cells vs rows
	async function performCut(targetRow: TechRow, field?: string | null) {
		if (!userPermissions.canEditAll) return;
		
		// Copy first
		performCopy(targetRow, field);

		if (field && field !== '__ROW__') {
			// Cell Cut: Clear the specific cell
			updateCell(targetRow.id, field, '');
		} else {
			// Row Cut: Clear the row contents (keep date/id)
			const uiEmptyData = {
				event_name: '',
				type: '',
				notes: '',
				ld: '',
				video: '',
				vj: '',
				sound: '',
				tech_sm: '',
				dt: '',
				artist_liaison: '',
				op_hours: '',
				crew_call: ''
			};
			const dbEmptyData = { ...uiEmptyData, type: null, calendar_event_id: null };
			rows = rows.map((r) => (r.id === targetRow.id ? { ...r, ...uiEmptyData } : r));
			const { error } = await supabase
				.from('schedule_techs')
				.update(dbEmptyData)
				.eq('id', targetRow.id);

			if (error) {
				console.error('Cut failed:', error);
				saveStatus = 'error';
			} else {
				if (targetRow.calendar_event_id) {
					syncRowToCalendar(targetRow, 'DELETE', targetRow);
				}
			}
		}
	}

	async function handleRowDelete(event: CustomEvent) {
		if (!userPermissions.canEditAll) return;
		const { id } = event.detail;
		const targetRow = rows.find((r) => r.id === id);
		if (!targetRow) return;
		const prevRows = [...rows];
		rows = rows.filter((r) => r.id !== id);

		const { error } = await supabase.from('schedule_techs').delete().eq('id', id);
		if (error) {
			console.error('Delete failed', error);
			rows = prevRows;
			alert('Delete failed');
		} else {
			logHistory(id, 'DELETE', targetRow, null);
			if (targetRow.calendar_event_id) {
				syncRowToCalendar(targetRow, 'DELETE', targetRow);
			}
		}
	}

	async function handleContextMenu(event: CustomEvent) {
		if (userPermissions.role === 'viewer') return;
		const { e, row, field } = event.detail;
		e.preventDefault();
		activeDropdownId = null;
		const x = Math.min(e.clientX, window.innerWidth - 200);
		const y = Math.min(e.clientY, window.innerHeight - 300);
		contextMenu = { show: true, x, y, row, field };
		contextMenuHasHistory = false;
		contextMenuCheckingHistory = true;
		if (field && field !== '__ROW__') checkHistoryAvailability(row.id, field);
		else contextMenuCheckingHistory = false;
		const closeMenu = () => {
			contextMenu.show = false;
			window.removeEventListener('click', closeMenu);
		};
		setTimeout(() => window.addEventListener('click', closeMenu), 10);
	}

	async function checkHistoryAvailability(rowId: string, field: string) {
		// [NOTE] We need to check if old_data contains the field key. 
		// Since we fixed the saving logic, strict checking here should work.
		const { count } = await supabase
			.from('schedule_techs_history')
			.select('id', { count: 'exact', head: true })
			.eq('row_id', rowId);
		
		// Note: The history table structure is JSONB, counting "exact" matches for a specific field in JSON 
		// via simple count(*) query isn't directly supported without complex filters.
		// For UI speed, we just check if ANY history exists for this row, 
		// or allow the panel to open and show "No History" if empty.
		if (isMounted) contextMenuHasHistory = (count || 0) > 0;
		if (isMounted) contextMenuCheckingHistory = false;
	}

	function handleRowMouseMove(e: MouseEvent, rowId: string) {
		hoveredRowId = rowId;
		if (!gridContainer) return;
		const rect = gridContainer.getBoundingClientRect();
		const relativeX = e.clientX - rect.left + gridContainer.scrollLeft;
		const foundCol = columnRanges.find((col) => relativeX <= col.end);
		hoveredColumnKey = foundCol ? foundCol.key : null;
	}

	function getTargetFromFocus() {
		const activeEl = document.activeElement as HTMLElement;
		if (!activeEl || !gridContainer || !gridContainer.contains(activeEl)) return null;
		const rowWrapper = activeEl.closest('[data-row-id]');
		if (!rowWrapper) return null;
		const rowId = rowWrapper.getAttribute('data-row-id');
		if (!rowId) return null;
		const foundCol = columnRanges.find((col) => {
			const rect = activeEl.getBoundingClientRect();
			const containerRect = gridContainer.getBoundingClientRect();
			const centerX = rect.left + rect.width / 2 - containerRect.left + gridContainer.scrollLeft;
			return centerX <= col.end;
		});
		const field = foundCol ? (COL_FIELD_MAP[foundCol.key] as string) : null;
		return { rowId, field };
	}

	async function handleKeydown(e: KeyboardEvent) {
		const activeTag = document.activeElement?.tagName.toUpperCase();
		if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

		if (!(e.metaKey || e.ctrlKey) || userPermissions.role === 'viewer') return;
		let targetRowId: string | null = null;
		let targetField: string | null = null;

		// Check if Row Number Button is explicitly focused
		const focusTarget = getTargetFromFocus();
		if (focusTarget) {
			targetRowId = focusTarget.rowId;
			targetField = focusTarget.field;
		}

		// If not explicitly focused, check Hover state
		if (!targetRowId && hoveredRowId) {
			targetRowId = hoveredRowId;
			// If hovering index column, field is __ROW__, otherwise map the column
			if (hoveredColumnKey === 'index') targetField = '__ROW__';
			else if (hoveredColumnKey) targetField = COL_FIELD_MAP[hoveredColumnKey] as string;
		}

		if (!targetRowId) return;
		const row = rows.find((r) => r.id === targetRowId);
		if (!row) return;

		const key = e.key.toLowerCase();
		// [CHANGED] Pass specific field to keyboard handlers
		if (key === 'c') performCopy(row, targetField);
		if (key === 'x') performCut(row, targetField);
		if (key === 'v') performPaste(row, targetField);
	}

	async function handleMenuAction(event: CustomEvent) {
		const action = event.detail;
		const targetRow = contextMenu.row;
		const targetField = contextMenu.field; // [CHANGED] Capture context field
		contextMenu.show = false;
		if (!targetRow) return;

		// [CHANGED] Pass targetField to action handlers to distinguish Row vs Cell operations
		if (action === 'copy') performCopy(targetRow, targetField);
		if (action === 'cut') performCut(targetRow, targetField);
		if (action === 'paste') performPaste(targetRow, targetField);
		
		if (action === 'delete') {
			handleRowDelete({ detail: { id: targetRow.id } } as any);
		}

		if (action === 'showHistory' && targetField && targetField !== '__ROW__') {
			historyPanel = {
				open: true,
				rowId: targetRow.id,
				rowIndex: filteredRows.findIndex((r) => r.id === targetRow.id),
				field: targetField,
				date: targetRow.date
			};
			return;
		}

		if (action === 'clear') {
			// [CHANGED] If right-clicked on a specific cell, clear ONLY that cell
			if (targetField && targetField !== '__ROW__') {
				updateCell(targetRow.id, targetField, '');
				return;
			}

			// Else, clear whole row (existing logic)
			const uiEmptyData = {
				event_name: '',
				type: '',
				notes: '',
				ld: '',
				video: '',
				vj: '',
				sound: '',
				tech_sm: '',
				dt: '',
				artist_liaison: '',
				op_hours: '',
				crew_call: ''
			};
			const dbEmptyData = { ...uiEmptyData, type: null, calendar_event_id: null };
			rows = rows.map((r) => (r.id === targetRow.id ? { ...r, ...uiEmptyData } : r));
			await supabase.from('schedule_techs').update(dbEmptyData).eq('id', targetRow.id);
			if (targetRow.calendar_event_id) {
				syncRowToCalendar(targetRow, 'DELETE', targetRow);
			}
			return;
		}

		if (['addAbove', 'addBelow', 'duplicate'].includes(action)) {
			const currentIndex = filteredRows.findIndex((r) => r.id === targetRow.id);
			if (currentIndex === -1) return;
			let newSortOrder = 0;
			let newDate = targetRow.date;

			if (action === 'addAbove') {
				const prevRow = filteredRows[currentIndex - 1];
				if (!prevRow || prevRow.date !== targetRow.date) {
					newSortOrder = targetRow.sort_order - 1.0;
				} else {
					newSortOrder = (prevRow.sort_order + targetRow.sort_order) / 2;
				}
			} else if (action === 'addBelow' || action === 'duplicate') {
				const nextRow = filteredRows[currentIndex + 1];
				if (!nextRow || nextRow.date !== targetRow.date) {
					newSortOrder = targetRow.sort_order + 1.0;
				} else {
					newSortOrder = (targetRow.sort_order + nextRow.sort_order) / 2;
				}
			}

			let dataToInsert: any;
			if (action === 'duplicate') {
				const { id: _ignore, calendar_event_id: _ignore2, ...rest } = targetRow;
				dataToInsert = rest;
			} else {
				dataToInsert = { date: newDate, year: year, type: '', event_name: '' };
			}

			const { data: newRow, error } = await supabase
				.from('schedule_techs')
				.insert({ ...dataToInsert, sort_order: newSortOrder })
				.select()
				.single();

			if (error) {
				alert(error.message);
			} else if (newRow) {
				rows = [...rows, newRow];
				logHistory(newRow.id, 'INSERT', null, newRow);
				if (action === 'duplicate' && newRow.type) {
					syncRowToCalendar(newRow, 'INSERT');
				}
			}
		}
	}

	function handleRowDropdownToggle(id: string) {
		if (!userPermissions.canEditAll) return;
		activeDropdownId = activeDropdownId === id ? null : id;
	}

	async function handleRestore(event: CustomEvent) {
		const { rowId, field, value } = event.detail;
		updateCell(rowId, field, value, true);
		historyPanel = { ...historyPanel };
	}
</script>

<svelte:window on:click={() => (activeDropdownId = null)} on:keydown={handleKeydown} />

<div class="flex flex-col h-full bg-gray1 text-gray2 overflow-hidden font-mono text-xs relative">
	<div
		class="flex-1 overflow-auto custom-scrollbar relative"
		bind:this={gridContainer}
		on:scroll={handleScroll}
	>
		<div
			class="bg-navbar border-b border-gray2/20 font-bold text-gray3 sticky top-0 z-20 shadow-lg flex"
			style="min-width: max-content;"
		>
			<div style="{gridStyle}; flex: 1;">
				<div class="p-2 text-center border-r border-gray2/10">#</div>
				<div class="p-2 border-r border-gray2/10 text-center">DAY</div>
				<div class="p-2 border-r-2 border-r-gray2/30 text-center">DATE</div>
				<div class="p-2 border-r border-gray2/10 text-center">TYPE</div>
				<div class="p-2 border-r-2 border-r-gray2/30 text-center">EVENTS</div>
				<div class="p-2 border-r border-gray2/10 text-center">OPS HOURS</div>
				<div class="p-2 border-r-2 border-r-gray2/30 text-center">CREW CALL</div>
				<div class="p-2 border-r border-gray2/10 text-center">LD</div>
				<div class="p-2 border-r border-gray2/10 text-center">VIDEO</div>
				<div class="p-2 border-r border-gray2/10 text-center">VJ</div>
				<div class="p-2 border-r border-gray2/10 text-center">SOUND</div>
				<div class="p-2 border-r border-gray2/10 text-center">TECH</div>
				<div class="p-2 border-r-2 border-r-gray2/30 text-center">DT</div>
				<div class="p-2 border-r-2 border-r-gray2/30 text-center">LIAISON</div>
				<div class="p-2 pl-4 flex justify-between items-center"><span>NOTES</span></div>
			</div>
		</div>

		{#if loading && rows.length === 0}
			<div class="flex items-center justify-center h-full text-lime text-sm min-w-full mt-10">
				Loading Schedule...
			</div>
		{:else}
			{#each filteredRows as row, i (row.id)}
				{#if i === 0 || dayjs(row.date).month() !== dayjs(filteredRows[i - 1].date).month()}
					<div class="sticky left-0 right-0 z-10 min-w-max">
						<div
							class="bg-white/10 border-y border-gray2/20 font-bold py-2 pl-4 text-white uppercase tracking-[0.2em] text-xs shadow-md text-left"
						>
							{dayjs(row.date).format('MMMM YYYY')}
						</div>
					</div>
				{/if}

				<div
					role="group"
					style="display: contents"
					data-row-id={row.id}
					on:mouseenter={() => (hoveredRowId = row.id)}
					on:mousemove={(e) => handleRowMouseMove(e, row.id)}
					on:mouseleave={() => {
						hoveredRowId = null;
						hoveredColumnKey = null;
					}}
				>
					<TechRowComponent
						{row}
						index={i}
						{gridStyle}
						currentYear={year}
						{activeDropdownId}
						{userPermissions}
						{isDeleteMode}
						{remotePresences}
						on:toggleDropdown={(e) => handleRowDropdownToggle(e.detail.id)}
						on:update={(e) => updateCell(e.detail.id, e.detail.field, e.detail.value)}
						on:contextmenu={handleContextMenu}
						on:focus={handleCellFocus}
						on:blur={handleCellBlur}
						on:deleteRow={handleRowDelete}
					/>
				</div>
			{/each}
		{/if}
	</div>
	{#if contextMenu.show}
		<TechContextMenu
			x={contextMenu.x}
			y={contextMenu.y}
			hasHistory={contextMenuHasHistory}
			checkingHistory={contextMenuCheckingHistory}
			on:action={handleMenuAction}
		/>
	{/if}
	<HistorySidePanel
		isOpen={historyPanel.open}
		rowId={historyPanel.rowId}
		rowIndex={historyPanel.rowIndex}
		field={historyPanel.field}
		rowDate={historyPanel.date}
		on:close={() => (historyPanel.open = false)}
		on:restore={handleRestore}
	/>
</div>

<style>
	.custom-scrollbar {
		overflow-x: auto;
		overflow-y: auto;
	}
	.custom-scrollbar::-webkit-scrollbar:vertical {
		display: none;
		width: 0px;
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar:horizontal {
		height: 12px;
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background-color: rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		border: 3px solid transparent;
		background-clip: content-box;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background-color: rgba(255, 255, 255, 0.3);
	}
</style>
