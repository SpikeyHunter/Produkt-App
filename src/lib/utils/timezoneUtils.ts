export function isDaylightSavingTime(date: Date): boolean {
	const year = date.getFullYear();
	const marchStart = new Date(year, 2, 1);
	const daysUntilSunday = (7 - marchStart.getDay()) % 7;
	const dstStart = new Date(year, 2, 8 + daysUntilSunday, 2, 0, 0);
	const novStart = new Date(year, 10, 1);
	const daysUntilSundayNov = (7 - novStart.getDay()) % 7;
	const dstEnd = new Date(year, 10, 1 + daysUntilSundayNov, 2, 0, 0);
	return date >= dstStart && date < dstEnd;
}