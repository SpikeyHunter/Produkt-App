<script lang="ts">
  import { onDestroy } from 'svelte';
  import { supabase } from '$lib/supabase';
  import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
  import type { TechRow } from '$lib/types/tech-schedule'; // Ensure this path is correct
  import TechRowComponent from './TechRow.svelte';
  import TechContextMenu from './TechContextMenu.svelte';
  import HistorySidePanel from './HistorySidePanel.svelte';
  import dayjs from 'dayjs';
  import customParseFormat from 'dayjs/plugin/customParseFormat';

  dayjs.extend(customParseFormat);
  
  export let year: number;
  export let hidePastMonths: boolean;
  
  // Received from +page.svelte
  export let userPermissions: {
      role: string;
      canAddYear: boolean;
      canEditAll: boolean;
      allowedColumns: string[];
  } = { role: 'viewer', canAddYear: false, canEditAll: false, allowedColumns: [] };
  
  // Data Props (Passed from Parent)
  export let rows: TechRow[] = [];
  export let loading: boolean = false;

  // FIX 1: Strictly type the 'field' so TypeScript knows it belongs to TechRow
  let activeEdit: { rowId: string; field: keyof TechRow } | null = null;

  const COL_WIDTHS = {
    index: '40px',
    day: '80px',
    date: '70px',
    type: '130px',
    event: '400px',
    hours: '110px',
    call: '110px',
    ld: '90px',
    video: '90px',
    vj: '90px',
    sound: '110px',
    tsm: '110px',
    dt: '90px',
    liaison: '100px',
    notes: '400px'
  };

  // Helper to map columns to strict TechRow keys
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
  let contextMenu = { show: false, x: 0, y: 0, row: null as TechRow | null, field: null as string | null };
  let clipboardData: { type: 'row' | 'cell', data: any, field?: string } | null = null;
  let channel: any;
  let activeDropdownId: string | null = null;
  
  // History State
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
  
  $: if (year) {
    setupRealtime();
  }

  $: filteredRows = rows
    .filter(row => {
        if (hidePastMonths && year === dayjs().year()) {
            return dayjs(row.date).month() >= dayjs().month(); 
        }
        return true;
    })
    .sort((a, b) => {
        const dateDiff = dayjs(a.date).valueOf() - dayjs(b.date).valueOf();
        if (dateDiff !== 0) return dateDiff;
        return a.sort_order - b.sort_order;
    });

  function setupRealtime() {
    if (channel) supabase.removeChannel(channel);
    channel = supabase
      .channel('tech-schedule-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_techs', filter: `year=eq.${year}` }, 
      (payload) => handleRealtimeUpdate(payload as RealtimePostgresChangesPayload<TechRow>))
      .subscribe();
  }

  function handleRealtimeUpdate(payload: RealtimePostgresChangesPayload<TechRow>) {
    if (payload.eventType === 'INSERT') {
      if (!rows.find(r => r.id === payload.new.id)) {
        rows = [...rows, payload.new];
      }
    } else if (payload.eventType === 'UPDATE') {
      rows = rows.map(r => {
          if (r.id !== payload.new.id) return r;

          const incoming = payload.new;
          
          // FIX 2: This block caused the error. Now activeEdit.field is strictly typed.
          if (activeEdit && activeEdit.rowId === r.id && activeEdit.field) {
              // We create a new object merging incoming data, but protecting the active field
              return {
                  ...incoming,
                  [activeEdit.field]: r[activeEdit.field] 
              };
          }
          return incoming;
      });
    } else if (payload.eventType === 'DELETE') {
      rows = rows.filter(r => r.id !== payload.old.id);
    }
  }

  async function logHistory(rowId: string, action: 'UPDATE' | 'DELETE' | 'INSERT', oldData: any, newData: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; 

    const payload = {
        row_id: rowId,
        action,
        old_data: oldData,
        new_data: newData,
        changed_by: user.id
    };
    const { error } = await supabase.from('schedule_techs_history').insert(payload);
    if (error) console.error("Failed to log history", error);
  }

  async function updateCell(id: string, field: string, value: any, isRestore = false) {
    const canEdit = userPermissions.canEditAll || userPermissions.allowedColumns.includes(field);
    if (!canEdit) return;

    const rowIndex = rows.findIndex(r => r.id === id);
    if (rowIndex === -1) return;
    const oldRow = rows[rowIndex];
    
    // Cast field to keyof TechRow to allow access
    const safeField = field as keyof TechRow;
    const oldValue = oldRow[safeField];

    // Optimistic Update
    const updatedRow = { ...oldRow, [field]: value };
    rows = rows.map(r => r.id === id ? updatedRow : r);

    // FIX 3: Construct safe update object for Supabase
    const updatePayload: Record<string, any> = {};
    updatePayload[field] = value;

    const { error } = await supabase.from('schedule_techs').update(updatePayload).eq('id', id);
    
    if (error) {
        console.error('Update failed', error);
        alert('Failed to save changes: ' + error.message);
        rows = rows.map(r => r.id === id ? oldRow : r); // Revert on error
    } else if (!isRestore) {
        await logHistory(id, 'UPDATE', { [field]: oldValue }, { [field]: value });
    }
  }

  // FIX 4: Cast the string from the event to a valid TechRow key
  function handleCellFocus(e: CustomEvent) {
      const field = e.detail.field as keyof TechRow;
      activeEdit = { rowId: e.detail.id, field };
  }

  function handleCellBlur() {
      setTimeout(() => {
          activeEdit = null;
      }, 200);
  }

  // ... [Keep handleRestore, handleContextMenu, checkHistoryAvailability, handleRowMouseMove as they were] ...

  async function handleRestore(event: CustomEvent) {
      if (!userPermissions.canEditAll) return;
      const { rowId, field, value } = event.detail;
      const { data: { user } } = await supabase.auth.getUser();
      const rowIndex = rows.findIndex(r => r.id === rowId);
      if (rowIndex === -1) return;
      const oldRow = rows[rowIndex];
      const oldValue = oldRow[field as keyof TechRow];

      await updateCell(rowId, field, value, true);
      if (user) {
          await supabase.from('schedule_techs_history').insert({
              row_id: rowId,
              action: 'RESTORE',
              old_data: { [field]: oldValue }, 
              new_data: { [field]: value },    
              changed_by: user.id
          });
      }
      historyPanel = { ...historyPanel };
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

    if (field && field !== '__ROW__') {
        checkHistoryAvailability(row.id, field);
    } else {
        contextMenuCheckingHistory = false;
        contextMenuHasHistory = false;
    }
    
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
      const relativeX = (e.clientX - rect.left) + gridContainer.scrollLeft;
      const foundCol = columnRanges.find(col => relativeX <= col.end);
      hoveredColumnKey = foundCol ? foundCol.key : null;
  }

  // FIX 5: Safer focus targeting
  function getTargetFromFocus(): { rowId: string, field: string | null } | null {
      const activeEl = document.activeElement as HTMLElement;
      if (!activeEl || !gridContainer || !gridContainer.contains(activeEl)) return null;

      const tagName = activeEl.tagName;
      if (tagName !== 'INPUT' && tagName !== 'TEXTAREA' && tagName !== 'SELECT') return null;

      const rowWrapper = activeEl.closest('[data-row-id]');
      if (!rowWrapper) return null;
      const rowId = rowWrapper.getAttribute('data-row-id');
      if (!rowId) return null;

      const rect = activeEl.getBoundingClientRect();
      const containerRect = gridContainer.getBoundingClientRect();
      const centerX = (rect.left + rect.width / 2) - containerRect.left + gridContainer.scrollLeft;
      
      const foundCol = columnRanges.find(col => centerX <= col.end);
      const field = foundCol ? (COL_FIELD_MAP[foundCol.key] as string) : null;

      return { rowId, field };
  }

  async function handleKeydown(e: KeyboardEvent) {
    const isCmdOrCtrl = e.metaKey || e.ctrlKey;
    if (!isCmdOrCtrl) return;
    if (userPermissions.role === 'viewer') return;

    let targetRowId: string | null = null;
    let targetField: string | null = null;
    const focusedTarget = getTargetFromFocus();
    if (focusedTarget) {
        targetRowId = focusedTarget.rowId;
        targetField = focusedTarget.field;
    } else {
        targetRowId = hoveredRowId;
        // Fix column key mapping
        const found = columnRanges.find(c => c.key === hoveredColumnKey);
        targetField = found ? (COL_FIELD_MAP[found.key] as string) : null;
    }

    if (!targetRowId) return;
    const row = rows.find(r => r.id === targetRowId);
    if (!row) return;

    const canEditField = (field: string | null) => {
        if (!field) return false;
        if (field === '__ROW__' && !userPermissions.canEditAll) return false; 
        return userPermissions.canEditAll || userPermissions.allowedColumns.includes(field);
    };

    const key = e.key.toLowerCase();
    
    // Helper to safely access row data with string key
    const getRowValue = (r: TechRow, f: string) => (r as any)[f];

    // COPY (Cmd+C)
    if (key === 'c' || key === 'x') {
        e.preventDefault();
        if (targetField === '__ROW__') {
            clipboardData = { type: 'row', data: { ...row } };
        } else if (targetField && targetField !== 'date') { 
            clipboardData = { type: 'cell', data: getRowValue(row, targetField), field: targetField };
        }

        // CUT (Cmd+X)
        if (key === 'x') {
             if (!canEditField(targetField)) return;
             if (targetField === '__ROW__') {
                 const emptyData = { 
                    event_name: '', type: '', notes: '', ld: '', video: '', vj: '', 
                    sound: '', tech_sm: '', dt: '', artist_liaison: '', op_hours: '', crew_call: '' 
                 };
                 rows = rows.map(r => r.id === row.id ? { ...r, ...emptyData } : r);
                 await supabase.from('schedule_techs').update(emptyData).eq('id', row.id);
             } else if (targetField && targetField !== 'date') {
                 updateCell(row.id, targetField, '');
             }
        }
    }

    // PASTE (Cmd+V)
    if (key === 'v' && clipboardData) {
        e.preventDefault();
        if (targetField === '__ROW__' && clipboardData.type === 'row') {
            if (!userPermissions.canEditAll) return;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _, sort_order: __, date: ___, year: ____, ...dataToPaste } = clipboardData.data;
            rows = rows.map(r => r.id === row.id ? { ...r, ...dataToPaste } : r);
            await supabase.from('schedule_techs').update(dataToPaste).eq('id', row.id);
        } else if (targetField && clipboardData.type === 'cell') {
            if (!canEditField(targetField)) return;
            const valToPaste = clipboardData.data;
            updateCell(row.id, targetField, valToPaste);
        }
    }
  }

  async function handleMenuAction(event: CustomEvent) {
    const action = event.detail;
    const targetRow = contextMenu.row;
    const targetField = contextMenu.field;
    
    if (!targetRow) return;

    const isFullEditor = userPermissions.canEditAll;
    const idx = filteredRows.findIndex(r => r.id === targetRow.id);

    if (action === 'showHistory') {
        if (!targetField || targetField === '__ROW__') return;
        historyPanel = { 
            open: true, 
            rowId: targetRow.id,
            rowIndex: idx,
            field: targetField,
            date: targetRow.date
        };
        contextMenu.show = false;
        return;
    }

    const prevOrder = idx > 0 ? filteredRows[idx - 1].sort_order : targetRow.sort_order - 1;

    if (['addBelow', 'addAbove', 'duplicate', 'delete', 'clear', 'cut', 'paste'].includes(action)) {
        if ((action === 'clear' || action === 'cut' || action === 'paste') && targetField !== '__ROW__') {
            if (!userPermissions.canEditAll && !userPermissions.allowedColumns.includes(targetField || '')) {
                contextMenu.show = false;
                return;
            }
        } else {
             if (!isFullEditor) {
                 contextMenu.show = false;
                 return;
             }
        }
    }

    switch (action) {
      case 'addBelow': await createRow(targetRow.date, targetRow.sort_order + 0.5); break;
      case 'addAbove': await createRow(targetRow.date, prevOrder + (targetRow.sort_order - prevOrder) / 2); break;
      case 'duplicate': 
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...rest } = targetRow;
        await supabase.from('schedule_techs').insert({ ...rest, sort_order: targetRow.sort_order + 0.1 });
        break;
      case 'delete': 
        rows = rows.filter(r => r.id !== targetRow.id);
        await supabase.from('schedule_techs').delete().eq('id', targetRow.id); 
        break;
      case 'clear':
        if (targetField === '__ROW__') {
             const emptyData = { 
                 event_name: '', type: '', notes: '', ld: '', video: '', vj: '', 
                 sound: '', tech_sm: '', dt: '', artist_liaison: '', op_hours: '', crew_call: '' 
             };
             rows = rows.map(r => r.id === targetRow.id ? { ...r, ...emptyData } : r);
             await supabase.from('schedule_techs').update(emptyData).eq('id', targetRow.id);
        } else if (targetField) {
             updateCell(targetRow.id, targetField, '');
        }
        break;
      case 'copy': 
        clipboardData = { type: 'row', data: { ...targetRow } };
        break;
      case 'cut':
        clipboardData = { type: 'row', data: { ...targetRow } };
        if (targetField === '__ROW__') {
             const clearedData = { 
                 event_name: '', type: '', notes: '', ld: '', video: '', vj: '', 
                 sound: '', tech_sm: '', dt: '', artist_liaison: '', op_hours: '', crew_call: '' 
             };
             rows = rows.map(r => r.id === targetRow.id ? { ...r, ...clearedData } : r);
             await supabase.from('schedule_techs').update(clearedData).eq('id', targetRow.id);
        } else if (targetField) {
             updateCell(targetRow.id, targetField, '');
        }
        break;
      case 'paste':
        if (clipboardData && clipboardData.type === 'row' && targetField === '__ROW__') {
             // eslint-disable-next-line @typescript-eslint/no-unused-vars
             const { id: _, sort_order: __, date: ___, year: ____, ...dataToPaste } = clipboardData.data;
             rows = rows.map(r => r.id === targetRow.id ? { ...r, ...dataToPaste } : r);
             await supabase.from('schedule_techs').update(dataToPaste).eq('id', targetRow.id);
        } else if (clipboardData && clipboardData.type === 'cell' && targetField) {
             updateCell(targetRow.id, targetField, clipboardData.data);
        }
        break;
    }
    contextMenu.show = false;
  }

  async function createRow(date: string, sortOrder: number) {
    const { data, error } = await supabase.from('schedule_techs').insert({ date, year, sort_order: sortOrder, type: '', event_name: '' }).select().single();
    if (!error && data) {
         await logHistory(data.id, 'INSERT', null, data);
    }
  }

  function handleRowDropdownToggle(id: string) {
      if (!userPermissions.canEditAll) return;
      activeDropdownId = activeDropdownId === id ? null : id;
  }

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });
</script>

<svelte:window 
    on:click={() => activeDropdownId = null} 
    on:keydown={handleKeydown}
/>

<div class="flex flex-col h-full bg-gray1 text-gray2 overflow-hidden font-mono text-xs relative">
    
    <div 
    class="flex-1 overflow-auto custom-scrollbar relative"
    bind:this={gridContainer}
  >
    <div 
      class="bg-navbar border-b border-gray2/20 font-bold text-gray3 sticky top-0 z-20 shadow-lg"
      style={gridStyle}
    >
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
      <div class="p-2 pl-4">NOTES</div>
    </div>

    {#if loading}
      <div class="flex items-center justify-center h-full text-lime animate-pulse text-sm min-w-full mt-10">Loading Schedule...</div>
    {:else}
      {#each filteredRows as row, i (row.id)}
        {#if i === 0 || dayjs(row.date).month() !== dayjs(filteredRows[i-1].date).month()}
          <div class="sticky left-0 right-0 z-10 min-w-max">
            <div class="bg-white/10 border-y border-gray2/20 font-bold py-2 pl-4 text-white uppercase tracking-[0.2em] text-xs shadow-md text-left">
                {dayjs(row.date).format('MMMM YYYY')}
            </div>
          </div>
        {/if}

        <div 
            role="group"
            style="display: contents"
            data-row-id={row.id}
            on:mouseenter={() => hoveredRowId = row.id}
            on:mousemove={(e) => handleRowMouseMove(e, row.id)}
            on:mouseleave={() => { hoveredRowId = null; hoveredColumnKey = null; }}
        >
            <TechRowComponent 
              {row} 
              index={i}
              {gridStyle} 
              currentYear={year}
              activeDropdownId={activeDropdownId}
              {userPermissions}
              on:toggleDropdown={(e) => handleRowDropdownToggle(e.detail.id)}
              on:update={(e) => updateCell(e.detail.id, e.detail.field, e.detail.value)}
              on:contextmenu={handleContextMenu}
              on:focus={handleCellFocus}
              on:blur={handleCellBlur} 
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
      on:close={() => historyPanel.open = false}
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