<script lang="ts">
    // Shown when the tech schedule has several shows on the event's day and
    // none clearly matches (e.g. advance "Nico de Andrea" vs schedule
    // "APACHE (FR)"). Lists the whole month so the right row can be picked.
    import { createEventDispatcher } from 'svelte';
    import Modal from '$lib/components/modals/Modal.svelte';
    import { isExcludedType, type ScheduleRow } from '$lib/services/scheduleMatch';
    import type { EmailTechEvent } from '$lib/types/emailtech';

    export let isOpen = false;
    export let event: EmailTechEvent | null = null;
    export let rows: ScheduleRow[] = [];
    export let candidates: ScheduleRow[] = [];
    export let reason = '';

    const dispatch = createEventDispatcher<{ pick: ScheduleRow; close: void }>();

    $: day = String(event?.event_date || '').slice(0, 10);
    $: candidateIds = new Set(candidates.map((c) => c.id));

    // Same day first, then the rest of the month in order.
    $: ordered = [...rows].sort((a, b) => {
        const ad = String(a.date).slice(0, 10) === day ? 0 : 1;
        const bd = String(b.date).slice(0, 10) === day ? 0 : 1;
        if (ad !== bd) return ad - bd;
        return String(a.date).localeCompare(String(b.date));
    });

    function fmtDay(d: string): string {
        const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return d;
        const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
        return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function staff(r: ScheduleRow): string {
        return [
            r.ld && `LD ${r.ld}`,
            r.video && `Video ${r.video}`,
            r.vj && `VJ ${r.vj}`,
            r.sound && `Sound ${r.sound}`,
            r.tech_sm && `Tech ${r.tech_sm}`,
            r.dt && `DT ${r.dt}`
        ]
            .filter(Boolean)
            .join(' · ');
    }
</script>

<Modal {isOpen} title="Which schedule row is this show?" maxWidth="max-w-3xl" on:close={() => dispatch('close')}>
    {#if event}
        <p class="text-sm text-gray2 mb-4">
            <span class="text-white font-bold">{event.event_name || event.artist_name}</span>
            · {event.event_venue || 'No venue'} · {fmtDay(day)}.
            {reason ? `${reason} — ` : ''}pick the row the crew should come from.
        </p>
    {/if}

    <div class="max-h-[60vh] overflow-y-auto rounded-xl border border-gray1 divide-y divide-gray1">
        {#each ordered as r (r.id)}
            {@const sameDay = String(r.date).slice(0, 10) === day}
            {@const isCandidate = candidateIds.has(r.id)}
            <button
                type="button"
                on:click={() => dispatch('pick', r)}
                class="w-full text-left px-4 py-3 flex items-start gap-4 hover:bg-gray1 transition-colors cursor-pointer
                       {sameDay ? 'bg-lime/5' : ''}"
            >
                <div class="w-24 shrink-0">
                    <div class="text-xs font-bold {sameDay ? 'text-lime' : 'text-gray2'}">{fmtDay(r.date)}</div>
                    {#if r.type}
                        <div class="text-[10px] uppercase tracking-wider mt-0.5 truncate {isExcludedType(r.type) ? 'text-problem/80' : 'text-gray2'}">{r.type}</div>
                    {/if}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-white truncate">
                        {r.event_name || '—'}
                        {#if isCandidate}
                            <span class="ml-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-lime text-black align-middle">match</span>
                        {/if}
                    </div>
                    <div class="text-xs text-gray2 truncate">{staff(r) || 'No staff on this row'}</div>
                </div>
                {#if r.crew_call}
                    <div class="text-xs text-gray2 shrink-0">{r.crew_call}</div>
                {/if}
            </button>
        {:else}
            <div class="p-6 text-center text-gray2 text-sm">No schedule rows this month.</div>
        {/each}
    </div>

    <div class="mt-4 flex justify-end">
        <button type="button" on:click={() => dispatch('close')}
            class="px-4 py-2 rounded-2xl text-xs font-bold border border-gray1 text-gray2 hover:text-white hover:border-gray2 transition-colors cursor-pointer">
            Skip — keep crew as is
        </button>
    </div>
</Modal>
