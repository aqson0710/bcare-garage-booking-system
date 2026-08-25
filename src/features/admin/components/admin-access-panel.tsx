"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminBookings,
  type AdminAccessResult,
  type AdminBooking,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type DashboardCounts = Record<AdminBooking["status"], number>;

type LoadState =
  | { status: "loading"; access: null; bookings: null; error: null }
  | { status: "signed-out"; access: null; bookings: null; error: null }
  | {
      status: "ready";
      access: AdminAccessResult;
      bookings: AdminBooking[] | null;
      error: null;
    }
  | { status: "error"; access: null; bookings: null; error: string };

const statusOrder: AdminBooking["status"][] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
];

function formatTime(time: string) {
  return time.slice(0, 5);
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
  label,
}: {
  count: number;
  label: AdminBooking["status"];
}) {
  return (
    <Link
      className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm hover:border-[var(--brand)]"
      href={`/admin/bookings?status=${label}`}
    >
      <p className="text-sm font-semibold capitalize text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
        {count}
      </p>
    </Link>
  );
}

function RecentBookingRow({ booking }: { booking: AdminBooking }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand)]">
              {booking.service?.name ?? "Service not found"}
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
          View detail
        </Link>
      </div>
    </article>
  );
}

export function AdminAccessPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    bookings: null,
    error: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadDashboard() {
      setLoadState({
        access: null,
        bookings: null,
        error: null,
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
          bookings: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          bookings: null,
          error: null,
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
          bookings: null,
          error: null,
          status: "ready",
        });
        return;
      }

      const { data, error } = await getAdminBookings(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          bookings: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        bookings: data ?? [],
        error: null,
        status: "ready",
      });
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
  }, []);

  const counts = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.bookings) {
      return getDashboardCounts([]);
    }

    return getDashboardCounts(loadState.bookings);
  }, [loadState]);

  const recentBookings = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.bookings) {
      return [];
    }

    return loadState.bookings.slice(0, 5);
  }, [loadState]);

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
              Admin Dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Review booking workload, status counts, and recent customer
              requests.
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
            href="/admin/bookings"
          >
            Open admin bookings
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            Loading admin dashboard...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">Login required</p>
            <p className="mt-1">Sign in before checking admin access.</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              Go to account
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
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {statusOrder.map((status) => (
                  <DashboardCard
                    count={counts[status]}
                    key={status}
                    label={status}
                  />
                ))}
              </section>

              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-bold text-[var(--foreground)]">
                      Recent bookings
                    </h2>
                    <Link
                      className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/bookings"
                    >
                      View all
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
                      No bookings yet.
                    </div>
                  )}
                </div>

                <aside className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-[var(--brand)]">
                    Quick links
                  </p>
                  <div className="mt-4 space-y-3">
                    <Link
                      className="block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
                      href="/admin/bookings"
                    >
                      Manage bookings
                    </Link>
                    <Link
                      className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/customers"
                    >
                      View customers
                    </Link>
                    <Link
                      className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/reports"
                    >
                      View reports
                    </Link>
                    <Link
                      className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/product-orders"
                    >
                      View product orders
                    </Link>
                    <Link
                      className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/payment-settings"
                    >
                      Payment settings
                    </Link>
                    <Link
                      className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/products"
                    >
                      Manage products
                    </Link>
                    <Link
                      className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/inventory"
                    >
                      Manage inventory
                    </Link>
                    <Link
                      className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/inventory-review"
                    >
                      Review inventory
                    </Link>
                    <Link
                      className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/product-categories"
                    >
                      Manage product categories
                    </Link>
                    <Link
                      className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/services"
                    >
                      Manage services
                    </Link>
                    <Link
                      className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/admin/service-categories"
                    >
                      Manage categories
                    </Link>
                    <Link
                      className="block min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                      href="/"
                    >
                      Customer booking page
                    </Link>
                  </div>
                  <div className="mt-5 rounded-md bg-slate-50 p-3 text-xs leading-5 text-[var(--muted)]">
                    Customer editing will be added in a later admin part.
                  </div>
                </aside>
              </section>
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
              <p className="text-lg font-bold">Access denied</p>
              <p className="mt-2">{loadState.access.reason}</p>
              {loadState.access.profile ? (
                <p className="mt-2 text-xs">
                  Current role: {loadState.access.profile.role ?? "unknown"}
                </p>
              ) : null}
              <Link
                className="mt-5 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
                href="/auth"
              >
                Go to account
              </Link>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
