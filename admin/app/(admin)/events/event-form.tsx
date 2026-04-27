'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { formatMoney } from '@/lib/format';
import type { EventRecord } from '@/lib/types';
import { createEvent, updateEvent } from './actions';

export type ContactSuggestion = { person: string; phone: string | null };

type Props = {
  event?: EventRecord;
  /** Distinct event titles from prior events. */
  titles?: string[];
  /** Distinct contact_person → contact_phone pairs from prior events. */
  contacts?: ContactSuggestion[];
  /** Distinct venue strings from prior events. */
  venues?: string[];
  /** Distinct contract prices from prior events (descending). */
  contractPrices?: string[];
};

const WORKFORCE_OPTIONS = ['1-5', '6-10', '11-16', '17-20', '21-30'] as const;

const LABOR_PCT_MIN = 0.4;
const LABOR_PCT_MAX = 0.5;

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventForm({
  event,
  titles = [],
  contacts = [],
  venues = [],
  contractPrices = [],
}: Props) {
  const router = useRouter();
  const isEdit = Boolean(event);
  const uid = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [contractPrice, setContractPrice] = useState<string>(
    event?.contract_price != null ? String(event.contract_price) : ''
  );

  const [contactPerson, setContactPerson] = useState<string>(event?.contact_person ?? '');
  const [contactPhone, setContactPhone] = useState<string>(
    event?.contact_phone != null ? String(event.contact_phone) : ''
  );

  const onContactPersonChange = (value: string) => {
    setContactPerson(value);
    // If the typed/selected value exactly matches a known contact, auto-fill
    // the phone (only when the phone field is empty so we don't clobber edits).
    const match = contacts.find((c) => c.person === value);
    if (match?.phone && contactPhone.trim() === '') {
      setContactPhone(match.phone);
    }
  };

  const priceNum = Number(contractPrice);
  const hasPrice = contractPrice.trim() !== '' && Number.isFinite(priceNum) && priceNum > 0;
  const laborMin = hasPrice ? priceNum * LABOR_PCT_MIN : 0;
  const laborMax = hasPrice ? priceNum * LABOR_PCT_MAX : 0;

  const onSubmit = (fd: FormData) => {
    start(async () => {
      setError(null);
      const r = isEdit ? await updateEvent(event!.id, fd) : await createEvent(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const id = r.id ?? event?.id;
      router.push(id ? `/events/${id}` : '/events');
      router.refresh();
    });
  };

  return (
    <form action={onSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl px-3 py-2 text-sm bg-rose-soft text-deep">{error}</div>
      )}

      <div className="card p-5 space-y-4">
        <h3 className="text-base font-bold">Event details</h3>
        <label className="block">
          <span className="label">Title <span className="text-deep">*</span></span>
          <input
            name="title"
            list={`${uid}-titles`}
            required
            defaultValue={event?.title ?? ''}
            placeholder="Type or pick from list"
            autoComplete="off"
            className="input"
          />
          <datalist id={`${uid}-titles`}>
            {titles.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Contact person</span>
            <input
              name="contact_person"
              list={`${uid}-contacts`}
              value={contactPerson}
              onChange={(e) => onContactPersonChange(e.target.value)}
              autoComplete="off"
              placeholder="Type or pick from list"
              className="input"
            />
            <datalist id={`${uid}-contacts`}>
              {contacts.map((c) => (
                <option key={c.person} value={c.person}>
                  {c.phone ? `· ${c.phone}` : ''}
                </option>
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="label">Contact phone</span>
            <input
              name="contact_phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              autoComplete="off"
              className="input"
            />
          </label>
        </div>
        <label className="block">
          <span className="label">Venue</span>
          <input
            name="venue"
            list={`${uid}-venues`}
            defaultValue={event?.venue ?? ''}
            placeholder="Type or pick from list"
            autoComplete="off"
            className="input"
          />
          <datalist id={`${uid}-venues`}>
            {venues.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Latitude (optional)</span>
            <input
              name="venue_latitude"
              type="number"
              step="0.000001"
              defaultValue={event?.venue_latitude ?? ''}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Longitude (optional)</span>
            <input
              name="venue_longitude"
              type="number"
              step="0.000001"
              defaultValue={event?.venue_longitude ?? ''}
              className="input"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Starts at <span className="text-deep">*</span></span>
            <input
              name="starts_at"
              type="datetime-local"
              required
              defaultValue={toLocalInput(event?.starts_at ?? null)}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Ends at</span>
            <input
              name="ends_at"
              type="datetime-local"
              defaultValue={toLocalInput(event?.ends_at ?? null)}
              className="input"
            />
          </label>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="text-base font-bold">Budget</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block">
            <span className="label">Contract price</span>
            <input
              name="contract_price"
              type="number"
              step="0.01"
              list={`${uid}-prices`}
              value={contractPrice}
              onChange={(e) => setContractPrice(e.target.value)}
              autoComplete="off"
              className="input"
            />
            <datalist id={`${uid}-prices`}>
              {contractPrices.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="label">Workforce needed</span>
            <select
              name="workforce_needed"
              defaultValue={event?.workforce_needed ?? ''}
              className="input">
              <option value="">— Select —</option>
              {WORKFORCE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          <div className="block">
            <span className="label">Labor budget range (40–50%)</span>
            <div className="input flex items-center justify-between bg-soft tabular-nums">
              {hasPrice ? (
                <span className="font-semibold">
                  {formatMoney(laborMin)} <span className="text-muted">–</span> {formatMoney(laborMax)}
                </span>
              ) : (
                <span className="text-muted">enter contract price</span>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted">
          Workforce needed is a planning estimate. Labor budget range is a fixed 40–50% of the contract
          price — used to suggest per-employee per-phase pay rates once crew is actually assigned.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="text-base font-bold">Notes & status</h3>
        {isEdit && (
          <label className="block">
            <span className="label">Status</span>
            <select name="status" defaultValue={event?.status ?? 'planned'} className="input">
              <option value="planned">Planned</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        )}
        {!isEdit && <input type="hidden" name="status" value="planned" />}
        <label className="block">
          <span className="label">Notes</span>
          <textarea name="notes" rows={3} defaultValue={event?.notes ?? ''} className="input" />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => router.back()} disabled={pending} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
        </button>
      </div>
    </form>
  );
}
