create table if not exists users (
  id serial primary key,
  username text unique not null,
  password_hash text not null,
  role text default 'admin',
  api_token text unique,
  created_at timestamptz default now()
);

alter table users
  add column if not exists api_token text unique,
  add column if not exists created_at timestamptz default now();

create table if not exists transactions (
  id text primary key,
  user_id integer references users(id) on delete cascade,
  date date not null,
  amount numeric not null,
  type text not null,
  "group" text,
  category text,
  description text,
  status text,
  payment_method text,
  client_reference text,
  is_manual_override boolean,
  is_recurring boolean,
  loan_end_month text,
  linked_month text,
  is_auto_generated boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table transactions
  add column if not exists user_id integer,
  add column if not exists loan_end_month text,
  add column if not exists linked_month text,
  add column if not exists is_auto_generated boolean,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists settings (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz default now(),
  unique (user_id, key)
);

insert into users (username, password_hash, role)
values
  ('lidor', 'lidor123', 'admin'),
  ('lior', 'lior123', 'admin')
on conflict (username) do update
set
  password_hash = excluded.password_hash,
  role = excluded.role;