"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminBookingsPage,
  getAdminDashboardBookingCounts,
  getAdminOpenRepairJobs,
  getAdminProductOrdersPage,
  getAdminProducts,
  type AdminAccessResult,
  type AdminBooking,
  type AdminProduct,
  type AdminProductOrder,
  type AdminRepairJob,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type DashboardCounts = Record<AdminBooking["status"], number>;

type MiniChartPoint = {
  label: string;
  note?: string;
  value: number;
};

type BreakdownRow = {
  label: string;
  value: number;
};

type LoadState =
  | {
      status: "loading";
      access: null;
      bookingCounts: null;
      bookings: null;
      error: null;
      productOrders: null;
      products: null;
      repairJobs: null;
    }
  | {
      status: "signed-out";
      access: null;
      bookingCounts: null;
      bookings: null;
      error: null;
      productOrders: null;
      products: null;
      repairJobs: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      bookingCounts: DashboardCounts | null;
      bookings: AdminBooking[] | null;
      error: null;
      productOrders: AdminProductOrder[] | null;
      products: AdminProduct[] | null;
      repairJobs: AdminRepairJob[] | null;
      todayBookingCount: number;
    }
  | {
      status: "error";
      access: null;
      bookingCounts: null;
      bookings: null;
      error: string;
      productOrders: null;
      products: null;
      repairJobs: null;
    };

const dashboardOrderPageSize = 100;
const dashboardBookingPageSize = 100;
const dashboardRepairJobLimit = 50;
const lowStockThreshold = 2;

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok",
});

function getDateKey(value: Date | string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function getTodayDateKey() {
  return getDateKey(new Date());
}

function addDays(date: Date, offset: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + offset);

  return nextDate;
}

function getMonthKey(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Bangkok",
    year: "numeric",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";

  return `${year}-${month}`;
}

function getCurrentMonthKey() {
  return getMonthKey(new Date());
}

function formatShortDate(value: Date | string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function isToday(value: string) {
  return getDateKey(value) === getTodayDateKey();
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return dateTimeFormatter.format(new Date(value));
}

function getLatestPaidAt(order: AdminProductOrder) {
  return (
    order.payments
      .filter((payment) => payment.payment_status === "paid" && payment.paid_at)
      .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""))[0]
      ?.paid_at ?? null
  );
}

function incrementNamedCount(map: Map<string, number>, label: string, value = 1) {
  map.set(label, (map.get(label) ?? 0) + value);
}

function getStatusStyle(status: AdminBooking["status"]) {
  if (status === "pending") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "confirmed") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function getProductOrderStatusStyle(status: AdminProductOrder["status"]) {
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

function getRepairJobStatusStyle(status: AdminRepairJob["status"]) {
  if (status === "pending" || status === "assigned") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "in_progress") {
    return "bg-cyan-50 text-cyan-800";
  }

  if (status === "completed") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-red-50 text-red-700";
}

function getDashboardCounts(bookings: AdminBooking[]) {
  return bookings.reduce<DashboardCounts>(
    (counts, booking) => ({
      ...counts,
      [booking.status]: counts[booking.status] + 1,
    }),
    {
      cancelled: 0,
      completed: 0,
      confirmed: 0,
      pending: 0,
    },
  );
}

function DashboardCard({
  count,
  href,
  label,
  note,
}: {
  count: number | string;
  href: string;
  label: string;
  note: string;
}) {
  return (
    <Link
      className="flex min-h-36 flex-col rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm hover:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
      href={href}
    >
      <p className="text-sm font-semibold text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 break-words text-3xl font-bold text-[var(--foreground)]">
        {count}
      </p>
      <p className="mt-auto pt-4 text-xs leading-5 text-[var(--muted)]">
        {note}
      </p>
    </Link>
  );
}

function SignalCard({
  label,
  note,
  tone = "neutral",
  value,
}: {
  label: string;
  note: string;
  tone?: "danger" | "neutral" | "success" | "warning";
  value: number | string;
}) {
  const toneClass = {
    danger: "border-red-200 bg-red-50 text-red-800",
    neutral: "border-[var(--line)] bg-white text-[var(--foreground)]",
    success: "border-emerald-200 bg-emerald-50 text-[var(--brand-strong)]",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  }[tone];

  return (
    <div className={`min-h-32 rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold">{value}</p>
      <p className="mt-2 text-xs leading-5">{note}</p>
    </div>
  );
}

function AlertRow({
  actionHref,
  actionText,
  label,
  note,
  tone = "warning",
}: {
  actionHref: string;
  actionText: string;
  label: string;
  note: string;
  tone?: "danger" | "warning";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 text-sm sm:flex-row sm:items-center sm:justify-between ${toneClass}`}
    >
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-1 leading-5">{note}</p>
      </div>
      <Link
        className="min-h-10 rounded-md bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--foreground)]"
        href={actionHref}
      >
        {actionText}
      </Link>
    </div>
  );
}

function MiniBarChart({
  emptyText,
  maxValue,
  points,
}: {
  emptyText: string;
  maxValue: number;
  points: MiniChartPoint[];
}) {
  if (points.every((point) => point.value === 0)) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-h-48 min-w-[420px] grid-cols-7 items-end gap-2">
        {points.map((point) => {
          const height = Math.max(
            point.value > 0 ? (point.value / maxValue) * 100 : 0,
            point.value > 0 ? 10 : 0,
          );

          return (
            <div
              className="flex h-full flex-col justify-end gap-2"
              key={point.label}
            >
              <div className="flex min-h-32 flex-col justify-end rounded-md bg-slate-50 px-1">
                <div
                  className="rounded-t-md bg-[var(--brand)]"
                  style={{ height: `${height}%` }}
                  title={`${point.label}: ${point.value}`}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-[var(--foreground)]">
                  {point.value}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
                  {point.label}
                </p>
                {point.note ? (
                  <p className="text-[10px] leading-4 text-[var(--muted)]">
                    {point.note}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BreakdownList({
  emptyText,
  rows,
}: {
  emptyText: string;
  rows: BreakdownRow[];
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const percent = total > 0 ? Math.round((row.value / total) * 100) : 0;

        return (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="min-w-0 truncate font-semibold text-[var(--foreground)]">
                {row.label}
              </p>
              <p className="shrink-0 text-[var(--muted)]">
                {row.value} / {percent}%
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[var(--brand)]"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankedList({
  emptyText,
  rows,
}: {
  emptyText: string;
  rows: BreakdownRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white p-3 text-sm"
          key={row.label}
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--brand)]">
              #{index + 1}
            </p>
            <p className="mt-1 truncate font-semibold text-[var(--foreground)]">
              {row.label}
            </p>
          </div>
          <p className="shrink-0 font-semibold text-[var(--muted)]">
            {row.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function RecentBookingRow({ booking }: { booking: AdminBooking }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand)]">
              {booking.service?.name ?? "ไม่พบบริการ"}
            </p>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                booking.status,
              )}`}
            >
              {booking.status}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">
            {booking.booking_date} at {formatTime(booking.booking_time)}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {booking.customer?.full_name ?? "-"} /{" "}
            {booking.vehicle?.license_plate ?? "-"}
          </p>
        </div>
        <Link
          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
          href={`/admin/bookings/${booking.id}`}
        >
          ดูรายละเอียด
        </Link>
      </div>
    </article>
  );
}

function ProductOrderQueueRow({ order }: { order: AdminProductOrder }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand)]">
              {order.order_number}
            </p>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getProductOrderStatusStyle(
                order.status,
              )}`}
            >
              {order.status}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">
            {currencyFormatter.format(order.total_amount)}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {order.customer?.full_name ?? "-"} / {order.payment_status}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            สร้างเมื่อ {formatDateTime(order.created_at)}
          </p>
        </div>
        <Link
          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
          href={`/admin/product-orders/${order.id}`}
        >
          ดูรายละเอียด
        </Link>
      </div>
    </article>
  );
}

function RepairJobQueueRow({ repairJob }: { repairJob: AdminRepairJob }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand)]">
              {repairJob.service?.name ?? "Repair job"}
            </p>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getRepairJobStatusStyle(
                repairJob.status,
              )}`}
            >
              {repairJob.status}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">
            {repairJob.vehicle?.license_plate ?? "-"}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {repairJob.customer?.full_name ?? "-"}
          </p>
        </div>
        <Link
          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
          href="/admin/repair-jobs"
        >
          Open jobs
        </Link>
      </div>
    </article>
  );
}

function LowStockRow({ product }: { product: AdminProduct }) {
  return (
    <Link
      className="block rounded-lg border border-[var(--line)] bg-white p-4 text-sm shadow-sm hover:border-[var(--brand)]"
      href="/admin/inventory"
    >
      <p className="font-semibold text-[var(--foreground)]">{product.name}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        SKU {product.sku ?? "-"} / stock {product.stock_quantity}
      </p>
    </Link>
  );
}

export function AdminAccessPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    bookingCounts: null,
    bookings: null,
    error: null,
    productOrders: null,
    products: null,
    repairJobs: null,
    status: "loading",
  });
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadDashboard() {
      setLoadState({
        access: null,
        bookingCounts: null,
        bookings: null,
        error: null,
        productOrders: null,
        products: null,
        repairJobs: null,
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
          bookingCounts: null,
          bookings: null,
          error: sessionError.message,
          productOrders: null,
          products: null,
          repairJobs: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          bookingCounts: null,
          bookings: null,
          error: null,
          productOrders: null,
          products: null,
          repairJobs: null,
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
          bookingCounts: null,
          bookings: null,
          error: null,
          productOrders: null,
          products: null,
          repairJobs: null,
          status: "ready",
          todayBookingCount: 0,
        });
        return;
      }

      const todayDate = getTodayDateKey();
      const [
        bookingCountsResult,
        bookingsResult,
        productOrdersResult,
        productsResult,
        repairJobsResult,
      ] = await Promise.all([
        getAdminDashboardBookingCounts(supabase, todayDate),
        getAdminBookingsPage(supabase, {
          page: 1,
          pageSize: dashboardBookingPageSize,
          search: "",
          status: "all",
        }),
        getAdminProductOrdersPage(supabase, {
          page: 1,
          pageSize: dashboardOrderPageSize,
          paymentStatus: "all",
          search: "",
          status: "all",
        }),
        getAdminProducts(supabase),
        getAdminOpenRepairJobs(supabase, dashboardRepairJobLimit),
      ]);

      if (!isMounted) {
        return;
      }

      if (bookingCountsResult.error) {
        setLoadState({
          access: null,
          bookingCounts: null,
          bookings: null,
          error: bookingCountsResult.error.message,
          productOrders: null,
          products: null,
          repairJobs: null,
          status: "error",
        });
        return;
      }

      if (bookingsResult.error) {
        setLoadState({
          access: null,
          bookingCounts: null,
          bookings: null,
          error: bookingsResult.error.message,
          productOrders: null,
          products: null,
          repairJobs: null,
          status: "error",
        });
        return;
      }

      if (productOrdersResult.error) {
        setLoadState({
          access: null,
          bookingCounts: null,
          bookings: null,
          error: productOrdersResult.error.message,
          productOrders: null,
          products: null,
          repairJobs: null,
          status: "error",
        });
        return;
      }

      if (productsResult.error) {
        setLoadState({
          access: null,
          bookingCounts: null,
          bookings: null,
          error: productsResult.error.message,
          productOrders: null,
          products: null,
          repairJobs: null,
          status: "error",
        });
        return;
      }

      if (repairJobsResult.error) {
        setLoadState({
          access: null,
          bookingCounts: null,
          bookings: null,
          error: repairJobsResult.error.message,
          productOrders: null,
          products: null,
          repairJobs: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        bookingCounts: bookingCountsResult.data?.statusCounts ?? null,
        bookings: bookingsResult.data?.bookings ?? [],
        error: null,
        productOrders: productOrdersResult.data?.orders ?? [],
        products: productsResult.data ?? [],
        repairJobs: repairJobsResult.data ?? [],
        status: "ready",
        todayBookingCount: bookingCountsResult.data?.todayCount ?? 0,
      });
      setLastLoadedAt(new Date().toISOString());
    }

    loadDashboard();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadDashboard();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refreshKey]);

  const counts = useMemo(() => {
    if (loadState.status !== "ready") {
      return getDashboardCounts([]);
    }

    return loadState.bookingCounts ?? getDashboardCounts(loadState.bookings ?? []);
  }, [loadState]);

  const recentBookings = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.bookings) {
      return [];
    }

    return loadState.bookings.slice(0, 5);
  }, [loadState]);

  const todayBookings = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.bookings) {
      return [];
    }

    return loadState.bookings.filter((booking) =>
      isToday(booking.booking_date),
    );
  }, [loadState]);

  const pendingBookings = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.bookings) {
      return [];
    }

    return loadState.bookings.filter((booking) => booking.status === "pending");
  }, [loadState]);

  const pendingProductOrders = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.productOrders) {
      return [];
    }

    return loadState.productOrders.filter(
      (order) =>
        order.status !== "cancelled" &&
        (order.payment_status === "unpaid" ||
          order.payment_status === "pending"),
    );
  }, [loadState]);

  const activeProductOrders = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.productOrders) {
      return [];
    }

    return loadState.productOrders.filter(
      (order) =>
        order.status === "pending" ||
        order.status === "confirmed" ||
        order.status === "preparing" ||
        order.status === "ready_for_pickup" ||
        order.status === "out_for_delivery",
    );
  }, [loadState]);

  const openRepairJobs = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.repairJobs) {
      return [];
    }

    return loadState.repairJobs.filter(
      (repairJob) =>
        repairJob.status === "pending" ||
        repairJob.status === "assigned" ||
        repairJob.status === "in_progress",
    );
  }, [loadState]);

  const lowStockProducts = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.products) {
      return [];
    }

    return loadState.products
      .filter((product) => product.stock_quantity <= lowStockThreshold)
      .sort((a, b) => a.stock_quantity - b.stock_quantity);
  }, [loadState]);

  const paidProductRevenue = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.productOrders) {
      return 0;
    }

    return loadState.productOrders
      .filter((order) => order.payment_status === "paid")
      .reduce((total, order) => total + order.total_amount, 0);
  }, [loadState]);

  const todayScheduleBookings = useMemo(() => {
    return todayBookings
      .filter(
        (booking) =>
          booking.status === "pending" || booking.status === "confirmed",
      )
      .sort((a, b) => a.booking_time.localeCompare(b.booking_time))
      .slice(0, 6);
  }, [todayBookings]);

  const paymentsWaitingVerification = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.productOrders) {
      return [];
    }

    return loadState.productOrders.filter(
      (order) =>
        order.status !== "cancelled" &&
        order.payments.some(
          (payment) => payment.verification_status === "submitted",
        ),
    );
  }, [loadState]);

  const ordersReadyToFulfill = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.productOrders) {
      return [];
    }

    return loadState.productOrders.filter(
      (order) =>
        order.payment_status === "paid" &&
        order.status !== "completed" &&
        order.status !== "cancelled",
    );
  }, [loadState]);

  const unassignedRepairJobs = useMemo(() => {
    return openRepairJobs.filter((repairJob) => !repairJob.mechanic_id);
  }, [openRepairJobs]);

  const todayPaidProductRevenue = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.productOrders) {
      return 0;
    }

    return loadState.productOrders
      .filter((order) => {
        const paidAt = getLatestPaidAt(order);

        return order.payment_status === "paid" && paidAt && isToday(paidAt);
      })
      .reduce((total, order) => total + order.total_amount, 0);
  }, [loadState]);

  const monthPaidProductRevenue = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.productOrders) {
      return 0;
    }

    const currentMonthKey = getCurrentMonthKey();

    return loadState.productOrders
      .filter((order) => {
        const paidAt = getLatestPaidAt(order);

        return (
          order.payment_status === "paid" &&
          paidAt &&
          getMonthKey(paidAt) === currentMonthKey
        );
      })
      .reduce((total, order) => total + order.total_amount, 0);
  }, [loadState]);

  const todayBookingCount =
    loadState.status === "ready" ? loadState.todayBookingCount : 0;

  const bookingTrendPoints = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);

      return {
        key: getDateKey(date),
        label: formatShortDate(date),
      };
    });

    const countByDate = new Map(days.map((day) => [day.key, 0]));

    if (loadState.status === "ready" && loadState.bookings) {
      for (const booking of loadState.bookings) {
        const dateKey = getDateKey(booking.booking_date);
        if (countByDate.has(dateKey)) {
          countByDate.set(dateKey, (countByDate.get(dateKey) ?? 0) + 1);
        }
      }
    }

    return days.map((day) => ({
      label: day.label,
      value: countByDate.get(day.key) ?? 0,
    }));
  }, [loadState]);

  const revenueTrendPoints = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = addDays(today, index - 6);

      return {
        key: getDateKey(date),
        label: formatShortDate(date),
      };
    });

    const revenueByDate = new Map(days.map((day) => [day.key, 0]));

    if (loadState.status === "ready" && loadState.productOrders) {
      for (const order of loadState.productOrders) {
        const paidAt = getLatestPaidAt(order);

        if (!paidAt || order.payment_status !== "paid") {
          continue;
        }

        const dateKey = getDateKey(paidAt);
        if (revenueByDate.has(dateKey)) {
          revenueByDate.set(
            dateKey,
            (revenueByDate.get(dateKey) ?? 0) + order.total_amount,
          );
        }
      }
    }

    return days.map((day) => ({
      label: day.label,
      note: currencyFormatter.format(revenueByDate.get(day.key) ?? 0),
      value: revenueByDate.get(day.key) ?? 0,
    }));
  }, [loadState]);

  const maxBookingTrendValue = Math.max(
    1,
    ...bookingTrendPoints.map((point) => point.value),
  );
  const maxRevenueTrendValue = Math.max(
    1,
    ...revenueTrendPoints.map((point) => point.value),
  );

  const bookingStatusBreakdown = useMemo<BreakdownRow[]>(
    () => [
      { label: "pending", value: counts.pending },
      { label: "confirmed", value: counts.confirmed },
      { label: "completed", value: counts.completed },
      { label: "cancelled", value: counts.cancelled },
    ],
    [counts],
  );

  const productOrderStatusBreakdown = useMemo<BreakdownRow[]>(() => {
    if (loadState.status !== "ready" || !loadState.productOrders) {
      return [];
    }

    const statusMap = new Map<string, number>();

    for (const order of loadState.productOrders) {
      incrementNamedCount(statusMap, order.status);
    }

    return Array.from(statusMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [loadState]);

  const paymentStatusBreakdown = useMemo<BreakdownRow[]>(() => {
    if (loadState.status !== "ready" || !loadState.productOrders) {
      return [];
    }

    const statusMap = new Map<string, number>();

    for (const order of loadState.productOrders) {
      incrementNamedCount(statusMap, order.payment_status);
    }

    return Array.from(statusMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [loadState]);

  const topServiceRows = useMemo<BreakdownRow[]>(() => {
    if (loadState.status !== "ready" || !loadState.bookings) {
      return [];
    }

    const serviceMap = new Map<string, number>();

    for (const booking of loadState.bookings) {
      incrementNamedCount(serviceMap, booking.service?.name ?? "Unknown service");
    }

    return Array.from(serviceMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [loadState]);

  const topProductRows = useMemo<BreakdownRow[]>(() => {
    if (loadState.status !== "ready" || !loadState.productOrders) {
      return [];
    }

    const productMap = new Map<string, number>();

    for (const order of loadState.productOrders) {
      for (const item of order.items) {
        incrementNamedCount(
          productMap,
          item.product?.name ?? "Unknown product",
          item.quantity,
        );
      }
    }

    return Array.from(productMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [loadState]);

  const isLoading = loadState.status === "loading";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-6 pt-0 sm:px-6 sm:pb-8 sm:pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              แดชบอร์ดผู้ดูแลระบบ
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ภาพรวมงานจอง ออเดอร์สินค้า สต๊อก งานซ่อม และยอดชำระเงินสำหรับ
              แอดมิน
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
              อัปเดตล่าสุด {lastLoadedAt ? formatDateTime(lastLoadedAt) : "-"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={() => setRefreshKey((currentKey) => currentKey + 1)}
              type="button"
            >
              {isLoading ? "กำลังรีเฟรช..." : "รีเฟรช"}
            </button>
            <Link
              className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/admin/bookings"
            >
              เปิดรายการจอง
            </Link>
          </div>
        </div>
      </header>

      {isLoading ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดแดชบอร์ด...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบ</p>
            <p className="mt-1">กรุณาเข้าสู่ระบบก่อนเข้าแดชบอร์ดแอดมิน</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่บัญชี
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
          {loadState.access.allowed ? (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <DashboardCard
                  count={todayBookingCount}
                  href="/admin/bookings"
                  label="งานจองวันนี้"
                  note="งานจองบริการที่อยู่ในวันนี้"
                />
                <DashboardCard
                  count={counts.pending}
                  href="/admin/bookings?status=pending"
                  label="การจองรอยืนยัน"
                  note="คำขอจองที่ยังรอ admin จัดการ"
                />
                <DashboardCard
                  count={pendingProductOrders.length}
                  href="/admin/product-orders?paymentStatus=pending"
                  label="คิวตรวจชำระเงิน"
                  note="ออเดอร์สินค้าที่ยังรอตรวจ/รอจ่าย"
                />
                <DashboardCard
                  count={lowStockProducts.length}
                  href="/admin/inventory-review"
                  label="สต๊อกใกล้หมด"
                  note={`สินค้าเหลือไม่เกิน ${lowStockThreshold} ชิ้น`}
                />
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <DashboardCard
                  count={activeProductOrders.length}
                  href="/admin/product-orders"
                  label="ออเดอร์สินค้าที่เปิดอยู่"
                  note="ออเดอร์ที่ยังไม่ปิดงาน"
                />
                <DashboardCard
                  count={openRepairJobs.length}
                  href="/admin/repair-jobs"
                  label="งานซ่อมที่ยังเปิดอยู่"
                  note="งานซ่อมที่ยังไม่เสร็จ"
                />
                <DashboardCard
                  count={currencyFormatter.format(paidProductRevenue)}
                  href="/admin/product-orders?paymentStatus=paid"
                  label="ยอดขายสินค้าที่ชำระแล้ว"
                  note={`จาก ${dashboardOrderPageSize} ออเดอร์ล่าสุด`}
                />
                <DashboardCard
                  count={loadState.products?.length ?? 0}
                  href="/admin/products"
                  label="สินค้า"
                  note="จำนวนสินค้าที่อยู่ในระบบ"
                />
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SignalCard
                  label="ชำระวันนี้"
                  note="ยอดจากออเดอร์สินค้าที่มี payment paid วันนี้"
                  tone={todayPaidProductRevenue > 0 ? "success" : "neutral"}
                  value={currencyFormatter.format(todayPaidProductRevenue)}
                />
                <SignalCard
                  label="ชำระเดือนนี้"
                  note="ยอดเดือนนี้จากรายการที่ชำระแล้วใน 100 ออเดอร์ล่าสุด"
                  tone={monthPaidProductRevenue > 0 ? "success" : "neutral"}
                  value={currencyFormatter.format(monthPaidProductRevenue)}
                />
                <SignalCard
                  label="ตรวจสลิป"
                  note="สลิปที่ลูกค้าส่งมาแล้วและรอ admin ตรวจ"
                  tone={
                    paymentsWaitingVerification.length > 0
                      ? "warning"
                      : "success"
                  }
                  value={paymentsWaitingVerification.length}
                />
                <SignalCard
                  label="พร้อมจัดการออเดอร์"
                  note="ออเดอร์ที่จ่ายแล้วและยังต้องจัดส่ง/รับสินค้า"
                  tone={ordersReadyToFulfill.length > 0 ? "warning" : "neutral"}
                  value={ordersReadyToFulfill.length}
                />
              </section>

              <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--brand)]">
                      สิ่งที่แอดมินควรดู
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
                      สิ่งที่ควรจัดการก่อน
                    </h2>
                  </div>
                  <Link
                    className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                    href="/admin/reports"
                  >
                    ดูรายงาน
                  </Link>
                </div>
                <div className="mt-4 grid gap-3">
                  {counts.pending > 0 ? (
                    <AlertRow
                      actionHref="/admin/bookings?status=pending"
                      actionText="ตรวจรายการจอง"
                      label={`${counts.pending} คำขอจองรอจัดการ`}
                      note="มีคำขอจองที่ยังไม่ได้ยืนยัน ควรตรวจเวลาและบริการก่อน"
                    />
                  ) : null}
                  {paymentsWaitingVerification.length > 0 ? (
                    <AlertRow
                      actionHref="/admin/product-orders?paymentStatus=pending"
                      actionText="ตรวจการชำระเงิน"
                      label={`${paymentsWaitingVerification.length} สลิปรอตรวจ`}
                      note="ลูกค้าส่งหลักฐานการชำระเงินแล้ว ควรตรวจสลิปก่อนเดินออเดอร์ต่อ"
                    />
                  ) : null}
                  {lowStockProducts.length > 0 ? (
                    <AlertRow
                      actionHref="/admin/inventory-review"
                      actionText="ตรวจสต๊อก"
                      label={`${lowStockProducts.length} สินค้าใกล้หมด`}
                      note="มีสินค้าที่จำนวนคงเหลือต่ำกว่าจุดเตือน อาจต้องเติมสต๊อก"
                      tone="danger"
                    />
                  ) : null}
                  {unassignedRepairJobs.length > 0 ? (
                    <AlertRow
                      actionHref="/admin/repair-jobs"
                      actionText="มอบหมายงาน"
                      label={`${unassignedRepairJobs.length} งานซ่อมยังไม่มอบหมาย`}
                      note="มีงานซ่อมที่ยังไม่ได้มอบหมายช่าง"
                    />
                  ) : null}
                  {counts.pending === 0 &&
                  paymentsWaitingVerification.length === 0 &&
                  lowStockProducts.length === 0 &&
                  unassignedRepairJobs.length === 0 ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-[var(--brand-strong)]">
                      ตอนนี้ยังไม่มีงานเร่งด่วนใน dashboard
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Link
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--foreground)] shadow-sm hover:border-[var(--brand)]"
                  href="/admin/product-orders"
                >
                  ออเดอร์สินค้า
                </Link>
                <Link
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--foreground)] shadow-sm hover:border-[var(--brand)]"
                  href="/admin/repair-jobs"
                >
                  งานซ่อม
                </Link>
                <Link
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--foreground)] shadow-sm hover:border-[var(--brand)]"
                  href="/admin/inventory-review"
                >
                  ตรวจสต๊อก
                </Link>
                <Link
                  className="min-h-12 rounded-lg border border-[var(--line)] bg-white px-4 py-3 text-center text-sm font-semibold text-[var(--foreground)] shadow-sm hover:border-[var(--brand)]"
                  href="/admin/payment-settings"
                >
                  ตั้งค่าชำระเงิน
                </Link>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--brand)]">
                        แนวโน้มการจอง 7 วัน
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
                        งานจองย้อนหลัง 7 วัน
                      </h2>
                      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                        ใช้ข้อมูล booking ล่าสุดสำหรับ preview บน dashboard
                      </p>
                    </div>
                    <Link
                      className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/bookings"
                    >
                      รายการจอง
                    </Link>
                  </div>
                  <MiniBarChart
                    emptyText="ยังไม่มี booking ในช่วง 7 วันนี้"
                    maxValue={maxBookingTrendValue}
                    points={bookingTrendPoints}
                  />
                </section>

                <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--brand)]">
                        ยอดชำระย้อนหลัง 7 วัน
                      </p>
                      <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
                        ยอดชำระสินค้าย้อนหลัง 7 วัน
                      </h2>
                      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                        คำนวณจาก payment paid ในออเดอร์ล่าสุดที่โหลดบนหน้า
                        dashboard
                      </p>
                    </div>
                    <Link
                      className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/product-orders?paymentStatus=paid"
                    >
                      ออเดอร์ที่ชำระแล้ว
                    </Link>
                  </div>
                  <MiniBarChart
                    emptyText="ยังไม่มียอดชำระสินค้าในช่วง 7 วันนี้"
                    maxValue={maxRevenueTrendValue}
                    points={revenueTrendPoints}
                  />
                </section>
              </section>

              <section className="grid gap-4 lg:grid-cols-3">
                <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-[var(--brand)]">
                    สถานะการจอง
                  </p>
                  <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">
                    สถานะงานจอง
                  </h2>
                  <div className="mt-5">
                    <BreakdownList
                      emptyText="ยังไม่มีข้อมูล booking"
                      rows={bookingStatusBreakdown}
                    />
                  </div>
                </section>

                <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-[var(--brand)]">
                    สถานะออเดอร์สินค้า
                  </p>
                  <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">
                    สถานะออเดอร์สินค้า
                  </h2>
                  <div className="mt-5">
                    <BreakdownList
                      emptyText="ยังไม่มีออเดอร์สินค้า"
                      rows={productOrderStatusBreakdown}
                    />
                  </div>
                </section>

                <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-[var(--brand)]">
                    สถานะชำระเงิน
                  </p>
                  <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">
                    สถานะการชำระเงิน
                  </h2>
                  <div className="mt-5">
                    <BreakdownList
                      emptyText="ยังไม่มีข้อมูลการชำระเงิน"
                      rows={paymentStatusBreakdown}
                    />
                  </div>
                </section>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--brand)]">
                        บริการยอดนิยม
                      </p>
                      <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">
                        บริการที่ถูกจองบ่อย
                      </h2>
                    </div>
                    <Link
                      className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/reports"
                    >
                      รายงาน
                    </Link>
                  </div>
                  <RankedList
                    emptyText="ยังไม่มีข้อมูลบริการยอดนิยม"
                    rows={topServiceRows}
                  />
                </section>

                <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--brand)]">
                        สินค้ายอดนิยม
                      </p>
                      <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">
                        สินค้าที่ถูกสั่งบ่อย
                      </h2>
                    </div>
                    <Link
                      className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/products"
                    >
                      สินค้า
                    </Link>
                  </div>
                  <RankedList
                    emptyText="ยังไม่มีข้อมูลสินค้ายอดนิยม"
                    rows={topProductRows}
                  />
                </section>
              </section>

              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  <section>
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)]">
                          ตารางงานวันนี้
                        </h2>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          งานวันนี้ที่ยัง pending หรือ confirmed
                        </p>
                      </div>
                      <Link
                        className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                        href="/admin/bookings"
                      >
                        ดูรายการปฏิทิน
                      </Link>
                    </div>
                    {todayScheduleBookings.length > 0 ? (
                      <div className="space-y-3">
                        {todayScheduleBookings.map((booking) => (
                          <RecentBookingRow booking={booking} key={booking.id} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
                        วันนี้ยังไม่มีงานจองที่ต้องจัดการ
                      </div>
                    )}
                  </section>

                  <section>
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)]">
                          คิวการจอง
                        </h2>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          งานจองที่ควรตรวจและยืนยันก่อน
                        </p>
                      </div>
                      <Link
                        className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                        href="/admin/bookings?status=pending"
                      >
                        ดูคิว
                      </Link>
                    </div>
                    {pendingBookings.length > 0 ? (
                      <div className="space-y-3">
                        {pendingBookings.slice(0, 5).map((booking) => (
                          <RecentBookingRow booking={booking} key={booking.id} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
                        {counts.pending > 0
                          ? "มีการจองที่รอยืนยันอยู่ในระบบ กดดูคิวเพื่อดูรายการทั้งหมด"
                          : "ไม่มีการจองรอยืนยันตอนนี้"}
                      </div>
                    )}
                  </section>

                  <section>
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)]">
                          คิวออเดอร์สินค้า
                        </h2>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          ออเดอร์สินค้าที่เกี่ยวกับการชำระเงินหรือรอจัดการ
                        </p>
                      </div>
                      <Link
                        className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                        href="/admin/product-orders"
                      >
                        ดูออเดอร์
                      </Link>
                    </div>
                    {pendingProductOrders.length > 0 ? (
                      <div className="space-y-3">
                        {pendingProductOrders.slice(0, 5).map((order) => (
                          <ProductOrderQueueRow key={order.id} order={order} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
                        ไม่มีออเดอร์สินค้ารอชำระเงินตอนนี้
                      </div>
                    )}
                  </section>

                  <section>
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)]">
                          การจองล่าสุด
                        </h2>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          รายการจองล่าสุดทั้งหมด
                        </p>
                      </div>
                      <Link
                        className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                        href="/admin/bookings"
                      >
                        ดูทั้งหมด
                      </Link>
                    </div>
                    {recentBookings.length > 0 ? (
                      <div className="space-y-3">
                        {recentBookings.map((booking) => (
                          <RecentBookingRow booking={booking} key={booking.id} />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
                        ยังไม่มีรายการจอง
                      </div>
                    )}
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold text-[var(--brand)]">
                      สต๊อกใกล้หมด
                    </p>
                    <div className="mt-4 space-y-3">
                      {lowStockProducts.slice(0, 5).map((product) => (
                        <LowStockRow key={product.id} product={product} />
                      ))}
                      {lowStockProducts.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[var(--line)] bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
                          สต๊อกยังไม่มีรายการใกล้หมด
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold text-[var(--brand)]">
                      งานซ่อม
                    </p>
                    <div className="mt-4 space-y-3">
                      {openRepairJobs.slice(0, 3).map((repairJob) => (
                        <RepairJobQueueRow
                          key={repairJob.id}
                          repairJob={repairJob}
                        />
                      ))}
                      {openRepairJobs.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[var(--line)] bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
                          ยังไม่มีงานซ่อมค้างอยู่
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                    <p className="text-sm font-semibold text-[var(--brand)]">
                      ลิงก์ลัด
                    </p>
                    <div className="mt-4 grid gap-3">
                      <Link
                        className="block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
                        href="/admin/bookings"
                      >
                        จัดการการจอง
                      </Link>
                      <Link
                        className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                        href="/admin/product-orders"
                      >
                        ออเดอร์สินค้า
                      </Link>
                      <Link
                        className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                        href="/admin/repair-jobs"
                      >
                        งานซ่อม
                      </Link>
                      <Link
                        className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                        href="/admin/inventory"
                      >
                        คลังสินค้า
                      </Link>
                      <Link
                        className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                        href="/admin/payment-settings"
                      >
                        ตั้งค่าชำระเงิน
                      </Link>
                      <Link
                        className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                        href="/admin/reports"
                      >
                        รายงาน
                      </Link>
                    </div>
                  </section>
                </aside>
              </section>
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
              <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
              <p className="mt-2">{loadState.access.reason}</p>
              {loadState.access.profile ? (
                <p className="mt-2 text-xs">
                  สิทธิ์ปัจจุบัน: {loadState.access.profile.role ?? "ไม่ทราบ"}
                </p>
              ) : null}
              <Link
                className="mt-5 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
                href="/auth"
              >
                ไปที่บัญชี
              </Link>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
