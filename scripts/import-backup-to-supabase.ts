/**
 * استيراد كل بيانات النسخة الاحتياطية إلى Supabase:
 * clients, payments, debts, expenses, appointments, tasks, savingsGoals
 *
 * المتطلبات:
 * - .env فيه SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY
 * - IMPORT_USER_ID = معرف المستخدم (Firebase UID)
 *
 * التشغيل: npm run import-backup
 * أو: BACKUP_FILE=path/to/backup.json npm run import-backup
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    process.env[key] = val;
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IMPORT_USER_ID = process.env.IMPORT_USER_ID;
const BACKUP_FILE =
  process.env.BACKUP_FILE || resolve(process.cwd(), 'financial_tracker_backup_2026-02-24.json');

interface BackupClient {
  id: string;
  name: string;
  project: string;
  totalProjectCost: number;
  currency: string;
  creationDate: string;
}

interface BackupPayment {
  id: string;
  clientId: string;
  amount: number;
  paymentDate: string;
  currency: string;
  notes?: string;
  creationDate: string;
}

interface BackupDebt {
  id: string;
  description: string;
  debtorName: string;
  creditorName: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
  amountRepaid?: number;
  paidDate?: string;
  notes?: string;
  creationDate: string;
}

interface BackupExpense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  expenseDate: string;
  creationDate: string;
}

interface BackupAppointment {
  id?: string;
  title: string;
  date: string;
  time: string;
  attendees?: string;
  location?: string;
  notes?: string;
  status: string;
  creationDate?: string;
}

interface BackupTask {
  id?: string;
  description: string;
  dueDate?: string;
  priority?: string;
  status: string;
  notes?: string;
  creationDate?: string;
}

interface BackupSavingsGoal {
  id: string;
  name: string;
  goalType: string;
  targetAmount: number;
  currentAmount: number;
  currency?: string;
  creationDate: string;
}

interface Backup {
  clients?: BackupClient[];
  payments?: BackupPayment[];
  debts?: BackupDebt[];
  expenses?: BackupExpense[];
  appointments?: BackupAppointment[];
  tasks?: BackupTask[];
  savingsGoals?: BackupSavingsGoal[];
}

function parseDate(iso: string): string {
  return iso.split('T')[0]!;
}

const BATCH = 100;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('خطأ: تأكد من وجود SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في .env');
    process.exit(1);
  }
  if (!IMPORT_USER_ID) {
    console.error(
      'خطأ: حدد IMPORT_USER_ID في .env (معرف المستخدم من Firebase - نفس الـ uid اللي التطبيق يستخدمه)'
    );
    process.exit(1);
  }
  if (!existsSync(BACKUP_FILE)) {
    console.error('خطأ: ملف النسخة الاحتياطية غير موجود:', BACKUP_FILE);
    process.exit(1);
  }

  const raw = readFileSync(BACKUP_FILE, 'utf-8');
  const backup: Backup = JSON.parse(raw);

  const clients = Array.isArray(backup.clients) ? backup.clients : [];
  const payments = Array.isArray(backup.payments) ? backup.payments : [];
  const debts = Array.isArray(backup.debts) ? backup.debts : [];
  const expenses = Array.isArray(backup.expenses) ? backup.expenses : [];
  const appointments = Array.isArray(backup.appointments) ? backup.appointments : [];
  const tasks = Array.isArray(backup.tasks) ? backup.tasks : [];
  const savingsGoals = Array.isArray(backup.savingsGoals) ? backup.savingsGoals : [];

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log('جاري استيراد كل البيانات إلى Supabase...');
  console.log('  عملاء:', clients.length, '| دفعات:', payments.length, '| ديون:', debts.length, '| مصروفات:', expenses.length, '| مواعيد:', appointments.length, '| مهام:', tasks.length, '| أهداف توفير:', savingsGoals.length);

  // 1) المستخدم
  const { error: userErr } = await supabase.from('users').upsert({ id: IMPORT_USER_ID }, { onConflict: 'id' });
  if (userErr) {
    console.error('خطأ عند إدراج المستخدم:', userErr.message);
    process.exit(1);
  }
  console.log('تم التأكد من المستخدم:', IMPORT_USER_ID);

  // 2) العملاء
  const totalPaidByClient: Record<string, number> = {};
  for (const p of payments) {
    totalPaidByClient[p.clientId] = (totalPaidByClient[p.clientId] ?? 0) + p.amount;
  }
  const clientRows = clients.map((c) => ({
    id: c.id,
    user_id: IMPORT_USER_ID,
    name: c.name,
    project: c.project,
    total_project_cost: c.totalProjectCost,
    currency: c.currency,
    total_paid: totalPaidByClient[c.id] ?? 0,
    created_at: c.creationDate || new Date().toISOString(),
  }));
  for (let i = 0; i < clientRows.length; i += BATCH) {
    const chunk = clientRows.slice(i, i + BATCH);
    const { error } = await supabase.from('clients').upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
      console.error('خطأ عند إدراج العملاء:', error.message);
      process.exit(1);
    }
  }
  console.log('تم إدراج العملاء:', clientRows.length);

  // 3) الدفعات
  const paymentRows = payments.map((p) => ({
    id: p.id,
    user_id: IMPORT_USER_ID,
    client_id: p.clientId,
    amount: p.amount,
    payment_date: parseDate(p.paymentDate),
    currency: p.currency,
    notes: p.notes ?? null,
    created_at: p.creationDate || new Date().toISOString(),
  }));
  for (let i = 0; i < paymentRows.length; i += BATCH) {
    const chunk = paymentRows.slice(i, i + BATCH);
    const { error } = await supabase.from('payments').upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
      console.error('خطأ عند إدراج الدفعات:', error.message);
      process.exit(1);
    }
  }
  console.log('تم إدراج الدفعات:', paymentRows.length);

  // 4) الديون
  const debtRows = debts.map((d) => ({
    id: d.id,
    user_id: IMPORT_USER_ID,
    description: d.description,
    debtor_name: d.debtorName,
    creditor_name: d.creditorName,
    amount: d.amount,
    currency: d.currency,
    due_date: parseDate(d.dueDate),
    status: d.status,
    amount_repaid: d.amountRepaid ?? 0,
    paid_date: d.paidDate || null,
    notes: d.notes ?? null,
    created_at: d.creationDate || new Date().toISOString(),
  }));
  for (let i = 0; i < debtRows.length; i += BATCH) {
    const chunk = debtRows.slice(i, i + BATCH);
    const { error } = await supabase.from('debts').upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
      console.error('خطأ عند إدراج الديون:', error.message);
      process.exit(1);
    }
  }
  console.log('تم إدراج الديون:', debtRows.length);

  // 5) المصروفات
  const expenseRows = expenses.map((e) => ({
    id: e.id,
    user_id: IMPORT_USER_ID,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    category: e.category,
    expense_date: parseDate(e.expenseDate),
    created_at: e.creationDate || new Date().toISOString(),
  }));
  for (let i = 0; i < expenseRows.length; i += BATCH) {
    const chunk = expenseRows.slice(i, i + BATCH);
    const { error } = await supabase.from('expenses').upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
    if (error) {
      console.error('خطأ عند إدراج المصروفات:', error.message);
      process.exit(1);
    }
  }
  console.log('تم إدراج المصروفات:', expenseRows.length);

  // 6) المواعيد (قد تكون فارغة)
  if (appointments.length > 0) {
    const appointmentRows = appointments.map((a) => ({
      id: (a as { id?: string }).id ?? randomUUID(),
      user_id: IMPORT_USER_ID,
      title: a.title,
      date: parseDate(typeof a.date === 'string' ? a.date : (a.date as unknown as Date).toString()),
      time: a.time || '09:00',
      attendees: a.attendees ?? null,
      location: a.location ?? null,
      notes: a.notes ?? null,
      status: a.status,
      created_at: a.creationDate || new Date().toISOString(),
    }));
    for (let i = 0; i < appointmentRows.length; i += BATCH) {
      const chunk = appointmentRows.slice(i, i + BATCH);
      const { error } = await supabase.from('appointments').upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
      if (error) {
        console.error('خطأ عند إدراج المواعيد:', error.message);
        process.exit(1);
      }
    }
    console.log('تم إدراج المواعيد:', appointmentRows.length);
  }

  // 7) المهام (قد تكون فارغة)
  if (tasks.length > 0) {
    const taskRows = tasks.map((t) => ({
      id: (t as { id?: string }).id ?? randomUUID(),
      user_id: IMPORT_USER_ID,
      description: t.description,
      due_date: t.dueDate ? parseDate(typeof t.dueDate === 'string' ? t.dueDate : (t.dueDate as unknown as Date).toString()) : null,
      priority: t.priority || 'medium',
      status: t.status,
      notes: t.notes ?? null,
      created_at: t.creationDate || new Date().toISOString(),
    }));
    for (let i = 0; i < taskRows.length; i += BATCH) {
      const chunk = taskRows.slice(i, i + BATCH);
      const { error } = await supabase.from('tasks').upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
      if (error) {
        console.error('خطأ عند إدراج المهام:', error.message);
        process.exit(1);
      }
    }
    console.log('تم إدراج المهام:', taskRows.length);
  }

  // 8) أهداف التوفير (قد تكون فارغة)
  if (savingsGoals.length > 0) {
    const goalRows = savingsGoals.map((g) => ({
      id: g.id,
      user_id: IMPORT_USER_ID,
      name: g.name,
      goal_type: g.goalType,
      target_amount: g.targetAmount,
      current_amount: g.currentAmount,
      currency: g.currency ?? null,
      created_at: g.creationDate || new Date().toISOString(),
    }));
    for (let i = 0; i < goalRows.length; i += BATCH) {
      const chunk = goalRows.slice(i, i + BATCH);
      const { error } = await supabase.from('savings_goals').upsert(chunk, { onConflict: 'id', ignoreDuplicates: false });
      if (error) {
        console.error('خطأ عند إدراج أهداف التوفير:', error.message);
        process.exit(1);
      }
    }
    console.log('تم إدراج أهداف التوفير:', goalRows.length);
  }

  console.log('تم استيراد كل البيانات بنجاح.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
