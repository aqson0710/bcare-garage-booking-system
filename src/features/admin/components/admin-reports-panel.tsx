"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminReports,
  type AdminAccessResult,
  type AdminReports,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; reports: null; error: null }
  | { status: "signed-out"; access: null; reports: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      reports: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      reports: AdminReports;
      error: null;
    }
  | { status: "error"; access: null; reports: null; error: string };

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
        {value}
      </p>
    </article>
  );
}

function StatusCard({
  count,
  status,
}: {
  count: number;
  status: AdminReports["statusCounts"][number]["status"];
}) {
  return (
    <Link
      className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm hover:border-[var(--brand)]"
      href={`/admin/bookings?status=${status}`}
    >
      <p className="text-sm font-semibold capitalize text-[var(--muted)]">
        {status}
      </p>
      <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
        {count}
      </p>
    </Link>
  );
}

export function AdminReportsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    reports: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadReports() {
      setLoadState({
        access: null,
        error: null,
        reports: null,
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
          reports: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          error: null,
          reports: null,
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
          reports: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminReports(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          error: error.message,
          reports: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        error: null,
        reports: data,
        status: "ready",
      });
    }

    loadReports();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadReports();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

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
              Admin Reports
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Review booking volume, estimated revenue, and most active
              services, customers, and vehicles.
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            Admin home
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            Loading reports...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">Login required</p>
            <p className="mt-1">Sign in with an admin account.</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              Go to account
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
        <section className="space-y-6 py-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total bookings"
              value={loadState.reports.totalBookingCount}
            />
            <MetricCard
              label="Estimated revenue"
              value={currencyFormatter.format(loadState.reports.estimatedRevenue)}
            />
            <MetricCard
              label="Average booking value"
              value={currencyFormatter.format(
                loadState.reports.averageBookingValue,
              )}
            />
            <MetricCard
              label="Active customers"
              value={loadState.reports.activeCustomerCount}
            />
          </section>

          <section>
            <h2 className="mb-4 text-xl font-bold text-[var(--foreground)]">
              Booking status
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {loadState.reports.statusCounts.map((item) => (
                <StatusCard
                  count={item.count}
                  key={item.status}
                  status={item.status}
                />
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                Top services
              </h2>
              <div className="mt-4 space-y-3">
                {loadState.reports.topServices.length > 0 ? (
                  loadState.reports.topServices.map((item, index) => (
                    <div
                      className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0"
                      key={`${item.service?.id ?? "missing"}-${index}`}
                    >
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {item.service?.name ?? "Service not found"}
                      </p>
                      <p className="text-sm text-[var(--muted)]">
                        {item.bookingCount}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">No data yet.</p>
                )}
              </div>
            </article>

            <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                Top customers
              </h2>
              <div className="mt-4 space-y-3">
                {loadState.reports.topCustomers.length > 0 ? (
                  loadState.reports.topCustomers.map((item, index) => (
                    <div
                      className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0"
                      key={`${item.customer?.id ?? "missing"}-${index}`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {item.customer?.full_name ?? "Customer not found"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {item.customer?.phone_number ?? "-"}
                        </p>
                      </div>
                      <p className="text-sm text-[var(--muted)]">
                        {item.bookingCount}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">No data yet.</p>
                )}
              </div>
            </article>

            <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                Top vehicles
              </h2>
              <div className="mt-4 space-y-3">
                {loadState.reports.topVehicles.length > 0 ? (
                  loadState.reports.topVehicles.map((item, index) => (
                    <div
                      className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0"
                      key={`${item.vehicle?.id ?? "missing"}-${index}`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {item.vehicle?.license_plate ?? "Vehicle not found"}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {item.vehicle
                            ? `${item.vehicle.brand ?? "-"} / ${
                                item.vehicle.model ?? "-"
                              }`
                            : "-"}
                        </p>
                      </div>
                      <p className="text-sm text-[var(--muted)]">
                        {item.bookingCount}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">No data yet.</p>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Total customers"
              value={loadState.reports.totalCustomerCount}
            />
            <MetricCard
              label="Total vehicles"
              value={loadState.reports.totalVehicleCount}
            />
            <MetricCard
              label="Revenue bookings"
              value={
                loadState.reports.statusCounts.find(
                  (item) => item.status === "confirmed",
                )!.count +
                loadState.reports.statusCounts.find(
                  (item) => item.status === "completed",
                )!.count
              }
            />
          </section>
        </section>
      ) : null}
    </main>
  );
}
