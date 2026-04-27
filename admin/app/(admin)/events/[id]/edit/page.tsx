import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { EventRecord } from '@/lib/types';
import { EventForm } from '../../event-form';
import { fetchEventSuggestions } from '../../suggestions';

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();
  const [{ data }, { titles, contacts, venues, contractPrices }] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).single(),
    fetchEventSuggestions(supabase),
  ]);
  if (!data) notFound();
  const event = data as EventRecord;

  return (
    <div>
      <div className="mb-5">
        <Link href={`/events/${id}`} className="text-sm font-semibold text-muted hover:underline">
          ← {event.title}
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Edit event</h1>
      </div>
      <EventForm event={event} titles={titles} contacts={contacts} venues={venues} contractPrices={contractPrices} />
    </div>
  );
}
