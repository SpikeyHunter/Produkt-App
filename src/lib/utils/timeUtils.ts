export function calculateHours(start: string, end: string): number {
  if (!start || !end) return 0;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  const date1 = new Date(2000, 0, 1, h1, m1);
  const date2 = new Date(2000, 0, 1, h2, m2);
  
  // Handle overnight shifts if needed (end time < start time)
  if (date2 < date1) date2.setDate(date2.getDate() + 1);
  
  return Math.round(((date2.getTime() - date1.getTime()) / 1000 / 60 / 60) * 10) / 10;
}

export function getWeekRangeString(startDateStr: string) {
    const start = new Date(startDateStr + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}