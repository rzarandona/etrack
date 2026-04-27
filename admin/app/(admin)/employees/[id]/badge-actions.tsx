'use client';

import { useState } from 'react';

type Props = {
  qrUrl: string | null;
  employeeCode: string;
};

/**
 * View + Download buttons for an employee's pre-generated QR badge. Renders
 * a lightbox with the QR at print-friendly size, and a Download button that
 * fetches the signed URL and saves the PNG with the employee_code as the
 * filename.
 */
export function BadgeActions({ qrUrl, employeeCode }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!qrUrl) {
    return (
      <p className="text-xs text-muted text-center">
        QR badge not generated yet — saving the employee will generate one.
      </p>
    );
  }

  const download = async () => {
    setBusy(true);
    try {
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${employeeCode}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Download failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex gap-2 justify-center">
        <button onClick={() => setOpen(true)} className="btn-secondary !py-1.5 !px-3 !text-xs">
          View QR
        </button>
        <button onClick={download} disabled={busy} className="btn-primary !py-1.5 !px-3 !text-xs">
          {busy ? 'Downloading…' : 'Download badge'}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}>
          <div
            className="card relative p-6 flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-xl flex items-center justify-center shadow text-ink">
              ×
            </button>
            <div className="text-xs uppercase tracking-wide text-muted">
              {employeeCode}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`QR badge for ${employeeCode}`}
              className="w-80 h-80 rounded-lg ring-soft bg-white p-2"
            />
            <button onClick={download} disabled={busy} className="btn-primary">
              {busy ? 'Downloading…' : 'Download PNG'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
