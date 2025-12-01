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

	// --- FIX 1: ROBUST SAVING STATE ---
	let pendingSaves = 0;
	export let saveStatus: 'idle' | 'saving' | 'success' | 'error' = 'idle';
    let saveWatchdog: any;

	$: {
		if (pendingSaves > 0) {
            saveStatus = 'saving';
            // Watchdog: If still saving after 8 seconds, force reset.
            clearTimeout(saveWatchdog);
            saveWatchdog = setTimeout(() => {
                if (pendingSaves > 0) {
                    console.warn('[TechBoard] Save stuck detected. Force resetting.');
                    pendingSaves = 0;
                    saveStatus = 'error';
                }
            }, 8000);
        }
		else if (pendingSaves === 0 && saveStatus === 'saving') {
            saveStatus = 'success';
            clearTimeout(saveWatchdog);
        }
	}

	$: if (saveStatus === 'success') {
		setTimeout(() => {
			if (pendingSaves === 0) saveStatus = 'idle';
		}, 2000);
	}

	let activeEdit: { rowId: string; field: keyof TechRow } | null = null;
	let channel: RealtimeChannel | null = null;

	const COL_WIDTHS = {
		index: '40px', day: '80px', date: '70px', type: '130px', event: '400px',
		hours: '120px', call: '120px', ld: '90px', video: '90px', vj: '90px',
		sound: '120px', tsm: '120px', dt: '90px', liaison: '120px', notes: '400px'
	};

	const COL_FIELD_MAP: Record<string, keyof TechRow | '__ROW__' | null> = {
		index: '__ROW__', day: null, date: 'date', type: 'type', event: 'event_name',
		hours: 'op_hours', call: 'crew_call', ld: 'ld', video: 'video', vj: 'vj',
		sound: 'sound', tsm: 'tech_sm', dt: 'dt', liaison: 'artist_liaison', notes: 'notes'
	};

	let columnRanges: { key: string; end: number }[] = [];
	let accum = 0;
	for (const [key, widthStr] of Object.entries(COL_WIDTHS)) {
		accum += parseInt(widthStr);
		columnRanges.push({ key, end: accum });
	}

	const gridStyle = `display: grid; grid-template-columns: ${Object.values(COL_WIDTHS).join(' ')}; min-width: max-content;`;

	let contextMenu = { show: false, x: 0, y: 0, row: null as TechRow | null, field: null as string | null };
	let clipboardData: { type: 'row' | 'cell'; data: any; field?: string } | null = null;
	let activeDropdownId: string | null = null;
	let historyPanel = { open: false, rowId: null as string | null, rowIndex: 0, field: null as string | null, date: null as string | null };
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
		
        // --- FIX 2: NO FILTER ---
        // We listen to ALL events on the table. This fixes the "Delete" bug 
        // because we will now receive delete events even if Postgres strips the year column.
		channel = supabase
			.channel(channelName)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'schedule_techs' }, 
				(payload) => handleRealtimeUpdate(payload as RealtimePostgresChangesPayload<TechRow>)
			)
			.subscribe((status) => {
				if (status === 'CHANNEL_ERROR') {
					setTimeout(() => setupRealtime(), 5000);
				}
			});
	}

	function handleRealtimeUpdate(payload: RealtimePostgresChangesPayload<TechRow>) {
        // Since we removed the filter, we might get events for 2024 or 2026.
        // We must check if the row is relevant to us inside this function.

		if (payload.eventType === 'INSERT') {
            // Only add if it belongs to THIS year
            if (payload.new.year !== year) return;

			if (!rows.find((r) => r.id === payload.new.id)) {
				rows = [...rows, payload.new];
			}
		} 
        else if (payload.eventType === 'UPDATE') {
            // Only update if we actually have this row in our list
            // (This inherently filters out other years)
            const exists = rows.find(r => r.id === payload.new.id);
            if (!exists) return; 

			rows = rows.map((r) => {
				if (r.id !== payload.new.id) return r;
				const incoming = payload.new;

				// Smart Merge: Protect active edits
				if (activeEdit && activeEdit.rowId === r.id && activeEdit.field) {
					const fieldBeingEdited = activeEdit.field;
					return { 
						...incoming, 
						[fieldBeingEdited]: r[fieldBeingEdited] 
					};
				}
				return incoming;
			});
		} 
        else if (payload.eventType === 'DELETE') {
            // Safe to run on all deletes. If ID isn't in our array, nothing happens.
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
		const updatedRow = { ...oldRow, [field]: value };
		
		// Optimistic Update
		rows = rows.map((r) => (r.id === id ? updatedRow : r));

		pendingSaves++;

        // --- FIX 3: TRY/FINALLY BLOCKS ---
        // Ensures pendingSaves ALWAYS goes down, even if Supabase errors out.
        try {
            const updatePayload: Record<string, any> = {};
            updatePayload[field] = value;

            const { error } = await supabase.from('schedule_techs').update(updatePayload).eq('id', id);

            if (error) {
                throw error;
            } else {
                if (!isRestore) {
                    // Don't await history, but catch its errors
                    logHistory(id, 'UPDATE', { [field]: oldRow[field as keyof TechRow] }, { [field]: value })
                        .catch(err => console.error('[History] Failed to log:', err));
                }
            }
        } catch (error: any) {
            console.error('[TechBoard] Update failed:', error);
            rows = rows.map((r) => (r.id === id ? oldRow : r)); // Revert
            saveStatus = 'error';
            alert('Failed to save: ' + error.message);
        } finally {
            pendingSaves--;
        }
	}

    // --- FIX 4: ROBUST HISTORY LOGGING ---
	async function logHistory(rowId: string, action: 'UPDATE' | 'DELETE' | 'INSERT', oldData: any, newData: any) {
		const { data: { user }, error: authError } = await supabase.auth.getUser();
		
        if (authError || !user) {
            console.error('[History] Cannot log history: User not authenticated', authError);
            return;
        }

		const { error } = await supabase.from('schedule_techs_history').insert({
			row_id: rowId,
			action,
			old_data: oldData,
			new_data: newData,
			changed_by: user.id
		});

        if (error) {
             console.error('[History] DB Insert failed:', error);
        }
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
		setTimeout(() => { activeEdit = null; }, 50);
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
        try {
		    const { error } = await supabase.from('schedule_techs').delete().eq('id', id);
            if (error) throw error;
            
            await logHistory(id, 'DELETE', targetRow, null);
        } catch (error: any) {
			console.error('[TechBoard] Delete failed:', error);
			rows = previousRows;
			saveStatus = 'error';
			alert('Failed to delete row: ' + error.message);
        } finally {
		    pendingSaves--;
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
		if (activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA' && activeEl.tagName !== 'SELECT') return null;
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

		let targetRowId = null, targetField = null;
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
					event_name: '', type: '', notes: '', ld: '', video: '', vj: '',
					sound: '', tech_sm: '', dt: '', artist_liaison: '', op_hours: '', crew_call: ''
				};
				const dbEmptyData = { ...uiEmptyData, type: null };
				rows = rows.map((r) => (r.id === row.id ? { ...r, ...uiEmptyData } : r));

				pendingSaves++;
                try {
				    const { error } = await supabase.from('schedule_techs').update(dbEmptyData).eq('id', row.id);
                    if (error) throw error;
                } catch (e: any) {
					console.error('[TechBoard] Cut/Clear failed:', e);
					saveStatus = 'error';
					alert(e.message);
                } finally {
				    pendingSaves--;
                }
			}
		}

		// Paste Row
		if (key === 'v' && clipboardData && clipboardData.type === 'row' && userPermissions.canEditAll) {
			const { id: _, sort_order: __, date: ___, year: ____, ...dataToPaste } = clipboardData.data;
			rows = rows.map((r) => (r.id === row.id ? { ...r, ...dataToPaste } : r));

			pendingSaves++;
            try {
			    const { error } = await supabase.from('schedule_techs').update(dataToPaste).eq('id', row.id);
                if (error) throw error;
            } catch (e: any) {
				console.error('[TechBoard] Paste failed:', e);
				saveStatus = 'error';
				alert(e.message);
            } finally {
			    pendingSaves--;
            }
		}
	}

	async function handleMenuAction(event: CustomEvent) {
		const action = event.detail;
		const targetRow = contextMenu.row;
		const targetField = contextMenu.field;
		
		contextMenu.show = false; 
		if (!targetRow) return;

		// 1. Show History
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

		// 2. Clear Contents
		if (action === 'clear') {
			const uiEmptyData = {
				event_name: '', type: '', notes: '', ld: '', video: '', vj: '',
				sound: '', tech_sm: '', dt: '', artist_liaison: '', op_hours: '', crew_call: ''
			};
			const dbEmptyData = { ...uiEmptyData, type: null };
			rows = rows.map((r) => (r.id === targetRow.id ? { ...r, ...uiEmptyData } : r));

			pendingSaves++;
            try {
			    const { error } = await supabase.from('schedule_techs').update(dbEmptyData).eq('id', targetRow.id);
                if (error) throw error;
            } catch (e: any) {
				console.error('Clear failed:', e);
				saveStatus = 'error'; 
				alert('Failed to clear: ' + e.message);
            } finally {
			    pendingSaves--;
            }
			return;
		}

		// 3. Delete Row
		if (action === 'delete') {
			const previousRows = [...rows];
			rows = rows.filter((r) => r.id !== targetRow.id);

			pendingSaves++;
            try {
			    const { error } = await supabase.from('schedule_techs').delete().eq('id', targetRow.id);
                if (error) throw error;
				logHistory(targetRow.id, 'DELETE', targetRow, null);
            } catch (e: any) {
				console.error('Delete failed:', e);
				rows = previousRows;
				saveStatus = 'error';
				alert('Failed to delete: ' + e.message);
            } finally {
			    pendingSaves--;
            }
			return;
		}

		// 4. Insert / Duplicate
		if (['addAbove', 'addBelow', 'duplicate'].includes(action)) {
			const currentIndex = filteredRows.findIndex(r => r.id === targetRow.id);
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
			} 
			else if (action === 'addBelow' || action === 'duplicate') {
				const nextRow = filteredRows[currentIndex + 1];
				if (!nextRow || nextRow.date !== targetRow.date) {
					newSortOrder = targetRow.sort_order + 1.0;
				} else {
					newSortOrder = (targetRow.sort_order + nextRow.sort_order) / 2;
				}
			}
			
			let dataToInsert: any; 
			if (action === 'duplicate') {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { id: _ignore, ...rest } = targetRow;
				dataToInsert = rest;
			} else {
				dataToInsert = { date: newDate, year: year, type: '', event_name: '' };
			}
			
			pendingSaves++;
            try {
			    const { data: newRow, error } = await supabase
				    .from('schedule_techs')
				    .insert({ ...dataToInsert, sort_order: newSortOrder })
				    .select()
				    .single();

                if (error) throw error;
                if (newRow) {
                    // Important: Optimistic add. If realtime is fast, we might get duplicate
                    // but our realtime handler handles duplicates safely.
				    rows = [...rows, newRow];
				    logHistory(newRow.id, 'INSERT', null, newRow);
                }
            } catch (e: any) {
				console.error('Insert failed:', e);
				saveStatus = 'error';
				alert(e.message);
            } finally {
			    pendingSaves--;
            }
		}
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