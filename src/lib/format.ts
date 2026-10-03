// Shared Thai display helpers: dates and status labels.
// Database values stay in English (pending, paid, ...); only what the user
// sees is translated here, so every screen shows the same wording.

const thaiDateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// "2026-10-03" -> "3 ต.ค. 2569". Parsed as a local calendar date so the day
// never shifts because of the time zone.
export function formatThaiDate(date: string | null | undefined) {
  if (!date) {
    return "-";
  }

  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? date : thaiDateFormatter.format(parsed);
}

// "2026-10-03", "09:00:00" -> "3 ต.ค. 2569 เวลา 09:00"
export function formatBookingSlot(
  date: string | null | undefined,
  time: string | null | undefined,
) {
  const timeLabel = time ? time.slice(0, 5) : "";

  return timeLabel
    ? `${formatThaiDate(date)} เวลา ${timeLabel}`
    : formatThaiDate(date);
}

const labels: Record<string, Record<string, string>> = {
  booking: {
    cancelled: "ยกเลิก",
    completed: "เสร็จสิ้น",
    confirmed: "ยืนยันแล้ว",
    pending: "รอยืนยัน",
  },
  bookingPayment: {
    awaiting_payment: "รอชำระเงิน",
    not_required: "ยังไม่ต้องชำระ",
    paid: "ชำระแล้ว",
    pending_review: "รอตรวจสลิป",
    rejected: "สลิปไม่ผ่าน",
  },
  productOrder: {
    cancelled: "ยกเลิก",
    completed: "เสร็จสิ้น",
    confirmed: "ยืนยันแล้ว",
    out_for_delivery: "กำลังจัดส่ง",
    pending: "รอดำเนินการ",
    preparing: "กำลังเตรียมสินค้า",
    ready_for_pickup: "พร้อมรับสินค้า",
  },
  productPayment: {
    cancelled: "ยกเลิก",
    paid: "ชำระแล้ว",
    partially_paid: "ชำระบางส่วน",
    pending: "รอตรวจสอบ",
    refunded: "คืนเงินแล้ว",
    unpaid: "ยังไม่ชำระ",
  },
  repairJob: {
    assigned: "มอบหมายช่างแล้ว",
    cancelled: "ยกเลิก",
    completed: "ซ่อมเสร็จ",
    in_progress: "กำลังซ่อม",
    pending: "รอมอบหมาย",
  },
};

export type StatusKind = keyof typeof labels;

export function statusLabel(kind: StatusKind, status: string | null | undefined) {
  if (!status) {
    return "-";
  }

  return labels[kind]?.[status] ?? status;
}
