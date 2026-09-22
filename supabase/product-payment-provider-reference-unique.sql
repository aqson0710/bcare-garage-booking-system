-- Payment integrity hardening: stop the same SlipOK transaction reference
-- (provider_reference / transRef) from ever being recorded as a successful
-- verification on more than one product_payments row.
--
-- Without this, the app relied only on SlipOK's own best-effort duplicate
-- detection (matched by guessing at wording in its rejection message), so
-- the same real bank slip could in theory be verified successfully for two
-- different orders.
--
-- IMPORTANT: run this check first. If it returns any rows, resolve those
-- duplicates manually (they are pre-existing double-verified payments) before
-- running the rest of this file, or the CREATE UNIQUE INDEX below will fail.
--
--   select provider_reference, array_agg(id) as payment_ids
--   from public.product_payments
--   where provider_reference is not null
--   group by provider_reference
--   having count(*) > 1;

drop index if exists public.product_payments_provider_reference_idx;

create unique index if not exists product_payments_provider_reference_key
on public.product_payments(provider_reference)
where provider_reference is not null;
