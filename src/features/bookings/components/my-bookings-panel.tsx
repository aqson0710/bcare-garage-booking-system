"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { getCurrentUserBookings, type MyBooking } from "@/features/bookings";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; bookings: null; error: null }
  | { status: "signed-out"; bookings: null; error: null }
  | { status: "ready"; bookings: MyBooking[]; error: null }
  | { status: "error"; bookings: null; error: string };

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
}

function getStatusStyle(status: MyBooking["status"]) {
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

function getRepairJobStatusStyle(status: NonNullable<MyBooking["repairJob"]>["status"]) {
  if (status === "pending") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "assigned") {
    return "bg-cyan-50 text-cyan-800";
  }

  if (status === "in_progress") {
    return "bg-indigo-50 text-indigo-800";
  }

  if (status === "completed") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-red-50 text-red-700";
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

function BookingCard({ booking }: { booking: MyBooking }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--brand)]">
            {booking.service?.name ?? "Service not found"}
          </p>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {booking.booking_date} at {formatTime(booking.booking_time)}
          </h2>
        </div>
        <span
          className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
            booking.status,
          )}`}
        >
          {booking.status}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--muted)]">Vehicle plate</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.vehicle?.license_plate ?? "-"}
          </dd>
          {booking.vehicle ? (
            <Link
              className="mt-2 inline-block text-xs font-semibold text-[var(--brand)]"
              href="/my-vehicles"
            >
              Edit vehicle
            </Link>
          ) : null}
        </div>
        <div>
          <dt className="text-[var(--muted)]">Base price</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.service
              ? currencyFormatter.format(booking.service.base_price)
              : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Estimated time</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.service
              ? formatDuration(booking.service.estimated_duration_minutes)
              : "-"}
          </dd>
        </div>
      </dl>

      {booking.note ? (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6 text-[var(--muted)]">
          {booking.note}
        </div>
      ) : null}

      <section className="mt-4 rounded-md border border-[var(--line)] bg-slate-50 p-3 text-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-[var(--foreground)]">
            Work order progress
          </p>
          {booking.repairJob ? (
            <span
              className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getRepairJobStatusStyle(
                booking.repairJob.status,
              )}`}
            >
              {booking.repairJob.status}
            </span>
          ) : (
            <span className="w-fit rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              Not created yet
            </span>
          )}
        </div>
        <p className="mt-2 text-[var(--muted)]">
          Mechanic: {booking.repairJob?.mechanic?.full_name ?? "-"}
        </p>
      </section>

      <p className="mt-4 break-all text-xs text-[var(--muted)]">
        Booking ID: {booking.id}
      </p>
      <Link
        className="mt-4 inline-block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
        href={`/my-bookings/${booking.id}`}
      >
        View details
      </Link>
    </article>
  );
}

export function MyBookingsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    bookings: null,
    error: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadBookings() {
      setLoadState({
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
          bookings: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          bookings: null,
          error: null,
          status: "signed-out",
        });
        return;
      }

      const { data, error } = await getCurrentUserBookings(
        supabase,
        session.user.id,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          bookings: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        bookings: data ?? [],
        error: null,
        status: "ready",
      });
    }

    loadBookings();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadBookings();
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
              My Bookings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Review booking requests linked to your signed-in customer
              profile.
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
            href="/"
          >
            New booking
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            Loading bookings...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">Login required</p>
            <p className="mt-1">Sign in before viewing your bookings.</p>
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
          {loadState.bookings.length > 0 ? (
            <div className="space-y-4">
              {loadState.bookings.map((booking) => (
                <BookingCard booking={booking} key={booking.id} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              No booking requests yet. Start by selecting a service.
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
