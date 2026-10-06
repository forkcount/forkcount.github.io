/**
 * Centralized date utility to ensure all date handling across ForkCount
 * uses the user's LOCAL date, never UTC.
 * 
 * Prevents 11pm logs from rolling over to tomorrow's date.
 */

export function formatLocalDate(d: Date | string = new Date()): string {
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    d = parseLocalDate(trimmed);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date();
  }
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m, d, 0, 0, 0, 0);
    }
  }
  return new Date();
}

export function getTodayLocalDateString(): string {
  return formatLocalDate(new Date());
}

export function addDaysLocal(base: Date | string, days: number): string {
  const d = typeof base === 'string' ? parseLocalDate(base) : new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export function getYesterdayLocalDateString(): string {
  return addDaysLocal(new Date(), -1);
}
