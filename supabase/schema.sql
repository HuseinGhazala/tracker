-- Supabase schema for tracker app
-- Run in Supabase SQL editor before using the app

create table if not exists users (
  id text primary key
);

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

-- Optional RLS (enable if using supabase auth instead of server key)
-- alter table users enable row level security;
-- alter table clients enable row level security;
-- alter table payments enable row level security;
-- create policy "Select own rows" on clients for select using (auth.uid() = user_id);
-- create policy "Modify own rows" on clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- create policy "Select own rows" on payments for select using (auth.uid() = user_id);
-- create policy "Modify own rows" on payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

