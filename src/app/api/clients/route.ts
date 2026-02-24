import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const uid = req.headers.get('x-user-id') || (await req.json().catch(() => null))?.uid;
  if (!uid) return NextResponse.json({ error: 'Missing user id' }, { status: 400 });
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const { uid, name, project, totalProjectCost, currency } = body || {};
  if (!uid || !name || !project || typeof totalProjectCost !== 'number' || !currency) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('clients')
      .insert({
        user_id: uid,
        name,
        project,
        total_project_cost: totalProjectCost,
        currency,
        total_paid: 0,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Unexpected error' }, { status: 500 });
  }
}

