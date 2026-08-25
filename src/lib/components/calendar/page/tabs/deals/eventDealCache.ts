// eventDealCache.ts
// event_deal payloads saved during this page session, keyed by calendar + version.
// The calendar page renders tabs through <svelte:component>, so switching tabs
// destroys a tab and re-passes the event_deal captured at page load. Any tab
// that writes event_deal (Deals, T&C) records the fresh payload here so a
// remounted tab prefers it over the stale page-load snapshot. Cleared on page
// reload, when the DB is the source of truth again.

const savedDealPayloads = new Map<string, any>();

export function dealCacheKey(event: any, viewedVersionNum: number): string {
	const id = event?.calendar?.id || event?.group_id || event?.id;
	return `${id ?? 'unknown'}:${viewedVersionNum}`;
}

export function getCachedDealPayload(event: any, viewedVersionNum: number): any {
	return savedDealPayloads.get(dealCacheKey(event, viewedVersionNum));
}

export function setCachedDealPayload(event: any, viewedVersionNum: number, payload: any): void {
	savedDealPayloads.set(dealCacheKey(event, viewedVersionNum), payload);
}
