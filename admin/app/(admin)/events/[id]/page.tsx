import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EventStatusPill } from '@/lib/components/pills';
import { formatDateTime } from '@/lib/format';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { EventPhase, EventRecord } from '@/lib/types';
import {
  AssignmentPanel,
  type AssignableUser,
  type AssignmentRow,
} from './assignment-panel';
import { DeleteEventButton } from './delete-button';
import { PhaseEditor } from './phase-editor';
import { SuggestedPayRate } from './suggested-pay-rate';

type AssignmentJoined = {
  id: string;
  user_id: string;
  role: 'supervisor' | 'employee';
  pay_rate_override: string | null;
  user: { full_name: string } | null;
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServer();

  const [{ data: eventData }, { data: phasesData }, { data: assignmentsData }, { data: usersData }, { data: employeesData }] =
    await Promise.all([
      supabase.from('events').select('*').eq('id', id).single(),
      supabase
        .from('event_phases')
        .select('*')
        .eq('event_id', id)
        .order('ord'),
      supabase
        .from('event_assignments')
        .select('id, user_id, role, pay_rate_override, user:user_profiles(full_name)')
        .eq('event_id', id),
      supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .in('role', ['admin', 'supervisor', 'employee'])
        .eq('active', true)
        .order('full_name'),
      supabase
        .from('employees')
        .select('user_profile_id, employee_code')
        .not('user_profile_id', 'is', null),
    ]);

  if (!eventData) notFound();
  const event = eventData as EventRecord;
  const phases = (phasesData as EventPhase[]) ?? [];
  const assignmentsRaw = (assignmentsData as unknown as AssignmentJoined[]) ?? [];
  const profiles = (usersData ?? []) as AssignableUser[];
  const empCodeByUser: Record<string, string> = {};
  for (const e of (employeesData ?? []) as { user_profile_id: string; employee_code: string }[]) {
    empCodeByUser[e.user_profile_id] = e.employee_code;
  }

  const assignments: AssignmentRow[] = assignmentsRaw.map((a) => ({
    id: a.id,
    user_id: a.user_id,
    role: a.role,
    pay_rate_override: a.pay_rate_override,
    user_full_name: a.user?.full_name ?? '(unknown)',
    employee_code: empCodeByUser[a.user_id] ?? null,
  }));

  const assignableUsers: AssignableUser[] = profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role,
    employee_code: empCodeByUser[p.id] ?? null,
  }));

  const employeeCount = assignments.filter((a) => a.role === 'employee').length;
  const phaseCount = phases.length;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <Link href="/events" className="text-sm font-semibold text-muted hover:underline">
            ← Events
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{event.title}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted">
            <EventStatusPill status={event.status} />
            <span>·</span>
            <span>{formatDateTime(event.starts_at)}</span>
            {event.ends_at && (
              <>
                <span>→</span>
                <span>{formatDateTime(event.ends_at)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/events/${event.id}/edit`} className="btn-primary">
            Edit
          </Link>
          <DeleteEventButton id={event.id} title={event.title} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <PhaseEditor eventId={event.id} phases={phases} />
          <AssignmentPanel
            eventId={event.id}
            assignments={assignments}
            assignableUsers={assignableUsers}
          />
        </div>

        <div className="space-y-5">
          <SuggestedPayRate
            contractPrice={event.contract_price ? Number(event.contract_price) : null}
            laborMin={Number(event.labor_budget_pct_min)}
            laborMax={Number(event.labor_budget_pct_max)}
            employeeCount={employeeCount}
            phaseCount={phaseCount}
          />

          <div className="card p-5 text-sm">
            <h2 className="text-base font-bold mb-2">Customer & venue</h2>
            <dl className="space-y-2">
              <Field label="Contact" value={event.contact_person} />
              <Field label="Phone" value={event.contact_phone} mono />
              <Field label="Venue" value={event.venue} />
              {event.venue_latitude && event.venue_longitude && (
                <Field
                  label="Coords"
                  value={`${event.venue_latitude}, ${event.venue_longitude}`}
                  mono
                />
              )}
              <Field label="Workforce needed" value={event.workforce_needed} />
            </dl>
          </div>

          {event.notes && (
            <div className="card p-5 text-sm">
              <h2 className="text-base font-bold mb-1">Notes</h2>
              <p className="whitespace-pre-wrap text-muted">{event.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className={mono ? 'font-mono' : undefined}>
        {value ?? <span className="text-muted">—</span>}
      </dd>
    </div>
  );
}
