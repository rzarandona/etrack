'use client';

import { useRouter } from 'next/navigation';

export function StatusFilter({ current }: { current?: string }) {
  const router = useRouter();
  return (
    <select
      defaultValue={current ?? ''}
      onChange={(e) => {
        const v = e.currentTarget.value;
        router.push(v ? `/events?status=${v}` : '/events');
      }}
      className="input !py-1.5 !px-3 !text-xs w-auto">
      <option value="">All statuses</option>
      <option value="planned">Planned</option>
      <option value="in_progress">In progress</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
    </select>
  );
}
