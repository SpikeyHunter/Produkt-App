// /src/lib/utils/compCsvExport.ts
import type { CompEntry } from '$lib/types/comptickets';

/**
 * Generates and downloads a CSV file from a list of comp entries.
 * This function correctly handles variable quantities per entry.
 * @param data - The array of comp entries to export.
 * @param fileName - The desired name for the downloaded file.
 */
export function exportCompsToCSV(data: CompEntry[], fileName: string) {
	const headers = ['Email', 'Quantity', 'Firstname', 'Lastname'];
	
	// Map the comp entry data to the correct CSV row format
	const rows = data.map((entry) => [
		entry.email,
		entry.quantity,
		entry.firstName,
		entry.lastName
	]);

	// Combine headers and rows into a single CSV string
	const csvContent = [
		headers.join(','),
		...rows.map((row) => row.join(','))
	].join('\n');

	// Create a Blob and trigger the download
	const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
	const link = document.createElement('a');
	const url = URL.createObjectURL(blob);

	link.setAttribute('href', url);
	link.setAttribute('download', fileName);
	link.style.visibility = 'hidden';

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}