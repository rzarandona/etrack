import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContactSuggestion } from './event-form';

/**
 * Pull distinct typeahead suggestions from prior events:
 *   - titles
 *   - contact_person → contact_phone (most-recent phone wins per person)
 *   - venues
 *   - contract prices
 */
export async function fetchEventSuggestions(supabase: SupabaseClient): Promise<{
  titles: string[];
  contacts: ContactSuggestion[];
  venues: string[];
  contractPrices: string[];
}> {
  const { data } = await supabase
    .from('events')
    .select('title, contact_person, contact_phone, venue, contract_price, created_at')
    .order('created_at', { ascending: false });

  const titleSet = new Set<string>();
  const contactMap = new Map<string, string | null>();
  const venueSet = new Set<string>();
  const priceSet = new Set<string>();

  for (const row of (data ?? []) as {
    title: string | null;
    contact_person: string | null;
    contact_phone: string | null;
    venue: string | null;
    contract_price: string | null;
  }[]) {
    if (row.title) titleSet.add(row.title);
    if (row.contact_person && !contactMap.has(row.contact_person)) {
      contactMap.set(row.contact_person, row.contact_phone);
    }
    if (row.venue) venueSet.add(row.venue);
    if (row.contract_price) priceSet.add(String(row.contract_price));
  }

  const titles = [...titleSet].sort((a, b) => a.localeCompare(b));
  const contacts: ContactSuggestion[] = [...contactMap.entries()]
    .map(([person, phone]) => ({ person, phone }))
    .sort((a, b) => a.person.localeCompare(b.person));
  const venues = [...venueSet].sort((a, b) => a.localeCompare(b));
  const contractPrices = [...priceSet].sort((a, b) => Number(b) - Number(a));

  return { titles, contacts, venues, contractPrices };
}
