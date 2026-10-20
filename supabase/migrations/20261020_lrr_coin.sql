-- ============================================================================
-- LRR Coin: members, coin ledger, catalogue, redemptions, expiry
-- Applies on top of supabase/schema.sql. Run once in the Supabase SQL editor.
-- ============================================================================

-- ---------- 1. Members and access ----------------------------------------
alter table profiles drop constraint if exists profiles_role_check;
update profiles set role = 'member' where role = 'student';
alter table profiles alter column role set default 'member';
alter table profiles add constraint profiles_role_check check (role in ('admin', 'member'));

alter table profiles add column if not exists status text not null default 'pending';
alter table profiles drop constraint if exists profiles_status_check;
alter table profiles add constraint profiles_status_check
  check (status in ('pending', 'approved', 'declined', 'suspended'));
alter table profiles add column if not exists task_interests text[] not null default '{}';
alter table profiles add column if not exists weekly_hours text not null default '';
alter table profiles add column if not exists relationship text not null default '';
alter table profiles add column if not exists application_note text not null default '';
alter table profiles add column if not exists reviewed_at timestamptz;

-- Everyone already using the app is approved.
update profiles set status = 'approved' where status = 'pending' and created_at < now();

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  first_user boolean;
  interests text[];
begin
  first_user := (select count(*) from public.profiles) = 0;
  select coalesce(array_agg(value), '{}') into interests
    from jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'task_interests', '[]'::jsonb));
  insert into public.profiles
    (id, email, full_name, role, status, task_interests, weekly_hours, relationship, application_note)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when first_user then 'admin' else 'member' end,
    case when first_user then 'approved' else 'pending' end,
    interests,
    coalesce(new.raw_user_meta_data ->> 'weekly_hours', ''),
    coalesce(new.raw_user_meta_data ->> 'relationship', ''),
    left(coalesce(new.raw_user_meta_data ->> 'application_note', ''), 2000)
  );
  return new;
end;
$$;

create or replace function is_approved()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and (status = 'approved' or role = 'admin')
  );
$$;

-- Members can edit their own name and application answers, but never their
-- own role or approval status.
create or replace function guard_profile_update()
returns trigger language plpgsql as $$
begin
  if not is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.reviewed_at := old.reviewed_at;
    new.email := old.email;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_update on profiles;
create trigger profiles_guard_update before update on profiles
  for each row execute procedure guard_profile_update();

-- ---------- 2. Tasks: category, coin value, open tasks -------------------
alter table tasks add column if not exists category text not null default 'other';
alter table tasks drop constraint if exists tasks_category_check;
alter table tasks add constraint tasks_category_check
  check (category in ('content', 'promotion', 'playlist', 'feedback', 'admin', 'other'));
alter table tasks add column if not exists coin_value int not null default 0;
alter table tasks drop constraint if exists tasks_coin_value_check;
alter table tasks add constraint tasks_coin_value_check check (coin_value >= 0);
alter table tasks add column if not exists is_open boolean not null default false;

-- Signed-off tasks created before Alec's account existed were never assigned.
-- He was the only student, so they are his.
alter table tasks disable trigger tasks_guard_update;
update tasks set assigned_to = (select id from profiles where role = 'member' order by created_at limit 1)
  where assigned_to is null and status = 'signed_off'
    and (select count(*) from profiles where role = 'member') = 1;
alter table tasks enable trigger tasks_guard_update;

create or replace function guard_task_update()
returns trigger language plpgsql as $$
begin
  if not is_admin() then
    if (new.status = 'signed_off' and old.status <> 'signed_off')
       or (old.status = 'signed_off' and new.status <> 'signed_off') then
      raise exception 'Only an admin can sign off (or unsign) a task';
    end if;
    -- The one assignment change a member may make: claiming an open task.
    if not (old.assigned_to is null and old.is_open and new.assigned_to = auth.uid()) then
      new.assigned_to := old.assigned_to;
    end if;
    new.created_by := old.created_by;
    new.due_date := old.due_date;
    new.title := old.title;
    new.description := old.description;
    new.week_of := old.week_of;
    new.sort_order := old.sort_order;
    new.category := old.category;
    new.coin_value := old.coin_value;
    new.is_open := old.is_open;
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

create or replace function claim_task(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_approved() then
    raise exception 'Your account needs to be approved first';
  end if;
  update tasks set assigned_to = auth.uid()
    where id = p_task and assigned_to is null and is_open;
  if not found then
    raise exception 'That task has already been claimed';
  end if;
end;
$$;

-- The old shared "4 tasks = 2 hours" rule is retired in favour of coin.
drop trigger if exists tasks_maybe_unlock on tasks;

-- ---------- 3. Coin ledger -----------------------------------------------
create table if not exists coin_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  amount int not null check (amount <> 0),
  reason text not null check (reason in ('task', 'redemption', 'adjustment', 'expiry')),
  task_id uuid references tasks (id) on delete set null,
  redemption_id uuid,
  source_id uuid references coin_ledger (id) on delete cascade,  -- expiry rows point at the lot they expire
  note text not null default '',
  expires_at timestamptz,   -- set on earned coin: 12 months after it was earned
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists coin_ledger_profile_idx on coin_ledger (profile_id, created_at);

-- Each earned lot and how much of it is still unspent, oldest spent first.
create or replace function coin_lots(p_profile uuid)
returns table (lot_id uuid, expires_at timestamptz, remaining int)
language plpgsql stable security definer set search_path = public as $$
declare
  spent int;
  lot record;
  expired int;
  avail int;
  used int;
begin
  select coalesce(-sum(amount), 0) into spent
    from coin_ledger where profile_id = p_profile and amount < 0 and reason <> 'expiry';
  for lot in
    select l.id, l.amount, l.expires_at from coin_ledger l
     where l.profile_id = p_profile and l.amount > 0
     order by l.created_at, l.id
  loop
    select coalesce(-sum(amount), 0) into expired from coin_ledger where source_id = lot.id;
    avail := lot.amount - expired;
    used := least(avail, spent);
    spent := spent - used;
    lot_id := lot.id;
    expires_at := lot.expires_at;
    remaining := avail - used;
    return next;
  end loop;
end;
$$;

create or replace function expire_coin(p_profile uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  l record;
begin
  for l in select * from coin_lots(p_profile)
    where remaining > 0 and expires_at is not null and expires_at <= now()
  loop
    insert into coin_ledger (profile_id, amount, reason, source_id, note)
      values (p_profile, -l.remaining, 'expiry', l.lot_id, 'Unused coin expired after 12 months');
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function expire_all_coin()
returns int language plpgsql security definer set search_path = public as $$
declare
  total int := 0;
  p record;
begin
  for p in select distinct profile_id from coin_ledger loop
    total := total + expire_coin(p.profile_id);
  end loop;
  return total;
end;
$$;

create or replace function coin_balance(p_profile uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::int from coin_ledger where profile_id = p_profile;
$$;

-- Balance, coin held by pending requests, and the next expiry, for the caller
-- (or any member, for an admin). Runs expiry first so the numbers are current.
create or replace function coin_summary(p_profile uuid default null)
returns table (balance int, held int, available int, next_expiry_amount int, next_expiry_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(p_profile, auth.uid());
begin
  if target <> auth.uid() and not is_admin() then
    raise exception 'Not allowed';
  end if;
  perform expire_coin(target);
  balance := coin_balance(target);
  select coalesce(sum(coin_total), 0)::int into held
    from redemptions where profile_id = target and status = 'requested';
  available := balance - held;
  select l.remaining, l.expires_at into next_expiry_amount, next_expiry_at
    from coin_lots(target) l
    where l.remaining > 0 and l.expires_at is not null
    order by l.expires_at limit 1;
  return next;
end;
$$;

-- Credit the assignee when a task is signed off; reverse it if sign-off is undone.
create or replace function credit_task_coin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  net int;
begin
  if new.assigned_to is null or new.coin_value <= 0 then
    return new;
  end if;
  select coalesce(sum(amount), 0) into net
    from coin_ledger where task_id = new.id and profile_id = new.assigned_to and reason in ('task', 'adjustment');
  if new.status = 'signed_off' and old.status <> 'signed_off' and net = 0 then
    insert into coin_ledger (profile_id, amount, reason, task_id, note, expires_at, created_by)
      values (new.assigned_to, new.coin_value, 'task', new.id, new.title, now() + interval '12 months', auth.uid());
  elsif old.status = 'signed_off' and new.status <> 'signed_off' and net > 0 then
    insert into coin_ledger (profile_id, amount, reason, task_id, note, created_by)
      values (new.assigned_to, -net, 'adjustment', new.id, 'Sign-off undone: ' || new.title, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_credit_coin on tasks;
create trigger tasks_credit_coin after update on tasks
  for each row execute procedure credit_task_coin();

-- Admin adjustment (opening balances, corrections). Positive amounts expire like earned coin.
create or replace function adjust_coin(p_profile uuid, p_amount int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can adjust coin'; end if;
  if p_amount = 0 then raise exception 'Amount cannot be zero'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Add a reason for the adjustment'; end if;
  if p_amount < 0 and coin_balance(p_profile) + p_amount < 0 then
    raise exception 'That would take the balance below zero';
  end if;
  insert into coin_ledger (profile_id, amount, reason, note, expires_at, created_by)
    values (p_profile, p_amount, 'adjustment', trim(p_note),
            case when p_amount > 0 then now() + interval '12 months' end, auth.uid());
end;
$$;

-- ---------- 4. Catalogue and redemptions ---------------------------------
create table if not exists catalogue_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'other'
    check (kind in ('recording', 'mixing', 'mastering', 'digital', 'merch', 'distribution', 'other')),
  unit text not null default 'each',
  description text not null default '',
  coin_price int check (coin_price is null or coin_price > 0),
  active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into catalogue_items (name, kind, unit, description, sort_order)
select * from (values
  ('Recording time', 'recording', 'hour', 'Studio recording at LRRecords', 1),
  ('Mix', 'mixing', 'song', 'One song mixed', 2),
  ('Master', 'mastering', 'song', 'One song mastered', 3)
) v(name, kind, unit, description, sort_order)
where not exists (select 1 from catalogue_items);

create table if not exists redemptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  item_id uuid not null references catalogue_items (id),
  item_name text not null,
  quantity int not null check (quantity > 0),
  coin_total int not null check (coin_total > 0),
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'declined', 'completed', 'cancelled')),
  notes text not null default '',
  admin_note text not null default '',
  decided_at timestamptz,
  decided_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table coin_ledger drop constraint if exists coin_ledger_redemption_fk;
alter table coin_ledger add constraint coin_ledger_redemption_fk
  foreign key (redemption_id) references redemptions (id) on delete set null;

create or replace function request_redemption(p_item uuid, p_quantity int, p_notes text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  item catalogue_items;
  total int;
  s record;
  new_id uuid;
begin
  if not is_approved() then raise exception 'Your account needs to be approved first'; end if;
  select * into item from catalogue_items where id = p_item and active and coin_price is not null;
  if not found then raise exception 'That item is not available'; end if;
  if p_quantity < 1 or p_quantity > 50 then raise exception 'Choose a quantity between 1 and 50'; end if;
  total := item.coin_price * p_quantity;
  select * into s from coin_summary(auth.uid());
  if s.available < total then
    raise exception 'Not enough coin: this needs %, you have % available', total, s.available;
  end if;
  insert into redemptions (profile_id, item_id, item_name, quantity, coin_total, notes)
    values (auth.uid(), item.id, item.name, p_quantity, total, left(coalesce(p_notes, ''), 1000))
    returning id into new_id;
  return new_id;
end;
$$;

create or replace function cancel_redemption(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update redemptions set status = 'cancelled', decided_at = now()
    where id = p_id and profile_id = auth.uid() and status = 'requested';
  if not found then raise exception 'Only a pending request can be cancelled'; end if;
end;
$$;

create or replace function decide_redemption(p_id uuid, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r redemptions;
begin
  if not is_admin() then raise exception 'Only an admin can approve requests'; end if;
  select * into r from redemptions where id = p_id for update;
  if not found or r.status <> 'requested' then raise exception 'That request is no longer pending'; end if;
  if p_approve then
    perform expire_coin(r.profile_id);
    if coin_balance(r.profile_id) < r.coin_total then
      raise exception 'Not enough coin left to approve this request';
    end if;
    insert into coin_ledger (profile_id, amount, reason, redemption_id, note, created_by)
      values (r.profile_id, -r.coin_total, 'redemption', r.id,
              r.item_name || ' x' || r.quantity, auth.uid());
  end if;
  update redemptions
     set status = case when p_approve then 'approved' else 'declined' end,
         admin_note = coalesce(p_note, ''), decided_at = now(), decided_by = auth.uid()
   where id = p_id;
end;
$$;

create or replace function complete_redemption(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can do this'; end if;
  update redemptions set status = 'completed' where id = p_id and status = 'approved';
  if not found then raise exception 'Only an approved request can be marked done'; end if;
end;
$$;

-- ---------- 5. Row level security ----------------------------------------
alter table coin_ledger enable row level security;
alter table catalogue_items enable row level security;
alter table redemptions enable row level security;

drop policy if exists tasks_select on tasks;
create policy tasks_select on tasks for select
  using (is_admin() or assigned_to = auth.uid() or (is_open and assigned_to is null and is_approved()));

drop policy if exists tasks_update on tasks;
create policy tasks_update on tasks for update
  using (is_admin() or (assigned_to = auth.uid() and is_approved()));

drop policy if exists ledger_select on coin_ledger;
create policy ledger_select on coin_ledger for select using (is_admin() or profile_id = auth.uid());

drop policy if exists catalogue_select on catalogue_items;
create policy catalogue_select on catalogue_items for select using (auth.uid() is not null);
drop policy if exists catalogue_insert on catalogue_items;
create policy catalogue_insert on catalogue_items for insert with check (is_admin());
drop policy if exists catalogue_update on catalogue_items;
create policy catalogue_update on catalogue_items for update using (is_admin());

drop policy if exists redemptions_select on redemptions;
create policy redemptions_select on redemptions for select using (is_admin() or profile_id = auth.uid());

-- Songs and studio time: each member sees their own.
drop policy if exists songs_select on songs;
create policy songs_select on songs for select using (is_admin() or created_by = auth.uid());
drop policy if exists time_select on studio_time_entries;
create policy time_select on studio_time_entries for select using (is_admin() or logged_by = auth.uid());

-- Old unlocks stay as history, visible to the admin only.
drop policy if exists unlocks_select on studio_unlocks;
create policy unlocks_select on studio_unlocks for select using (is_admin());

-- Functions: callable by signed-in users only.
revoke execute on function claim_task(uuid), coin_summary(uuid), adjust_coin(uuid, int, text),
  request_redemption(uuid, int, text), cancel_redemption(uuid), decide_redemption(uuid, boolean, text),
  complete_redemption(uuid), expire_coin(uuid), expire_all_coin(), coin_lots(uuid), coin_balance(uuid)
  from public, anon;
grant execute on function claim_task(uuid), coin_summary(uuid), adjust_coin(uuid, int, text),
  request_redemption(uuid, int, text), cancel_redemption(uuid), decide_redemption(uuid, boolean, text),
  complete_redemption(uuid)
  to authenticated;
revoke execute on function expire_coin(uuid), expire_all_coin(), coin_lots(uuid), coin_balance(uuid)
  from authenticated;
