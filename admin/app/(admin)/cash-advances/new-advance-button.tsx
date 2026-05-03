'use client';

import { useState } from 'react';
import { AdvanceForm, type EmployeeOption, type EventOption } from './advance-form';

export function NewAdvanceButton({
  employees,
  events,
}: {
  employees: EmployeeOption[];
  events: EventOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Record advance
      </button>
      <AdvanceForm
        open={open}
        onClose={() => setOpen(false)}
        employees={employees}
        events={events}
      />
    </>
  );
}
