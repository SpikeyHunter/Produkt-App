<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		normalizeStatus,
		statusPillClass,
		statusDotClass,
		formatCompactDate,
		formatMoney,
		highlightSegments
	} from '$lib/components/booking/talentpayments/paymentStatus';

	export let artist: any;
	export let selected = false;
	/** Active ⌘K query — matched part of the artist name gets a lime highlight. */
	export let query = '';

	const dispatch = createEventDispatcher();

	$: status = normalizeStatus(artist?.paymentData?.status);
	$: amount = artist?.paymentData?.amount ?? 150;
	$: delivery = artist?.paymentData?.delivery_method || 'Pick Up';
	$: hasInvoice = !!artist?.paymentData?.invoice_url;

	// Only the artist name is searchable, so it's the only thing highlighted.
	$: nameParts = highlightSegments(artist?.artist_name, query);
</script>

<!-- Every accent colour comes from the `lime` Tailwind token so it always matches
     the rest of the app. The scoped CSS below only handles geometry (it never
     sets border-color or text colour) so these utility classes always win. -->
<button
	class="tp-row group {selected
		? 'border-lime bg-lime/10'
		: 'border-transparent hover:border-white/10 hover:bg-white/5'}"
	on:click={() => dispatch('click', artist)}
	title={artist?.artist_name}
>
	<span class="tp-thumb">
		{#if artist.event_flyer}
			<img src={artist.event_flyer} alt="" loading="lazy" decoding="async" />
		{/if}
	</span>

	<span class="tp-cell tp-name text-white group-hover:text-lime">
		<span class="tp-truncate">
			{#each nameParts as seg}
				{#if seg.hit}<mark class="tp-hl">{seg.text}</mark>{:else}{seg.text}{/if}
			{/each}
		</span>
		{#if hasInvoice}
			<svg
				class="h-3 w-3 flex-shrink-0 text-lime"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				viewBox="0 0 24 24"
				aria-label="Invoice uploaded"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
			</svg>
		{/if}
	</span>

	<span class="tp-cell tp-event text-white/55">
		<span class="tp-truncate">{artist.eventNameDisplay || '—'}</span>
	</span>

	<span class="tp-cell tp-meta text-white/65">
		{formatCompactDate(artist.eventDateDisplay)}
	</span>

	<span class="tp-cell tp-meta text-white/65">
		{delivery}
	</span>

	<span class="tp-cell">
		<span class={statusPillClass(status)}>
			<span class={statusDotClass(status)}></span>
			{status}
		</span>
	</span>

	<span class="tp-cell tp-amount text-lime">
		{formatMoney(amount)}
	</span>
</button>

<style>
	.tp-row {
		display: grid;
		/* --tp-cols is set once on the list wrapper in +page.svelte, so the header
		   and every row share exactly the same track sizes. Custom properties
		   inherit across component boundaries — the columns cannot drift. */
		grid-template-columns: var(--tp-cols);
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 46px; /* fixed height => rows never reflow or jump */
		padding: 0 12px;
		/* width/style only — colour is owned by the Tailwind classes above */
		border-width: 1px;
		border-style: solid;
		border-radius: 12px;
		background-color: transparent;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.12s ease,
			border-color 0.12s ease,
			color 0.12s ease;
		contain: layout paint;
	}

	.tp-thumb {
		position: relative;
		display: block;
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		overflow: hidden;
		border-radius: 8px;
		background: rgb(255 255 255 / 0.06);
	}

	.tp-thumb img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.tp-cell {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		overflow: hidden;
	}

	.tp-name {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.tp-event {
		font-size: 12px;
		font-weight: 500;
	}

	.tp-meta {
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
	}

	.tp-amount {
		justify-content: flex-end;
		font-size: 13px;
		font-weight: 700;
		white-space: nowrap;
	}

	.tp-truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Search hit — lime wash, never the browser's default yellow. */
	.tp-hl {
		border-radius: 3px;
		padding: 0 1px;
		background: rgb(198 255 0 / 0.26);
		color: inherit;
	}
</style>