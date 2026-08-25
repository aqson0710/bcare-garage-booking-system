"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  getCustomerProductOrders,
  type ProductOrderWithItems,
} from "@/features/products";
import { createClient } from "@/lib/supabase/browser";
import { ProductImageThumb } from "./product-image-thumb";

type LoadState =
  | { status: "loading"; orders: null; error: null }
  | { status: "signed-out"; orders: null; error: null }
  | { status: "ready"; orders: ProductOrderWithItems[]; error: null }
  | { status: "error"; orders: null; error: string };

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function getOrderStatusStyle(status: ProductOrderWithItems["status"]) {
  if (status === "pending") {
    return "bg-amber-50 text-amber-800";
  }

  if (
    status === "confirmed" ||
    status === "preparing" ||
    status === "ready_for_pickup" ||
    status === "out_for_delivery"
  ) {
    return "bg-cyan-50 text-cyan-800";
  }

  if (status === "completed") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-red-50 text-red-700";
}

function getPaymentStatusStyle(status: ProductOrderWithItems["payment_status"]) {
  if (status === "paid") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  if (status === "pending") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "refunded") {
    return "bg-cyan-50 text-cyan-800";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function getVerificationStatusStyle(
  status: ProductOrderWithItems["payments"][number]["verification_status"],
) {
  if (status === "verified") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  if (status === "submitted") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "rejected" || status === "failed") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatOrderStatus(status: ProductOrderWithItems["status"]) {
  if (status === "pending") {
    return "รอรับออเดอร์";
  }

  if (status === "confirmed") {
    return "ยืนยันออเดอร์แล้ว";
  }

  if (status === "preparing") {
    return "กำลังจัดเตรียม";
  }

  if (status === "ready_for_pickup") {
    return "พร้อมรับที่อู่";
  }

  if (status === "out_for_delivery") {
    return "กำลังจัดส่ง";
  }

  if (status === "completed") {
    return "สำเร็จ";
  }

  return "ยกเลิกแล้ว";
}

function formatPaymentStatus(status: ProductOrderWithItems["payment_status"]) {
  if (status === "paid") {
    return "ชำระเงินแล้ว";
  }

  if (status === "pending") {
    return "รอตรวจชำระเงิน";
  }

  if (status === "refunded") {
    return "คืนเงินแล้ว";
  }

  if (status === "cancelled") {
    return "ยกเลิกการชำระเงิน";
  }

  return "ยังไม่ชำระเงิน";
}

function formatVerificationStatus(
  status: ProductOrderWithItems["payments"][number]["verification_status"],
) {
  if (status === "not_submitted") {
    return "ยังไม่ส่งสลิป";
  }

  if (status === "submitted") {
    return "ส่งสลิปแล้ว รอตรวจ";
  }

  if (status === "verified") {
    return "สลิปผ่านแล้ว";
  }

  if (status === "rejected") {
    return "สลิปไม่ผ่าน";
  }

  return "ตรวจสลิปล้มเหลว";
}

function getPaymentVerifierLabel(
  payment: ProductOrderWithItems["payments"][number] | null,
) {
  if (!payment) {
    return "-";
  }

  if (payment.verification_provider === "slipok") {
    return "SlipOK";
  }

  return "แอดมิน";
}

function formatDeliveryMethod(method: ProductOrderWithItems["delivery_method"]) {
  return method === "delivery" ? "จัดส่งถึงบ้าน" : "รับที่อู่";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ProductOrderCard({ order }: { order: ProductOrderWithItems }) {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const firstItems = order.items.slice(0, 3);
  const latestPayment = order.payments[0] ?? null;

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--brand)]">
            {order.order_number}
          </p>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {formatDateTime(order.created_at)}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {formatDeliveryMethod(order.delivery_method)} · {itemCount} รายการ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getOrderStatusStyle(
              order.status,
            )}`}
          >
            {formatOrderStatus(order.status)}
          </span>
          <span
            className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getPaymentStatusStyle(
              order.payment_status,
            )}`}
          >
            {formatPaymentStatus(order.payment_status)}
          </span>
          {latestPayment ? (
            <span
              className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getVerificationStatusStyle(
                latestPayment.verification_status,
              )}`}
            >
              {formatVerificationStatus(latestPayment.verification_status)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-[minmax(0,1fr)_160px]">
        <div>
          <p className="font-semibold text-[var(--foreground)]">สินค้า</p>
          <div className="mt-2 space-y-2 text-[var(--muted)]">
            {firstItems.length > 0 ? (
              firstItems.map((item) => (
                <div className="flex items-center gap-3" key={item.id}>
                  <ProductImageThumb
                    alt={`รูปสินค้า ${item.product?.name ?? "สินค้า"}`}
                    size="sm"
                    src={item.product?.image_url}
                  />
                  <p>
                    {item.product?.name ?? "สินค้า"} x {item.quantity}
                  </p>
                </div>
              ))
            ) : (
              <p>ไม่มีรายการสินค้า</p>
            )}
            {order.items.length > firstItems.length ? (
              <p>และอีก {order.items.length - firstItems.length} รายการ</p>
            ) : null}
          </div>
        </div>
        <div>
          <p className="text-[var(--muted)]">ยอดรวม</p>
          <p className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {currencyFormatter.format(order.total_amount)}
          </p>
        </div>
      </div>

      {order.status === "cancelled" ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
          <p className="font-semibold">คำสั่งซื้อนี้ถูกยกเลิกแล้ว</p>
          <p className="mt-1">
            ออเดอร์นี้จะไม่ถูกจัดเตรียมหรือจัดส่งต่อแล้ว
          </p>
        </div>
      ) : null}

      {latestPayment?.verification_status === "rejected" ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
          <p className="font-semibold">สลิปไม่ผ่าน สามารถส่งใหม่ได้</p>
          <p className="mt-1">
            {latestPayment.rejected_reason
              ? `${getPaymentVerifierLabel(latestPayment)} ตรวจไม่ผ่าน: ${
                  latestPayment.rejected_reason
                }`
              : `${getPaymentVerifierLabel(
                  latestPayment,
                )} ตรวจไม่ผ่าน กรุณาเปิดรายละเอียดเพื่อส่งสลิปใหม่`}
          </p>
        </div>
      ) : null}

      {latestPayment?.verification_status === "submitted" ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          <p className="font-semibold">ส่งสลิปแล้ว รอตรวจ</p>
          <p className="mt-1">
            {latestPayment.verification_provider === "slipok"
              ? "เมื่อ SlipOK หรือแอดมินตรวจผ่าน สถานะจะเปลี่ยนเป็นชำระเงินแล้ว"
              : "เมื่อแอดมินอนุมัติ สถานะจะเปลี่ยนเป็นชำระเงินแล้ว"}
          </p>
        </div>
      ) : null}

      {latestPayment?.verification_status === "verified" ? (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]">
          <p className="font-semibold">ชำระเงินเรียบร้อยแล้ว</p>
          <p className="mt-1">
            {getPaymentVerifierLabel(latestPayment)} ตรวจสลิปผ่านแล้ว
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="break-all text-xs text-[var(--muted)]">
          รหัสออเดอร์: {order.id}
        </p>
        <Link
          className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
          href={`/my-product-orders/${order.id}`}
        >
          ดูรายละเอียด
        </Link>
      </div>
    </article>
  );
}

export function CustomerProductOrdersPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    orders: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadOrders() {
      setLoadState({
        error: null,
        orders: null,
        status: "loading",
      });

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setLoadState({
          error: sessionError.message,
          orders: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          error: null,
          orders: null,
          status: "signed-out",
        });
        return;
      }

      const { data, error } = await getCustomerProductOrders(
        supabase,
        session.user.id,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          error: error.message,
          orders: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        error: null,
        orders: data ?? [],
        status: "ready",
      });
    }

    loadOrders();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadOrders();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
            BCare
          </p>
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              คำสั่งซื้อสินค้า
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ดูประวัติการสั่งซื้อสินค้า สถานะออเดอร์ วิธีรับสินค้า และยอดรวม
              ของบัญชีที่เข้าสู่ระบบอยู่
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
            href="/products"
          >
            เลือกสินค้าเพิ่ม
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดคำสั่งซื้อ...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อนดูคำสั่งซื้อ</p>
            <p className="mt-1">เข้าสู่ระบบด้วยบัญชีลูกค้าที่ใช้สั่งสินค้า</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่หน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          {loadState.orders.length > 0 ? (
            <div className="space-y-4">
              {loadState.orders.map((order) => (
                <ProductOrderCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">
                ยังไม่มีคำสั่งซื้อสินค้า
              </p>
              <p className="mt-1">
                เริ่มจากหน้าเลือกสินค้า เพิ่มสินค้าเข้าตะกร้า แล้ว checkout
              </p>
              <Link
                className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                href="/products"
              >
                ไปเลือกสินค้า
              </Link>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
