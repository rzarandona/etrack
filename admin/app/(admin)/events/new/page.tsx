import Link from 'next/link';
import { getSupabaseServer } from '@/lib/supabase/server';
import { EventForm } from '../event-form';
import { fetchEventSuggestions } from '../suggestions';

export default async function NewEventPage() {
  const supabase = await getSupabaseServer();
  const { titles, contacts, venues, contractPrices } = await fetchEventSuggestions(supabase);

  return (
    <div>
      <div className="mb-5">
        <Link href="/events" className="text-sm font-semibold text-muted hover:underline">
          ← Events
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">New event</h1>
        <p className="text-sm mt-1 text-muted">
          Three default phases (Ingress / Event Proper / Egress) are added on save. Edit them on the
          event detail page.
        </p>
      </div>
      <EventForm titles={titles} contacts={contacts} venues={venues} contractPrices={contractPrices} />
    </div>
  );
}
