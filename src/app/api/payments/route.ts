import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const uid = req.headers.get('x-user-id') || (await req.json().catch(() => null))?.uid;
  if (!uid) return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', uid)
      .order('payment_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const { uid, clientId, amount, paymentDate, currency, notes } = body || {};
  if (!uid || !clientId || typeof amount !== 'number' || !paymentDate || !currency) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('payments')
      .insert({
        user_id: uid,
        client_id: clientId,
        amount,
        payment_date: paymentDate,
        currency,
        notes: notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    // Increment client's total_paid
    const { error: updErr } = await supabase.rpc('increment_client_total_paid', {
      p_client_id: clientId,
      p_amount: amount,
    });
    if (updErr) throw updErr;

    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 });
  }
}

