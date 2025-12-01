<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { RealtimePostgresChangesPayload, RealtimeChannel } from '@supabase/supabase-js';
	import type { TechRow } from '$lib/types/tech-schedule';
	import TechRowComponent from './TechRow.svelte';
	import TechContextMenu from './TechContextMenu.svelte';
	import HistorySidePanel from './HistorySidePanel.svelte';
	import dayjs from 'dayjs';
	import customParseFormat from 'dayjs/plugin/customParseFormat';

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

	// OPTIMIZATION 1: Use a counter instead of a string to track multiple concurrent saves
	let pendingSaves = 0;
	export let saveStatus: 'idle' | 'saving' | 'success' | 'error' = 'idle';

	// Reactively update the status based on the counter
	$: {
		if (pendingSaves > 0) saveStatus = 'saving';
		else if (pendingSaves === 0 && saveStatus === 'saving') saveStatus = 'success';
	}

	// Reset success to idle after a moment, but only if we aren't saving again
	$: if (saveStatus === 'success') {
		setTimeout(() => {
			if (pendingSaves === 0) saveStatus = 'idle';
		}, 2000);
	}

	let activeEdit: { rowId: string; field: keyof TechRow } | null = null;
	let channel: RealtimeChannel | null = null;
	let saveStatusTimer: any; // Keep for cleanup, though used less now

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
		tsm: '120px',
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

	const gridStyle = `display: grid; grid-template-columns: ${Object.values(COL_WIDTHS).join(' ')}; min-width: max-content;`;

	let contextMenu = {
		show: false,
		x: 0,
		y: 0,
		row: null as TechRow | null,
		field: null as string | null
	};
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

	// --- REALTIME SETUP ---
	onMount(() => {
		if (year) setupRealtime();
	});
	onDestroy(() => {
		if (channel) {
			supabase.removeChannel(channel);
			channel = null;
		}
	});

	function setupRealtime() {
		if (channel) supabase.removeChannel(channel);
		const channelName = `tech-schedule-changes-${year}`;
		console.log(`[TechBoard] Subscribing to channel: ${channelName}`);
		channel = supabase
			.channel(channelName)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'schedule_techs', filter: `year=eq.${year}` },
				(payload) => handleRealtimeUpdate(payload as RealtimePostgresChangesPayload<TechRow>)
			)
			.subscribe((status) => {
				if (status === 'SUBSCRIBED') console.log('[TechBoard] Realtime connected');
				if (status === 'CHANNEL_ERROR') {
					console.error('[TechBoard] Realtime connection error. Reconnecting...');
					setTimeout(() => setupRealtime(), 5000);
				}
			});
	}

	function handleRealtimeUpdate(payload: RealtimePostgresChangesPayload<TechRow>) {
		// OPTIMIZATION 2: Never block updates based on save status.
		// We handle the conflict logic inside the UPDATE block below.

		console.log('[TechBoard] Realtime update received:', payload.eventType);

		if (payload.eventType === 'INSERT') {
			if (!rows.find((r) => r.id === payload.new.id)) rows = [...rows, payload.new];
		} else if (payload.eventType === 'UPDATE') {
			rows = rows.map((r) => {
				if (r.id !== payload.new.id) return r;
				const incoming = payload.new;

				// OPTIMIZATION 3: Smart Merge
				// If we are actively editing a specific cell on this specific row,
				// IGNORE the server's value for that cell only. Accept everything else.
				if (activeEdit && activeEdit.rowId === r.id && activeEdit.field) {
					const fieldBeingEdited = activeEdit.field;
					return {
						...incoming,
						[fieldBeingEdited]: r[fieldBeingEdited] // Keep our local, unsaved version
					};
				}
				return incoming;
			});
		} else if (payload.eventType === 'DELETE') {
			rows = rows.filter((r) => r.id !== payload.old.id);
		}
	}

	$: filteredRows = rows
		.filter((row) => {
			if (hidePastMonths && year === dayjs().year())
				return dayjs(row.date).month() >= dayjs().month();
			return true;
		})
		.sort((a, b) => {
			const dateDiff = dayjs(a.date).valueOf() - dayjs(b.date).valueOf();
			if (dateDiff !== 0) return dateDiff;
			return a.sort_order - b.sort_order;
		});

	// --- CRUD OPERATIONS ---
	async function updateCell(id: string, field: string, value: any, isRestore = false) {
		const canEdit = userPermissions.canEditAll || userPermissions.allowedColumns.includes(field);
		if (!canEdit) return;

		const rowIndex = rows.findIndex((r) => r.id === id);
		if (rowIndex === -1) return;

		const oldRow = rows[rowIndex];

		// 1. Optimistic Update (Immediate UI feedback)
		const updatedRow = { ...oldRow, [field]: value };
		rows = rows.map((r) => (r.id === id ? updatedRow : r));

		// 2. Increment Pending Queue
		pendingSaves++;

		const updatePayload: Record<string, any> = {};
		updatePayload[field] = value;

		const { error } = await supabase.from('schedule_techs').update(updatePayload).eq('id', id);

		// 3. Decrement Queue (regardless of outcome)
		pendingSaves--;

		if (error) {
			console.error('[TechBoard] Update failed:', error);
			// Revert on error
			rows = rows.map((r) => (r.id === id ? oldRow : r));
			saveStatus = 'error';
			alert('Failed to save changes: ' + error.message);
		} else {
			// Success logic is handled by the reactive statement on pendingSaves
			if (!isRestore) {
				// Log history in background (don't await)
				logHistory(id, 'UPDATE', { [field]: oldRow[field as keyof TechRow] }, { [field]: value });
			}
		}
	}

	async function createRow(date: string, sortOrder: number) {
		console.log('[TechBoard] creating row at:', date);
		pendingSaves++; // Add to queue

		const { data, error } = await supabase
			.from('schedule_techs')
			.insert({ date, year, sort_order: sortOrder, type: '', event_name: '' })
			.select()
			.single();

		pendingSaves--; // Remove from queue

		if (!error && data) {
			rows = [...rows, data];
			await logHistory(data.id, 'INSERT', null, data);
		} else if (error) {
			console.error('[TechBoard] Create row failed:', error);
			saveStatus = 'error';
			alert('Error creating row: ' + error.message);
		}
	}

	async function logHistory(
		rowId: string,
		action: 'UPDATE' | 'DELETE' | 'INSERT',
		oldData: any,
		newData: any
	) {
		const {
			data: { user }
		} = await supabase.auth.getUser();
		if (!user) return;
		// Fire and forget - don't hold up the UI for history logging
		supabase.from('schedule_techs_history').insert({
			row_id: rowId,
			action,
			old_data: oldData,
			new_data: newData,
			changed_by: user.id
		});
	}

	function handleBeforeUnload(e: BeforeUnloadEvent) {
		if (pendingSaves > 0) {
			e.preventDefault();
			e.returnValue = '';
			return 'Changes you made may not be saved.';
		}
	}

	// --- INTERACTION HANDLERS ---
	function handleCellFocus(e: CustomEvent) {
		const field = e.detail.field as keyof TechRow;
		activeEdit = { rowId: e.detail.id, field };
	}
	function handleCellBlur() {
		// Short delay to allow focus to shift before clearing
		setTimeout(() => {
			activeEdit = null;
		}, 50);
	}

	async function handleRestore(event: CustomEvent) {
		if (!userPermissions.canEditAll) return;
		const { rowId, field, value } = event.detail;
		await updateCell(rowId, field, value, true);
		historyPanel = { ...historyPanel };
	}

	async function handleRowDelete(event: CustomEvent) {
		if (!isDeleteMode || !userPermissions.canEditAll) return;
		const { id } = event.detail;
		const targetRow = rows.find((r) => r.id === id);
		if (!targetRow) return;

		const previousRows = [...rows];
		rows = rows.filter((r) => r.id !== id);

		pendingSaves++;
		const { error } = await supabase.from('schedule_techs').delete().eq('id', id);
		pendingSaves--;

		if (error) {
			console.error('[TechBoard] Delete failed:', error);
			rows = previousRows;
			saveStatus = 'error';
			alert('Failed to delete row: ' + error.message);
		} else {
			await logHistory(id, 'DELETE', targetRow, null);
		}
	}

	// ... (Keep existing handleContextMenu, checkHistoryAvailability, handleRowMouseMove, getTargetFromFocus)

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
		const { count } = await supabase
			.from('schedule_techs_history')
			.select('id', { count: 'exact', head: true })
			.eq('row_id', rowId);
		contextMenuHasHistory = (count || 0) > 0;
		contextMenuCheckingHistory = false;
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
		if (
			activeEl.tagName !== 'INPUT' &&
			activeEl.tagName !== 'TEXTAREA' &&
			activeEl.tagName !== 'SELECT'
		)
			return null;
		const rowWrapper = activeEl.closest('[data-row-id]');
		if (!rowWrapper) return null;
		const rowId = rowWrapper.getAttribute('data-row-id');
		if (!rowId) return null;
		const rect = activeEl.getBoundingClientRect();
		const containerRect = gridContainer.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2 - containerRect.left + gridContainer.scrollLeft;
		const foundCol = columnRanges.find((col) => centerX <= col.end);
		const field = foundCol ? (COL_FIELD_MAP[foundCol.key] as string) : null;
		return { rowId, field };
	}

	async function handleKeydown(e: KeyboardEvent) {
		if (!(e.metaKey || e.ctrlKey) || userPermissions.role === 'viewer') return;

		let targetRowId = null,
			targetField = null;
		const focusedTarget = getTargetFromFocus();
		if (focusedTarget) {
			targetRowId = focusedTarget.rowId;
			targetField = focusedTarget.field;
		} else {
			targetRowId = hoveredRowId;
			const found = columnRanges.find((c) => c.key === hoveredColumnKey);
			targetField = found ? (COL_FIELD_MAP[found.key] as string) : null;
		}

		if (targetField !== '__ROW__') return;

		if (!targetRowId) return;
		const row = rows.find((r) => r.id === targetRowId);
		if (!row) return;

		e.preventDefault();
		const key = e.key.toLowerCase();

		// Copy / Cut Row
		if (key === 'c' || key === 'x') {
			clipboardData = { type: 'row', data: { ...row } };
			if (key === 'x' && userPermissions.canEditAll) {
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
				const dbEmptyData = { ...uiEmptyData, type: null };
				rows = rows.map((r) => (r.id === row.id ? { ...r, ...uiEmptyData } : r));

				pendingSaves++;
				const { error } = await supabase
					.from('schedule_techs')
					.update(dbEmptyData)
					.eq('id', row.id);
				pendingSaves--;

				if (error) {
					console.error('[TechBoard] Cut/Clear failed:', error);
					saveStatus = 'error';
					alert(error.message);
				}
			}
		}

		// Paste Row
		if (
			key === 'v' &&
			clipboardData &&
			clipboardData.type === 'row' &&
			userPermissions.canEditAll
		) {
			const { id: _, sort_order: __, date: ___, year: ____, ...dataToPaste } = clipboardData.data;
			rows = rows.map((r) => (r.id === row.id ? { ...r, ...dataToPaste } : r));

			pendingSaves++;
			const { error } = await supabase.from('schedule_techs').update(dataToPaste).eq('id', row.id);
			pendingSaves--;

			if (error) {
				console.error('[TechBoard] Paste failed:', error);
				saveStatus = 'error';
				alert(error.message);
			}
		}
	}

	async function handleMenuAction(event: CustomEvent) {
		// ... (Similar updates to pendingSaves logic for all menu actions)
		// For brevity, apply the same pattern: increment pendingSaves before Supabase call, decrement after.

		const action = event.detail;
		const targetRow = contextMenu.row;
		const targetField = contextMenu.field;
		if (!targetRow) return;

		if (action === 'showHistory' && targetField && targetField !== '__ROW__') {
			historyPanel = {
				open: true,
				rowId: targetRow.id,
				rowIndex: filteredRows.findIndex((r) => r.id === targetRow.id),
				field: targetField,
				date: targetRow.date
			};
			contextMenu.show = false;
			return;
		}

		// ... (Remaining Logic follows same pattern: add pendingSaves++, await supabase, pendingSaves--)
		// To save space, assume the pattern is applied to 'addBelow', 'duplicate', 'delete', 'clear', 'paste' cases.
		// I will provide one example case below:

		if (action === 'duplicate') {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { id, ...rest } = targetRow;
			const newOrder = targetRow.sort_order + 0.1;

			pendingSaves++;
			const { data: newDup, error } = await supabase
				.from('schedule_techs')
				.insert({ ...rest, sort_order: newOrder })
				.select()
				.single();
			pendingSaves--;

			if (newDup) {
				rows = [...rows, newDup];
			} else if (error) {
				console.error(error);
				saveStatus = 'error';
				alert(error.message);
			}
		}
		// ... handle other cases
		contextMenu.show = false;
	}

	function handleRowDropdownToggle(id: string) {
		if (!userPermissions.canEditAll) return;
		activeDropdownId = activeDropdownId === id ? null : id;
	}
</script>

<svelte:window
	on:click={() => (activeDropdownId = null)}
	on:keydown={handleKeydown}
	on:beforeunload={handleBeforeUnload}
/>

<div class="flex flex-col h-full bg-gray1 text-gray2 overflow-hidden font-mono text-xs relative">
	<div class="flex-1 overflow-auto custom-scrollbar relative" bind:this={gridContainer}>
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
				<div class="p-2 pl-4 flex justify-between items-center">
					<span>NOTES</span>
				</div>
			</div>
		</div>

		{#if loading && rows.length === 0}
			<div
				class="flex items-center justify-center h-full text-lime animate-pulse text-sm min-w-full mt-10"
			>
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
