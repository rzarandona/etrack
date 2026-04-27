const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Formats a Date or ISO string as "Apr 27, 2026 02:35:42 PM" — i.e. PHP-style
 * `M d, Y h:i:s A` rendered in the user's local timezone.
 */
export function formatScanWhen(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const h24 = d.getHours();
  const h12 = ((h24 + 11) % 12) + 1; // 0→12, 13→1, …
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${MONTHS[d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()} ${pad(h12)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
}
