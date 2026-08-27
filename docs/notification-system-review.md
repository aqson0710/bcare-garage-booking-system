# Step 18 Web Notification System Review

Step 18 adds in-app notification centers for customers and admins. This is a
webapp-only notification system for the MVP. It does not send email, LINE, SMS,
or push notifications.

## Completed Scope

- Customer notification center at `/notifications`.
- Admin notification center at `/admin/notifications`.
- Notification links in the main navigation.
- Unread badge counts in the navigation.
- Read and read-all actions.
- Filters for all, unread, booking, repair, payment, and product/order items.
- Notification cards link to the relevant booking, repair/order, payment, or
  receipt page.

## Customer Notifications

Customer notifications are derived from the current signed-in customer's data:

- Booking confirmed, cancelled, or completed.
- Repair job assigned, in progress, or completed.
- Product order confirmed, preparing, ready for pickup, out for delivery,
  completed, or cancelled.
- Payment unpaid, submitted, verified, rejected, or failed.

Customer route:

```text
/notifications
```

## Admin Notifications

Admin notifications are derived from current operational queues:

- Pending bookings that need confirmation.
- Confirmed bookings that may need a repair job.
- Pending payment proof that needs review.
- Product orders that need confirmation or preparation.
- Open repair jobs that need assignment or monitoring.

Admin route:

```text
/admin/notifications
```

## Read State

Read state is stored in browser `localStorage` for this MVP:

- Customer key: `bcare-read-notifications:[user-id]`
- Admin key: `bcare-admin-read-notifications:[user-id]`

This means read/unread status is local to the browser and device. If the user
clears browser storage or uses another device, notifications can appear unread
again.

## Manual Test Checklist

Customer:

1. Sign in as a customer.
2. Open `/notifications`.
3. Confirm notifications load from bookings, repair jobs, product orders, and
   payments.
4. Test filters: all, unread, booking, repair, payment, order.
5. Click `เปิดดู` and confirm it opens the correct page.
6. Click `อ่านแล้ว` and confirm the unread count changes.
7. Click `อ่านทั้งหมดแล้ว` and confirm the badge clears in navigation.

Admin:

1. Sign in as an admin.
2. Open `/admin/notifications`.
3. Confirm pending work appears from bookings, payments, product orders, and
   repair jobs.
4. Test filters: all, unread, booking, repair, payment, order.
5. Click `เปิดจัดการ` and confirm it opens the correct admin page.
6. Click `อ่านแล้ว` and `อ่านทั้งหมดแล้ว`.
7. Confirm the admin navigation badge updates.

## Known Limits

- Notifications are generated from current row status, not permanent event
  history.
- Read/unread is browser-local for now.
- No real-time subscription is active yet.
- No external notification channels are included yet.
