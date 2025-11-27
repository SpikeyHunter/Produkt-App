<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { updateSSShow, type SSShow } from '$lib/services/ssShowService';
    import SSSetTimesModal from './SSSetTimesModal.svelte';
    import { portal } from '$lib/utils/portalUtils';
    import ClipboardButton from '$lib/components/buttons/ClipboardButton.svelte';

    export let show: SSShow;
    const dispatch = createEventDispatcher();

    let showSetTimesModal = false;
    $: setTimes = Array.isArray(show.show_settimes) ? show.show_settimes : [];

    async function handleSetTimesSave(event: CustomEvent) {
        const newSetTimes = event.detail.settimes;
        setTimes = newSetTimes;
        await updateSSShow(show.id, { show_settimes: newSetTimes });
        dispatch('update', { updates: { show_settimes: newSetTimes } });
        showSetTimesModal = false;
    }

    function isSultan(activity: string) {
        return activity && activity.toLowerCase().includes('sultan');
    }

    function formatTime(timeStr: string) {
        if (!timeStr) return '';
        return timeStr.replace(/([0-9])([AP]M)/i, '$1 $2');
    }

    // --- Clipboard Logic ---
    // We assume the modal calculates lengths and saves them to the DB in 'length' field.
    // If not, we re-calculate here for the clipboard.
    
    $: clipboardText = (() => {
        if (!setTimes || setTimes.length === 0) return '';
        
        const headers = ['Timetable', 'Length', 'Artist'];
        // Use stored length or fallback
        const rows = setTimes.map((d: any) => [
            formatTime(d.time), 
            d.length || '', 
            d.activity
        ]);

        const colWidths = headers.map((h, i) => {
            return Math.max(h.length, ...rows.map((r: any[]) => r[i].length)) + 2;
        });

        const pad = (str: string, width: number) => str.padEnd(width);
        const headerStr = headers.map((h, i) => pad(h, colWidths[i])).join('');
        const rowStrs = rows.map((row: any[]) => row.map((cell, i) => pad(cell, colWidths[i])).join('')).join('\n');

        return `${headerStr}\n${rowStrs}`;
    })();

    $: clipboardHtml = (() => {
        if (!setTimes || setTimes.length === 0) return '';

        const getColors = (status: string) => {
            switch (status) {
                case 'Confirmed': return { bg: '#d9ead3', text: '#274e13' }; 
                case 'Proposed': return { bg: '#fce5cd', text: '#783f04' };
                case 'Tentative': return { bg: '#fff2cc', text: '#7f6000' };
                case 'Problem': return { bg: '#f4cccc', text: '#660000' };
                default: return { bg: '#ffffff', text: '#000000' };
            }
        };

        let html = '<table style="border-collapse: collapse; font-family: Arial, sans-serif; font-size: 13px; border: 1px solid #d1d5db;">';
        html += '<thead style="background-color: #f3f4f6;"><tr>';
        html += '<th style="border: 1px solid #d1d5db; padding: 4px 8px; text-align: left; width: 80px;">Timetable</th>';
        html += '<th style="border: 1px solid #d1d5db; padding: 4px 8px; text-align: center; width: 60px;">Length</th>';
        html += '<th style="border: 1px solid #d1d5db; padding: 4px 8px; text-align: left; width: 200px;">Artist</th>';
        html += '</tr></thead><tbody>';

        setTimes.forEach((row: any) => {
            const colors = getColors(row.status || 'Default');
            const isSultanRow = isSultan(row.activity);
            const weight = isSultanRow || row.activity === 'DOORS' || row.activity === 'CURFEW' ? 'bold' : 'normal';

            html += `<tr style="background-color: ${colors.bg}; color: ${colors.text};">`;
            html += `<td style="border: 1px solid #d1d5db; padding: 4px 8px; font-weight: ${weight}; text-align: center;">${formatTime(row.time)}</td>`;
            html += `<td style="border: 1px solid #d1d5db; padding: 4px 8px; text-align: center;">${row.length || ''}</td>`;
            html += `<td style="border: 1px solid #d1d5db; padding: 4px 8px; font-weight: ${weight};">${row.activity}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table>';
        return html;
    })();

    // --- UI Helpers ---
    function getStatusColorClass(status: string) {
        switch (status) {
            case 'Confirmed': return 'bg-[var(--color-confirmed)]';
            case 'Proposed': return 'bg-[var(--color-proposed)]';
            case 'Tentative': return 'bg-[var(--color-tentatif)]';
            case 'Problem': return 'bg-[var(--color-problem)]';
            default: return 'bg-[var(--color-gray2)]';
        }
    }

    function getStatusTextColorClass(status: string) {
        switch (status) {
            case 'Confirmed': return 'text-[var(--color-confirmed)]';
            case 'Proposed': return 'text-[var(--color-proposed)]';
            case 'Tentative': return 'text-[var(--color-tentatif)]';
            case 'Problem': return 'text-[var(--color-problem)]';
            default: return 'text-[var(--color-gray2)]';
        }
    }

    function getHighlightColorClass(status: string) {
        switch (status) {
            case 'Confirmed': return 'highlight-confirmed';
            case 'Proposed': return 'highlight-proposed';
            case 'Tentative': return 'highlight-tentatif';
            case 'Problem': return 'highlight-problem';
            default: return 'highlight-default';
        }
    }
</script>

<div class="bg-navbar rounded-2xl overflow-hidden h-full min-h-[300px] flex flex-col relative transition-all duration-300">
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray1 flex-shrink-0">
        <h2 class="text-lg font-normal text-gray3 truncate flex-1 mr-4">Run of Show</h2>
        <button
            on:click={() => showSetTimesModal = true}
            class="p-1.5 text-gray2 hover:text-black hover:bg-lime rounded-lg transition-all duration-200 cursor-pointer flex-shrink-0"
            aria-label="Edit set times"
        >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
        </button>
    </div>

    <div class="flex-1 flex flex-col relative min-h-0">
        {#if setTimes.length > 0}
            <div class="flex-1 overflow-y-auto pt-4 px-6 pb-2 custom-scrollbar">
                <ul class="space-y-3">
                    {#each setTimes as slot}
                        <li class="flex items-center text-sm gap-2.5 relative {isSultan(slot.activity) ? 'artist-highlight' : ''}">
                            {#if isSultan(slot.activity)}
                                <div class="highlight-bg {getHighlightColorClass(slot.status || 'Confirmed')}"></div>
                            {/if}
                            <span class="block w-1.5 h-4 rounded-full {getStatusColorClass(slot.status || 'Confirmed')} relative z-10"></span>
                            <span class="w-20 font-bold flex-shrink-0 {getStatusTextColorClass(slot.status || 'Confirmed')} relative z-10 font-mono">
                                {formatTime(slot.time)}
                            </span>
                            <span class="{getStatusTextColorClass(slot.status || 'Confirmed')} truncate relative z-10 font-bold">
                                {slot.activity}
                            </span>
                        </li>
                    {/each}
                </ul>
            </div>

            <div class="border-t border-gray1 px-4 py-3 mt-auto flex justify-end flex-shrink-0">
                <ClipboardButton
                    variant="default"
                    copyText={clipboardText}
                    copyHtml={clipboardHtml}
                    label="Copy Table"
                    successMessage="Copied!"
                />
            </div>
        {:else}
            <div class="flex h-full w-full items-center justify-center p-4">
                <button
                    on:click={() => showSetTimesModal = true}
                    class="h-full w-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 bg-gray1 text-gray2 transition-all duration-200 hover:cursor-pointer hover:border-lime hover:bg-opacity-75 hover:text-white"
                >
                    <svg class="w-6 h-6 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span class="font-bold text-xs">Add Set Times</span>
                </button>
            </div>
        {/if}
    </div>
</div>

{#if showSetTimesModal}
    <div use:portal>
        <SSSetTimesModal 
            isOpen={showSetTimesModal} 
            show={show}
            initialSetTimes={setTimes} 
            on:close={() => showSetTimesModal = false} 
            on:save={handleSetTimesSave} 
        />
    </div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

    .artist-highlight {
        position: relative;
        margin-left: -8px;
        margin-right: -8px;
        padding-left: 8px;
        padding-right: 8px;
        border-radius: 6px;
    }

    .highlight-bg {
        position: absolute;
        inset: -4px -8px;
        border-radius: 6px;
        border-width: 2px;
        border-style: solid;
        opacity: 0.15;
    }

    .highlight-bg::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 4px;
        border-width: 2px;
        border-style: solid;
        opacity: 0.8;
    }

    .highlight-confirmed { background-color: var(--color-confirmed); border-color: var(--color-confirmed); }
    .highlight-confirmed::before { border-color: var(--color-confirmed); }
    .highlight-proposed { background-color: var(--color-proposed); border-color: var(--color-proposed); }
    .highlight-proposed::before { border-color: var(--color-proposed); }
    .highlight-tentatif { background-color: var(--color-tentatif); border-color: var(--color-tentatif); }
    .highlight-tentatif::before { border-color: var(--color-tentatif); }
    .highlight-problem { background-color: var(--color-problem); border-color: var(--color-problem); }
    .highlight-problem::before { border-color: var(--color-problem); }
    .highlight-default { background-color: var(--color-gray2); border-color: var(--color-gray2); }
    .highlight-default::before { border-color: var(--color-gray2); }
</style>