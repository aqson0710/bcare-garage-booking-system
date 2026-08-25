"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminCustomers,
  type AdminAccessResult,
  type AdminCustomerSummary,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; customers: null; error: null }
  | { status: "signed-out"; access: null; customers: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      customers: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      customers: AdminCustomerSummary[];
      error: null;
    }
  | { status: "error"; access: null; customers: null; error: string };

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH");
}

function CustomerCard({ customer }: { customer: AdminCustomerSummary }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand)]">
              {customer.role}
            </p>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {customer.email ?? "No email"}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {customer.full_name}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {customer.phone_number}
          </p>
        </div>

        <Link
          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
          href={`/admin/customers/${customer.id}`}
        >
          View customer
        </Link>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[var(--muted)]">Vehicles</dt>
          <dd className="mt-1 text-lg font-bold text-[var(--foreground)]">
            {customer.vehicleCount}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Bookings</dt>
          <dd className="mt-1 text-lg font-bold text-[var(--foreground)]">
            {customer.bookingCount}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Latest booking</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {customer.latestBooking
              ? `${customer.latestBooking.booking_date} ${customer.latestBooking.booking_time.slice(
                  0,
                  5,
                )}`
              : "-"}
          </dd>
          {customer.latestBooking ? (
            <dd className="mt-1 text-xs text-[var(--muted)]">
              {customer.latestBooking.status}
            </dd>
          ) : null}
        </div>
        <div>
          <dt className="text-[var(--muted)]">Joined</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {formatDateTime(customer.created_at)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function AdminCustomersPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    customers: null,
    error: null,
    status: "loading",
  });
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadCustomers() {
      setLoadState({
        access: null,
        customers: null,
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
          customers: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          customers: null,
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
          customers: null,
          error: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminCustomers(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          customers: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        customers: data ?? [],
        error: null,
        status: "ready",
      });
    }

    loadCustomers();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadCustomers();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    const normalizedSearch = searchInput.trim().toLowerCase();

    return loadState.customers.filter((customer) => {
      if (!normalizedSearch) {
        return true;
      }

      return (
        customer.full_name.toLowerCase().includes(normalizedSearch) ||
        customer.phone_number.toLowerCase().includes(normalizedSearch) ||
        (customer.email ?? "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [loadState, searchInput]);

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
              Admin Customers
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Review customer profiles, vehicle counts, and booking activity.
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
            Loading customers...
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
        <section className="py-6">
          <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {filteredCustomers.length} of {loadState.customers.length}{" "}
                customers
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Customer records are read-only in this part.
              </p>
            </div>

            <input
              className="min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] lg:max-w-md"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search customer, phone, or email"
              type="search"
              value={searchInput}
            />
          </div>

          {filteredCustomers.length > 0 ? (
            <div className="mt-5 space-y-4">
              {filteredCustomers.map((customer) => (
                <CustomerCard customer={customer} key={customer.id} />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              No customers match the current search.
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
