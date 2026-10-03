-- Customer reviews and star ratings for completed repair bookings.
--
-- One review per booking. A customer can only review their OWN booking, and
-- only once its status is 'completed'. They can edit their review later.
-- Admins can read every review and delete inappropriate ones.
-- Visitors never see individual reviews; the services page shows only the
-- average rating and count per service, via get_service_rating_summary().
--
-- Run in the Supabase SQL Editor. Safe to run more than once.

create table if not exists public.service_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique
    references public.bookings(id) on delete cascade,
  customer_id uuid not null
    references public.profiles(id) on delete cascade,
  service_id uuid not null
    references public.services(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_reviews_service_id_idx
  on public.service_reviews (service_id);
create index if not exists service_reviews_customer_id_idx
  on public.service_reviews (customer_id);

create or replace function public.set_service_reviews_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_service_reviews_updated_at on public.service_reviews;
create trigger set_service_reviews_updated_at
before update on public.service_reviews
for each row
execute function public.set_service_reviews_updated_at();

alter table public.service_reviews enable row level security;

drop policy if exists "Customers can read own reviews" on public.service_reviews;
create policy "Customers can read own reviews"
on public.service_reviews for select to authenticated
using (customer_id = auth.uid());

drop policy if exists "Admins can read all reviews" on public.service_reviews;
create policy "Admins can read all reviews"
on public.service_reviews for select to authenticated
using (public.current_user_is_admin());

-- Insert/update only for the customer's own completed booking, and the
-- service must be the booking's service (so ratings can't be pinned on a
-- different service).
drop policy if exists "Customers can review own completed bookings"
on public.service_reviews;
create policy "Customers can review own completed bookings"
on public.service_reviews for insert to authenticated
with check (
  customer_id = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = service_reviews.booking_id
      and b.customer_id = auth.uid()
      and b.status = 'completed'
      and b.service_id = service_reviews.service_id
  )
);

drop policy if exists "Customers can edit own reviews" on public.service_reviews;
create policy "Customers can edit own reviews"
on public.service_reviews for update to authenticated
using (customer_id = auth.uid())
with check (
  customer_id = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = service_reviews.booking_id
      and b.customer_id = auth.uid()
      and b.status = 'completed'
      and b.service_id = service_reviews.service_id
  )
);

drop policy if exists "Admins can delete reviews" on public.service_reviews;
create policy "Admins can delete reviews"
on public.service_reviews for delete to authenticated
using (public.current_user_is_admin());

-- Average rating per service for the public services page. Returns only
-- aggregates (no names, no comments), so it is safe for visitors.
create or replace function public.get_service_rating_summary()
returns table (
  service_id uuid,
  average_rating numeric,
  review_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    service_id,
    round(avg(rating)::numeric, 1) as average_rating,
    count(*) as review_count
  from public.service_reviews
  group by service_id;
$$;

grant execute on function public.get_service_rating_summary()
  to anon, authenticated;
