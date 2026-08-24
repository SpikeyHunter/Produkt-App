<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		normalizeStatus,
		statusPillClass,
		statusDotClass,
		formatShortDate,
		formatMoney,
		highlightSegments
	} from '$lib/components/booking/talentpayments/paymentStatus';

	export let artist: any;
	export let selected = false;
	export let showEventName = false;
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

<!-- All accents use the `lime` Tailwind token. The scoped CSS handles geometry
     only — it never sets border-color or text colour. -->
<button
	class="artist-card group {selected
		? 'border-lime ring-1 ring-lime'
		: 'border-white/10 hover:border-white/25'}"
	on:click={() => dispatch('click', artist)}
>
	<!-- Background layer is absolutely positioned, so the <img>'s intrinsic pixel
	     size can never influence layout. The card's height comes purely from the
	     grid track (grid-auto-rows), which is why it can't pop or scale on a
	     cold first paint anymore. -->
	<span class="card-bg">
		{#if artist.event_flyer}
			<img src={artist.event_flyer} alt="" loading="lazy" decoding="async" />
			<span class="card-scrim"></span>
		{:else}
			<span class="card-scrim card-scrim--solid"></span>
		{/if}
	</span>

	<span class="card-body">
		<span class="card-top">
			<span class="card-title text-white group-hover:text-lime">
				{#each nameParts as seg}
					{#if seg.hit}<mark class="tp-hl">{seg.text}</mark>{:else}{seg.text}{/if}
				{/each}
			</span>

			<span class="card-meta">
				<span class="card-date text-lime">{formatShortDate(artist.eventDateDisplay)}</span>
				{#if showEventName && artist.eventNameDisplay}
					<span class="card-event text-white/60">{artist.eventNameDisplay}</span>
				{/if}
			</span>
		</span>

		<span class="card-bottom">
			<span class="card-delivery">
				<span class="text-white/45">Delivery</span>
				<span class="font-bold text-white">{delivery}</span>
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

			<span class="card-status-row">
				<span class={statusPillClass(status)}>
					<span class={statusDotClass(status)}></span>
					{status}
				</span>
				<span class="card-amount text-lime">{formatMoney(amount)}</span>
			</span>
		</span>
	</span>
</button>

<style>
	.artist-card {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%; /* fills the fixed grid row — no aspect-ratio guesswork */
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border-radius: 14px;
		/* width/style only — colour is owned by the Tailwind classes above */
		border-width: 1px;
		border-style: solid;
		background: #141414;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
		contain: layout paint;
	}

	.card-bg {
		position: absolute;
		inset: 0;
		z-index: 0;
		display: block;
		background: #141414;
	}

	.card-bg img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.34;
		transition: opacity 0.15s ease;
	}

	.artist-card:hover .card-bg img {
		opacity: 0.22;
	}

	.card-scrim {
		position: absolute;
		inset: 0;
		display: block;
		background: linear-gradient(
			to top,
			rgb(0 0 0 / 0.95) 0%,
			rgb(0 0 0 / 0.8) 45%,
			rgb(0 0 0 / 0.45) 100%
		);
	}

	.card-scrim--solid {
		background: linear-gradient(to top, rgb(0 0 0 / 0.6), rgb(255 255 255 / 0.02));
	}

	.card-body {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		height: 100%;
		padding: 12px;
		gap: 8px;
	}

	.card-top {
		display: block;
		min-width: 0;
	}

	.card-title {
		display: -webkit-box;
		font-size: 15px;
		font-weight: 800;
		line-height: 1.15;
		letter-spacing: -0.015em;
		overflow: hidden;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		transition: color 0.15s ease;
	}

	.card-meta {
		display: flex;
		flex-direction: column;
		gap: 1px;
		margin-top: 4px;
		min-width: 0;
	}

	.card-date {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.card-event {
		font-size: 11px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-bottom {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	.card-delivery {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 10px;
		white-space: nowrap;
	}

	.card-status-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding-top: 8px;
		border-top: 1px solid rgb(255 255 255 / 0.1);
		min-width: 0;
	}

	.card-amount {
		font-size: 15px;
		font-weight: 800;
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