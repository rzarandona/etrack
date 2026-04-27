import JSZip from 'jszip';
import QRCode from 'qrcode';
import { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { Employee } from '@/lib/types';

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();

  // Inline admin gate — route handlers return HTTP errors, not redirects,
  // so the client can surface a useful message.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('supervisor_profiles')
    .select('role, active')
    .eq('id', user.id)
    .single();
  if (!profile || !profile.active || profile.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  let ids: string[];
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (!Array.isArray(body.ids) || body.ids.some((x) => typeof x !== 'string')) {
      return new Response('Invalid body: expected { ids: string[] }', { status: 400 });
    }
    ids = body.ids as string[];
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (ids.length === 0) {
    return new Response('Select at least one employee', { status: 400 });
  }

  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, employee_code, full_name, hourly_rate, active')
    .in('id', ids);
  if (error) return new Response(error.message, { status: 500 });
  const list = (employees as Pick<Employee, 'id' | 'employee_code' | 'full_name' | 'hourly_rate' | 'active'>[]) ?? [];

  const zip = new JSZip();

  // CSV: one row per employee. Fields the print vendor needs.
  const csvRows: string[] = ['employee_code,full_name,employee_id,hourly_rate,qr_filename'];
  for (const e of list) {
    const qrFile = `qrcodes/${e.employee_code}.png`;
    const png = await QRCode.toBuffer(e.id, { type: 'png', errorCorrectionLevel: 'M', margin: 1, width: 512 });
    zip.file(qrFile, png);
    csvRows.push(
      [
        csvEscape(e.employee_code),
        csvEscape(e.full_name),
        csvEscape(e.id),
        csvEscape(e.hourly_rate),
        csvEscape(qrFile),
      ].join(',')
    );
  }
  zip.file('employees.csv', csvRows.join('\n'));

  const zipBytes = await zip.generateAsync({ type: 'arraybuffer' });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  return new Response(zipBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="etrack-badges-${stamp}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
