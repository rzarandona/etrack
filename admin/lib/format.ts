const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

const MONEY_FMT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format a number/string as currency-style with thousand separators, no
 * symbol, no decimals. e.g. 1234.56 -> "1,235". Returns "" for null/empty.
 */
export function formatMoney(value: number | string | null | undefined): string {
  if (value == null || value === '') return '';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '';
  return MONEY_FMT.format(n);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Formats a Date or ISO string as "Apr 27, 2026 02:35:42 PM" — i.e. PHP-style
 * `M d, Y h:i:s A` rendered in the user's local timezone. Used for scan
 * timestamps where second-level precision matters.
 */
export function formatScanWhen(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const h24 = d.getHours();
  const h12 = ((h24 + 11) % 12) + 1; // 0→12, 13→1, …
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(h12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
}

/**
 * Formats a Date or ISO string as "Apr 27, 2026 02:35 PM" — same shape as
 * formatScanWhen but without seconds. Used for event start/end times,
 * recent activity rows, and anywhere second-level precision is noise.
 */
export function formatDateTime(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const h24 = d.getHours();
  const h12 = ((h24 + 11) % 12) + 1;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(h12)}:${pad(d.getMinutes())} ${ampm}`;
}
