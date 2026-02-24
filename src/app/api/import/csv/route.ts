import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PLACEHOLDER = '<REPLACE_WITH_YOUR_SUPABASE_USER_ID>';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || c === '\r') {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): string[][] {
  const lines = text.split('\n').filter((l) => l.trim());
  return lines.map((l) => parseCSVLine(l));
}

export async function POST(req: Request) {
  const uid = req.headers.get('x-user-id');
  if (!uid) return NextResponse.json({ error: 'Missing user id' }, { status: 400 });

  let clientsFile: File | null = null;
  let paymentsFile: File | null = null;
  try {
    const formData = await req.formData();
    clientsFile = formData.get('clients') as File | null;
    paymentsFile = formData.get('payments') as File | null;
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  try {
    await supabase.from('users').upsert({ id: uid }, { onConflict: 'id' });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  let clientsImported = 0;
  let paymentsImported = 0;

  if (clientsFile && clientsFile.size > 0) {
    const text = await clientsFile.text();
    const replaced = text.split(PLACEHOLDER).join(uid);
    const rows = parseCSV(replaced);
    const header = rows[0] ?? [];
    const dataRows = rows.slice(1);
    const idIdx = header.indexOf('id');
    const userIdIdx = header.indexOf('user_id');
    const nameIdx = header.indexOf('name');
    const projectIdx = header.indexOf('project');
    const costIdx = header.indexOf('total_project_cost');
    const currencyIdx = header.indexOf('currency');
    const paidIdx = header.indexOf('total_paid');
    const createdAtIdx = header.indexOf('created_at');

    if (
      [idIdx, userIdIdx, nameIdx, projectIdx, costIdx, currencyIdx, paidIdx, createdAtIdx].some(
        (i) => i === -1
      )
    ) {
      return NextResponse.json(
        { error: 'عمود ناقص في ملف العملاء. المطلوب: id, user_id, name, project, total_project_cost, currency, total_paid, created_at' },
        { status: 400 }
      );
    }

    const BATCH = 50;
    for (let i = 0; i < dataRows.length; i += BATCH) {
      const chunk = dataRows.slice(i, i + BATCH).map((row) => ({
        id: row[idIdx],
        user_id: row[userIdIdx] || uid,
        name: row[nameIdx] ?? '',
        project: row[projectIdx] ?? '',
        total_project_cost: Number(row[costIdx]) || 0,
        currency: row[currencyIdx] ?? 'EGP',
        total_paid: Number(row[paidIdx]) || 0,
        created_at: row[createdAtIdx] || new Date().toISOString(),
      }));
      const { error } = await supabase.from('clients').upsert(chunk, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });
      if (error) throw error;
      clientsImported += chunk.length;
    }
  }

  if (paymentsFile && paymentsFile.size > 0) {
    const text = await paymentsFile.text();
    const replaced = text.split(PLACEHOLDER).join(uid);
    const rows = parseCSV(replaced);
    const header = rows[0] ?? [];
    const dataRows = rows.slice(1);
    const idIdx = header.indexOf('id');
    const userIdIdx = header.indexOf('user_id');
    const clientIdIdx = header.indexOf('client_id');
    const amountIdx = header.indexOf('amount');
    const dateIdx = header.indexOf('payment_date');
    const currencyIdx = header.indexOf('currency');
    const notesIdx = header.indexOf('notes');
    const createdAtIdx = header.indexOf('created_at');

    if (
      [idIdx, userIdIdx, clientIdIdx, amountIdx, dateIdx, currencyIdx].some((i) => i === -1)
    ) {
      return NextResponse.json(
        { error: 'عمود ناقص في ملف الدفعات. المطلوب: id, user_id, client_id, amount, payment_date, currency, notes, created_at' },
        { status: 400 }
      );
    }

    const BATCH = 50;
    for (let i = 0; i < dataRows.length; i += BATCH) {
      const chunk = dataRows.slice(i, i + BATCH).map((row) => ({
        id: row[idIdx],
        user_id: row[userIdIdx] || uid,
        client_id: row[clientIdIdx],
        amount: Number(row[amountIdx]) || 0,
        payment_date: (row[dateIdx] || '').split('T')[0] || new Date().toISOString().split('T')[0],
        currency: row[currencyIdx] ?? 'EGP',
        notes: row[notesIdx] ?? null,
        created_at: row[createdAtIdx] || new Date().toISOString(),
      }));
      const { error } = await supabase.from('payments').upsert(chunk, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });
      if (error) throw error;
      paymentsImported += chunk.length;
    }
  }

  if (paymentsImported > 0) {
    const { data: clientRows } = await supabase.from('clients').select('id').eq('user_id', uid);
    for (const row of clientRows ?? []) {
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .eq('client_id', row.id);
      const total = (payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
      await supabase.from('clients').update({ total_paid: total }).eq('id', row.id);
    }
  }

  return NextResponse.json({
    ok: true,
    clientsImported,
    paymentsImported,
  });
}
