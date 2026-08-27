# Step 19 Invoice / Receipt Review

Step 19 adds printable documents for product orders and service bookings.

## Completed Scope

- Product order receipt and payment notice for customers.
- Product order receipt and payment notice for admins.
- Booking confirmation and service intake document for customers.
- Booking confirmation and service intake document for admins.
- Document links from both detail pages and list pages.
- Browser print flow for `Print / Save as PDF`.
- A4 print styling in the global stylesheet.

## Product Order Documents

Customer routes:

- `/my-product-orders`
- `/my-product-orders/[id]`
- `/my-product-orders/[id]/receipt`

Admin routes:

- `/admin/product-orders`
- `/admin/product-orders/[id]`
- `/admin/product-orders/[id]/receipt`

Expected document behavior:

- If the order is paid, the document title is `ใบเสร็จรับเงิน`.
- If the order is not paid yet, the document title is `ใบแจ้งชำระเงิน`.
- The document shows order number, customer, order status, payment status,
  products, quantities, unit prices, subtotal, delivery fee, total, delivery
  method, payment method, paid date, and payment reference when available.
- The customer can only open their own order document.
- Admin users can open any product order document.

## Booking Documents

Customer routes:

- `/my-bookings`
- `/my-bookings/[id]`
- `/my-bookings/[id]/receipt`

Admin routes:

- `/admin/bookings`
- `/admin/bookings/[id]`
- `/admin/bookings/[id]/receipt`

Expected document behavior:

- Pending bookings show `ใบรับคำขอจอง`.
- Confirmed bookings show `ใบยืนยันการจอง`.
- Completed bookings show `ใบสรุปงานบริการ`.
- The document shows customer, phone, email, service, appointment date/time,
  booking status, repair status, vehicle, estimated duration, estimated price,
  mechanic, diagnosis, repair notes, and customer note when available.
- The customer can only open their own booking document.
- Admin users can open any booking document.

## Manual Test Checklist

Use one customer account and one admin account.

1. Open `/my-product-orders`.
2. Click `ใบเสร็จ / ใบแจ้งชำระเงิน` on an order card.
3. Confirm the document opens and the back button returns to the order detail.
4. Click `พิมพ์ / บันทึกเป็น PDF` and confirm the print preview is clean.
5. Open `/admin/product-orders`.
6. Open the same product order receipt from the admin list and detail page.
7. Open `/my-bookings`.
8. Click `เอกสารการจอง` on a booking card.
9. Confirm the booking document opens and prints cleanly.
10. Open `/admin/bookings`.
11. Open the same booking document from the admin list and detail page.

## Known Limits

- The current flow uses the browser print dialog instead of direct PDF download.
- Product order documents are based on current order/payment rows.
- Booking documents use the current service base price as the initial estimate;
  final repair totals can be expanded later if the system adds repair parts,
  labor lines, or final invoice tables.
