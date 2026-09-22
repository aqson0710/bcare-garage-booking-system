import type {
  AdminBooking,
  AdminProductOrder,
  AdminRepairJob,
} from "@/features/admin";
import type { MyBooking } from "@/features/bookings";
import type { ProductOrderWithItems } from "@/features/products";
import type { WebNotification } from "./types";

function buildBookingNotification(booking: MyBooking): WebNotification | null {
  const serviceName = booking.service?.name ?? "บริการที่จอง";
  const bookingTime = booking.booking_time.slice(0, 5);

  if (booking.status === "confirmed") {
    return {
      createdAt: booking.updated_at,
      href: `/my-bookings/${booking.id}`,
      id: `booking-confirmed-${booking.id}-${booking.updated_at}`,
      message: `${serviceName} วันที่ ${booking.booking_date} เวลา ${bookingTime} น.`,
      source: "booking",
      title: "การจองได้รับการยืนยันแล้ว",
      tone: "success",
    };
  }

  if (booking.status === "cancelled") {
    return {
      createdAt: booking.updated_at,
      href: `/my-bookings/${booking.id}`,
      id: `booking-cancelled-${booking.id}-${booking.updated_at}`,
      message: `${serviceName} วันที่ ${booking.booking_date} เวลา ${bookingTime} น.`,
      source: "booking",
      title: "การจองถูกยกเลิก",
      tone: "danger",
    };
  }

  if (booking.status === "completed") {
    return {
      createdAt: booking.updated_at,
      href: `/my-bookings/${booking.id}`,
      id: `booking-completed-${booking.id}-${booking.updated_at}`,
      message: `${serviceName} เสร็จสิ้นแล้ว สามารถเปิดเอกสารการจองได้`,
      source: "booking",
      title: "งานบริการเสร็จสิ้น",
      tone: "success",
    };
  }

  return null;
}

function buildRepairNotification(booking: MyBooking): WebNotification | null {
  const repairJob = booking.repairJob;

  if (!repairJob) {
    return null;
  }

  const serviceName = booking.service?.name ?? "งานซ่อม";

  if (repairJob.status === "assigned") {
    return {
      createdAt: repairJob.updated_at,
      href: `/my-bookings/${booking.id}`,
      id: `repair-assigned-${repairJob.id}-${repairJob.updated_at}`,
      message: repairJob.mechanic?.full_name
        ? `${serviceName} มอบหมายให้ ${repairJob.mechanic.full_name} แล้ว`
        : `${serviceName} มีการมอบหมายช่างแล้ว`,
      source: "repair",
      title: "งานซ่อมถูกมอบหมายแล้ว",
      tone: "info",
    };
  }

  if (repairJob.status === "in_progress") {
    return {
      createdAt: repairJob.updated_at,
      href: `/my-bookings/${booking.id}`,
      id: `repair-progress-${repairJob.id}-${repairJob.updated_at}`,
      message: `${serviceName} กำลังอยู่ระหว่างดำเนินงาน`,
      source: "repair",
      title: "งานซ่อมเริ่มดำเนินการแล้ว",
      tone: "info",
    };
  }

  if (repairJob.status === "completed") {
    return {
      createdAt: repairJob.updated_at,
      href: `/my-bookings/${booking.id}`,
      id: `repair-completed-${repairJob.id}-${repairJob.updated_at}`,
      message: `${serviceName} ซ่อมเสร็จแล้ว ตรวจรายละเอียดงานได้จากหน้าการจอง`,
      source: "repair",
      title: "งานซ่อมเสร็จแล้ว",
      tone: "success",
    };
  }

  return null;
}

function buildOrderNotification(
  order: ProductOrderWithItems,
): WebNotification | null {
  if (order.status === "confirmed") {
    return {
      createdAt: order.updated_at,
      href: `/my-product-orders/${order.id}`,
      id: `order-confirmed-${order.id}-${order.updated_at}`,
      message: `${order.order_number} ได้รับการยืนยันแล้ว`,
      source: "order",
      title: "ออเดอร์สินค้าได้รับการยืนยัน",
      tone: "success",
    };
  }

  if (order.status === "preparing") {
    return {
      createdAt: order.updated_at,
      href: `/my-product-orders/${order.id}`,
      id: `order-preparing-${order.id}-${order.updated_at}`,
      message: `${order.order_number} กำลังจัดเตรียมสินค้า`,
      source: "order",
      title: "กำลังจัดเตรียมสินค้า",
      tone: "info",
    };
  }

  if (order.status === "ready_for_pickup") {
    return {
      createdAt: order.updated_at,
      href: `/my-product-orders/${order.id}`,
      id: `order-ready-${order.id}-${order.updated_at}`,
      message: `${order.order_number} พร้อมรับที่อู่แล้ว`,
      source: "order",
      title: "สินค้าพร้อมรับแล้ว",
      tone: "success",
    };
  }

  if (order.status === "out_for_delivery") {
    return {
      createdAt: order.updated_at,
      href: `/my-product-orders/${order.id}`,
      id: `order-delivery-${order.id}-${order.updated_at}`,
      message: `${order.order_number} กำลังจัดส่ง`,
      source: "order",
      title: "สินค้าอยู่ระหว่างจัดส่ง",
      tone: "info",
    };
  }

  if (order.status === "completed") {
    return {
      createdAt: order.updated_at,
      href: `/my-product-orders/${order.id}/receipt`,
      id: `order-completed-${order.id}-${order.updated_at}`,
      message: `${order.order_number} เสร็จสิ้นแล้ว สามารถเปิดใบเสร็จได้`,
      source: "order",
      title: "ออเดอร์สินค้าเสร็จสิ้น",
      tone: "success",
    };
  }

  if (order.status === "cancelled") {
    return {
      createdAt: order.updated_at,
      href: `/my-product-orders/${order.id}`,
      id: `order-cancelled-${order.id}-${order.updated_at}`,
      message: `${order.order_number} ถูกยกเลิก`,
      source: "order",
      title: "ออเดอร์สินค้าถูกยกเลิก",
      tone: "danger",
    };
  }

  return null;
}

function buildPaymentNotification(
  order: ProductOrderWithItems,
): WebNotification | null {
  const latestPayment = order.payments[0] ?? null;

  if (!latestPayment) {
    if (order.payment_status === "unpaid") {
      return {
        createdAt: order.updated_at,
        href: `/my-product-orders/${order.id}#payment`,
        id: `payment-unpaid-${order.id}-${order.updated_at}`,
        message: `${order.order_number} ยังรอการชำระเงิน`,
        source: "payment",
        title: "ยังไม่ได้ชำระเงิน",
        tone: "warning",
      };
    }

    return null;
  }

  if (latestPayment.verification_status === "submitted") {
    return {
      createdAt: latestPayment.updated_at,
      href: `/my-product-orders/${order.id}`,
      id: `payment-submitted-${latestPayment.id}-${latestPayment.updated_at}`,
      message: `${order.order_number} ส่งหลักฐานแล้ว รอการตรวจสอบ`,
      source: "payment",
      title: "ส่งสลิปแล้ว รอตรวจ",
      tone: "warning",
    };
  }

  if (latestPayment.verification_status === "verified") {
    return {
      createdAt: latestPayment.updated_at,
      href: `/my-product-orders/${order.id}/receipt`,
      id: `payment-verified-${latestPayment.id}-${latestPayment.updated_at}`,
      message: `${order.order_number} ชำระเงินผ่านแล้ว เปิดใบเสร็จได้`,
      source: "payment",
      title: "ชำระเงินสำเร็จ",
      tone: "success",
    };
  }

  if (
    latestPayment.verification_status === "rejected" ||
    latestPayment.verification_status === "failed"
  ) {
    return {
      createdAt: latestPayment.updated_at,
      href: `/my-product-orders/${order.id}#payment`,
      id: `payment-rejected-${latestPayment.id}-${latestPayment.updated_at}`,
      message:
        latestPayment.rejected_reason ??
        `${order.order_number} ตรวจสลิปไม่ผ่าน กรุณาส่งหลักฐานใหม่`,
      source: "payment",
      title: "สลิปไม่ผ่าน",
      tone: "danger",
    };
  }

  return null;
}

export function buildCustomerNotifications({
  bookings,
  orders,
}: {
  bookings: MyBooking[];
  orders: ProductOrderWithItems[];
}) {
  const notifications = [
    ...bookings.flatMap((booking) =>
      [buildBookingNotification(booking), buildRepairNotification(booking)].filter(
        (item): item is WebNotification => Boolean(item),
      ),
    ),
    ...orders.flatMap((order) =>
      [buildPaymentNotification(order), buildOrderNotification(order)].filter(
        (item): item is WebNotification => Boolean(item),
      ),
    ),
  ];

  return notifications.sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );
}

function buildAdminBookingNotification(
  booking: AdminBooking,
): WebNotification | null {
  if (booking.status === "pending") {
    return {
      createdAt: booking.created_at,
      href: `/admin/bookings?bookingId=${booking.id}`,
      id: `admin-booking-pending-${booking.id}-${booking.updated_at}`,
      message: `${booking.customer?.full_name ?? "ลูกค้า"} จอง ${
        booking.service?.name ?? "บริการ"
      } วันที่ ${booking.booking_date} เวลา ${booking.booking_time.slice(0, 5)} น.`,
      source: "booking",
      title: "มีการจองรอยืนยัน",
      tone: "warning",
    };
  }

  if (booking.status === "confirmed") {
    return {
      createdAt: booking.updated_at,
      href: `/admin/bookings?bookingId=${booking.id}`,
      id: `admin-booking-confirmed-${booking.id}-${booking.updated_at}`,
      message: `${booking.service?.name ?? "บริการ"} ยืนยันแล้ว ตรวจว่าต้องสร้างใบงานซ่อมหรือไม่`,
      source: "booking",
      title: "การจองพร้อมดำเนินงาน",
      tone: "info",
    };
  }

  return null;
}

function buildAdminRepairNotification(
  repairJob: AdminRepairJob,
): WebNotification | null {
  if (repairJob.status === "pending") {
    return {
      createdAt: repairJob.created_at,
      href: "/admin/repair-jobs",
      id: `admin-repair-pending-${repairJob.id}-${repairJob.updated_at}`,
      message: `${repairJob.customer?.full_name ?? "ลูกค้า"} · ${
        repairJob.service?.name ?? "งานซ่อม"
      } ยังไม่ได้มอบหมายช่าง`,
      source: "repair",
      title: "ใบงานซ่อมรอมอบหมายช่าง",
      tone: "warning",
    };
  }

  if (repairJob.status === "assigned") {
    return {
      createdAt: repairJob.updated_at,
      href: "/admin/repair-jobs",
      id: `admin-repair-assigned-${repairJob.id}-${repairJob.updated_at}`,
      message: `${repairJob.service?.name ?? "งานซ่อม"} มอบหมายให้ ${
        repairJob.mechanic?.full_name ?? "ช่าง"
      } แล้ว`,
      source: "repair",
      title: "ใบงานซ่อมมอบหมายแล้ว",
      tone: "info",
    };
  }

  if (repairJob.status === "in_progress") {
    return {
      createdAt: repairJob.updated_at,
      href: "/admin/repair-jobs",
      id: `admin-repair-progress-${repairJob.id}-${repairJob.updated_at}`,
      message: `${repairJob.service?.name ?? "งานซ่อม"} กำลังดำเนินงาน`,
      source: "repair",
      title: "ใบงานซ่อมกำลังดำเนินการ",
      tone: "info",
    };
  }

  return null;
}

function buildAdminOrderNotification(
  order: AdminProductOrder,
): WebNotification | null {
  if (order.status === "pending") {
    return {
      createdAt: order.created_at,
      href: `/admin/product-orders/${order.id}`,
      id: `admin-order-pending-${order.id}-${order.updated_at}`,
      message: `${order.order_number} จาก ${
        order.customer?.full_name ?? "ลูกค้า"
      } รอยืนยันออเดอร์`,
      source: "order",
      title: "ออเดอร์สินค้ารอยืนยัน",
      tone: "warning",
    };
  }

  if (order.status === "confirmed") {
    return {
      createdAt: order.updated_at,
      href: `/admin/product-orders/${order.id}`,
      id: `admin-order-confirmed-${order.id}-${order.updated_at}`,
      message: `${order.order_number} ยืนยันแล้ว รอเริ่มจัดเตรียมสินค้า`,
      source: "order",
      title: "ออเดอร์รอจัดเตรียม",
      tone: "info",
    };
  }

  if (order.status === "preparing") {
    return {
      createdAt: order.updated_at,
      href: `/admin/product-orders/${order.id}`,
      id: `admin-order-preparing-${order.id}-${order.updated_at}`,
      message:
        order.delivery_method === "delivery"
          ? `${order.order_number} กำลังจัดเตรียม รอเริ่มจัดส่ง`
          : `${order.order_number} กำลังจัดเตรียม รอแจ้งพร้อมรับที่อู่`,
      source: "order",
      title: "ออเดอร์กำลังจัดเตรียม",
      tone: "info",
    };
  }

  return null;
}

function buildAdminPaymentNotification(
  order: AdminProductOrder,
): WebNotification | null {
  const latestPayment = order.payments[0] ?? null;

  if (latestPayment?.verification_status === "submitted") {
    return {
      createdAt: latestPayment.updated_at,
      href: `/admin/product-orders/${order.id}`,
      id: `admin-payment-submitted-${latestPayment.id}-${latestPayment.updated_at}`,
      message: `${order.order_number} ส่งหลักฐานชำระเงินแล้ว รอ admin ตรวจ`,
      source: "payment",
      title: "มีสลิปรอตรวจ",
      tone: "warning",
    };
  }

  if (latestPayment?.verification_status === "rejected") {
    return {
      createdAt: latestPayment.updated_at,
      href: `/admin/product-orders/${order.id}`,
      id: `admin-payment-rejected-${latestPayment.id}-${latestPayment.updated_at}`,
      message: `${order.order_number} สลิปถูกปฏิเสธแล้ว รอลูกค้าส่งใหม่`,
      source: "payment",
      title: "สลิปถูกปฏิเสธ",
      tone: "danger",
    };
  }

  if (order.payment_status === "unpaid" && order.status !== "cancelled") {
    return {
      createdAt: order.updated_at,
      href: `/admin/product-orders/${order.id}`,
      id: `admin-payment-unpaid-${order.id}-${order.updated_at}`,
      message: `${order.order_number} ยังไม่มีหลักฐานชำระเงิน`,
      source: "payment",
      title: "ออเดอร์ยังไม่ชำระเงิน",
      tone: "warning",
    };
  }

  return null;
}

export function buildAdminNotifications({
  bookings,
  orders,
  repairJobs,
}: {
  bookings: AdminBooking[];
  orders: AdminProductOrder[];
  repairJobs: AdminRepairJob[];
}) {
  const notifications = [
    ...bookings
      .map(buildAdminBookingNotification)
      .filter((item): item is WebNotification => Boolean(item)),
    ...repairJobs
      .map(buildAdminRepairNotification)
      .filter((item): item is WebNotification => Boolean(item)),
    ...orders.flatMap((order) =>
      [buildAdminPaymentNotification(order), buildAdminOrderNotification(order)].filter(
        (item): item is WebNotification => Boolean(item),
      ),
    ),
  ];

  return notifications.sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
  );
}
