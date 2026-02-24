-- Supabase schema for tracker app
-- Run in Supabase SQL editor before using the app
--
-- استيراد العملاء من CSV (مثلاً clients_export_*.csv):
-- 1) شغّل هذا الملف كاملاً في SQL Editor مرة واحدة.
-- 2) أضف المستخدم أولاً: INSERT INTO users (id) VALUES ('معرف_فيربيس_الخاص_بك') ON CONFLICT (id) DO NOTHING;
-- 3) في الملف CSV استبدل <REPLACE_WITH_YOUR_SUPABASE_USER_ID> بمعرف المستخدم نفسه.
-- 4) Table Editor → جدول clients → Import data from CSV واختر الملف.

create table if not exists users (
  id text primary key
);

-- جاهز لاستيراد CSV: الأعمدة id, user_id, name, project, total_project_cost, currency, total_paid, created_at
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  name text not null,
  project text not null,
  total_project_cost numeric not null,
  currency text not null,
  total_paid numeric not null default 0,
  created_at timestamp with time zone not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  amount numeric not null,
  payment_date date not null,
  currency text not null,
  notes text,
  created_at timestamp with time zone not null default now()
);

-- Helper function to increment client's total_paid
create or replace function increment_client_total_paid(p_client_id uuid, p_amount numeric)
returns void
language plpgsql
as $$
begin
  update clients
  set total_paid = coalesce(total_paid, 0) + coalesce(p_amount, 0)
  where id = p_client_id;
end;
$$;

-- الديون
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  description text not null,
  debtor_name text not null,
  creditor_name text not null,
  amount numeric not null,
  currency text not null,
  due_date date not null,
  status text not null,
  amount_repaid numeric not null default 0,
  paid_date timestamp with time zone,
  notes text,
  created_at timestamp with time zone not null default now()
);

-- المصروفات
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  description text not null,
  amount numeric not null,
  currency text not null,
  category text not null,
  expense_date date not null,
  created_at timestamp with time zone not null default now()
);

-- المواعيد
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  title text not null,
  date date not null,
  time text not null,
  attendees text,
  location text,
  notes text,
  status text not null,
  created_at timestamp with time zone not null default now()
);

-- المهام
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  description text not null,
  due_date date,
  priority text not null default 'medium',
  status text not null,
  notes text,
  created_at timestamp with time zone not null default now()
);

-- أهداف التوفير
create table if not exists savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  name text not null,
  goal_type text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  currency text,
  created_at timestamp with time zone not null default now()
);

-- Optional RLS (enable if using supabase auth instead of server key)
-- alter table users enable row level security;
-- alter table clients enable row level security;
-- alter table payments enable row level security;
-- create policy "Select own rows" on clients for select using (auth.uid() = user_id);
-- create policy "Modify own rows" on clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "Select own rows" on payments for select using (auth.uid() = user_id);
-- create policy "Modify own rows" on payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

