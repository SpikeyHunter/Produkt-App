<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fly, fade } from 'svelte/transition';
    import { supabase } from '$lib/supabase';

    export let isOpen = false;
    export let events: any[] = [];
    export let currentUser: any = null; // <--- Make sure this line is here!
    
    const dispatch = createEventDispatcher();

    // Toggle states
    let markAsCompleted = false;
    let markAsApproved = false;

    let files: FileList | null = null;
    let step: 'upload' | 'mapping' | 'processing' = 'upload';
    let processedBatches: any[] = [];
    let isUploading = false;
    let uploadProgress = 0;
    let isDragging = false;

    // Custom Dropdown State
    let activeDropdownIndex: number | null = null;
    let dropdownSearchQuery = '';

    // Click outside handler for custom dropdown
    function handleWindowClick(e: MouseEvent) {
        if (activeDropdownIndex !== null) {
            const target = e.target as HTMLElement;
            if (!target.closest('.custom-dropdown-container')) {
                activeDropdownIndex = null;
            }
        }
    }

    $: filteredDropdownEvents = events.filter(e => {
        if (!dropdownSearchQuery) return true;
        const q = dropdownSearchQuery.toLowerCase();
        return (
            String(e.event_id).includes(q) ||
            (e.event_name || '').toLowerCase().includes(q) ||
            (e.event_date || '').includes(q)
        );
    });

    // French translation map to ensure standard data models
    const DICTIONARY: Record<string, string> = {
        'vestiaire prépayé': 'Coat Check',
        'table - prépayée': 'Table - Prepaid',
        'table - porte': 'Table - Door',
        'billet': 'Ticket',
        'catégorie': 'Category'
    };

    function translateName(name: string): string {
        const lower = name.toLowerCase().trim();
        return DICTIONARY[lower] || name;
    }

    // A robust CSV parser to handle quoted strings
    function parseCSV(text: string) {
        let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
        for (l of text) {
            if ('"' === l) {
                if (s && l === p) row[i] += l;
                s = !s;
            } else if (',' === l && s) l = row[++i] = '';
            else if ('\n' === l && s) {
                if ('\r' === p) row[i] = row[i].slice(0, -1);
                row = ret[++r] = ['']; i = 0;
            } else row[i] += l;
            p = l;
        }
        return ret;
    }

    // Normalize Date
    function normalizeDate(dateStr: string) {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return null;
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } catch {
            return null;
        }
    }

    // Status checking
    function getEventStatus(eventId: number | string): string {
        const evt = events.find(e => String(e.event_id) === String(eventId));
        if (!evt) return 'todo';
        const rep = evt.box_office_reports;
        if (!rep) return 'todo';
        return (Array.isArray(rep) ? rep[0]?.status : rep.status) || 'todo';
    }

    function evaluateMapping(batch: any, eventId: string | number) {
        batch.matchedEventId = eventId;
        if (eventId) {
            const status = getEventStatus(eventId);
            if (status !== 'todo') {
                batch.statusError = `Blocked: Event report is currently '${status.replace('_', ' ')}'.`;
                batch.isBlocked = true;
            } else {
                batch.statusError = null;
                batch.isBlocked = false;
            }
        } else {
            batch.statusError = null;
            batch.isBlocked = false;
        }
    }

    function handleEventSelection(batchIndex: number, eventId: string | number) {
        evaluateMapping(processedBatches[batchIndex], eventId);
        processedBatches = [...processedBatches];
        activeDropdownIndex = null; // Close dropdown
    }

    // Drag and Drop Handlers
    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        isDragging = true;
    }

    function handleDragLeave(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        isDragging = false;
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
            files = e.dataTransfer.files;
            handleProcessFiles();
        }
    }

    async function handleProcessFiles() {
        if (!files || files.length === 0) return;
        
        const maxFiles = Array.from(files);
        processedBatches = [];
        step = 'mapping';

        for (const file of maxFiles) {
            const text = await file.text();
            const rows = parseCSV(text);
            
            let eventName = '';
            let eventDate = '';
            let headerIdx = -1;

            for (let i = 0; i < Math.min(15, rows.length); i++) {
                const rowStr = rows[i].join(',').toLowerCase();
                
                if (rowStr.includes('event name') || rowStr.includes('nom de l\'événement')) {
                    const idx = rows[i].findIndex(c => c.toLowerCase().includes('event name') || c.toLowerCase().includes('nom de l\'événement'));
                    if (idx > -1 && rows[i].length > idx + 1) eventName = rows[i][idx + 1].trim();
                }
                if (rowStr.includes('event date') || rowStr.includes('date de l\'événement')) {
                    const idx = rows[i].findIndex(c => c.toLowerCase().includes('event date') || c.toLowerCase().includes('date de l\'événement'));
                    if (idx > -1 && rows[i].length > idx + 1) eventDate = rows[i][idx + 1].trim();
                }
                if (rows[i][0]?.trim().toLowerCase() === 'ticket' || rows[i][0]?.trim().toLowerCase() === 'billet') {
                    headerIdx = i;
                }
            }

            if (headerIdx === -1) {
                processedBatches.push({ file, filename: file.name, parseError: "Invalid format: Missing Ticket header", isBlocked: true });
                continue;
            }

            const headers = rows[headerIdx].map(h => h.trim().toLowerCase());
            const tIdx = headers.findIndex(h => h.includes('ticket') || h.includes('billet'));
            const cIdx = headers.findIndex(h => h.includes('category') || h.includes('catégorie'));
            const tierIdx = headers.findIndex(h => h === 'tier');
            const pIdx = headers.findIndex(h => h.includes('price') || h.includes('prix'));
            const sIdx = headers.findIndex(h => h.includes('sold') || h.includes('vendu'));
            const scIdx = headers.findIndex(h => h.includes('scanned') || h.includes('scanné'));

            const report = { online: [] as any[], door: [] as any[], table_tickets: [] as any[], comp: [] as any[], other: [] as any[] };
            let currentSection = 'online';

            for (let i = headerIdx + 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || !row[0]) continue;
                
                const r0 = row[0].trim();
                const r0Upper = r0.toUpperCase();

                if (r0Upper.startsWith('SUBTOTAL ONLINE') || r0Upper.startsWith('SOUS-TOTAL EN LIGNE')) { currentSection = 'door'; continue; }
                if (r0Upper.startsWith('SUBTOTAL DOOR') || r0Upper.startsWith('SOUS-TOTAL PORTE')) { currentSection = 'table_tickets'; continue; }
                if (r0Upper.startsWith('SUBTOTAL TABLE') || r0Upper.startsWith('SOUS-TOTAL TABLE')) { currentSection = 'comp'; continue; }
                if (r0Upper.startsWith('SUBTOTAL COMP') || r0Upper.startsWith('SOUS-TOTAL COMP')) { currentSection = 'done'; continue; }
                if (r0Upper.startsWith('ADDITIONAL ITEMS') || r0Upper.startsWith('ARTICLES SUPPLÉMENTAIRES')) { currentSection = 'other'; continue; }
                if (currentSection === 'done' && !(r0Upper.startsWith('ADDITIONAL ITEMS') || r0Upper.startsWith('ARTICLES SUPPLÉMENTAIRES'))) continue;

                if (r0Upper === 'TOTAL' || r0Upper === 'SCAN REPORT' || r0Upper.includes('NO SHOW')) continue;

                let ticketName = row[tIdx] || '';
                if (!ticketName) continue; 

                let priceStr = pIdx > -1 ? row[pIdx] || '' : '';
                let price = parseFloat(priceStr.replace(/[^0-9.-]+/g, ""));
                
                let soldStr = sIdx > -1 ? row[sIdx] || '' : '';
                let sold = parseInt(soldStr.replace(/[^0-9]+/g, ""));
                
                let scannedStr = scIdx > -1 ? row[scIdx] || '' : '';
                let scanned = parseInt(scannedStr.replace(/[^0-9]+/g, ""));

                const item = {
                    id: crypto.randomUUID(),
                    ticket: translateName(ticketName),
                    category: cIdx > -1 ? row[cIdx] : '',
                    tier: tierIdx > -1 ? row[tierIdx] : '',
                    price: isNaN(price) ? 0 : price,
                    sold: isNaN(sold) ? 0 : sold,
                    scanned: isNaN(scanned) ? 0 : scanned,
                    allowPrice: true,
                    allowSold: true,
                    allowScanned: true,
                    allowEntry: true
                };

                if (currentSection === 'other') report.other.push(item);
                else if (currentSection === 'comp') report.comp.push(item);
                else if (currentSection === 'table_tickets') report.table_tickets.push(item);
                else if (currentSection === 'door') report.door.push(item);
                else report.online.push(item);
            }

            // --- Auto-Mapping Logic ---
            const formattedDate = normalizeDate(eventDate);
            let matchedEventId = '';

            let match = events.find(e => 
                e.event_date === formattedDate && 
                e.event_name.toLowerCase() === eventName.toLowerCase()
            );

            if (!match && formattedDate) {
                match = events.find(e => {
                    if (e.event_date !== formattedDate) return false;
                    const dbName = (e.event_name || '').toLowerCase();
                    const csvName = eventName.toLowerCase();
                    return dbName.includes(csvName) || csvName.includes(dbName);
                });
            }

            const batchRecord = {
                file,
                filename: file.name,
                eventName,
                eventDate,
                formattedDate,
                report,
                matchedEventId: match ? match.event_id : '',
                parseError: null,
                statusError: null,
                isBlocked: false
            };

            // Automatically check status if mapped
            if (batchRecord.matchedEventId) {
                evaluateMapping(batchRecord, batchRecord.matchedEventId);
            }

            processedBatches.push(batchRecord);
        }
        
        processedBatches = [...processedBatches];
    }

    async function handleUploadAll() {
        const toUpload = processedBatches.filter(b => b.matchedEventId && !b.parseError && !b.isBlocked);
        if (toUpload.length === 0) return;

        step = 'processing';
        isUploading = true;
        let completed = 0;

        // Determine hierarchy of status
        let finalStatus = 'in_progress';
        if (markAsCompleted) finalStatus = 'done';
        if (markAsApproved) finalStatus = 'approved';

        // Prepare the user specific payload data
        const completedByArray = markAsCompleted && currentUser?.first_name ? [currentUser.first_name] : null;
        const approvedByName = markAsApproved ? `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() : null;
        const approvedAtTime = markAsApproved ? new Date().toISOString() : null;

        for (const batch of toUpload) {
            const eventIdNum = Number(batch.matchedEventId);

            const payload: any = {
                online: batch.report.online,
                door: batch.report.door,
                table_tickets: batch.report.table_tickets,
                comp: batch.report.comp,
                other: batch.report.other,
                status: finalStatus
            };

            // Only append these fields if toggles are checked (avoids overwriting existing data with null)
            if (markAsCompleted) payload.completed_by = completedByArray;
            if (markAsApproved) {
                payload.approved_by = approvedByName;
                payload.approved_at = approvedAtTime;
            }

            const { data: existing } = await supabase
                .from('box_office_reports')
                .select('event_id')
                .eq('event_id', eventIdNum)
                .maybeSingle();

            if (existing) {
                await supabase.from('box_office_reports').update(payload).eq('event_id', eventIdNum);
            } else {
                payload.event_id = eventIdNum;
                await supabase.from('box_office_reports').insert(payload);
            }

            completed++;
            uploadProgress = Math.round((completed / toUpload.length) * 100);
        }

        isUploading = false;
        dispatch('close');
    }

    function removeBatch(index: number) {
        processedBatches.splice(index, 1);
        processedBatches = [...processedBatches];
        if (processedBatches.length === 0) step = 'upload';
    }

    function getEventDisplay(eventId: string | number) {
        const evt = events.find(e => String(e.event_id) === String(eventId));
        if (!evt) return '';
        return `${evt.event_date} | ${evt.event_name}`;
    }
</script>

<svelte:window on:click={handleWindowClick} />

{#if isOpen}
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" transition:fade={{ duration: 150 }}>
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" role="button" tabindex="-1" aria-label="Close modal background" on:click={() => dispatch('close')} on:keypress={(e) => e.key === 'Escape' && dispatch('close')}></div>

        <div class="relative bg-navbar border border-gray1/50 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col h-[85vh]" in:fly={{ y: 20, duration: 200 }}>
            
            <div class="p-5 border-b border-gray1 flex justify-between items-center shrink-0">
                <h3 class="text-lg font-bold text-white flex items-center gap-2">
                    <svg class="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    Batch Upload Reports
                </h3>
                <button aria-label="Close modal" class="text-gray2 hover:text-white transition-colors" on:click={() => dispatch('close')}>
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            <div class="p-6 overflow-y-auto flex-1 custom-scrollbar">
                {#if step === 'upload'}
                    <div 
                        class="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-8 text-center transition-all {isDragging ? 'border-lime bg-lime/10' : 'border-gray1 bg-black/20 hover:border-gray2 hover:bg-gray1/10'}"
                        on:dragover={handleDragOver}
                        on:dragleave={handleDragLeave}
                        on:drop={handleDrop}
                        role="region"
                        aria-label="File dropzone"
                    >
                        <svg class="w-12 h-12 mb-4 {isDragging ? 'text-lime' : 'text-gray2'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                            <path d="M14 3v5h5M16 13H8M16 17H8M10 9H8" />
                        </svg>
                        <h4 class="text-white font-bold text-lg mb-1">
                            {isDragging ? 'Drop CSV files here' : 'Upload CSV Reports'}
                        </h4>
                        <p class="text-gray2 text-sm mb-6 max-w-sm">
                            Drag and drop or select your CSV files exported from your scanning system. We'll extract and map them automatically.
                        </p>
                        
                        <label class="px-6 py-3 bg-lime text-black font-bold rounded-3xl hover:bg-lime/80 transition-colors cursor-pointer shadow-lg">
                            Select CSV Files
                            <input 
                                type="file" 
                                accept=".csv" 
                                multiple 
                                bind:files 
                                class="hidden"
                                on:change={handleProcessFiles}
                            />
                        </label>
                    </div>

                {:else if step === 'mapping'}
                    <div class="space-y-4">
                        <div class="flex items-center justify-between mb-2">
                            <p class="text-sm text-gray2">Review extracted data and fix unmapped events.</p>
                            <span class="text-xs bg-gray1 px-3 py-1 rounded-3xl text-white">{processedBatches.length} files processed</span>
                        </div>

                        <div class="border border-gray1 rounded-3xl overflow-visible shadow-md bg-[#1e1e1e]">
                            <table class="w-full text-left text-sm text-white">
                                <thead class="bg-black/40 border-b border-gray1 text-xs uppercase text-gray2 tracking-wider">
                                    <tr>
                                        <th class="p-4 rounded-tl-3xl">File Reference</th>
                                        <th class="p-4">Extracted Details</th>
                                        <th class="p-4 w-[350px]">Map to System Event</th>
                                        <th class="p-4 text-center w-16 rounded-tr-3xl">Action</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-gray1/50">
                                    {#each processedBatches as batch, i}
                                        <tr class="hover:bg-white/5 transition-colors {batch.parseError || batch.statusError ? 'bg-problem/5' : ''}">
                                            <td class="p-4 min-w-[200px] truncate max-w-xs font-mono text-xs text-gray3" title={batch.filename}>
                                                {batch.filename}
                                                {#if batch.parseError}
                                                    <div class="text-problem text-[10px] mt-1 font-sans">{batch.parseError}</div>
                                                {/if}
                                            </td>
                                            <td class="p-4">
                                                {#if !batch.parseError}
                                                    <div class="font-bold text-sm truncate max-w-[200px]">{batch.eventName}</div>
                                                    <div class="text-gray2 text-xs mt-0.5">{batch.eventDate}</div>
                                                {/if}
                                            </td>
                                            <td class="p-4 align-top">
                                                {#if !batch.parseError}
                                                    <div class="relative w-full custom-dropdown-container">
                                                        <button 
                                                            type="button"
                                                            class="w-full bg-black/50 border text-left flex justify-between items-center rounded-3xl p-2.5 px-4 text-xs outline-none cursor-pointer transition-colors {batch.statusError ? 'border-problem/80 text-problem' : (batch.matchedEventId ? 'border-lime/50 text-lime' : 'border-gray1/80 text-gray2 hover:border-gray2')}"
                                                            on:click={() => {
                                                                activeDropdownIndex = activeDropdownIndex === i ? null : i;
                                                                dropdownSearchQuery = ''; // reset search on open
                                                            }}
                                                        >
                                                            <span class="truncate pr-4">{getEventDisplay(batch.matchedEventId) || '-- Select an Event to Map --'}</span>
                                                            <svg class="w-4 h-4 flex-shrink-0 {activeDropdownIndex === i ? 'rotate-180' : ''} transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                                        </button>

                                                        {#if activeDropdownIndex === i}
                                                            <div class="absolute z-50 top-full left-0 mt-2 w-full bg-[#2a2a2a] border border-gray1/80 rounded-3xl shadow-xl flex flex-col overflow-hidden max-h-[250px]" in:fly={{ y: -5, duration: 150 }}>
                                                                <div class="p-2 border-b border-gray1/50">
                                                                    <input 
                                                                        type="text" 
                                                                        bind:value={dropdownSearchQuery}
                                                                        placeholder="Search name, date, ID..." 
                                                                        class="w-full bg-black/40 border border-transparent rounded-3xl px-4 py-2 text-xs text-white focus:border-lime/50 outline-none"
                                                                    />
                                                                </div>
                                                                <div class="overflow-y-auto custom-scrollbar">
                                                                    {#each filteredDropdownEvents as evt}
                                                                        <button 
                                                                            type="button"
                                                                            class="w-full text-left px-4 py-3 hover:bg-white/10 text-xs text-white border-b border-gray1/20 last:border-0 transition-colors"
                                                                            on:click={() => handleEventSelection(i, evt.event_id)}
                                                                        >
                                                                            <span class="font-bold">{evt.event_name}</span>
                                                                            <span class="text-gray2 ml-1">({evt.event_date}) - ID: {evt.event_id}</span>
                                                                        </button>
                                                                    {:else}
                                                                        <div class="p-4 text-center text-xs text-gray2">No events found.</div>
                                                                    {/each}
                                                                </div>
                                                            </div>
                                                        {/if}

                                                        {#if batch.statusError}
                                                            <div class="text-problem text-[10px] mt-1.5 ml-2 font-bold flex items-center gap-1">
                                                                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                                                {batch.statusError}
                                                            </div>
                                                        {/if}
                                                    </div>
                                                {/if}
                                            </td>
                                            <td class="p-4 text-center align-top">
                                                <button class="p-2 text-gray2 hover:text-problem hover:bg-problem/10 rounded-full transition-colors mt-0.5" on:click={() => removeBatch(i)} aria-label="Remove from batch" title="Remove from batch">
                                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    </div>

                {:else if step === 'processing'}
                    <div class="h-full flex flex-col items-center justify-center space-y-6">
                        <div class="relative w-24 h-24">
                            <svg class="w-full h-full text-gray1 transform -rotate-90" viewBox="0 0 36 36">
                                <path class="stroke-current" fill="none" stroke-width="3" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path class="stroke-lime" fill="none" stroke-width="3" stroke-dasharray="{uploadProgress}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <div class="absolute inset-0 flex items-center justify-center text-white font-bold text-xl">
                                {uploadProgress}%
                            </div>
                        </div>
                        <p class="text-gray2 font-medium">Uploading and mapping data to reports...</p>
                    </div>
                {/if}
            </div>

            {#if step === 'mapping'}
                {@const validBatches = processedBatches.filter(b => b.matchedEventId && !b.parseError && !b.isBlocked).length}
                <div class="p-5 border-t border-gray1 bg-black/40 flex justify-between items-center shrink-0 rounded-b-3xl">
                    <button class="px-6 py-2.5 rounded-3xl text-sm font-bold text-gray2 hover:text-white hover:bg-gray1 transition-colors" on:click={() => step = 'upload'}>
                        Cancel
                    </button>
                    
                    <div class="flex items-center gap-6">
                        <label class="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray2 hover:text-white transition-colors">
                            <div class="relative flex items-center">
                                <input type="checkbox" bind:checked={markAsCompleted} class="sr-only peer" />
                                <div class="w-9 h-5 bg-gray1 rounded-full peer peer-checked:bg-lime transition-colors"></div>
                                <div class="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                            </div>
                            Mark Completed
                        </label>

                        <label class="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray2 hover:text-white transition-colors">
                            <div class="relative flex items-center">
                                <input type="checkbox" bind:checked={markAsApproved} class="sr-only peer" />
                                <div class="w-9 h-5 bg-gray1 rounded-full peer peer-checked:bg-lime transition-colors"></div>
                                <div class="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4"></div>
                            </div>
                            Mark Approved
                        </label>

                        <button 
                            class="px-8 py-2.5 rounded-3xl text-sm font-bold text-black bg-lime hover:bg-lime/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-2"
                            disabled={validBatches === 0}
                            on:click={handleUploadAll}
                        >
                            Confirm & Upload ({validBatches})
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-gray1); border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-gray2); }
</style>