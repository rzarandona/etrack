'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

const BUCKET = 'employee-photos';

type Props = {
  /** Initial signed URL of an already-saved photo, if editing. */
  initialUrl?: string | null;
};

/**
 * Drag-and-drop photo uploader. Uploads the file to `staging/{ts}-{name}` in
 * the employee-photos bucket and writes the resulting path into a hidden form
 * field named `photo_staging_path`. The server action moves the file from
 * staging to its permanent path after the employee row is created/updated.
 */
export function PhotoInput({ initialUrl }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl ?? null);
  const [stagingPath, setStagingPath] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const objectUrlRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Photo must be an image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be 5 MB or smaller.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
      const path = `staging/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const supabase = getSupabaseBrowser();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setPreviewUrl(url);
      setStagingPath(path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  };

  return (
    <div>
      <span className="label">Photo</span>

      <input ref={inputRef} type="file" accept="image/*" onChange={onSelect} className="hidden" />
      <input type="hidden" name="photo_staging_path" value={stagingPath} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition"
        style={{
          borderColor: dragOver ? 'var(--accent)' : 'var(--line)',
          background: dragOver ? 'var(--accent-soft)' : 'var(--hover-soft)',
        }}>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Employee photo" className="h-full aspect-square rounded-xl object-cover" />
        ) : (
          <>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)' }}>
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {busy ? 'Uploading…' : 'Drop photo here or click to upload'}
            </span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>JPG, PNG · up to 5 MB</span>
          </>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs" style={{ color: 'var(--accent-deep)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
