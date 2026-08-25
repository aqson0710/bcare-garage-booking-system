create table if not exists public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null default 'default',
  status text not null default 'active',
  promptpay_enabled boolean not null default true,
  promptpay_display_name text not null default 'BigO-RepairCar',
  promptpay_id text,
  promptpay_qr_image_url text,
  bank_transfer_enabled boolean not null default true,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  bank_branch text,
  payment_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint payment_settings_setting_key_unique unique (setting_key),
  constraint payment_settings_status_check check (status in ('active', 'inactive'))
);

alter table public.payment_settings enable row level security;

create or replace function public.touch_payment_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_settings_set_updated_at on public.payment_settings;
create trigger payment_settings_set_updated_at
before update on public.payment_settings
for each row
execute function public.touch_payment_settings_updated_at();

drop policy if exists "Anyone can read active payment settings" on public.payment_settings;
create policy "Anyone can read active payment settings"
on public.payment_settings
for select
to anon, authenticated
using (setting_key = 'default' and status = 'active');

drop policy if exists "Admins can read all payment settings" on public.payment_settings;
create policy "Admins can read all payment settings"
on public.payment_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can insert payment settings" on public.payment_settings;
create policy "Admins can insert payment settings"
on public.payment_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update payment settings" on public.payment_settings;
create policy "Admins can update payment settings"
on public.payment_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

insert into public.payment_settings (
  setting_key,
  status,
  promptpay_enabled,
  promptpay_display_name,
  promptpay_id,
  promptpay_qr_image_url,
  bank_transfer_enabled,
  bank_name,
  bank_account_number,
  bank_account_name,
  bank_branch,
  payment_instructions
)
values (
  'default',
  'active',
  true,
  'BigO-RepairCar',
  '099-999-9999',
  '/mock-promptpay-qr.svg',
  true,
  'ธนาคารกสิกรไทย',
  '123-4-56789-0',
  'BigO-RepairCar Co., Ltd.',
  'สาขาทดสอบ',
  'โอนยอดให้ตรงกับคำสั่งซื้อ แล้วแนบสลิปเพื่อให้ระบบตรวจสอบ'
)
on conflict (setting_key) do nothing;
