"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminCustomerById,
  type AdminAccessResult,
  type AdminCustomerDetail,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; customer: null; error: null }
  | { status: "signed-out"; access: null; customer: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      customer: null;
      error: null;
    }
  | {
      status: "not-found";
      access: AdminAccessResult;
      customer: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      customer: AdminCustomerDetail;
      error: null;
    }
  | { status: "error"; access: null; customer: null; error: string };

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH");
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

function getStatusStyle(status: AdminCustomerDetail["bookings"][number]["status"]) {
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

export function AdminCustomerDetailPanel({ customerId }: { customerId: string }) {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    customer: null,
    error: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadCustomer() {
      setLoadState({
        access: null,
        customer: null,
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
          customer: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          customer: null,
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
          customer: null,
          error: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminCustomerById(supabase, customerId);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          customer: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      if (!data) {
        setLoadState({
          access,
          customer: null,
          error: null,
          status: "not-found",
        });
        return;
      }

      setLoadState({
        access,
        customer: data,
        error: null,
        status: "ready",
      });
    }

    loadCustomer();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadCustomer();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [customerId]);

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
              Customer Detail
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Review profile, vehicles, and booking history for this customer.
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin/customers"
          >
            Back to customers
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            Loading customer...
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

      {loadState.status === "not-found" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)] shadow-sm">
            Customer not found.
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
        <section className="grid gap-6 py-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--brand)]">
              Customer profile
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
              {loadState.customer.full_name}
            </h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Phone</dt>
                <dd className="mt-1 font-semibold text-[var(--foreground)]">
                  {loadState.customer.phone_number}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Email</dt>
                <dd className="mt-1 break-all font-semibold text-[var(--foreground)]">
                  {loadState.customer.email ?? "-"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Role</dt>
                <dd className="mt-1 font-semibold text-[var(--foreground)]">
                  {loadState.customer.role}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Joined</dt>
                <dd className="mt-1 font-semibold text-[var(--foreground)]">
                  {formatDateTime(loadState.customer.created_at)}
                </dd>
              </div>
            </dl>
          </aside>

          <div className="space-y-6">
            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                  Vehicles
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  {loadState.customer.vehicles.length} records
                </p>
              </div>
              {loadState.customer.vehicles.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {loadState.customer.vehicles.map((vehicle) => (
                    <article
                      className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm"
                      key={vehicle.id}
                    >
                      <h3 className="text-lg font-bold text-[var(--foreground)]">
                        {vehicle.license_plate}
                      </h3>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {vehicle.brand ?? "-"} / {vehicle.model ?? "-"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {vehicle.year ?? "-"} / {vehicle.color ?? "-"}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
                  No vehicles yet.
                </div>
              )}
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                  Bookings
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  {loadState.customer.bookings.length} records
                </p>
              </div>
              {loadState.customer.bookings.length > 0 ? (
                <div className="space-y-3">
                  {loadState.customer.bookings.map((booking) => (
                    <article
                      className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm"
                      key={booking.id}
                    >
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
                          <h3 className="mt-2 text-lg font-bold text-[var(--foreground)]">
                            {booking.booking_date} at{" "}
                            {formatTime(booking.booking_time)}
                          </h3>
                          <p className="mt-2 text-sm text-[var(--muted)]">
                            Vehicle: {booking.vehicle?.license_plate ?? "-"}
                          </p>
                        </div>
                        <Link
                          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                          href={`/admin/bookings/${booking.id}`}
                        >
                          View booking
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
                  No bookings yet.
                </div>
              )}
            </section>
          </div>
        </section>
      ) : null}
    </main>
  );
}
