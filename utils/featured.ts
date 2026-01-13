/**
 * Get the current date/time in Philippine Time (UTC+8)
 * @returns Date object adjusted to UTC+8
 */
export function getPHTime(): Date {
    const now = new Date();
    // Convert to UTC then add 8 hours for PH time (UTC+8)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (8 * 3600000));
}

/**
 * Get the start of today in Philippine Time (UTC+8)
 * @returns Date object representing 00:00:00 of today in PH time
 */
export function getPHTodayStart(): Date {
    const phNow = getPHTime();
    const start = new Date(phNow);
    start.setHours(0, 0, 0, 0);
    return start;
}

/**
 * Get the end of today in Philippine Time (UTC+8)
 * @returns Date object representing 23:59:59.999 of today in PH time
 */
export function getPHTodayEnd(): Date {
    const phNow = getPHTime();
    const end = new Date(phNow);
    end.setHours(23, 59, 59, 999);
    return end;
}

/**
 * Get the day of year (1-366) for a given date
 * @param date - Date to calculate day of year for (defaults to current PH time)
 * @returns Day of year (1-366)
 */
export function getDayOfYear(date?: Date): number {
    const targetDate = date || getPHTime();
    const start = new Date(targetDate.getFullYear(), 0, 0);
    const diff = targetDate.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}
