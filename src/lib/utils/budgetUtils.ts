// A utility function for formatting money as you requested.

/**
 * Formats a number as a currency string, e.g., "1,000,000.00$" or "(1,000,000.00$)"
 */
export function formatMoney(amount: number | null | undefined): string {
	const num = Number(amount) || 0;
	const options: Intl.NumberFormatOptions = {
		minimumFractionDigits: 2, // Always show 2 decimal places
		maximumFractionDigits: 2  // Always show 2 decimal places
	};

	const formatted = num.toLocaleString('en-US', options);

	if (num < 0) {
		return `(${formatted.replace('-', '')}$)`;
	}
	return `${formatted}$`;
}