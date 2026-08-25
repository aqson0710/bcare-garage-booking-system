"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminProductOrdersPage,
  updateAdminProductOrderStatus,
  type AdminAccessResult,
  type AdminProductOrder,
  type AdminProductOrderListResult,
  type AdminProductOrderListPaymentFilter,
  type AdminProductOrderListStatusFilter,
  type AdminProductOrderStatusAction,
} from "@/features/admin";
import { ProductImageThumb } from "@/features/products/components/product-image-thumb";
import { createClient } from "@/lib/supabase/browser";

type StatusFilter = AdminProductOrderListStatusFilter;
type PaymentFilter = AdminProductOrderListPaymentFilter;

type LoadState =
  | { status: "loading"; access: null; result: null; error: null }
  | { status: "signed-out"; access: null; result: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      result: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      result: AdminProductOrderListResult;
      error: null;
    }
  | { status: "error"; access: null; result: null; error: string };

type ActionState =
  | { status: "idle"; orderId: null; error: null }
  | { status: "updating"; orderId: string; error: null }
  | { status: "error"; orderId: string; error: string };

const statusFilters: StatusFilter[] = [
  "all",
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
  "completed",
  "cancelled",
];
const paymentFilters: PaymentFilter[] = [
  "all",
  "unpaid",
  "pending",
  "paid",
  "refunded",
  "cancelled",
];
const pageSize = 10;
const editableStatuses: AdminProductOrderStatusAction[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
  "completed",
  "cancelled",
];

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function parseStatusFilter(status: string | null): StatusFilter {
  if (
    status === "pending" ||
    status === "confirmed" ||
    status === "preparing" ||
    status === "ready_for_pickup" ||
    status === "out_for_delivery" ||
    status === "completed" ||
    status === "cancelled"
  ) {
    return status;
  }

  return "all";
}

function parsePaymentFilter(paymentStatus: string | null): PaymentFilter {
  if (
    paymentStatus === "unpaid" ||
    paymentStatus === "pending" ||
    paymentStatus === "paid" ||
    paymentStatus === "refunded" ||
    paymentStatus === "cancelled"
  ) {
    return paymentStatus;
  }

  return "all";
}

function parsePage(page: string | null) {
  const parsedPage = Number(page);

  if (!Number.isFinite(parsedPage) || parsedPage < 1) {
    return 1;
  }

  return Math.floor(parsedPage);
}

function clampPage(page: number, totalPages: number) {
  if (!Number.isFinite(page)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.floor(page)), totalPages);
}

function getOrderStatusStyle(status: AdminProductOrder["status"]) {
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

function getPaymentStatusStyle(status: AdminProductOrder["payment_status"]) {
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

function formatOrderStatus(status: AdminProductOrder["status"]) {
  if (status === "pending") {
    return "รอรับออเดอร์";
  }

  if (status === "confirmed") {
    return "ยืนยันแล้ว";
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

function formatPaymentStatus(status: AdminProductOrder["payment_status"]) {
  if (status === "paid") {
    return "ชำระแล้ว";
  }

  if (status === "pending") {
    return "รอตรวจชำระเงิน";
  }

  if (status === "refunded") {
    return "คืนเงินแล้ว";
  }

  if (status === "cancelled") {
    return "ยกเลิกชำระเงิน";
  }

  return "ยังไม่ชำระ";
}

function getVerificationStatusStyle(
  status: AdminProductOrder["payments"][number]["verification_status"],
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

function formatPaymentFilterLabel(paymentStatus: PaymentFilter) {
  if (paymentStatus === "all") {
    return "ทุกการชำระเงิน";
  }

  if (paymentStatus === "unpaid") {
    return "ยังไม่ชำระ";
  }

  if (paymentStatus === "pending") {
    return "รอตรวจสลิป";
  }

  if (paymentStatus === "paid") {
    return "ชำระแล้ว";
  }

  if (paymentStatus === "refunded") {
    return "คืนเงิน";
  }

  return "ยกเลิกชำระเงิน";
}

function formatVerificationStatus(
  status: AdminProductOrder["payments"][number]["verification_status"],
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

function formatDeliveryMethod(method: AdminProductOrder["delivery_method"]) {
  return method === "delivery" ? "จัดส่งถึงบ้าน" : "รับที่อู่";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getAdminOrderActions(
  order: AdminProductOrder,
): Array<{
  label: string;
  status: AdminProductOrderStatusAction;
  tone: string;
}> {
  if (order.status === "pending") {
    return [
      {
        label: "ยืนยันออเดอร์",
        status: "confirmed",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "ยกเลิก",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  if (order.status === "confirmed") {
    return [
      {
        label: "เริ่มจัดเตรียม",
        status: "preparing",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "ยกเลิก",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  if (order.status === "preparing") {
    return [
      {
        label:
          order.delivery_method === "delivery"
            ? "เริ่มจัดส่ง"
            : "พร้อมรับที่อู่",
        status:
          order.delivery_method === "delivery"
            ? "out_for_delivery"
            : "ready_for_pickup",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "ยกเลิก",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  if (order.status === "ready_for_pickup" || order.status === "out_for_delivery") {
    return [
      {
        label: "ปิดออเดอร์สำเร็จ",
        status: "completed",
        tone: "bg-[var(--brand)] text-white",
      },
    ];
  }

  return [];
}

function AdminPaginationControls({
  onPageChange,
  placement,
  result,
}: {
  onPageChange: (page: number) => void;
  placement: "bottom" | "top";
  result: AdminProductOrderListResult;
}) {
  const inputId = `product-order-page-jump-${placement}-${result.page}-${result.totalPages}`;

  function handlePageJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const requestedPage = Number(formData.get("page"));
    onPageChange(clampPage(requestedPage, result.totalPages));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-sm text-[var(--muted)]">
        หน้า {result.page} จาก {result.totalPages}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <button
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={result.page <= 1}
            onClick={() => onPageChange(result.page - 1)}
            type="button"
          >
            ก่อนหน้า
          </button>
          <button
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={result.page >= result.totalPages}
            onClick={() => onPageChange(result.page + 1)}
            type="button"
          >
            ถัดไป
          </button>
        </div>

        <form
          className="flex items-center gap-2"
          key={inputId}
          onSubmit={handlePageJump}
        >
          <label
            className="whitespace-nowrap text-sm font-semibold text-[var(--muted)]"
            htmlFor={inputId}
          >
            ไปหน้า
          </label>
          <input
            className="min-h-10 w-24 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            defaultValue={result.page}
            id={inputId}
            inputMode="numeric"
            max={result.totalPages}
            min={1}
            name="page"
            type="number"
          />
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
            type="submit"
          >
            ไป
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminProductOrderCard({
  actionState,
  onStatusChange,
  order,
}: {
  actionState: ActionState;
  onStatusChange: (
    order: AdminProductOrder,
    status: AdminProductOrderStatusAction,
  ) => void;
  order: AdminProductOrder;
}) {
  const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
  const firstItems = order.items.slice(0, 3);
  const returnedItemCount = order.returnMovements.reduce(
    (total, movement) => total + movement.quantity,
    0,
  );
  const soldItemCount = order.saleMovements.reduce(
    (total, movement) => total + movement.quantity,
    0,
  );
  const latestPayment = order.payments[0] ?? null;
  const actions = getAdminOrderActions(order);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<AdminProductOrderStatusAction>(order.status);
  const isUpdating =
    actionState.status === "updating" && actionState.orderId === order.id;
  const canSaveStatus = selectedStatus !== order.status && !isUpdating;

  function cancelStatusEdit() {
    setSelectedStatus(order.status);
    setIsEditingStatus(false);
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand)]">
              {order.order_number}
            </p>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getOrderStatusStyle(
                order.status,
              )}`}
            >
              {formatOrderStatus(order.status)}
            </span>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getPaymentStatusStyle(
                order.payment_status,
              )}`}
            >
              {formatPaymentStatus(order.payment_status)}
            </span>
            {latestPayment ? (
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getVerificationStatusStyle(
                  latestPayment.verification_status,
                )}`}
              >
                {formatVerificationStatus(latestPayment.verification_status)}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {formatDateTime(order.created_at)}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {formatDeliveryMethod(order.delivery_method)} · {itemCount} รายการ
          </p>
        </div>
        <Link
          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
          href={`/admin/product-orders/${order.id}`}
        >
          ดูรายละเอียด
        </Link>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm md:grid-cols-4">
        <div>
          <dt className="text-[var(--muted)]">ลูกค้า</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {order.customer?.full_name ?? "-"}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {order.customer?.phone_number ?? "-"}
          </dd>
          <dd className="mt-1 break-all text-xs text-[var(--muted)]">
            {order.customer?.email ?? "-"}
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-[var(--muted)]">สินค้า</dt>
          <dd className="mt-1 space-y-2 text-[var(--foreground)]">
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
              <p>-</p>
            )}
            {order.items.length > firstItems.length ? (
              <p className="text-xs text-[var(--muted)]">
                และอีก {order.items.length - firstItems.length} รายการ
              </p>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">ยอดรวม</dt>
          <dd className="mt-1 text-xl font-bold text-[var(--foreground)]">
            {currencyFormatter.format(order.total_amount)}
          </dd>
        </div>
      </dl>

      {order.note ? (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6 text-[var(--muted)]">
          {order.note}
        </div>
      ) : null}

      {order.status === "cancelled" ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
          <p className="font-semibold">ออเดอร์นี้ถูกยกเลิกแล้ว</p>
          {order.saleMovements.length > 0 ? (
            <p className="mt-1">
              คืน stock แล้ว {returnedItemCount} จาก {soldItemCount} ชิ้น
            </p>
          ) : (
            <p className="mt-1">
              ไม่พบ sale movement เดิม จึงไม่มี stock ที่ต้องคืน
            </p>
          )}
        </div>
      ) : null}

      {latestPayment?.verification_status === "submitted" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          <p className="font-semibold">รอตรวจสลิป</p>
          <p className="mt-1">
            ลูกค้าส่งหลักฐานแล้ว เปิดรายละเอียดเพื่อดูรูปสลิปและอนุมัติหรือปฏิเสธ
          </p>
        </div>
      ) : null}

      {latestPayment?.verification_status === "rejected" ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
          <p className="font-semibold">สลิปถูกปฏิเสธ</p>
          <p className="mt-1">
            {latestPayment.rejected_reason
              ? `เหตุผล: ${latestPayment.rejected_reason}`
              : "ยังไม่มีเหตุผลที่บันทึกไว้"}
          </p>
        </div>
      ) : null}

      <p className="mt-4 break-all text-xs text-[var(--muted)]">
        รหัสออเดอร์: {order.id}
      </p>

      <div className="mt-5 flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        {isEditingStatus ? (
          <div className="flex w-full flex-col gap-3 rounded-md border border-[var(--line)] bg-slate-50 p-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="text-sm font-semibold text-[var(--foreground)]">
              แก้ไขสถานะ
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] sm:w-56"
                disabled={isUpdating}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target.value as AdminProductOrderStatusAction,
                  )
                }
                value={selectedStatus}
              >
                {editableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatOrderStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                disabled={isUpdating}
                onClick={cancelStatusEdit}
                type="button"
              >
                ยกเลิกการแก้ไข
              </button>
              <button
                className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSaveStatus}
                onClick={() => onStatusChange(order, selectedStatus)}
                type="button"
              >
                {isUpdating ? "กำลังบันทึก..." : "บันทึกสถานะ"}
              </button>
            </div>
          </div>
        ) : actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                className={`min-h-10 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${action.tone}`}
                disabled={isUpdating}
                key={action.status}
                onClick={() => onStatusChange(order, action.status)}
                type="button"
              >
                {isUpdating ? "กำลังอัปเดต..." : action.label}
              </button>
            ))}
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
              disabled={isUpdating}
              onClick={() => setIsEditingStatus(true)}
              type="button"
            >
              แก้ไขสถานะ
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-[var(--muted)]">
              ไม่มีปุ่มลัดสำหรับสถานะนี้
            </p>
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
              disabled={isUpdating}
              onClick={() => setIsEditingStatus(true)}
              type="button"
            >
              แก้ไขสถานะ
            </button>
          </div>
        )}

        {actionState.status === "error" && actionState.orderId === order.id ? (
          <p className="text-sm text-red-700">{actionState.error}</p>
        ) : null}
      </div>
    </article>
  );
}

export function AdminProductOrdersPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const paymentFilter = parsePaymentFilter(searchParams.get("payment"));
  const page = parsePage(searchParams.get("page"));
  const submittedSearch = searchParams.get("search") ?? "";
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    result: null,
    status: "loading",
  });
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("search") ?? "",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [actionState, setActionState] = useState<ActionState>({
    error: null,
    orderId: null,
    status: "idle",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadOrders() {
      setLoadState({
        access: null,
        error: null,
        result: null,
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
          access: null,
          error: sessionError.message,
          result: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          error: null,
          result: null,
          status: "signed-out",
        });
        return;
      }

      const access = await checkAdminAccess(supabase, session.user.id);

      if (!isMounted) {
        return;
      }

      if (!access.allowed) {
        setLoadState({
          access,
          error: null,
          result: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminProductOrdersPage(supabase, {
        page,
        pageSize,
        paymentStatus: paymentFilter,
        search: submittedSearch,
        status: statusFilter,
      });

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          error: error.message,
          result: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        error: null,
        result: data,
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
  }, [page, paymentFilter, reloadKey, statusFilter, submittedSearch]);

  function updateFilters(next: {
    page?: number;
    payment?: PaymentFilter;
    search?: string;
    status?: StatusFilter;
  }) {
    const nextPage = next.page ?? page;
    const nextPayment = next.payment ?? paymentFilter;
    const nextSearch = next.search ?? submittedSearch;
    const nextStatus = next.status ?? statusFilter;
    const params = new URLSearchParams();

    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }

    if (nextPayment !== "all") {
      params.set("payment", nextPayment);
    }

    if (nextSearch.trim()) {
      params.set("search", nextSearch.trim());
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({
      page: 1,
      search: searchInput,
    });
  }

  function handlePageChange(nextPage: number) {
    updateFilters({
      page: nextPage,
    });
  }

  async function handleStatusChange(
    order: AdminProductOrder,
    nextStatus: AdminProductOrderStatusAction,
  ) {
    if (loadState.status !== "ready") {
      return;
    }

    if (
      nextStatus === "cancelled" &&
      !window.confirm(
        "ยกเลิกคำสั่งซื้อนี้และคืนสต็อกสินค้าเข้าคลังหรือไม่?",
      )
    ) {
      return;
    }

    setActionState({
      error: null,
      orderId: order.id,
      status: "updating",
    });

    const supabase = createClient();
    const { error } = await updateAdminProductOrderStatus(
      supabase,
      order.id,
      nextStatus,
    );

    if (error) {
      setActionState({
        error: error.message,
        orderId: order.id,
        status: "error",
      });
      return;
    }

    setReloadKey((currentKey) => currentKey + 1);
    setActionState({
      error: null,
      orderId: null,
      status: "idle",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
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
              ออเดอร์สินค้า
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ดูคำสั่งซื้อสินค้าจากลูกค้า พร้อมค้นหา กรองสถานะ และเปิดดูรายละเอียด
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            กลับหน้าแอดมิน
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดคำสั่งซื้อสินค้า...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อน</p>
            <p className="mt-1">เข้าสู่ระบบด้วยบัญชี admin</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่หน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">Access denied</p>
            <p className="mt-2">{loadState.access.reason}</p>
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
          <div className="space-y-4 border-b border-[var(--line)] pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  พบ {loadState.result.totalCount} คำสั่งซื้อ
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  หน้า {loadState.result.page} จาก{" "}
                  {loadState.result.totalPages}
                </p>
                {paymentFilter === "pending" ? (
                  <p className="mt-1 text-sm font-semibold text-amber-800">
                    กำลังดูคิวรอตรวจสลิป
                  </p>
                ) : null}
              </div>

              <form
                className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl"
                onSubmit={handleSearchSubmit}
              >
                <input
                  className="min-h-10 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="ค้นหาเลขออเดอร์ ลูกค้า เบอร์โทร สินค้า หมายเหตุ หรือ order ID"
                  type="search"
                  value={searchInput}
                />
                <button
                  className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                  type="submit"
                >
                  ค้นหา
                </button>
                {submittedSearch ? (
                  <button
                    className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                    onClick={() => {
                      setSearchInput("");
                      updateFilters({
                        page: 1,
                        search: "",
                      });
                    }}
                    type="button"
                  >
                    ล้าง
                  </button>
                ) : null}
              </form>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusFilters.map((status) => (
                <button
                  className={
                    statusFilter === status
                      ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                      : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                  }
                  key={status}
                  onClick={() =>
                    updateFilters({
                      page: 1,
                      status,
                    })
                  }
                  type="button"
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {paymentFilters.map((paymentStatus) => (
                <button
                  className={
                    paymentFilter === paymentStatus
                      ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                      : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                  }
                  key={paymentStatus}
                  onClick={() =>
                    updateFilters({
                      page: 1,
                      payment: paymentStatus,
                    })
                  }
                  type="button"
                >
                  {formatPaymentFilterLabel(paymentStatus)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <AdminPaginationControls
              onPageChange={handlePageChange}
              placement="top"
              result={loadState.result}
            />
          </div>

          {loadState.result.orders.length > 0 ? (
            <div className="mt-5 space-y-4">
              {loadState.result.orders.map((order) => (
                <AdminProductOrderCard
                  actionState={actionState}
                  key={`${order.id}-${order.status}`}
                  onStatusChange={handleStatusChange}
                  order={order}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบคำสั่งซื้อสินค้าที่ตรงกับตัวกรองตอนนี้
            </div>
          )}

          <div className="mt-6">
            <AdminPaginationControls
              onPageChange={handlePageChange}
              placement="bottom"
              result={loadState.result}
            />
          </div>
        </section>
      ) : null}
    </main>
  );
}
