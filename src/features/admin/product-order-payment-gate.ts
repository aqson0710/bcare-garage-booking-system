import type {
  AdminProductOrder,
  AdminProductOrderStatusAction,
} from "./types";

// Product orders must be fully paid before the shop confirms and starts
// preparing them. These are the statuses that come after payment.
const statusesRequiringPayment: ReadonlySet<AdminProductOrderStatusAction> =
  new Set([
    "confirmed",
    "preparing",
    "ready_for_pickup",
    "out_for_delivery",
    "completed",
  ]);

export function isProductOrderPaid(
  order: Pick<AdminProductOrder, "payment_status">,
) {
  return order.payment_status === "paid";
}

export function statusRequiresPayment(status: AdminProductOrderStatusAction) {
  return statusesRequiringPayment.has(status);
}

export const PRODUCT_ORDER_PAYMENT_REQUIRED_MESSAGE =
  "ต้องตรวจการชำระเงินให้ผ่านก่อน (สถานะชำระเงินต้องเป็น \"ชำระแล้ว\") จึงจะยืนยันออเดอร์หรือเริ่มจัดเตรียมได้ เปิดรายละเอียดออเดอร์เพื่อตรวจสลิปด้วย SlipOK หรือดูรูปสลิปแล้วอนุมัติ";

export function getPaymentGateError(
  order: Pick<AdminProductOrder, "payment_status">,
  nextStatus: AdminProductOrderStatusAction,
) {
  if (statusRequiresPayment(nextStatus) && !isProductOrderPaid(order)) {
    return PRODUCT_ORDER_PAYMENT_REQUIRED_MESSAGE;
  }

  return null;
}
