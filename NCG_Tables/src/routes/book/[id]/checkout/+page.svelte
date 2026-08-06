<script lang="ts">
  import { page } from '$app/state';
  import { app } from '$lib/stores/app.svelte';
  import { ADMIN_FEE_RATE, isPastCutoff, money, tierOf } from '$lib/layout';

  const te = $derived(app.tablesEvent(page.params.id));
  const ev = $derived(te ? app.eventRow(te.event_id) : null);
  const venue = $derived(te ? app.venue(te.venue_id) : null);
  const sel = $derived(page.url.searchParams.get('sel') ?? '');
  const guests = $derived(Number(page.url.searchParams.get('guests') ?? 2));
  const taken = $derived(te ? app.takenIds(te.id) : new Set<string>());

  // Resolve to a concrete element (sections book the cheapest available table)
  const resolved = $derived.by(() => {
    if (!te) return null;
    if (sel.startsWith('sec:')) {
      const name = sel.slice(4);
      const free = te.elements
        .filter((el) => el.bookable && !el.disabled && el.section === name && !taken.has(el.id))
        .sort((a, b) => a.price - b.price);
      return free[0] ? { el: free[0], label: `${name} — ${free[0].name}` } : null;
    }
    const el = te.elements.find((e) => e.id === sel && e.bookable && !e.disabled);
    return el && !taken.has(el.id) ? { el, label: el.name } : null;
  });

  const cutoff = $derived(te && ev ? isPastCutoff(ev.event_date, te.booking_cutoff_hour) : false);
  const adminFee = $derived(resolved ? Math.round(resolved.el.deposit * ADMIN_FEE_RATE * 100) / 100 : 0);
  const dueNow = $derived(resolved ? resolved.el.deposit + adminFee : 0);
  const balance = $derived(resolved ? resolved.el.price - resolved.el.deposit : 0);

  let fullName = $state('');
  let email = $state('');
  let phone = $state('');
  let agreed = $state(false);
  let submitting = $state(false);
  let done = $state(false);
  let errorMsg = $state('');

  const valid = $derived(fullName.trim().length > 1 && /.+@.+\..+/.test(email) && agreed);

  const fmt = (d: string | null | undefined) =>
    d ? new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' }) : '';

  async function submit() {
    if (!valid || !resolved || !te || cutoff) return;
    submitting = true;
    errorMsg = '';
    try {
      await app.addReservation({
        tables_event_id: te.id,
        element_id: resolved.el.id,
        element_name: resolved.el.name,
        guest_name: fullName.trim(),
        guest_email: email.trim(),
        guest_phone: phone.trim() || null,
        party_size: guests,
        deposit_amount: resolved.el.deposit,
        total_amount: resolved.el.price,
        status: 'pending',
        stripe_payment_intent: null,
        notes: `${ev?.event_name ?? ''}`.trim() || null
      });
      done = true;
    } catch (e: unknown) {
      errorMsg = e instanceof Error ? e.message : 'Something went wrong — please try again.';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="min-h-screen bg-[#f2ead9] text-[#1b1510]" style="font-family:Inter,system-ui,sans-serif">
  <div class="max-w-5xl mx-auto px-6 py-10">
    {#if !te || !resolved}
      <p>
        {#if te && sel}That table just got booked — pick another one.{:else}Reservation not found.{/if}
        <a class="underline" href={te ? `/book/${te.id}` : '/book'}>Back to floor plan</a>
      </p>
    {:else if cutoff}
      <p>Reservations are closed for this event. <a class="underline" href="/book">Back to events</a></p>
    {:else if done}
      <div class="max-w-xl mx-auto text-center py-24">
        <div class="text-5xl mb-6">❖</div>
        <h1 class="text-3xl font-bold tracking-tight">Reservation received</h1>
        <p class="mt-4 text-[#5a4c3d] leading-relaxed">
          {resolved.label} is on hold for <strong>{ev?.event_name}</strong> ({fmt(ev?.event_date)}).
          A confirmation will be sent to <strong>{email}</strong> once your {money(resolved.el.deposit)} deposit is processed.
        </p>
        <a href="/book" class="inline-block mt-8 rounded-xl bg-[#1b1510] text-[#f2ead9] px-6 py-3 font-medium">Back to events</a>
      </div>
    {:else}
      {@const tier = tierOf(resolved.el.price)}
      <a href="/book/{te.id}" class="text-sm text-[#5a4c3d] hover:underline">‹ Back to floor plan</a>
      <div class="mt-2 text-sm text-[#5a4c3d]"><strong>{fmt(ev?.event_date)}</strong></div>
      <h1 class="text-3xl font-bold mt-1">{ev?.event_name}</h1>

      <div class="grid lg:grid-cols-[1fr_400px] gap-8 mt-8 items-start">
        <div class="rounded-2xl bg-white shadow-sm p-6">
          <div class="grid grid-cols-4 gap-4 text-center border-b border-[#e5dac4] pb-5">
            {#each [
              ['Room', venue?.name ?? ''],
              ['People', String(guests)],
              ['Tier', tier.name],
              ['Table', resolved.label]
            ] as [k, v]}
              <div>
                <div class="text-[11px] uppercase tracking-wider text-[#8a7a64]">{k}</div>
                <div class="font-semibold mt-1 text-sm leading-snug">{v}</div>
              </div>
            {/each}
          </div>
          <div class="mt-5 space-y-3 text-sm leading-relaxed text-[#4a3f31]">
            <p><strong>Minimum spend:</strong> {money(resolved.el.price)} — your table for the full night, up to {resolved.el.capacity} guests.</p>
            <p><strong>Dress code:</strong> Elegant chic. No sportswear, beachwear or party accessories. 18+ with valid ID.</p>
            <p><strong>Deposit policy:</strong> the {money(resolved.el.deposit)} deposit is <strong>non-refundable</strong> and is applied to your minimum spend on the night.</p>
          </div>
        </div>

        <div class="rounded-2xl bg-white shadow-sm p-6 sticky top-6">
          <span class="inline-block text-xs font-semibold text-white bg-[#3b6fe0] rounded-full px-3 py-1">Payment summary</span>
          <div class="flex justify-between items-baseline mt-4">
            <span class="font-semibold">Total price</span>
            <span class="text-2xl font-bold">{money(resolved.el.price)}</span>
          </div>
          <div class="border-t border-[#e5dac4] mt-3 pt-3 space-y-1.5 text-sm">
            <div class="flex justify-between"><span>Deposit (non-refundable)</span><span>{money(resolved.el.deposit)}</span></div>
            <div class="flex justify-between"><span>Administration fee</span><span>{money(adminFee)}</span></div>
          </div>
          <div class="border-t border-[#e5dac4] mt-3 pt-3 flex justify-between font-semibold">
            <span>To pay in advance</span><span>{money(dueNow)}</span>
          </div>
          <div class="flex justify-between text-sm text-[#8a7a64] mt-1">
            <span>Balance at the venue</span><span>{money(balance)}</span>
          </div>

          <div class="mt-6 space-y-3">
            <div>
              <label class="text-sm font-medium" for="fn">Full name</label>
              <input id="fn" class="w-full mt-1 rounded-lg border border-[#d8cbb2] bg-[#faf6ec] px-3 py-2.5 focus:outline-none focus:border-[#c97b3d]"
                bind:value={fullName} autocomplete="name" />
            </div>
            <div>
              <label class="text-sm font-medium" for="em">Email</label>
              <input id="em" type="email" class="w-full mt-1 rounded-lg border border-[#d8cbb2] bg-[#faf6ec] px-3 py-2.5 focus:outline-none focus:border-[#c97b3d]"
                bind:value={email} autocomplete="email" />
            </div>
            <div>
              <label class="text-sm font-medium" for="ph">Phone <span class="text-[#8a7a64] font-normal">(optional)</span></label>
              <input id="ph" type="tel" class="w-full mt-1 rounded-lg border border-[#d8cbb2] bg-[#faf6ec] px-3 py-2.5 focus:outline-none focus:border-[#c97b3d]"
                bind:value={phone} autocomplete="tel" />
            </div>
            <label class="flex items-start gap-2 text-xs text-[#5a4c3d] leading-relaxed cursor-pointer">
              <input type="checkbox" class="mt-0.5 accent-[#c97b3d]" bind:checked={agreed} />
              I understand the {money(resolved.el.deposit)} deposit is non-refundable and agree to the venue's dress code and entry policies.
            </label>
          </div>

          {#if errorMsg}<p class="text-sm text-red-600 mt-3">{errorMsg}</p>{/if}

          <button class="mt-5 w-full rounded-xl bg-[#c97b3d] hover:bg-[#b56a2f] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 transition-colors cursor-pointer"
            disabled={!valid || submitting} onclick={submit}>
            {submitting ? 'Reserving…' : `Reserve — ${money(dueNow)}`}
          </button>
          <p class="text-[11px] text-[#8a7a64] mt-2 text-center">
            Card payment via Stripe coming next — this records your reservation as pending.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>
