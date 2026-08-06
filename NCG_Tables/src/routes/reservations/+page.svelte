<script lang="ts">
  import { app } from '$lib/stores/app.svelte';
  import { money } from '$lib/layout';

  const statusCls: Record<string, string> = {
    pending: 'text-hold', deposit_paid: 'text-lime', confirmed: 'text-ok',
    cancelled: 'text-dim line-through', no_show: 'text-sold'
  };
  const rows = $derived(
    app.reservations.map((r) => {
      const te = app.tablesEvent(r.tables_event_id);
      return { r, ev: te ? app.eventRow(te.event_id) : null, te };
    })
  );
</script>

<div class="space-y-4">
  <h1 class="text-xl font-semibold tracking-tight">All reservations</h1>
  {#if rows.length === 0}
    <div class="rounded-xl border border-edge bg-panel p-6 text-sm text-dim">No reservations yet.</div>
  {:else}
    <div class="rounded-xl border border-edge bg-panel overflow-x-auto">
      <table class="w-full text-sm">
        <thead><tr class="text-left border-b border-edge">
          {#each ['Event', 'Guest', 'Table', 'Party', 'Deposit', 'Total', 'Status', 'Created'] as h}
            <th class="label px-4 py-3">{h}</th>
          {/each}
        </tr></thead>
        <tbody>
          {#each rows as { r, ev, te } (r.id)}
            <tr class="border-b border-edge/50 hover:bg-ink/40">
              <td class="px-4 py-3">
                {#if te}<a class="hover:text-lime" href="/events/{te.id}">{ev?.event_name ?? `#${te.event_id}`}</a>{:else}—{/if}
              </td>
              <td class="px-4 py-3">{r.guest_name}<div class="text-dim text-xs">{r.guest_email}</div></td>
              <td class="px-4 py-3">{r.element_name}</td>
              <td class="px-4 py-3">{r.party_size}</td>
              <td class="px-4 py-3">{money(r.deposit_amount)}</td>
              <td class="px-4 py-3">{money(r.total_amount)}</td>
              <td class="px-4 py-3 {statusCls[r.status] ?? ''}">{r.status.replace('_', ' ')}</td>
              <td class="px-4 py-3 font-mono text-xs text-dim">{r.created_at?.slice(0, 10) ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
