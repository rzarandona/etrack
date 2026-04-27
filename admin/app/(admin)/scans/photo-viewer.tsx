'use client';

import { useState } from 'react';

/**
 * Renders the verification photo as a small thumbnail when one exists, and a
 * muted user-icon placeholder when it doesn't. Clicking a real thumbnail
 * opens a full-size lightbox.
 */
export function PhotoThumb({ url }: { url: string | null }) {
  const [open, setOpen] = useState(false);
  const [thumbLoaded, setThumbLoaded] = useState(false);

  if (!url) {
    return (
      <div
        className="inline-flex h-10 w-10 items-center justify-center rounded-md ring-soft"
        style={{ background: 'var(--hover-soft)', color: 'var(--muted)' }}
        title="No verification photo"
        aria-label="No verification photo">
        <UserIcon />
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-block h-10 w-10 overflow-hidden rounded-md ring-soft hover:opacity-90 transition"
        style={{ background: 'var(--hover-soft)' }}
        title="View verification photo"
        aria-label="View verification photo">
        {!thumbLoaded && (
          <span
            className="absolute inset-0 animate-pulse"
            style={{ background: 'var(--hover-soft)' }}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Verification"
          loading="lazy"
          decoding="async"
          onLoad={() => setThumbLoaded(true)}
          className={`relative h-full w-full object-cover transition-opacity duration-300 ${
            thumbLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </button>
      {open && <Lightbox url={url} onClose={() => setOpen(false)} />}
    </>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}>
      <div
        className="card relative max-h-[90vh] max-w-[90vw] p-2"
        onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-xl flex items-center justify-center shadow"
          style={{ color: 'var(--ink)' }}>
          ×
        </button>
        <div className="relative min-w-[280px] min-h-[200px] flex items-center justify-center">
          {!loaded && (
            <div
              className="absolute inset-0 rounded-xl animate-pulse"
              style={{ background: 'var(--hover-soft)' }}
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Verification photo"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`max-h-[85vh] max-w-[85vw] rounded-xl transition-opacity duration-300 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
