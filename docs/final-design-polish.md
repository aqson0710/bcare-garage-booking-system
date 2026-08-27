# Step 21: Final Design Polish

## Part 1 - Design System Foundation And Role-Aware Navigation

This part starts the final design polish without changing business logic,
Supabase queries, or database schema.

### Completed

- Updated global design tokens to the approved garage palette:
  - Dark gray: `#242424`
  - Yellow accent: `#F5C518`
  - Light background: `#F5F5F3`
  - White surface: `#FFFFFF`
  - Secondary text: `#666666`
  - Border: `#D8D8D3`
- Removed the previous decorative background gradients so the app feels more
  practical and less like a generic SaaS template.
- Added a safer global contrast rule for existing primary buttons that use the
  brand background.
- Rebuilt the shared app navigation so signed-in users see menu groups based on
  their `profiles.role`:
  - Signed-out users see public customer links only.
  - Customers see customer booking, product, cart, order, vehicle, and
    notification links.
  - Technicians see technician work order and profile links only.
  - Admins see admin workspace links and admin setup links only.
- Added active navigation state so the current page is clearer.

### Review Checklist

1. Sign out and confirm the navigation only shows public customer links.
2. Sign in as a customer and confirm admin/technician links are hidden.
3. Sign in as a technician and confirm customer/admin links are hidden.
4. Sign in as an admin and confirm customer/technician links are hidden.
5. Confirm the yellow accent is visible but does not dominate the page.

## Part 2 - Thai UI Copy Pass

This part continues the final polish by making the main visible web app copy
Thai-first across customer, technician, and admin screens. It keeps existing
business logic, Supabase queries, API routes, and database schema unchanged.

### Completed

- Translated the auth and profile flow for login, registration, saved profile,
  and current session states.
- Translated customer vehicle, booking list, booking detail, and work order
  progress screens.
- Translated technician work order list, work order detail, status updates,
  diagnosis, repair notes, and technician profile screens.
- Translated key admin screens for bookings, booking details, services,
  service categories, products, product categories, inventory, inventory
  review, customers, reports, repair jobs, technician skills, and product
  orders.
- Added Thai display helpers for stored status values such as `pending`,
  `confirmed`, `cancelled`, `assigned`, `in_progress`, `active`, and
  `inactive`, while keeping the database values unchanged.
- Cleaned common loading, signed-out, access-denied, empty-state, filter, and
  action button text.

### Review Checklist

1. Sign in as a customer and review `/`, `/auth`, `/my-bookings`,
   `/my-bookings/[id]`, `/my-vehicles`, `/products`, `/cart`,
   `/checkout`, `/my-product-orders`, and `/notifications`.
2. Sign in as a technician and review `/technician/work-orders`,
   `/technician/work-orders/[id]`, and `/technician/profile`.
3. Sign in as an admin and review `/admin`, booking, service, product,
   inventory, customer, report, repair job, technician skill, payment setting,
   product order, and notification pages.
4. Confirm status badges are readable in Thai but still update the correct
   existing database values.
5. Note any remaining English message that comes directly from Supabase,
   SlipOK, or browser validation for a later error-message polish pass.

## Part 3 - Navigation Actions

This part improves the shared navigation controls that appear across customer,
technician, and admin pages. It keeps existing page functionality, Supabase
queries, and notification logic unchanged.

### Completed

- Added a persistent login action for signed-out users in the shared
  navigation.
- Added a persistent logout button for signed-in users so they no longer need
  to open only the account page to sign out.
- Added a compact bell shortcut for notification pages:
  - Customers open `/notifications`.
  - Admins open `/admin/notifications`.
  - Technicians do not see a bell yet because the current notification system
    does not include technician notifications.
- Kept unread notification badge counts on the bell shortcut.
- Removed duplicate notification text links from the main customer/admin menu
  so notifications act like a utility action instead of another ordinary page
  link.
- Added a loading account state while the navigation checks the current
  session.

### Review Checklist

1. Sign out and confirm the nav shows the public customer menu plus
   `เข้าสู่ระบบ`.
2. Sign in as a customer and confirm the nav shows `ออกจากระบบ` and the bell
   opens `/notifications`.
3. Sign in as an admin and confirm the bell opens `/admin/notifications`.
4. Sign in as a technician and confirm admin/customer links are still hidden.
5. Click `ออกจากระบบ` from a non-auth page and confirm the page reacts to the
   signed-out state.

## Part 4 - Shared Navigation Layout Structure

This part starts the global layout polish through the shared navigation layer
used across customer, technician, and admin screens. It does not change page
data loading, API routes, or database behavior.

### Completed

- Converted the shared navigation into a bordered workspace control area so it
  reads as one consistent system component across pages.
- Reworked the navigation into a yellow brand/action strip and a dark primary
  menu bar, closer to a real automotive service website.
- Added a role/status chip that shows whether the current viewer is a guest,
  customer, technician, or admin.
- Kept login, logout, and notification actions in a utility row separated from
  the main navigation links.
- Standardized active utility actions so login and notification buttons use
  white surfaces with yellow emphasis instead of black button fills.
- Changed main navigation links to horizontal scrolling rows so mobile and
  narrower screens avoid awkward wrapping.
- Collapsed admin setup links into a `ตั้งค่าระบบ` disclosure group, reducing
  clutter in the admin workspace while keeping every setup page accessible.
- Kept the active admin setup group open when the current page is inside that
  group.

### Review Checklist

1. Review `/auth` signed out and confirm the navigation looks like one
   consistent control area.
2. Sign in as a customer and confirm customer links scroll cleanly on narrow
   screens.
3. Sign in as a technician and confirm only technician workspace links remain.
4. Sign in as an admin and confirm `ตั้งค่าระบบ` can be expanded and that the
   active setup page stays visible.
5. Confirm login/logout and notification bell remain usable after the layout
   polish.

### Next Recommended Part

Step 21 Part 5 should continue layout polish at the page level:

- Customer top navigation and content container.
- Admin sidebar/header workspace direction.
- Shared page header and action area patterns.
- Keep existing page functionality intact while improving presentation.
