'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export default function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const initialError =
    params.get('error') === 'admin-only'
      ? 'This account is not an admin. Sign in with an admin user.'
      : null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInErr) {
      setError(signInErr.message);
      setBusy(false);
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <form onSubmit={onSubmit} className="card w-full max-w-sm p-8 ring-soft">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--accent)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight">etrack admin</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Sign in to continue</p>
          </div>
        </div>

        {error && (
          <div
            className="rounded-xl px-3 py-2 text-sm mb-4"
            style={{ background: 'var(--rose-soft)', color: 'var(--accent-deep)' }}>
            {error}
          </div>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="label">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={busy}
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
              className="input"
            />
          </label>
        </div>

        <button type="submit" disabled={busy} className="btn-primary w-full justify-center mt-6">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
