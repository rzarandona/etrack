'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Employee, Rate } from '@/lib/types';
import { createEmployee, updateEmployee } from './actions';
import { PhotoInput } from './photo-input';
import { RateSelect } from './rate-select';

type Props = {
  rates: Rate[];
  employee?: Employee;
  photoUrl?: string | null;
};

export function EmployeeForm({ rates, employee, photoUrl }: Props) {
  const router = useRouter();
  const isEdit = Boolean(employee);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [fullName, setFullName] = useState<string>(employee?.full_name ?? '');

  const onSubmit = (fd: FormData) => {
    start(async () => {
      setError(null);
      const r = isEdit ? await updateEmployee(employee!.id, fd) : await createEmployee(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const newId = r.id ?? employee?.id;
      if (newId) router.push(`/employees/${newId}`);
      else router.push('/employees');
      router.refresh();
    });
  };

  const mapsHref = (() => {
    const a = employee?.home_address;
    if (a) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
    return 'https://www.google.com/maps';
  })();

  return (
    <form action={onSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--rose-soft)', color: 'var(--accent-deep)' }}>
          {error}
        </div>
      )}

      {/* PHOTO + IDENTITY */}
      <div className="card p-5 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <PhotoInput initialUrl={photoUrl ?? null} />
        </div>
        <div className="space-y-4 md:col-span-2">
          <label className="block">
            <span className="label">Full name <span style={{ color: 'var(--accent-deep)' }}>*</span></span>
            <input
              name="full_name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase' }}
              autoComplete="off"
              className="input"
            />
          </label>

          <RateSelect rates={rates} initialValue={employee?.hourly_rate ?? null} />

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Birthdate <span style={{ color: 'var(--accent-deep)' }}>*</span></span>
              <input
                name="birthdate"
                type="date"
                required
                defaultValue={employee?.birthdate ?? ''}
                className="input"
              />
            </label>
            <label className="block">
              <span className="label">Contact number <span style={{ color: 'var(--accent-deep)' }}>*</span></span>
              <input
                name="contact_no"
                type="tel"
                required
                placeholder="+63 912 345 6789"
                defaultValue={employee?.contact_no ?? ''}
                className="input"
              />
            </label>
          </div>
        </div>
      </div>

      {/* HOME ADDRESS */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold">Home address</h3>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Required. Lat/lng are optional; you can fill them by picking a pin in Google Maps.
            </p>
          </div>
          <a href={mapsHref} target="_blank" rel="noreferrer" className="btn-secondary !py-2 !px-3 !text-xs">
            Pick on Google Maps ↗
          </a>
        </div>
        <label className="block mb-3">
          <span className="label">Address <span style={{ color: 'var(--accent-deep)' }}>*</span></span>
          <textarea
            name="home_address"
            required
            rows={2}
            defaultValue={employee?.home_address ?? ''}
            placeholder="Street, barangay, city, province"
            className="input"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Latitude (optional)</span>
            <input
              name="home_latitude"
              type="number"
              step="0.000001"
              defaultValue={employee?.home_latitude ?? ''}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Longitude (optional)</span>
            <input
              name="home_longitude"
              type="number"
              step="0.000001"
              defaultValue={employee?.home_longitude ?? ''}
              className="input"
            />
          </label>
        </div>
      </div>

      {/* EMERGENCY CONTACT */}
      <div className="card p-5">
        <h3 className="text-base font-bold mb-1">Emergency contact</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>Optional.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Name</span>
            <input
              name="emergency_contact_name"
              defaultValue={employee?.emergency_contact_name ?? ''}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Number</span>
            <input
              name="emergency_contact_number"
              type="tel"
              defaultValue={employee?.emergency_contact_number ?? ''}
              className="input"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create employee'}
        </button>
      </div>
    </form>
  );
}
