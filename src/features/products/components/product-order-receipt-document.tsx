import type { Profile } from "@/features/auth";
import type {
  ProductOrderItemWithProduct,
  ProductOrderWithItems,
} from "@/features/products";

type ReceiptOrder = ProductOrderWithItems & {
  customer?: Profile | null;
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatOrderStatus(status: ProductOrderWithItems["status"]) {
  if (status === "pending") {
    return "รอรับคำสั่งซื้อ";
  }

  if (status === "confirmed") {
    return "ยืนยันคำสั่งซื้อแล้ว";
  }

  if (status === "preparing") {
    return "กำลังจัดเตรียมสินค้า";
  }

  if (status === "ready_for_pickup") {
    return "พร้อมรับสินค้า";
  }

  if (status === "out_for_delivery") {
    return "กำลังจัดส่ง";
  }

  if (status === "completed") {
    return "เสร็จสิ้น";
  }

  return "ยกเลิกแล้ว";
}

function formatPaymentStatus(status: ProductOrderWithItems["payment_status"]) {
  if (status === "paid") {
    return "ชำระเงินแล้ว";
  }

  if (status === "pending") {
    return "ส่งหลักฐานแล้ว รอตรวจ";
  }

  if (status === "refunded") {
    return "คืนเงินแล้ว";
  }

  if (status === "cancelled") {
    return "ยกเลิกการชำระเงิน";
  }

  return "ยังไม่ชำระเงิน";
}

function formatDeliveryMethod(method: ProductOrderWithItems["delivery_method"]) {
  return method === "delivery" ? "จัดส่งที่บ้าน" : "รับที่อู่";
}

function formatPaymentMethod(method: string | null | undefined) {
  if (method === "promptpay") {
    return "PromptPay / QR";
  }

  if (method === "bank_transfer") {
    return "โอนเข้าบัญชีธนาคาร";
  }

  return "-";
}

function getDocumentTitle(order: ReceiptOrder) {
  return order.payment_status === "paid" ? "ใบเสร็จรับเงิน" : "ใบแจ้งชำระเงิน";
}

function getLatestPaidPayment(order: ReceiptOrder) {
  return (
    order.payments.find((payment) => payment.payment_status === "paid") ??
    order.payments[0] ??
    null
  );
}

function ReceiptInfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-950">
        {value}
      </dd>
    </div>
  );
}

function ReceiptTableRow({ item }: { item: ProductOrderItemWithProduct }) {
  return (
    <tr className="border-b border-slate-200 align-top">
      <td className="py-3 pr-3">
        <p className="font-semibold text-slate-950">
          {item.product?.name ?? "สินค้า"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          SKU: {item.product?.sku ?? "-"} ·{" "}
          {item.product?.category?.name ?? "ไม่พบหมวดสินค้า"}
        </p>
      </td>
      <td className="px-3 py-3 text-right">{item.quantity}</td>
      <td className="px-3 py-3 text-right">
        {currencyFormatter.format(item.unit_price)}
      </td>
      <td className="py-3 pl-3 text-right font-semibold text-slate-950">
        {currencyFormatter.format(item.total_price)}
      </td>
    </tr>
  );
}

export function ProductOrderReceiptDocument({
  backHref,
  order,
}: {
  backHref: string;
  order: ReceiptOrder;
}) {
  const latestPayment = getLatestPaidPayment(order);
  const documentTitle = getDocumentTitle(order);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 text-slate-950 print:max-w-none print:bg-white print:px-0 print:py-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a
          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)]"
          href={backHref}
        >
          กลับไปหน้ารายละเอียด
        </a>
        <button
          className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
          onClick={() => window.print()}
          type="button"
        >
          พิมพ์ / บันทึกเป็น PDF
        </button>
      </div>

      <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-[var(--brand)]">
              BCare · BigO-RepairCar
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              {documentTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              เอกสารสำหรับคำสั่งซื้อสินค้าและหลักฐานการชำระเงิน
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">
              เลขที่เอกสาร
            </p>
            <p className="mt-1 font-bold text-slate-950">
              {order.order_number}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase text-slate-500">
              วันที่ออกเอกสาร
            </p>
            <p className="mt-1 font-semibold text-slate-950">
              {formatDateTime(new Date().toISOString())}
            </p>
          </div>
        </header>

        <section className="grid gap-5 border-b border-slate-200 py-6 md:grid-cols-3">
          <ReceiptInfoItem
            label="ลูกค้า"
            value={order.customer?.full_name ?? `รหัสลูกค้า ${order.customer_id}`}
          />
          <ReceiptInfoItem
            label="เบอร์โทร"
            value={order.customer?.phone_number ?? "-"}
          />
          <ReceiptInfoItem
            label="อีเมล"
            value={order.customer?.email ?? "-"}
          />
          <ReceiptInfoItem
            label="สร้างคำสั่งซื้อ"
            value={formatDateTime(order.created_at)}
          />
          <ReceiptInfoItem
            label="สถานะคำสั่งซื้อ"
            value={formatOrderStatus(order.status)}
          />
          <ReceiptInfoItem
            label="สถานะชำระเงิน"
            value={formatPaymentStatus(order.payment_status)}
          />
        </section>

        <section className="py-6">
          <h2 className="text-lg font-bold text-slate-950">รายการสินค้า</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50 text-slate-500">
                  <th className="py-3 pr-3 text-left font-semibold">สินค้า</th>
                  <th className="px-3 py-3 text-right font-semibold">จำนวน</th>
                  <th className="px-3 py-3 text-right font-semibold">
                    ราคาต่อชิ้น
                  </th>
                  <th className="py-3 pl-3 text-right font-semibold">รวม</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <ReceiptTableRow item={item} key={item.id} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-5 border-t border-slate-200 pt-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4 text-sm leading-6 text-slate-600">
            <div>
              <p className="font-semibold text-slate-950">การรับสินค้า</p>
              <p className="mt-1">{formatDeliveryMethod(order.delivery_method)}</p>
              {order.delivery_method === "delivery" ? (
                <p className="mt-2 whitespace-pre-line">
                  {order.delivery_address ?? "-"}
                </p>
              ) : null}
            </div>

            <div>
              <p className="font-semibold text-slate-950">ข้อมูลชำระเงิน</p>
              <p className="mt-1">
                วิธีชำระ: {formatPaymentMethod(latestPayment?.payment_method)}
              </p>
              <p className="mt-1">
                วันที่ชำระ:{" "}
                {latestPayment?.paid_at
                  ? formatDateTime(latestPayment.paid_at)
                  : "-"}
              </p>
              <p className="mt-1">
                เลขอ้างอิง:{" "}
                {latestPayment?.slip_reference ??
                  latestPayment?.provider_reference ??
                  "-"}
              </p>
            </div>

            {order.note ? (
              <div>
                <p className="font-semibold text-slate-950">หมายเหตุ</p>
                <p className="mt-1">{order.note}</p>
              </div>
            ) : null}
          </div>

          <dl className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">ยอดสินค้า</dt>
              <dd className="font-semibold">
                {currencyFormatter.format(order.subtotal_amount)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">ค่าจัดส่ง</dt>
              <dd className="font-semibold">
                {currencyFormatter.format(order.delivery_fee)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-3">
              <dt className="text-base font-bold text-slate-950">ยอดรวม</dt>
              <dd className="text-xl font-bold text-slate-950">
                {currencyFormatter.format(order.total_amount)}
              </dd>
            </div>
          </dl>
        </section>

        <footer className="mt-8 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
          เอกสารนี้ออกจากระบบ BCare Garage Booking System
          สำหรับใช้ตรวจสอบคำสั่งซื้อและการชำระเงินของ BigO-RepairCar
        </footer>
      </article>
    </main>
  );
}
