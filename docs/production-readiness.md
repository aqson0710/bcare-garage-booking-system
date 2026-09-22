# Production Readiness Checklist

Step 17 prepares BCare for a safe deploy and team testing pass. This file does
not contain real secrets.

## Current Status

- Main customer booking flow is implemented.
- Auth, profile, vehicle reuse, and protected customer pages are implemented.
- Admin booking, service, category, customer, report, repair job, capacity,
  product, inventory, product order, payment review, payment settings, dashboard,
  product image, and service image flows are implemented.
- SlipOK server verification route and admin verify button are implemented.
- Debug browser pages were removed from the app routes.
- Remaining planned work: notifications, invoice/receipt, delivery/shipping
  refinement, final design polish, full QA, and deployment documentation.

## Required Environment Variables

Local development and deployment need these keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SLIPOK_BRANCH_ID=
SLIPOK_API_KEY=
SLIPOK_MODE=test
```

Keep these rules:

- Never commit `.env.local`.
- Never put real `SUPABASE_SERVICE_ROLE_KEY` or `SLIPOK_API_KEY` in README,
  screenshots, client components, or browser-visible code.
- `SUPABASE_SERVICE_ROLE_KEY` must be used only from server code.
- `SLIPOK_API_KEY` must be used only from server code.

## Supabase SQL Checklist

Before production testing, confirm these SQL files have been applied in the
Supabase project when their feature is used:

- `supabase/authenticated-rls-policies.sql`
- `supabase/admin-role-access.sql`
- `supabase/admin-booking-status-policies.sql`
- `supabase/admin-service-management-policies.sql`
- `supabase/admin-service-category-management-policies.sql`
- `supabase/repair-jobs-work-order-schema-alignment.sql`
- `supabase/technician-specialty-profile-field.sql`
- `supabase/technician-multi-skill-schema.sql`
- `supabase/technician-work-order-read-policies.sql`
- `supabase/technician-work-order-update-policies.sql`
- `supabase/customer-work-order-read-policies.sql`
- `supabase/work-order-status-sync-rules.sql`
- `supabase/schedule-capacity-schema.sql`
- `supabase/garage-operating-days.sql`
- `supabase/schedule-capacity-overbooking-guard.sql`
- `supabase/product-inventory-schema-alignment.sql`
- `supabase/product-sales-schema-alignment.sql`
- `supabase/product-order-stock-deduction.sql`
- `supabase/product-order-stock-safe-cancellation.sql`
- `supabase/product-payment-slipok-schema.sql`
- `supabase/product-payment-slip-storage.sql`
- `supabase/payment-settings-schema.sql`
- `supabase/payment-settings-storage.sql`
- `supabase/product-image-upload.sql`
- `supabase/service-image-upload.sql`
- `supabase/product-payment-provider-reference-unique.sql` (run the
  duplicate-check query in this file's header comment first; see
  "Payment Verification Security Fix" below)

## Verification Before Deploy

Run these checks before sharing a production-like build:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected result: all three commands complete successfully.

## Manual Flow Test

Use these flows for a team test pass:

- Customer auth: register/login/logout and profile save.
- Customer booking: select service, select date/time from available capacity,
  create booking, view booking detail, cancel pending booking.
- Admin booking: filter/search bookings, confirm/cancel/complete, open booking
  detail, create repair job from confirmed booking.
- Technician: view assigned repair jobs, update work status, diagnosis, and
  repair notes.
- Customer repair tracking: view repair progress from booking detail.
- Admin capacity: manage capacity, operating days, and closed dates.
- Admin services: edit service/category details and upload service images.
- Product store: browse products, add to cart, checkout, and view order detail.
- Admin products: manage products, categories, stock movements, and product
  images.
- Product orders: cancel safely, confirm stock return, review payment queue.
- Payment: customer sees payment instructions, uploads slip, admin manually
  approves/rejects, and admin can test SlipOK verification when real slip data is
  available.
- Payment settings: admin updates PromptPay QR and bank transfer instructions,
  then customer order detail reflects the latest active settings.

## Deployment Notes

- Set the same environment variable names on the hosting provider.
- Use the production Supabase project URL and publishable key.
- Keep service-role and SlipOK keys as server-only secrets.
- Confirm Supabase Storage buckets and policies exist for product images,
  service images, payment QR assets, and payment slips.
- Run a fresh `npm run build` on the deployment host.
- After deploy, test with one customer account, one admin account, and one
  technician account.

## Payment Verification Security Fix

A review of the SlipOK payment flow found that the amount used to verify a
slip came from a customer-editable form field instead of the order's own
total. A customer could report a lower amount than they actually owed, have
that lower amount verified successfully by SlipOK, and have the full order
marked as paid.

Fixed:

- `src/app/api/product-payments/[paymentId]/verify-slipok/route.ts` now
  always fetches `product_orders.total_amount` fresh and uses that as the
  amount sent to SlipOK, ignoring `payment.amount` / `payment.slip_amount`.
- `src/features/products/queries.ts` `submitProductPaymentSlip` now rejects a
  slip submission whose amount does not match the order total, as an
  earlier check on top of the fix above.
- `src/features/products/components/customer-product-order-detail-panel.tsx`
  no longer lets the customer edit the amount field; it always displays and
  submits `order.total_amount`.
- `supabase/product-payment-provider-reference-unique.sql` adds a unique
  index on `product_payments.provider_reference` so the same SlipOK
  transaction reference can never be recorded as a successful verification
  on two different payments. Run the duplicate-check query in that file's
  header comment first.

Not yet done in this pass (tracked separately):

- `verified_by` on an auto-verified-by-SlipOK payment currently stores the
  customer's own user id (the route reuses the same variable for whichever
  user called the endpoint). Worth a follow-up to distinguish system
  verification from admin verification explicitly.
- Full ledger-style rework (separate invoice / payment attempt / verified
  transaction tables, so an order's paid status is always recomputed from
  the sum of verified transactions instead of set directly by one
  verification call) is a larger follow-up, not part of this fix.

Manual test after applying this fix:

1. Create a product order, note its total.
2. Try to upload a slip and confirm the amount field shows the order total
   and cannot be edited.
3. Upload a real slip for less than the order total and confirm SlipOK
   verification fails with an amount-mismatch message, and the order stays
   unpaid.
4. Upload a real slip for the exact order total and confirm it verifies and
   the order is marked paid.
