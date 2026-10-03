-- Audit log: a record of what admins change in the system, and when.
--
-- Every insert / update / delete an ADMIN makes on the tables listed at the
-- bottom of this file is written to public.audit_logs by a database trigger,
-- so nothing in the web app has to remember to log it, and it can't be
-- skipped. Changes made by customers, technicians or the system (e.g. the
-- SlipOK auto-check) are not logged here.
--
-- One exception: changing a user's role goes through the API route
-- /api/admin/customers/[id]/role with the service role key, so the trigger
-- can't see which admin did it. That route writes its own log entry.
--
-- For an update only the fields that actually changed are stored (old value
-- and new value). For an insert / delete the whole row is stored.
--
-- Admins can READ the log (page /admin/audit-log). Nobody can edit or delete
-- log entries through the app, admins included.
--
-- Run in the Supabase SQL Editor AFTER service-reviews.sql.
-- Safe to run more than once.

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  -- Name/email at the time of the change, so the log still reads correctly
  -- if the admin's profile is renamed or deleted later.
  actor_name text,
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id text,
  -- Human-readable name of the record (product name, order number, ...),
  -- kept so deleted records can still be identified.
  record_label text,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[]
);

create index if not exists audit_logs_occurred_at_idx
  on public.audit_logs (occurred_at desc);
create index if not exists audit_logs_table_occurred_at_idx
  on public.audit_logs (table_name, occurred_at desc);
create index if not exists audit_logs_actor_occurred_at_idx
  on public.audit_logs (actor_id, occurred_at desc);
create index if not exists audit_logs_record_id_idx
  on public.audit_logs (record_id);

alter table public.audit_logs enable row level security;

-- Only admins can read; nobody writes through the API (the trigger below
-- writes as the table owner, which RLS doesn't block).
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

drop policy if exists "Admins can read audit logs" on public.audit_logs;
create policy "Admins can read audit logs"
on public.audit_logs for select to authenticated
using (public.current_user_is_admin());

-- Log entries are permanent: block edits and deletes even for roles that
-- bypass RLS (service role, SQL Editor). To clear old entries on purpose,
-- disable this trigger first.
create or replace function public.prevent_audit_log_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit log entries cannot be changed or deleted'
    using errcode = '42501';
end;
$$;

drop trigger if exists prevent_audit_log_changes on public.audit_logs;
create trigger prevent_audit_log_changes
before update or delete on public.audit_logs
for each row
execute function public.prevent_audit_log_changes();

-- The trigger function attached to every audited table.
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_changed text[];
  v_key text;
begin
  -- Only changes made by a signed-in admin are logged.
  if v_actor_id is null or not public.current_user_is_admin() then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new);
  end if;

  if tg_op = 'UPDATE' then
    -- Keep only the fields that changed (timestamps excluded).
    select array_agg(key order by key)
    into v_changed
    from jsonb_each(v_new) as n(key, value)
    where key not in ('updated_at', 'created_at')
      and n.value is distinct from v_old -> key;

    if v_changed is null then
      return null; -- nothing meaningful changed
    end if;

    v_row := v_new;
    v_old := (
      select jsonb_object_agg(key, v_old -> key) from unnest(v_changed) as key
    );
    v_new := (
      select jsonb_object_agg(key, v_row -> key) from unnest(v_changed) as key
    );
  else
    v_row := coalesce(v_new, v_old);
  end if;

  select coalesce(nullif(trim(full_name), ''), email)
  into v_actor_name
  from public.profiles
  where id = v_actor_id;

  insert into public.audit_logs (
    actor_id,
    actor_name,
    action,
    table_name,
    record_id,
    record_label,
    old_data,
    new_data,
    changed_fields
  )
  values (
    v_actor_id,
    v_actor_name,
    lower(tg_op),
    tg_table_name,
    coalesce(
      v_row ->> 'id',
      v_row ->> 'closed_date',
      v_row ->> 'weekday',
      case when v_row ? 'technician_id'
        then (v_row ->> 'technician_id') || ':' || (v_row ->> 'skill_id')
      end
    ),
    left(coalesce(
      v_row ->> 'order_number',
      v_row ->> 'name',
      v_row ->> 'title',
      v_row ->> 'full_name',
      v_row ->> 'setting_key',
      case when v_row ? 'booking_date'
        then concat_ws(' ', v_row ->> 'booking_date', v_row ->> 'booking_time')
      end,
      v_row ->> 'closed_date',
      v_row ->> 'weekday'
    ), 200),
    v_old,
    v_new,
    case when tg_op = 'UPDATE' then v_changed end
  );

  return null;
end;
$$;

-- Attach the trigger to every table admins manage.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'bookings',
    'booking_payments',
    'repair_jobs',
    'product_orders',
    'product_payments',
    'products',
    'product_categories',
    'inventory_movements',
    'services',
    'service_categories',
    'service_reviews',
    'technician_skills',
    'technician_profile_skills',
    'profiles',
    'garage_capacity',
    'garage_closed_dates',
    'garage_operating_days',
    'payment_settings',
    'homepage_footer_settings',
    'homepage_appearance_settings',
    'homepage_slides'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format(
        'drop trigger if exists write_audit_log on public.%I', v_table
      );
      execute format(
        'create trigger write_audit_log
         after insert or update or delete on public.%I
         for each row execute function public.write_audit_log()',
        v_table
      );
    end if;
  end loop;
end $$;
