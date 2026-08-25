# BCare Garage Booking System

BCare is the garage booking system for BigO-RepairCar.

## Current Step

Step 13 Part 2: Admin SlipOK Verify Button

Completed in this part:

- Part 1: Project Initialization
- Part 2: Supabase environment setup and client connection
- Part 3: Supabase SDK client setup
- Part 4: First real table query check
- Part 5: Core database types and table access check
- Part 6: First feature data layer for services
- Step 6 Part 1: Services listing page
- Step 6 Part 2: Service selection state
- Step 6 Part 3: Booking form UI
- Step 6 Part 4: Authenticated booking database insert
- Step 7 Part 1: Auth UI setup
- Step 7 Part 2: Profile creation after register/login
- Step 7 Part 3: Authenticated RLS policies
- Step 7 Part 4: Auth state integration into booking flow
- Step 6 Part 5: My bookings page
- Step 6 Part 6: Vehicle reuse and booking date/time validation
- Step 6 Part 7: My vehicles page
- Step 6 Part 8: Booking detail and cancel booking
- Step 8 Part 0: Admin role and access setup
- Step 8 Part 1: Admin booking list
- Step 8 Part 2: Admin booking status management
- Step 8 Part 3: Admin booking status correction
- Step 8 Part 4: Admin booking detail page
- Step 8 Part 5: Admin dashboard summary
- Step 8 Part 6: Admin booking pagination, status URL filters, and search
- Step 8 Part 7: Admin service price, duration, and status management
- Step 8 Part 8: Admin service category name, description, and status management
- Step 8 Part 8.1: Add service categories and assign services by category dropdown
- Step 8 Part 9: Admin customer list and customer detail view
- Step 8 Part 10: Admin reports and basic analytics
- Step 9 Part 0: Work order schema check tool and read-only SQL check plan
- Step 9 Part 1: Repair jobs work order schema alignment
- Step 9 Part 2: Admin work orders list foundation
- Step 9 Part 3: Admin create work order from confirmed booking
- Step 9 Part 4: Admin assign mechanic to work order
- Step 9 Part 4.1: Technician specialty label for mechanic assignment
- Step 9 Part 4.2: Technician multi-skill schema
- Step 9 Part 4.3: Admin mechanic assignment shows multi-skills
- Step 9 Part 4.4: Technician profile and multi-skill management
- Step 9 Part 5: Technician assigned work orders page
- Step 9 Part 6: Technician work order detail, status updates, diagnosis, and repair notes
- Step 9 Part 7: Customer work order progress visibility
- Step 9 Part 8: Booking and work order status sync rules
- Step 9 Part 9: Technician work order status filtering
- Step 9 Part 10: Final Step 9 review, documentation cleanup, and completion checks
- Step 9 Part 11: Admin technician skill management page
- Step 10 Part 0: Schedule and capacity schema check
- Step 10 Part 1: Schedule and capacity database schema
- Step 10 Part 2: Admin capacity management UI
- Step 10 Part 3: Customer booking availability
- Step 10 Part 3.1: Thai UI text pass for customer booking and admin capacity
- Step 10 Part 4: Prevent overbooking
- Step 10 Part 5: Admin schedule overview
- Step 10 Part 5.1: Garage operating days and closed dates
- Step 10 Part 6: Final schedule and capacity review
- Step 11 Part 0: Product and inventory schema check tool and read-only SQL check plan
- Step 11 Part 1: Product and inventory schema alignment
- Step 11 Part 2: Admin products management UI
- Step 11 Part 3: Admin inventory movements UI
- Step 11 Part 4: Admin product category management UI
- Step 11 Part 5: Low stock and inventory review
- Step 11 Part 6: Final product and inventory review
- Step 12 Part 0: Product sales and customer storefront schema check
- Step 12 Part 1: Product sales schema alignment
- Step 12 Part 2: Customer product storefront UI
- Step 12 Part 3: Cart review and quantity management
- Step 12 Part 4: Checkout and product order creation
- Step 12 Part 5: Order stock deduction and inventory movement
- Step 12 Part 6: Customer product order history
- Step 12 Part 7: Admin product orders
- Step 12 Part 8: Admin product order status management
- Step 12 Part 9: Stock-safe product order cancellation
- Step 12 Part 9.1: Product order cancellation UI sync
- Step 12 Part 10: SlipOK payment schema and planning
- Step 12 Part 11: Customer payment slip upload UI
- Step 12 Part 12: Admin payment proof review
- Step 12 Part 13: Admin manual payment approval
- Step 12 Part 14: Customer payment status sync and re-upload flow
- Step 12 Part 15: Product payment admin queue and final payment review
- Step 12 Part 16: Final product sales review and cleanup
- Step 13 Part 0: SlipOK readiness and safe integration planning
- Step 13 Part 1: SlipOK server verification route
- Step 13 Part 2: Admin SlipOK verify button

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- ESLint

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

The home page now shows the first feature UI: the active BigO-RepairCar
services grouped by service category. Signed-in users with a saved customer
profile can select one service and submit a booking request to Supabase.

## Supabase Setup

Create `.env.local` from `.env.example`, then fill in the Supabase project
values from the Supabase dashboard:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

After starting the development server, verify the client-side Supabase
connection in the browser:

```text
http://localhost:3000/supabase-check
```

The Data API root endpoint requires elevated access. If the browser check
returns `ok: true` with status `401` or `403`, the project is still reachable
and the public key is being sent correctly.

There is also a server-side diagnostic endpoint:

```text
http://localhost:3000/api/supabase/health
```

In restricted local environments, this endpoint can fail if Node.js cannot
connect outbound even though the browser can reach Supabase.

## Supabase Clients

Use the browser client in Client Components:

```ts
import { createClient } from "@/lib/supabase/browser";

const supabase = createClient();
```

Use the server client in Server Components, Route Handlers, and Server Actions:

```ts
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
```

Database table types are scaffolded in `src/lib/supabase/database.types.ts` and
currently include the confirmed readable tables `services` and
`service_categories`. They can be replaced with generated Supabase types after
the full schema is finalized.

## Data Query Check

Use this setup-only page to query one real table from Supabase:

```text
http://localhost:3000/supabase-data-check
```

Enter a table name such as `services`, `bookings`, or the exact table name from
the Supabase database created in Step 4.

Use this setup-only page to check access across the confirmed core BCare tables:

```text
http://localhost:3000/supabase-table-access-check
```

The current confirmed readable tables are `services`, `service_categories`,
`vehicles`, `bookings`, and `profiles`.

## Services Data Layer

Use the shared services data layer for the first feature UI:

```ts
import { getServicesWithCategories } from "@/features/services";
```

Use this setup-only page to verify the grouped services data:

```text
http://localhost:3000/services-data-check
```

Use this setup-only page before inserting bookings:

```text
http://localhost:3000/supabase-schema-check
```

Use this setup-only page to check whether guest profile insert is allowed:

```text
http://localhost:3000/supabase-insert-check
```

## Auth

Use this page to test customer login, registration, logout, and current session
state. Signed-in users can also create or update their customer profile row:

```text
http://localhost:3000/auth
```

The app header links the service booking page and account page so the current
test flow can be completed in the browser:

1. Open `/auth`, sign in or register, and save a customer profile.
2. Open `/`, select a service, fill vehicle/date/time details, and submit.
3. A successful submission reuses the user's existing vehicle when the license
   plate already exists, or creates a new vehicle row before creating a pending
   booking row.
4. Booking times can be selected from 09:00 to 18:00.
5. Open `/my-bookings` to review booking requests linked to the current user.
6. Open `/my-bookings/[id]` from a booking card to review detail or cancel a
   pending booking.
7. Open `/my-vehicles` to update vehicle brand, model, year, color, and plate.

Use this page after applying authenticated RLS policies:

```text
http://localhost:3000/auth-rls-check
```

## Admin Access

Run this SQL in Supabase SQL Editor before testing admin access:

```text
supabase/admin-role-access.sql
```

Then open:

```text
http://localhost:3000/admin
```

The page confirms whether the current signed-in account has the `admin` role.
Admin users can see booking status counts and recent requests on the dashboard.
Admin users can review all customer bookings at:

```text
http://localhost:3000/admin/bookings
```

The admin bookings page supports pagination, status filters, and search by
customer name, phone, email, vehicle plate, service name, note, or booking ID.
Status dashboard cards also link to filtered booking lists, for example:

```text
http://localhost:3000/admin/bookings?status=pending
```

Admin users can open a single booking detail page at:

```text
http://localhost:3000/admin/bookings/[id]
```

Run this SQL before using admin status buttons:

```text
supabase/admin-booking-status-policies.sql
```

Run this SQL before using admin service management:

```text
supabase/admin-service-management-policies.sql
```

Then open:

```text
http://localhost:3000/admin/services
```

Admin users can update each service's base price, estimated duration, and
active/inactive status. Inactive services are hidden from the customer booking
page.

Run this SQL before using admin service category management:

```text
supabase/admin-service-category-management-policies.sql
```

Then open:

```text
http://localhost:3000/admin/service-categories
```

Admin users can update each category's name, description, and active/inactive
status. Inactive categories are hidden from the customer booking page.

Admin users can also add new categories from `/admin/service-categories`.
After a category is added, it appears in the category dropdown on:

```text
http://localhost:3000/admin/services
```

Admin users should assign service categories from this dropdown instead of
typing category names manually.

Admin users can review customers at:

```text
http://localhost:3000/admin/customers
```

The customer list supports search by customer name, phone, or email. Admin
users can open a customer detail page to review profile data, vehicles, and
booking history. Customer data is read-only in Step 8 Part 9.

Admin users can review reports at:

```text
http://localhost:3000/admin/reports
```

Reports include booking totals, status totals, estimated revenue from confirmed
and completed bookings, and top services, customers, and vehicles.

## Work Order Schema Check

Step 9 starts by checking whether the database already has a work order table
candidate before building the technician workflow.

Open this local diagnostic page:

```text
http://localhost:3000/work-order-schema-check
```

For direct database confirmation, run this read-only SQL in Supabase SQL Editor:

```text
supabase/work-order-schema-check.sql
```

If neither `work_orders` nor `repair_jobs` exists, review and approve the next
Step 9 part before creating any new work order schema.

## Repair Jobs Work Order Schema

Step 9 uses the existing `repair_jobs` table as the work order table for the
MVP. The database keeps the existing assignment field name:

```text
repair_jobs.mechanic_id
```

The `mechanic_id` value stores the assigned technician's `profiles.id`. The
account role remains:

```text
profiles.role = 'technician'
```

Run this SQL in Supabase SQL Editor before building the technician workflow:

```text
supabase/repair-jobs-work-order-schema-alignment.sql
```

This alignment adds missing work order fields such as `customer_id`,
`vehicle_id`, `mechanic_id`, `diagnosis`, and `repair_notes` when needed, and
keeps RLS scoped to admins, the assigned mechanic, and the owning customer.

Admin users can review the work order foundation list at:

```text
http://localhost:3000/admin/repair-jobs
```

This page reads `repair_jobs` and shows linked booking, customer, vehicle,
service, and mechanic information. Admin users can assign a mechanic from
profiles where `role = 'technician'`. Assigning a mechanic to a pending work
order moves it to `assigned`; removing the mechanic from an assigned work order
moves it back to `pending`.

Admin users can create a work order from a confirmed booking on:

```text
http://localhost:3000/admin/bookings/[id]
```

The booking must be `confirmed` before the create action is enabled. The app
checks for an existing `repair_jobs` row for that booking before inserting, so
the UI does not create duplicates during the MVP flow.

Run this SQL before setting mechanic specialties:

```text
supabase/technician-specialty-profile-field.sql
```

Then set `profiles.technician_specialty` for technician accounts in Supabase
Table Editor. The admin work orders page shows the specialty in the mechanic
dropdown so admins can choose the right mechanic more easily.

For the long-term technician skill model, run:

```text
supabase/technician-multi-skill-schema.sql
```

This adds `technician_skills` as the reusable skill list and
`technician_profile_skills` as the join table between technician profiles and
their skills. A technician can have multiple skills. The older
`profiles.technician_specialty` field can remain as a temporary MVP label while
the multi-skill UI is completed.

The admin work orders page now reads these multi-skill tables for mechanic
assignment. The mechanic dropdown shows each technician with all active skills,
for example:

```text
Somchai - Engine, Electrical (somchai@example.com)
```

If a technician has no multi-skill rows yet, the page falls back to
`profiles.technician_specialty`, then `No skills set`.

Technician users can manage their own profile and skills at:

```text
http://localhost:3000/technician/profile
```

The account must have `profiles.role = 'technician'`. The page lets technicians
update their name, phone number, short specialty label, and selected skills.

Admin users can manage the technician skill list at:

```text
http://localhost:3000/admin/technician-skills
```

This page uses the `technician_skills` table created by
`supabase/technician-multi-skill-schema.sql`. Admin users can add skills, update
names and descriptions, and mark skills active or inactive. Technician profile
selection and admin mechanic assignment continue to use active skills.

Run this SQL before testing the technician work orders page:

```text
supabase/technician-work-order-read-policies.sql
```

Technician users can review their assigned repair jobs at:

```text
http://localhost:3000/technician/work-orders
```

This page shows only `repair_jobs` rows where `mechanic_id` matches the signed-in
technician account. Technicians can also filter this page by work order status
using the summary cards at the top of the page.

Run this SQL before testing technician work order updates:

```text
supabase/technician-work-order-update-policies.sql
```

Technician users can open and update one assigned repair job at:

```text
http://localhost:3000/technician/work-orders/[id]
```

The detail page lets technicians update the work order status, diagnosis, and
repair notes. Starting work sets `started_at`; completing work sets
`completed_at`. Closed work orders are read-only for technicians.

Run this SQL before testing customer work order progress:

```text
supabase/customer-work-order-read-policies.sql
```

Customer users can see work order progress for their own bookings at:

```text
http://localhost:3000/my-bookings
http://localhost:3000/my-bookings/[id]
```

The customer pages show whether a work order has been created, the repair job
status, the assigned mechanic, diagnosis, repair notes, and start/completion
timestamps. Customer access remains scoped to `repair_jobs.customer_id =
auth.uid()`.

Run this SQL before testing booking/work order status sync:

```text
supabase/work-order-status-sync-rules.sql
```

The status sync rules keep the workflow consistent:

- Completing a repair job marks the linked booking as `completed`.
- Cancelling a booking marks open linked repair jobs as `cancelled`.
- Completing a booking marks linked repair jobs as `completed`.
- A cancelled booking cannot keep an open repair job.
- A pending booking cannot progress to active repair work until confirmed.

Recommended Step 9 SQL run order for a fresh Supabase database:

```text
supabase/repair-jobs-work-order-schema-alignment.sql
supabase/technician-specialty-profile-field.sql
supabase/technician-multi-skill-schema.sql
supabase/technician-work-order-read-policies.sql
supabase/technician-work-order-update-policies.sql
supabase/customer-work-order-read-policies.sql
supabase/work-order-status-sync-rules.sql
```

Step 9 is complete when this flow works end to end:

1. Admin confirms a booking and creates a repair job from it.
2. Admin assigns a technician profile to the repair job.
3. Technician sees only assigned repair jobs.
4. Technician opens a repair job, updates diagnosis, repair notes, and status.
5. Customer sees work order progress on their own booking pages.
6. Booking and repair job statuses stay synced for completed and cancelled work.

## Schedule / Capacity Schema Check

Step 10 starts by checking whether the database already has schedule or capacity
tables before adding capacity rules.

Open this local diagnostic page:

```text
http://localhost:3000/schedule-capacity-schema-check
```

The page checks these table candidates:

```text
bookings
garage_capacity
booking_capacity
schedule_capacity
booking_slots
service_slots
mechanic_schedules
```

It also summarizes recent booking slots from `bookings.booking_date` and
`bookings.booking_time` so duplicate active booking times are visible before
capacity rules are added.

For direct database confirmation, run this read-only SQL in Supabase SQL Editor:

```text
supabase/schedule-capacity-schema-check.sql
```

Step 10 Part 0 does not create or modify schedule data. It confirms the current
state before deciding the capacity schema in the next approved part.

## Schedule / Capacity Database Schema

Step 10 Part 1 adds the first dedicated capacity table for booking slots:

```text
garage_capacity
```

Run this SQL in Supabase SQL Editor:

```text
supabase/schedule-capacity-schema.sql
```

The table uses the same schedule keys as existing bookings:

```text
booking_date
booking_time
```

Admins can manage capacity rows. Authenticated users can read open capacity
slots. The schema also adds helper functions for upcoming availability and
overbooking checks:

```text
get_garage_slot_availability(date, time)
is_garage_slot_available(date, time)
```

Step 10 Part 1 does not change the customer booking UI yet. Customer slot
filtering and database-level overbooking prevention are handled in later Step
10 parts after this SQL is reviewed and run.

## Admin Capacity Management

Step 10 Part 2 adds the admin capacity management page:

```text
http://localhost:3000/admin/capacity
```

Admin users can add and update `garage_capacity` slots with:

```text
booking_date
booking_time
max_bookings
status
note
```

The page shows active booking counts for each slot using pending and confirmed
bookings, then calculates remaining capacity. It also blocks duplicate
date/time rows in the UI before sending the change to Supabase.

Step 10 Part 2 requires `supabase/schedule-capacity-schema.sql` from Step 10
Part 1 to be run first. Customer booking availability is still handled in the
next approved part.

## Customer Booking Availability

Step 10 Part 3 connects the customer booking form to the capacity rules from
`garage_capacity`.

When a signed-in customer selects a booking date, the booking form checks each
30-minute time slot through:

```text
get_garage_slot_availability(date, time)
```

The time dropdown only shows slots that are open and still have remaining
capacity. Each option also shows the remaining booking count for that slot.

This part improves the customer UI selection flow, but it does not yet add the
database-level race-condition guard for two users booking the same final slot at
the same time. That protection is handled in Step 10 Part 4.

## Prevent Overbooking

Step 10 Part 4 adds a database trigger that blocks booking inserts or schedule
updates when the selected slot is already full or closed.

Run this SQL in Supabase SQL Editor:

```text
supabase/schedule-capacity-overbooking-guard.sql
```

The trigger checks `bookings` before insert or update of:

```text
booking_date
booking_time
status
```

For active booking statuses (`pending`, `confirmed`), the database locks the
selected date/time slot during the transaction, counts existing active bookings,
and compares that count with `garage_capacity.max_bookings`. If no explicit
capacity row exists, the fallback capacity is 1 open slot.

This protects against two users submitting the last available slot at the same
time. The customer UI also maps the database errors to Thai messages when a
slot is full, closed, or outside business hours.

## Admin Schedule Overview

Step 10 Part 5 adds the admin schedule overview page:

```text
http://localhost:3000/admin/schedule
```

The page shows a 7-day table of booking slots from 09:00 to 18:00 in 30-minute
intervals. Each cell shows:

```text
active bookings / max bookings
available booking count
open, full, or closed state
```

The overview combines `garage_capacity` with active `bookings` (`pending` and
`confirmed`). Slots without an explicit capacity row use the MVP fallback rule:
open with 1 available booking capacity. Use `/admin/capacity` to add or edit
capacity rules.

## Garage Operating Days / Closed Dates

Step 10 Part 5.1 adds shop-level opening rules so the garage can close whole
days before customers choose a booking time.

Run this SQL in Supabase SQL Editor:

```text
supabase/garage-operating-days.sql
```

The SQL adds:

```text
garage_operating_days
garage_closed_dates
get_garage_operating_status(date)
```

Default weekly rules are Monday-Friday open from 09:00 to 18:00, and Saturday
and Sunday closed. Admin users can change the weekly settings and add special
closed dates at:

```text
http://localhost:3000/admin/operating-days
```

Closed weekly days and special closed dates are used by the customer booking
form, the admin schedule overview, and the database overbooking guard. When the
garage is closed for a selected date, the customer time dropdown shows no
booking times and the database rejects booking inserts for that date.

## Step 10 Final Review

Step 10 completes the first schedule and capacity layer for the booking flow.
The system now supports:

- Admin capacity rules per date/time slot.
- Customer booking time dropdown filtered by remaining capacity.
- Database-level protection against overbooking active bookings.
- Admin 7-day schedule overview.
- Weekly shop open/closed settings.
- Special closed dates that hide customer times and block booking inserts.

Recommended Step 10 SQL run order for a fresh Supabase database:

```text
supabase/schedule-capacity-schema.sql
supabase/schedule-capacity-overbooking-guard.sql
supabase/garage-operating-days.sql
```

The Step 10 admin pages are:

```text
http://localhost:3000/admin/capacity
http://localhost:3000/admin/schedule
http://localhost:3000/admin/operating-days
```

Recommended Step 10 test checklist:

1. Run the three Step 10 SQL files above in Supabase SQL Editor.
2. Sign in with an admin account and open `/admin/capacity`.
3. Add a capacity row for a future date/time with `max_bookings = 1`.
4. Sign in as a customer, open `/`, select a service, and choose that date.
5. Confirm that the time dropdown only shows open slots with remaining capacity.
6. Submit one booking for the slot.
7. Try to submit another active booking for the same slot and confirm it is blocked.
8. Open `/admin/schedule` and confirm the active booking count appears.
9. Open `/admin/operating-days`, close one weekday, then choose a matching date on `/`.
10. Confirm the customer booking form shows no times for closed shop dates.

Step 10 is complete when customer booking availability, admin capacity rules,
admin schedule overview, weekly closed days, special closed dates, and the
database overbooking guard all agree on the same open/closed state.

## Product / Inventory Schema Check

Step 11 starts by checking whether the database already has product, inventory,
or product order table candidates before creating the product and stock schema.

Open this local diagnostic page:

```text
http://localhost:3000/product-inventory-schema-check
```

The page checks these table candidates:

```text
product_categories
products
inventory_items
inventory_movements
stock_movements
product_orders
product_order_items
```

For direct database confirmation, run this read-only SQL in Supabase SQL Editor:

```text
supabase/product-inventory-schema-check.sql
```

Step 11 Part 0 does not create or modify product or inventory data. It confirms
the current database state before deciding the product and inventory schema in
the next approved part.

## Product / Inventory Schema Alignment

Step 11 Part 1 keeps the existing `product_categories` and `products` rows, then
adds the first inventory foundation.

Run this SQL in Supabase SQL Editor:

```text
supabase/product-inventory-schema-alignment.sql
```

This alignment:

- Adds product price and SKU fields: `sku`, `unit_price`, and `cost_price`.
- Keeps the existing `products.stock_quantity` field as the current stock count.
- Creates `inventory_movements` for stock in, stock out, adjustments, sales,
  repair usage, and returns.
- Adds a trigger so each new inventory movement updates
  `products.stock_quantity`.
- Blocks stock movements that would make product stock negative.
- Allows authenticated users to read active products and product categories.
- Allows admin users to manage product categories, products, and inventory
  movements.

Step 11 Part 1 does not add the admin product UI yet. The admin product and
stock management screens start in the next approved part after this SQL has
been reviewed and run.

## Admin Products Management

Step 11 Part 2 adds the admin product management page:

```text
http://localhost:3000/admin/products
```

Admin users can:

- Add new products with product category, SKU, sale price, cost price, and
  active/inactive status.
- Update existing product name, description, category, SKU, sale price, cost
  price, and active/inactive status.
- Search products by name, SKU, description, or category.
- Filter products by status.
- Review current stock quantity and low-stock counts.

Current stock is read-only in this part. Stock changes are intentionally kept
for the next approved inventory movement part so stock adjustments have a
history in `inventory_movements`.

## Admin Inventory Movements

Step 11 Part 3 adds the admin inventory movement page:

```text
http://localhost:3000/admin/inventory
```

Admin users can record stock changes through `inventory_movements`:

- `stock_in` for receiving stock.
- `stock_out` for manual stock out.
- `adjustment_in` for correcting stock upward.
- `adjustment_out` for correcting stock downward.
- `repair_usage` for using product stock in repair work.
- `return` for returned stock.

Each movement inserts a history row and the database trigger updates
`products.stock_quantity`. The UI blocks obvious negative-stock attempts before
submitting, and the database trigger remains the final protection against stock
going below zero.

The page also shows total stock, low-stock count, and recent inventory movement
history with product, quantity, note, and creator details.

## Admin Product Category Management

Step 11 Part 4 adds the admin product category management page:

```text
http://localhost:3000/admin/product-categories
```

Admin users can:

- Add product categories.
- Update product category names and descriptions.
- Mark product categories active or inactive.
- Search product categories.
- Filter product categories by status.

The product management page links to this page so admins can add a product
category before assigning products to it.

## Low Stock / Inventory Review

Step 11 Part 5 adds the admin inventory review page:

```text
http://localhost:3000/admin/inventory-review
```

Admin users can:

- Review active product count and total stock.
- See out-of-stock, low-stock, and healthy-stock counts.
- Filter products by stock status: all, out, low, healthy, or inactive.
- Search by product name, SKU, description, or category.
- See the latest inventory movement for each product.
- Jump to inventory movement entry or product editing from each review row.

Low stock currently means an active product has stock quantity of 2 or lower.
The review page is for stock visibility only. Stock changes still happen through
`/admin/inventory` so every stock update is recorded in `inventory_movements`.

## Step 11 Final Review

Step 11 completes the first product and inventory management layer for the
admin workflow.

The system now supports:

- Product and product category schema checks.
- Product SKU, sale price, cost price, status, and current stock fields.
- Inventory movement history in `inventory_movements`.
- Database-triggered stock updates from inventory movements.
- Database protection against negative stock.
- Admin product management.
- Admin product category management.
- Admin stock in/out and adjustment recording.
- Admin low-stock and inventory review.

Recommended Step 11 SQL run order for a fresh Supabase database:

```text
supabase/product-inventory-schema-alignment.sql
```

Optional read-only check before or after alignment:

```text
supabase/product-inventory-schema-check.sql
```

The Step 11 admin pages are:

```text
http://localhost:3000/admin/products
http://localhost:3000/admin/product-categories
http://localhost:3000/admin/inventory
http://localhost:3000/admin/inventory-review
```

Recommended Step 11 test checklist:

1. Run the Step 11 schema alignment SQL in Supabase SQL Editor.
2. Sign in with an admin account and open `/admin/product-categories`.
3. Add or update a product category.
4. Open `/admin/products` and add or update a product with SKU, price, cost,
   category, and active status.
5. Open `/admin/inventory` and record a `stock_in` movement for that product.
6. Confirm product stock increases on `/admin/products`.
7. Record a `stock_out` or `repair_usage` movement within available stock.
8. Confirm product stock decreases and negative stock is blocked.
9. Open `/admin/inventory-review` and confirm out, low, and healthy stock
   filters work.
10. Confirm every stock change appears in recent inventory movement history.

Step 11 is complete when admins can manage products, categories, stock
movements, and low-stock review without directly editing stock numbers by hand.

Customer product storefront, cart, product orders, pickup/delivery choices, and
payment begin in Step 12.

## Product Sales / Customer Storefront Schema Check

Step 12 starts by checking whether the database already has customer product
sales, cart, delivery, or payment table candidates before creating the
storefront order schema.

Open this local diagnostic page:

```text
http://localhost:3000/product-sales-schema-check
```

The page checks these table candidates:

```text
products
product_categories
product_orders
product_order_items
product_payments
shopping_carts
shopping_cart_items
delivery_addresses
```

There is also a read-only SQL check for Supabase SQL Editor:

```text
supabase/product-sales-schema-check.sql
```

Step 12 Part 0 does not create or modify product sales data. It confirms the
current database state before deciding the customer storefront, cart, order,
pickup/delivery, and payment schema in the next approved part.

## Product Sales Schema Alignment

Step 12 Part 1 creates the first customer product sales foundation.

Run this SQL in Supabase SQL Editor:

```text
supabase/product-sales-schema-alignment.sql
```

This alignment creates:

- `delivery_addresses` for saved customer delivery addresses.
- `shopping_carts` for one active customer cart at a time.
- `shopping_cart_items` for products inside a customer cart.
- `product_orders` for customer product purchase orders.
- `product_order_items` for products inside each order.
- `product_payments` for payment tracking records.

The schema supports two delivery methods:

```text
pickup
delivery
```

The first product order statuses are:

```text
pending
confirmed
preparing
ready_for_pickup
out_for_delivery
completed
cancelled
```

The first payment statuses are:

```text
unpaid
pending
paid
refunded
cancelled
```

Step 12 Part 1 also enables RLS so customers can read and create their own
cart, address, and order data while admins can manage product orders and
payments. Customer-facing storefront UI starts in the next approved part.

## Customer Product Storefront UI

Step 12 Part 2 adds the first customer product storefront page:

```text
http://localhost:3000/products
```

Signed-in customers can:

- View active products from the existing product inventory.
- See product category, SKU, sale price, and current stock.
- Search products by name, description, SKU, or category.
- Filter products by product category.
- Add available products to their active shopping cart.
- See the current total item count in the cart summary.

This part creates the cart data in `shopping_carts` and
`shopping_cart_items`, but does not create product orders yet. Cart review,
quantity editing, pickup/delivery choice, and checkout start in the next
approved parts.

## Cart Review and Quantity Management

Step 12 Part 3 adds the customer cart review page:

```text
http://localhost:3000/cart
```

Signed-in customers can:

- View the active cart created from `/products`.
- See cart items with product name, category, SKU, stock, unit price, quantity,
  line total, and subtotal.
- Increase or decrease item quantity without exceeding available stock.
- Edit quantity directly.
- Remove items from the cart.
- Return to the product storefront to add more items.

This part still does not create `product_orders`. Checkout, pickup/delivery
choice, payment method selection, and order creation start in the next approved
part.

## Checkout and Product Order Creation

Step 12 Part 4 adds the first customer checkout page:

```text
http://localhost:3000/checkout
```

Signed-in customers can:

- Review cart items before creating an order.
- Choose pickup at the garage or delivery.
- Enter a delivery address when delivery is selected.
- Add an order note.
- Create a `product_orders` row from the active cart.
- Create matching `product_order_items` rows.
- Mark the active `shopping_carts` row as `ordered`.

This part checks available stock before creating the order, but it does not
deduct product stock yet and does not process a real payment. Stock deduction,
inventory movement creation, payment tracking, and customer order history start
in the next approved parts.

## Order Stock Deduction and Inventory Movement

Step 12 Part 5 makes checkout deduct stock after a product order is created.

Run this SQL in Supabase SQL Editor before testing checkout stock deduction:

```text
supabase/product-order-stock-deduction.sql
```

This SQL adds:

- A safe database function: `apply_product_order_inventory`.
- A duplicate-protection index for product-order sale movements.
- Permission for authenticated users to apply stock deduction only for their
  own product order, while admins can apply it for any order.

After the SQL is run, checkout will:

1. Create a `product_orders` row.
2. Create matching `product_order_items` rows.
3. Call `apply_product_order_inventory`.
4. Create `inventory_movements` with `movement_type = 'sale'`.
5. Deduct product stock through the existing inventory movement trigger.
6. Mark the active shopping cart as `ordered`.

If stock deduction fails, the order is marked `cancelled` and the cart remains
active so the customer can edit the cart and try again.

This part still does not process a real payment. Payment tracking, customer
order history, and admin product order management start in the next approved
parts.

## Customer Product Order History

Step 12 Part 6 adds customer-facing product order history pages:

```text
http://localhost:3000/my-product-orders
http://localhost:3000/my-product-orders/[order-id]
```

Signed-in customers can:

- View their own product orders.
- See order number, order status, payment status, delivery method, and total.
- Open an order detail page to review ordered items, quantities, prices,
  delivery address, and notes.
- Navigate back to products, cart, checkout, and their order history from the
  customer nav.

This part reads existing order data only. It does not add payment processing or
admin product order management yet.

## Admin Product Orders

Step 12 Part 7 adds admin-facing product order pages:

```text
http://localhost:3000/admin/product-orders
http://localhost:3000/admin/product-orders/[order-id]
```

Admins can:

- View product orders from all customers.
- Filter orders by product order status.
- Search by order number, customer name, phone, email, product name, SKU,
  note, delivery address, or order ID.
- Use pagination controls at the top and bottom, including direct page jump.
- Open an order detail page to review customer contact, ordered items, delivery
  method, delivery address, status, payment status, and totals.

This part is read-only for product orders. Admin order status changes, payment
tracking, and product payment management continue in the next approved parts.

## Admin Product Order Status Management

Step 12 Part 8 lets admins update product order status from:

```text
http://localhost:3000/admin/product-orders
http://localhost:3000/admin/product-orders/[order-id]
```

Admins can:

- Use quick actions for the normal product order flow.
- Change `pending` orders to `confirmed`.
- Change `confirmed` orders to `preparing`.
- Change `preparing` pickup orders to `ready_for_pickup`.
- Change `preparing` delivery orders to `out_for_delivery`.
- Mark `ready_for_pickup` or `out_for_delivery` orders as `completed`.
- Use Edit status to correct mistakes across all valid product order statuses.

Cancelling an order now continues in the next part so stock can be returned
through inventory movements safely.

## Stock-Safe Product Order Cancellation

Step 12 Part 9 makes admin product order cancellation return stock safely.

Run this SQL in Supabase SQL Editor before testing stock-safe cancellation:

```text
supabase/product-order-stock-safe-cancellation.sql
```

This SQL adds:

- A safe database function: `cancel_product_order_with_inventory_return`.
- A duplicate-protection index for product-order return movements.
- Permission for authenticated admins to cancel product orders and return stock.

After the SQL is run, admin cancellation will:

1. Lock the selected `product_orders` row.
2. Check admin access.
3. Check whether return movements already exist for that product order.
4. Create `inventory_movements` with `movement_type = 'return'` when sale
   movements exist.
5. Return stock through the existing inventory movement trigger.
6. Update the product order status to `cancelled`.

If return movements already exist, the function will not create duplicates. It
will keep the order cancelled and return the existing return movement count.

## Product Order Cancellation UI Sync

Step 12 Part 9.1 makes cancelled product orders clear on both admin and customer
screens.

- Admin product order lists show cancelled orders with a stock return summary.
- Admin product order detail refreshes the full order after a status update and
  shows return movement evidence from `inventory_movements`.
- Customer product order history and order detail show a cancelled notice when
  the order status is `cancelled`.
- The source of truth remains Supabase, so both admin and customer pages show
  the same status after refresh.

## SlipOK Payment Schema And Planning

Step 12 Part 10 prepares product payments for automated slip verification with
SlipOK. This part does not call the SlipOK API yet and does not upload slip
images yet.

Run this SQL in Supabase SQL Editor before building the slip upload UI:

```text
supabase/product-payment-slipok-schema.sql
```

This SQL adds SlipOK-ready payment fields to `product_payments`:

- Verification provider and status: `verification_provider`,
  `verification_status`.
- Slip evidence: `slip_image_url`, `slip_qr_payload`, `slip_reference`,
  `slip_amount`, and `slip_transfer_at`.
- Transfer details returned by verification: sender and receiver bank/account
  fields, receiver name, provider reference, and raw provider response.
- Audit fields: `submitted_at`, `verified_at`, `verified_by`, and
  `rejected_reason`.
- A unique index on `slip_reference` to help block duplicate slip reuse.
- Customer insert/update policies for their own pending payment proof without
  allowing customers to mark a payment as paid themselves.

After running the schema SQL, verify it from the browser:

```text
http://localhost:3000/product-sales-schema-check
```

Or verify it directly in Supabase SQL Editor:

```text
supabase/product-payment-slipok-schema-check.sql
```

The next approved parts will add customer slip upload, SlipOK API verification,
and automatic payment status sync.

## Customer Payment Slip Upload UI

Step 12 Part 11 lets customers submit payment proof from their product order
detail page. This part uploads and records the slip, but does not call SlipOK
yet.

Run this SQL in Supabase SQL Editor before testing slip image uploads:

```text
supabase/product-payment-slip-storage.sql
```

This SQL creates a private Supabase Storage bucket:

```text
payment-slips
```

Customers can upload and read files only inside their own user folder. Admins
can read and manage slips for review. The customer product order detail page at:

```text
http://localhost:3000/my-product-orders/[order-id]
```

now supports:

- Selecting payment method: PromptPay / QR or bank transfer.
- Entering the amount shown on the slip.
- Entering an optional slip reference.
- Uploading a PNG or JPEG slip image.
- Creating or updating a pending `product_payments` row with
  `verification_provider = 'slipok'` and `verification_status = 'submitted'`.
- Updating the product order's `payment_status` to `pending`.

SlipOK API verification and automatic `paid` updates continue in later
approved parts. Manual admin approval continues in Step 12 Part 13.

## Admin Payment Proof Review

Step 12 Part 12 lets admins review customer payment proof from the product
order detail page:

```text
http://localhost:3000/admin/product-orders/[order-id]
```

Admin users can now see `product_payments` linked to the order:

- Payment method.
- Amount submitted by the customer.
- Payment status and verification status.
- Slip reference.
- Submitted time and verified time.
- Rejected reason, if present.
- Private storage path for the uploaded slip.
- A temporary signed link to open the slip image from the private
  `payment-slips` bucket.

Step 12 Part 12 is review-only. Admin approval/rejection buttons and SlipOK API
verification continue in later approved parts.

## Admin Manual Payment Approval

Step 12 Part 13 lets admins manually approve or reject customer payment proof
from the product order detail page:

```text
http://localhost:3000/admin/product-orders/[order-id]
```

Approving payment proof updates the related `product_payments` row to
`payment_status = 'paid'` and `verification_status = 'verified'`, records
`paid_at` and `verified_at`, and updates the product order's `payment_status`
to `paid`.

Rejecting payment proof updates the related `product_payments` row to
`payment_status = 'failed'` and `verification_status = 'rejected'`, saves the
admin's rejection reason, and returns the product order's `payment_status` to
`unpaid` unless another paid payment already exists for that same order.

This part is manual only. SlipOK API verification remains a future approved
part.

## Customer Payment Status Sync And Re-upload Flow

Step 12 Part 14 makes customer-facing product order payment states clearer
after admin payment review:

```text
http://localhost:3000/my-product-orders
http://localhost:3000/my-product-orders/[order-id]
```

Customers now see Thai payment labels and the latest slip verification state
from `product_payments`:

- `submitted`: slip sent and waiting for admin review.
- `verified`: payment approved and no more slip upload is needed.
- `rejected`: slip rejected, rejection reason shown, and the customer can send
  a new slip.

The customer detail page now includes a refresh status button so customers can
manually reload the latest admin approval/rejection result without navigating
away. Payment rows are loaded by latest `updated_at` so the most recently
reviewed or resubmitted proof appears first.

## Product Payment Admin Queue And Final Payment Review

Step 12 Part 15 adds payment-focused filtering to the admin product order list:

```text
http://localhost:3000/admin/product-orders
http://localhost:3000/admin/product-orders?payment=pending
```

Admins can now filter product orders by payment status:

- `pending`: payment proof submitted and waiting for admin review.
- `paid`: payment approved.
- `unpaid`: no approved payment yet.
- `refunded` and `cancelled`: payment exceptions.

The product order cards also show the latest slip verification badge from
`product_payments`, including submitted, verified, and rejected states. This
creates a practical manual payment queue before future SlipOK automation work.

## Final Product Sales Review And Cleanup

Step 12 Part 16 is the final review pass for the manual product sales MVP:

```text
Products -> Cart -> Checkout -> My Product Orders -> Upload Slip -> Admin Review -> Customer Status
```

This pass cleaned up the product order flow by:

- Making admin product order status actions use Thai labels.
- Showing Thai order and payment statuses on admin product order cards and
  detail pages.
- Making admin approve/reject payment buttons available only for submitted
  payment proof that is still waiting for review.
- Loading admin payment rows by latest `updated_at`, matching the customer
  view, so the newest review or resubmission appears first.
- Cleaning customer-facing order ID labels to Thai.

At the end of Step 12, the product sales MVP includes storefront, cart,
checkout, stock deduction, customer order history, customer slip upload, admin
manual payment review, customer payment result sync, and admin payment queue.
SlipOK automatic verification remains a future optional integration.

## SlipOK Readiness And Safe Integration Planning

Step 13 Part 0 prepares the project for automatic SlipOK verification without
calling the SlipOK API yet.

Use this local readiness page:

```text
http://localhost:3000/slipok-readiness-check
```

Required server-only environment variables:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SLIPOK_BRANCH_ID=your-slipok-branch-id
SLIPOK_API_KEY=your-slipok-api-key
```

Do not expose these values in client components, README examples with real
values, screenshots, or Git. Keep real values in `.env.local` only.

The planned safe flow is:

- Customer uploads payment proof as usual.
- Server route reads the private slip file from Supabase Storage.
- Server route calls SlipOK using `SLIPOK_BRANCH_ID` and `SLIPOK_API_KEY`.
- If SlipOK verifies the slip and amount, the order becomes paid
  automatically.
- If SlipOK rejects the slip, the rejection reason is saved and the customer
  can upload a new slip.
- If SlipOK is unavailable, the existing admin manual review flow remains the
  fallback.

## SlipOK Server Verification Route

Step 13 Part 1 adds the secure server route for SlipOK verification:

```text
POST /api/product-payments/[paymentId]/verify-slipok
```

The route requires a signed-in admin user. It uses `SUPABASE_SERVICE_ROLE_KEY`
only on the server to download the private slip image from the `payment-slips`
bucket and update payment/order rows.

Verification behavior:

- If SlipOK verifies the slip and amount, `product_payments` is updated to
  `payment_status = 'paid'` and `verification_status = 'verified'`, and the
  related product order becomes `payment_status = 'paid'`.
- If SlipOK rejects the slip, `product_payments` is updated to
  `payment_status = 'failed'` and `verification_status = 'rejected'`, the
  rejection reason is saved, and the customer can upload a new slip.
- If SlipOK is unavailable or credentials are invalid, the route returns an
  error without breaking the existing manual admin review flow.

This part adds the route only. UI buttons for controlled admin testing continue
in the next approved part.

## Admin SlipOK Verify Button

Step 13 Part 2 adds a controlled admin UI button for SlipOK verification on the
product order detail page:

```text
http://localhost:3000/admin/product-orders/[order-id]
```

For payment proof with `payment_status = 'pending'` and
`verification_status = 'submitted'`, admins can now click `ตรวจด้วย SlipOK`.
The button calls:

```text
POST /api/product-payments/[paymentId]/verify-slipok
```

If SlipOK verifies the slip, the page updates the payment to paid/verified and
the order payment status to paid. If SlipOK rejects the slip, the page updates
the payment to failed/rejected and shows the rejection message while keeping
the existing manual review flow available for fallback.

Manual approve/reject buttons remain available for the same pending submitted
payment proof, so the garage can still handle cases where SlipOK is unavailable
or a human review is needed.

## Available Scripts

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm run start` starts the production server.
- `npm run lint` runs ESLint.
- `npm run lint:fix` runs ESLint and applies safe fixes.
- `npm run typecheck` runs TypeScript validation without emitting files.
