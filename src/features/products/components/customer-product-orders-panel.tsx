"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  cancelOwnProductOrder,
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

type StatusFilter = "all" | "action_needed" | "in_progress" | "done";

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

const filterOptions: { value: StatusFilter; label: string }[] = [
  { label: "ทั้งหมด", value: "all" },
  { label: "ต้องดำเนินการ", value: "action_needed" },
  { label: "กำลังดำเนินการ", value: "in_progress" },
  { label: "เสร็จสิ้น / ยกเลิก", value: "done" },
];

function matchesFilter(order: ProductOrderWithItems, filter: StatusFilter) {
  if (filter === "all") {
    return true;
  }

  const latestPayment = order.payments[0] ?? null;
  const needsAction =
    order.payment_status === "unpaid" ||
    latestPayment?.verification_status === "rejected";

  if (filter === "action_needed") {
    return needsAction;
  }

  if (filter === "done") {
    return order.status === "completed" || order.status === "cancelled";
  }

  return !needsAction && order.status !== "completed" && order.status !== "cancelled";
}

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

  if (status === "pending" || status === "partially_paid") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "refunded") {
    return "bg-cyan-50 text-cyan-800";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-[var(--surface-muted)] text-[var(--foreground)]";
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

  if (status === "partially_paid") {
    return "ชำระบางส่วน";
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

function formatDeliveryMethod(method: ProductOrderWithItems["delivery_method"]) {
  return method === "delivery" ? "จัดส่งถึงบ้าน" : "รับที่อู่";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ProductOrderRow({
  onCancelled,
  order,
}: {
  onCancelled: (orderId: string) => void;
  order: ProductOrderWithItems;
}) {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const previewItems = order.items.slice(0, 4);
  const latestPayment = order.payments[0] ?? null;
  const needsAttention =
    order.payment_status === "unpaid" ||
    latestPayment?.verification_status === "rejected";
  const [cancelState, setCancelState] = useState<
    { status: "idle"; error: null } | { status: "cancelling"; error: null } | { status: "error"; error: string }
  >({ error: null, status: "idle" });

  async function handleCancel() {
    if (
      !window.confirm(
        "ยืนยันยกเลิกคำสั่งซื้อนี้หรือไม่? ระบบจะคืนสต๊อกสินค้าที่ตัดไว้ให้อัตโนมัติ และไม่สามารถย้อนกลับได้",
      )
    ) {
      return;
    }

    setCancelState({ error: null, status: "cancelling" });
    const supabase = createClient();
    const { error } = await cancelOwnProductOrder(supabase, order.id);

    if (error) {
      setCancelState({ error: error.message, status: "error" });
      return;
    }

    setCancelState({ error: null, status: "idle" });
    onCancelled(order.id);
  }

  return (
    <article
      className={
        needsAttention
          ? "rounded-lg border-2 border-amber-300 bg-[var(--surface)] p-4 shadow-sm sm:p-5"
          : "rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[var(--foreground)]">
              {order.order_number}
            </p>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${getOrderStatusStyle(order.status)}`}
            >
              {formatOrderStatus(order.status)}
            </span>
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${getPaymentStatusStyle(order.payment_status)}`}
            >
              {formatPaymentStatus(order.payment_status)}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            {formatDateTime(order.created_at)} · {formatDeliveryMethod(order.delivery_method)}{" "}
            · {itemCount} ชิ้น
          </p>
        </div>
        <p className="text-xl font-bold text-[var(--foreground)] sm:text-right">
          {currencyFormatter.format(order.total_amount)}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 overflow-x-auto">
        {previewItems.map((item) => (
          <ProductImageThumb
            alt={`รูปสินค้า ${item.product?.name ?? "สินค้า"}`}
            key={item.id}
            size="sm"
            src={item.product?.image_url}
          />
        ))}
        {order.items.length > previewItems.length ? (
          <span className="flex h-10 shrink-0 items-center rounded-md bg-[var(--surface-muted)] px-2 text-xs font-semibold text-[var(--muted)]">
            +{order.items.length - previewItems.length}
          </span>
        ) : null}
      </div>

      {needsAttention ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          {latestPayment?.verification_status === "rejected"
            ? "สลิปไม่ผ่านการตรวจ กรุณาเปิดรายละเอียดเพื่อส่งสลิปใหม่"
            : "ยังไม่ได้ชำระเงินสำหรับคำสั่งซื้อนี้"}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
        <Link
          className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
          href={`/my-product-orders/${order.id}`}
        >
          ดูรายละเอียด
        </Link>
        <Link
          className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
          href={`/my-product-orders/${order.id}/receipt`}
        >
          ใบเสร็จ
        </Link>
        {order.status === "pending" ? (
          <button
            className="min-h-10 rounded-md border border-red-200 bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={cancelState.status === "cancelling"}
            onClick={handleCancel}
            type="button"
          >
            {cancelState.status === "cancelling" ? "กำลังยกเลิก..." : "ยกเลิกคำสั่งซื้อ"}
          </button>
        ) : null}
      </div>

      {cancelState.status === "error" ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {cancelState.error}
        </p>
      ) : null}
    </article>
  );
}

export function CustomerProductOrdersPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    orders: null,
    status: "loading",
  });
  const [filter, setFilter] = useState<StatusFilter>("all");

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

  const filteredOrders = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    return loadState.orders.filter((order) => matchesFilter(order, filter));
  }, [loadState, filter]);

  function handleOrderCancelled(orderId: string) {
    setLoadState((current) => {
      if (current.status !== "ready") {
        return current;
      }

      return {
        ...current,
        orders: current.orders.map((order) =>
          order.id === orderId ? { ...order, status: "cancelled" } : order,
        ),
      };
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              คำสั่งซื้อสินค้า
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ดูประวัติการสั่งซื้อสินค้า สถานะออเดอร์ และยอดชำระเงิน
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
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
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
          <div className="max-w-xl rounded-lg border border-red-200 bg-[var(--surface)] px-5 py-4 text-sm text-[var(--danger)] shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          {loadState.orders.length > 0 ? (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <button
                    className={
                      filter === option.value
                        ? "min-h-9 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                        : "min-h-9 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)]"
                    }
                    key={option.value}
                    onClick={() => setFilter(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {filteredOrders.length > 0 ? (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <ProductOrderRow
                      key={order.id}
                      onCancelled={handleOrderCancelled}
                      order={order}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
                  ไม่มีคำสั่งซื้อในหมวดนี้
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
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
