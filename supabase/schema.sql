-- NOTE: after running this file, also run supabase/migrations/20261020_lrr_coin.sql
-- (LRR Coin: members, coin ledger, catalogue, redemptions, expiry).
-- ============================================================================
-- LRRecords Job & Music Production Tracker — database schema
-- ============================================================================
-- Run this in your Supabase project's SQL Editor (Project -> SQL Editor ->
-- New query -> paste this whole file -> Run). Safe to re-run: it uses
-- "create table if not exists" / "drop policy if exists" guards.
-- ============================================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ---------- profiles ----------
-- One row per auth.users row. role = 'admin' (Brett) or 'student' (Alec).
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'student' check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up.
-- The FIRST person to sign up becomes admin; everyone after is a student.
-- (You can also just hand-edit roles afterwards in the Table Editor.)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'student' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Helper used throughout RLS policies below.
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- tasks ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  week_of date,               -- the Friday this task set belongs to
  due_date date,               -- deadline set by admin
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'submitted', 'signed_off')),
  assigned_to uuid references profiles (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  sort_order int not null default 0,
  signed_off_at timestamptz,
  signed_off_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row execute procedure set_updated_at();

-- Students may move a task to submitted/in_progress and touch evidence,
-- but only an admin may sign a task off (or move it back off signed_off).
create or replace function guard_task_update()
returns trigger language plpgsql as $$
begin
  if not is_admin() then
    if (new.status = 'signed_off' and old.status <> 'signed_off')
       or (old.status = 'signed_off' and new.status <> 'signed_off') then
      raise exception 'Only an admin can sign off (or unsign) a task';
    end if;
    new.assigned_to := old.assigned_to;
    new.created_by := old.created_by;
    new.due_date := old.due_date;
    new.title := old.title;
    new.week_of := old.week_of;
    new.sort_order := old.sort_order;
  end if;

  if new.status = 'signed_off' and old.status <> 'signed_off' then
    new.signed_off_at := now();
    new.signed_off_by := auth.uid();
  elsif new.status <> 'signed_off' then
    new.signed_off_at := null;
    new.signed_off_by := null;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_guard_update on tasks;
create trigger tasks_guard_update
  before update on tasks
  for each row execute procedure guard_task_update();

-- ---------- task_evidence ----------
create table if not exists task_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  type text not null check (type in ('text', 'link', 'file', 'screenshot')),
  content text not null default '',   -- text body, URL, or file caption
  file_path text,                      -- storage object path, for file/screenshot
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- task_notes (feedback thread on a task) ----------
create table if not exists task_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

-- ---------- settings (singleton row) ----------
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  tasks_required_for_studio int not null default 4,
  studio_hours_per_unlock numeric not null default 2,
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

drop trigger if exists settings_set_updated_at on settings;
create trigger settings_set_updated_at
  before update on settings
  for each row execute procedure set_updated_at();

-- ---------- studio_unlocks ----------
-- Auto-created when enough signed-off tasks accumulate.
create table if not exists studio_unlocks (
  id uuid primary key default gen_random_uuid(),
  earned_at timestamptz not null default now(),
  tasks_completed_count int not null,
  hours numeric not null,
  status text not null default 'available' check (status in ('available', 'used')),
  used_at timestamptz,
  notes text not null default ''
);

create or replace function maybe_unlock_studio_time()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  signed_off_count int;
  existing_unlocks int;
  threshold int;
  hours_each numeric;
  should_have int;
begin
  if new.status = 'signed_off' and old.status <> 'signed_off' then
    select count(*) into signed_off_count from tasks where status = 'signed_off';
    select tasks_required_for_studio, studio_hours_per_unlock
      into threshold, hours_each from settings where id = 1;
    if threshold is null or threshold < 1 then
      threshold := 4;
    end if;
    select count(*) into existing_unlocks from studio_unlocks;
    should_have := signed_off_count / threshold;
    while existing_unlocks < should_have loop
      insert into studio_unlocks (tasks_completed_count, hours)
        values (signed_off_count, coalesce(hours_each, 2));
      existing_unlocks := existing_unlocks + 1;
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_maybe_unlock on tasks;
create trigger tasks_maybe_unlock
  after update on tasks
  for each row execute procedure maybe_unlock_studio_time();

-- ---------- songs ----------
create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'idea'
    check (status in ('idea', 'writing', 'recording', 'mixing', 'mastering', 'released')),
  notes text not null default '',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- studio_time_entries ----------
create table if not exists studio_time_entries (
  id uuid primary key default gen_random_uuid(),
  song_id uuid references songs (id) on delete cascade,
  task_description text not null,
  hours numeric not null check (hours >= 0),
  entry_date date not null default current_date,
  logged_by uuid references profiles (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table task_evidence enable row level security;
alter table task_notes enable row level security;
alter table settings enable row level security;
alter table studio_unlocks enable row level security;
alter table songs enable row level security;
alter table studio_time_entries enable row level security;

-- profiles
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (auth.uid() = id or is_admin());

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (auth.uid() = id or is_admin());

-- tasks
drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks for select
  using (is_admin() or assigned_to = auth.uid());

drop policy if exists tasks_insert on tasks;
create policy tasks_insert on tasks for insert
  with check (is_admin());

drop policy if exists tasks_update on tasks;
create policy tasks_update on tasks for update
  using (is_admin() or assigned_to = auth.uid());

drop policy if exists tasks_delete on tasks;
create policy tasks_delete on tasks for delete
  using (is_admin());

-- task_evidence
drop policy if exists evidence_select on task_evidence;
create policy evidence_select on task_evidence for select
  using (
    is_admin() or exists (
      select 1 from tasks where tasks.id = task_evidence.task_id and tasks.assigned_to = auth.uid()
    )
  );

drop policy if exists evidence_insert on task_evidence;
create policy evidence_insert on task_evidence for insert
  with check (
    is_admin() or exists (
      select 1 from tasks where tasks.id = task_evidence.task_id and tasks.assigned_to = auth.uid()
    )
  );

drop policy if exists evidence_delete on task_evidence;
create policy evidence_delete on task_evidence for delete
  using (is_admin() or created_by = auth.uid());

-- task_notes
drop policy if exists notes_select on task_notes;
create policy notes_select on task_notes for select
  using (
    is_admin() or exists (
      select 1 from tasks where tasks.id = task_notes.task_id and tasks.assigned_to = auth.uid()
    )
  );

drop policy if exists notes_insert on task_notes;
create policy notes_insert on task_notes for insert
  with check (
    is_admin() or exists (
      select 1 from tasks where tasks.id = task_notes.task_id and tasks.assigned_to = auth.uid()
    )
  );

-- settings
drop policy if exists settings_select on settings;
create policy settings_select on settings for select using (true);

drop policy if exists settings_update on settings;
create policy settings_update on settings for update using (is_admin());

-- studio_unlocks
drop policy if exists unlocks_select on studio_unlocks;
create policy unlocks_select on studio_unlocks for select using (true);

drop policy if exists unlocks_update on studio_unlocks;
create policy unlocks_update on studio_unlocks for update using (is_admin());

drop policy if exists unlocks_insert on studio_unlocks;
create policy unlocks_insert on studio_unlocks for insert with check (is_admin());

-- songs
drop policy if exists songs_select on songs;
create policy songs_select on songs for select using (true);

drop policy if exists songs_insert on songs;
create policy songs_insert on songs for insert with check (auth.uid() is not null);

drop policy if exists songs_update on songs;
create policy songs_update on songs for update
  using (is_admin() or created_by = auth.uid());

-- studio_time_entries
drop policy if exists time_select on studio_time_entries;
create policy time_select on studio_time_entries for select using (true);

drop policy if exists time_insert on studio_time_entries;
create policy time_insert on studio_time_entries for insert with check (auth.uid() is not null);

drop policy if exists time_update on studio_time_entries;
create policy time_update on studio_time_entries for update
  using (is_admin() or logged_by = auth.uid());

drop policy if exists time_delete on studio_time_entries;
create policy time_delete on studio_time_entries for delete
  using (is_admin() or logged_by = auth.uid());

-- ============================================================================
-- Storage bucket for evidence files/screenshots
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

drop policy if exists evidence_storage_read on storage.objects;
create policy evidence_storage_read on storage.objects for select
  using (
    bucket_id = 'evidence'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists evidence_storage_insert on storage.objects;
create policy evidence_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists evidence_storage_delete on storage.objects;
create policy evidence_storage_delete on storage.objects for delete
  using (
    bucket_id = 'evidence'
    and (is_admin() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- ============================================================================
-- Done. Next: Authentication -> Providers -> make sure Email is enabled,
-- and Authentication -> Settings -> turn OFF "Confirm email" for the fastest
-- setup (2-person app). Then create your two accounts from the app's
-- sign-up screen — the first account created becomes the admin (Brett),
-- the second becomes the student (Alec).
-- ============================================================================
