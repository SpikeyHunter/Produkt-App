// src/lib/utils/formatters.ts
// It's good practice to move utility functions like these into their own file.

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00';
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatEventDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';

  // Using UTC methods to avoid timezone issues
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatGenre(genre: string | null | undefined): string {
  if (!genre) return '';
  const genreLower = genre.toLowerCase();

  switch (genreLower) {
    case 'edm': return 'EDM';
    case 'hiphop':
    case 'hip-hop':
    case 'hip hop': return 'Hip-Hop';
    case 'dnb':
    case 'd&b':
    case 'drum and bass': return 'DnB';
    case 'n/a': return 'N/A';
    default:
      return genre.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
  }
}
