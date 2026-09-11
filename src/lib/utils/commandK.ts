/**
 * Who owns ⌘K right now.
 *
 * The layout's document palette listens for ⌘K everywhere; the calendar and
 * talent-payments pages have palettes of their own. A page palette claims the
 * shortcut while it's mounted (and usable), and the global one steps aside —
 * so the two never open on top of each other.
 */
let claims = 0;

/** Claim ⌘K for a page palette. Returns the release function. */
export function claimCommandK(): () => void {
	claims++;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		claims = Math.max(0, claims - 1);
	};
}

export function commandKClaimed(): boolean {
	return claims > 0;
}
