// src/lib/utils/csvExport.ts

import type { Customer } from '$lib/services/customersService';

/**
 * Generates and downloads a CSV file from a list of customers.
 * @param customers - The array of customer objects to export.
 * @param ticketCount - The number of tickets to assign to each customer.
 * @param filters - A string describing the filters applied, for the filename.
 */
export function exportCustomersToCSV(customers: Customer[], ticketCount: number, filters: string = 'Customer_List') {
  // 1. Define CSV headers
  const headers = ['Email', 'Quantity', 'Firstname', 'Lastname'];
  
  // 2. Map customer data to CSV rows, ensuring efficiency
  // This avoids creating a large intermediate array of strings.
  // Instead, we create an array of arrays, which is more memory-efficient.
  const rows = customers.map(customer => [
    customer.user_mail || '',
    ticketCount,
    customer.user_first_name || '',
    customer.user_last_name || ''
  ]);

  // 3. Combine headers and rows into a single CSV string
  // Using .join() is highly performant for large arrays.
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // 4. Create the filename with the specified format
  const date = new Date();
  const dateString = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
  const fileName = `${dateString} - ${filters.replace(/ /g, '_')}.csv`;

  // 5. Create a Blob and trigger the download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.href) {
    URL.revokeObjectURL(link.href);
  }
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}