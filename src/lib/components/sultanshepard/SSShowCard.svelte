<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { SSShow } from '$lib/services/ssShowService';

    export let show: SSShow;

    const dispatch = createEventDispatcher();

    $: displayDate = new Date(show.show_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
    });

    $: fullLocation = [show.show_city, show.show_country].filter(Boolean).join(', ');

    // --- Time Formatter ---
    function formatTimeShort(timeStr: string): string {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(h), parseInt(m));
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: m === '00' ? undefined : '2-digit' }).replace(' ', '');
    }

    // --- Tag Logic ---
    type Tag = { label: string; type: 'gray' | 'lime' | 'confirmed' | 'proposed' | 'problem' };

    $: tags = (() => {
        let t: Tag[] = [];

        // 1. Notes (Gray) - UPDATED FIX
        if (show.notes) {
            if (Array.isArray(show.notes)) {
                // Handle Array format: [{"id": 123, "text": "Note content"}]
                show.notes.forEach((note: any) => {
                    if (note.text && note.text.trim() !== '') {
                        t.push({ label: note.text, type: 'gray' });
                    }
                });
            } else if (typeof show.notes === 'string' && show.notes.trim() !== '') {
                // Handle legacy String format
                t.push({ label: show.notes, type: 'gray' });
            }
        }

        // 2. DOS Contact (Lime)
        const hasContact = show.dos_contact && show.dos_contact !== '[]' && show.dos_contact !== '';
        if (!hasContact) {
            t.push({ label: 'No Contact', type: 'lime' });
        }

        // 3. Show Specs (Lime)
        let specsUrl = '';
        if (typeof show.show_specs === 'string') specsUrl = show.show_specs;
        else if (typeof show.show_specs === 'object' && show.show_specs) specsUrl = (show.show_specs as any).url || '';
        const hasSpecsFile = !!show.show_specs_file;
        const hasSpecs = (specsUrl && specsUrl !== '') || hasSpecsFile;

        if (!hasSpecs) {
            t.push({ label: 'Show Specs', type: 'lime' });
        }

        // 4. Venue Info Logic
        const v = show.venue_info || {};

        // Pixel Map
        if (v.pixel_map === false) t.push({ label: 'No Pixel Map', type: 'problem' });
        else if (v.pixel_map === true) t.push({ label: 'Pixel Map', type: 'confirmed' });

        // --- Camera Logic ---
        if (v.camera === true) {
            // Camera IS available
            if (v.sdi_confirmed === true) {
                t.push({ label: 'Camera + SDI', type: 'confirmed' });
            } else {
                // SDI is False or Null
                t.push({ label: 'Camera Available', type: 'confirmed' });
            }
        } else if (v.camera === false) {
            // Camera is NOT available
            if (v.bring_own_camera === true) {
                t.push({ label: 'Own Camera', type: 'confirmed' });
            } else if (v.bring_own_camera === false) {
                t.push({ label: 'No Camera', type: 'problem' });
            }
            // If bring_own_camera is null/TBD, we display nothing here
        }
        // If v.camera is null (TBD), we display nothing.

        // 5. Set Times (ROS)
        if (Array.isArray(show.show_settimes) && show.show_settimes.length > 0) {
            const activeSets = show.show_settimes.filter((s: any) => s.status !== 'Default');
            if (activeSets.length > 0) {
                const hasProblem = activeSets.some((s: any) => s.status === 'Problem');
                const hasWaiting = activeSets.some((s: any) => ['Tentative', 'Proposed'].includes(s.status));
                const allConfirmed = activeSets.every((s: any) => s.status === 'Confirmed');

                if (hasProblem) {
                    t.push({ label: 'ROS Problem', type: 'problem' });
                } else if (hasWaiting) {
                    t.push({ label: 'ROS Waiting', type: 'proposed' });
                } else if (allConfirmed) {
                    t.push({ label: 'ROS Confirmed', type: 'confirmed' });
                }
            }
        }

        // 6. VJ Info
        const vj = show.vj_info || {};
        if (vj.needed === true && vj.confirmed === true) {
            t.push({ label: `VJ - ${vj.name || 'Other'}`, type: 'confirmed' });
        } else if (vj.needed === false) {
            t.push({ label: 'No VJ', type: 'problem' });
        }

        // 7. Videocheck
        const vc = show.videocheck || {};
        if (vc.needed === true && vc.confirmed === true && vc.startTime && vc.endTime) {
            const timeRange = `${formatTimeShort(vc.startTime)}-${formatTimeShort(vc.endTime)}`;
            t.push({ label: `Videocheck - ${timeRange}`, type: 'confirmed' });
        } else if (vc.needed === false) {
            t.push({ label: 'No Videocheck', type: 'problem' });
        }

        // 8. Tracklist
        const tl = show.tracklist || {};
        if (tl.revised === 'yes' && tl.text && tl.text.trim() !== '') {
            t.push({ label: 'Tracklist Revised', type: 'confirmed' });
        }

        // --- SORTING ---
        // Order: Gray -> Lime -> Confirmed -> Proposed -> Problem
        const typeOrder: Record<string, number> = {
            'gray': 1,
            'lime': 2,
            'confirmed': 3,
            'proposed': 4,
            'problem': 5
        };

        return t.sort((a, b) => {
            return typeOrder[a.type] - typeOrder[b.type];
        });
    })();

    // --- Color Mapper ---
    function getTagClasses(type: string): string {
        switch (type) {
            case 'gray': return 'border-gray2 bg-gray2/20 text-gray2';
            case 'lime': return 'border-lime bg-lime/10 text-lime';
            case 'confirmed': return 'border-[#86EFAC] bg-[#86EFAC]/10 text-[#86EFAC]';
            case 'proposed': return 'border-[#FDBA74] bg-[#FDBA74]/10 text-[#FDBA74]';
            case 'problem': return 'border-[#FCA5A5] bg-[#FCA5A5]/10 text-[#FCA5A5]';
            default: return 'border-gray2 text-gray2';
        }
    }

    function handleClick() {
        dispatch('click', { show });
    }

    function handleEdit(e: Event) {
        e.stopPropagation();
        dispatch('edit', { show });
    }
</script>

<div
    class="bg-navbar rounded-2xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl cursor-pointer h-52 group"
    on:click={handleClick}
    on:keydown={(e) => e.key === 'Enter' && handleClick()}
    role="button"
    tabindex="0"
    aria-label={`View details for ${show.show_venue || 'show'}`}
>
    <div class="flex gap-4 h-full">
        <div class="w-32 flex flex-col flex-shrink-0 h-full">
            <div class="flex-1 rounded-xl overflow-hidden relative bg-gray-900 flex items-center justify-center">
                {#if show.flyer_url}
                    <img src={show.flyer_url} alt={show.show_venue || 'Flyer'} class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" />
                {:else}
                    <div class="text-center"><span class="text-xs text-gray2">No IMG</span></div>
                {/if}
            </div>
            <div class="bg-gray3 text-black px-2 py-1 rounded-lg text-center font-bold text-xs mt-3 flex-shrink-0">{displayDate}</div>
        </div>

        <div class="flex-1 flex flex-col min-w-0 h-full">
            <div class="flex items-start justify-between mb-2">
                <div class="flex-1 min-w-0 pr-2">
                    <h3 class="text-white text-lg font-bold truncate leading-tight">{show.show_venue || 'TBD Venue'}</h3>
                    <p class="text-gray2 text-sm mt-0.5 truncate">{fullLocation}</p>
                </div>
                <button on:click={handleEdit} class="p-2 text-gray2 hover:text-black hover:bg-lime rounded-lg transition-all" aria-label="Edit show">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
            </div>

            <div class="flex-1 min-h-0 overflow-hidden relative">
                <div class="flex flex-wrap gap-1.5 content-start h-full overflow-y-auto custom-scrollbar pr-1">
                    {#if tags.length === 0}
                         <span class="rounded-full border border-gray2 bg-gray2/20 px-3 py-1 text-xs font-bold text-gray2 w-full text-center">Setup Required</span>
                    {:else}
                        {#each tags as tag}
                            <span class={`rounded-full border px-2 py-1 text-[11px] font-bold whitespace-nowrap w-max ${getTagClasses(tag.type)}`}>
                                {tag.label}
                            </span>
                        {/each}
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
</style>