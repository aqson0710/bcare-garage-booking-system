-- Export the BCare database structure as one SQL script.
-- Run in Supabase SQL Editor, then copy the single result cell.
with
enums as (
  select 10 as ord, t.typname as name,
    format('create type public.%I as enum (%s);', t.typname,
      string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder)) as ddl
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
  group by t.typname
),
tables as (
  select 20 as ord, c.relname as name,
    format(E'create table public.%I (\n%s\n);', c.relname,
      string_agg(
        format('  %I %s%s%s', a.attname,
          format_type(a.atttypid, a.atttypmod),
          case when ad.adbin is not null
            then ' default ' || pg_get_expr(ad.adbin, ad.adrelid) else '' end,
          case when a.attnotnull then ' not null' else '' end),
        E',\n' order by a.attnum)) as ddl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r'
  group by c.relname
),
constraints as (
  select case when con.contype = 'f' then 40 else 30 end as ord,
    c.relname || '.' || con.conname as name,
    format('alter table public.%I add constraint %I %s;',
      c.relname, con.conname, pg_get_constraintdef(con.oid)) as ddl
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and con.contype in ('p', 'u', 'c', 'f', 'x')
),
indexes as (
  select 50 as ord, i.indexname as name, i.indexdef || ';' as ddl
  from pg_indexes i
  where i.schemaname = 'public'
    and not exists (
      select 1 from pg_constraint con
      join pg_namespace n on n.oid = con.connamespace
      where n.nspname = 'public' and con.conname = i.indexname)
),
functions as (
  select 60 as ord, p.proname as name,
    pg_get_functiondef(p.oid) || ';' as ddl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d
      where d.objid = p.oid and d.deptype = 'e')
),
views as (
  select 70 as ord, c.relname as name,
    format(E'create or replace view public.%I as\n%s', c.relname,
      pg_get_viewdef(c.oid, true)) as ddl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
),
triggers as (
  select 80 as ord, t.tgname as name, pg_get_triggerdef(t.oid, true) || ';' as ddl
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and (n.nspname = 'public'
      or (n.nspname = 'auth' and c.relname = 'users'))
),
rls as (
  select 90 as ord, c.relname as name,
    format('alter table public.%I enable row level security;', c.relname) as ddl
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
),
policies as (
  select 100 as ord, p.schemaname || '.' || p.tablename || '.' || p.policyname as name,
    format('create policy %I on %I.%I as %s for %s to %s%s%s;',
      p.policyname, p.schemaname, p.tablename, lower(p.permissive), lower(p.cmd),
      array_to_string(p.roles, ', '),
      case when p.qual is not null then E'\n  using (' || p.qual || ')' else '' end,
      case when p.with_check is not null
        then E'\n  with check (' || p.with_check || ')' else '' end) as ddl
  from pg_policies p
  where p.schemaname = 'public'
    or (p.schemaname = 'storage' and p.tablename = 'objects')
),
buckets as (
  select 110 as ord, b.id as name,
    format('insert into storage.buckets (id, name, public) values (%L, %L, %L) on conflict (id) do nothing;',
      b.id, b.name, b.public) as ddl
  from storage.buckets b
),
all_ddl as (
  select * from enums union all select * from tables
  union all select * from constraints union all select * from indexes
  union all select * from functions union all select * from views
  union all select * from triggers union all select * from rls
  union all select * from policies union all select * from buckets
)
select
  E'-- BCare database schema (exported ' || now()::date || E')\n'
  || E'-- Run on an empty Supabase project (SQL Editor).\n\n'
  || E'set check_function_bodies = off;\n\n'
  || string_agg(ddl, E'\n\n' order by ord, name) as schema_sql
from all_ddl;
