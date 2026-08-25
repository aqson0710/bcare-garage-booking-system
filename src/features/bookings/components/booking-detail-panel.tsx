"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  cancelCurrentUserBooking,
  getCurrentUserBookingById,
  type MyBooking,
} from "@/features/bookings";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; booking: null; error: null; userId: null }
  | { status: "signed-out"; booking: null; error: null; userId: null }
  | { status: "not-found"; booking: null; error: null; userId: string }
  | { status: "ready"; booking: MyBooking; error: null; userId: string }
  | { status: "error"; booking: null; error: string; userId: null };

type CancelState =
  | { status: "idle"; error: null }
  | { status: "cancelling"; error: null }
  | { status: "error"; error: string };

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

function formatTime(time: string) {
  return time.slice(0, 5);
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

function getCancelButtonLabel(
  bookingStatus: MyBooking["status"],
  cancelStatus: CancelState["status"],
) {
  if (cancelStatus === "cancelling") {
    return "Cancelling...";
  }

  if (bookingStatus === "cancelled") {
    return "Cancelled";
  }

  if (bookingStatus === "pending") {
    return "Cancel booking";
  }

  return "Cannot cancel";
}

function getCancelButtonClass(bookingStatus: MyBooking["status"]) {
  if (bookingStatus === "pending") {
    return "min-h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60";
  }

  return "min-h-10 rounded-md border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed";
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-semibold text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function formatNullableDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("th-TH");
}

export function BookingDetailPanel({ bookingId }: { bookingId: string }) {
  const [loadState, setLoadState] = useState<LoadState>({
    booking: null,
    error: null,
    status: "loading",
    userId: null,
  });
  const [cancelState, setCancelState] = useState<CancelState>({
    error: null,
    status: "idle",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadBooking() {
      setLoadState({
        booking: null,
        error: null,
        status: "loading",
        userId: null,
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
          booking: null,
          error: sessionError.message,
          status: "error",
          userId: null,
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          booking: null,
          error: null,
          status: "signed-out",
          userId: null,
        });
        return;
      }

      const { data, error } = await getCurrentUserBookingById(
        supabase,
        session.user.id,
        bookingId,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          booking: null,
          error: error.message,
          status: "error",
          userId: null,
        });
        return;
      }

      if (!data) {
        setLoadState({
          booking: null,
          error: null,
          status: "not-found",
          userId: session.user.id,
        });
        return;
      }

      setLoadState({
        booking: data,
        error: null,
        status: "ready",
        userId: session.user.id,
      });
    }

    loadBooking();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadBooking();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [bookingId]);

  async function handleCancelBooking() {
    if (loadState.status !== "ready" || loadState.booking.status !== "pending") {
      return;
    }

    setCancelState({
      error: null,
      status: "cancelling",
    });

    const supabase = createClient();
    const { data, error } = await cancelCurrentUserBooking(
      supabase,
      loadState.userId,
      loadState.booking.id,
    );

    if (error) {
      setCancelState({
        error: error.message,
        status: "error",
      });
      return;
    }

    if (!data) {
      setCancelState({
        error: "Only pending bookings can be cancelled.",
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      booking: {
        ...loadState.booking,
        status: data.status,
        updated_at: data.updated_at,
      },
    });
    setCancelState({
      error: null,
      status: "idle",
    });
  }

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
              Booking Detail
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Review the selected booking request and cancel it while it is
              still pending.
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/my-bookings"
          >
            Back to bookings
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            Loading booking...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">Login required</p>
            <p className="mt-1">Sign in before viewing this booking.</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              Go to account
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "not-found" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)] shadow-sm">
            <p className="font-semibold text-[var(--foreground)]">
              Booking not found
            </p>
            <p className="mt-1">
              This booking does not exist or is not linked to your account.
            </p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/my-bookings"
            >
              Back to bookings
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
          <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--brand)]">
                  {loadState.booking.service?.name ?? "Service not found"}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                  {loadState.booking.booking_date} at{" "}
                  {formatTime(loadState.booking.booking_time)}
                </h2>
              </div>
              <span
                className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                  loadState.booking.status,
                )}`}
              >
                {loadState.booking.status}
              </span>
            </div>

            <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-2">
              <DetailItem
                label="Vehicle plate"
                value={loadState.booking.vehicle?.license_plate ?? "-"}
              />
              <DetailItem
                label="Vehicle"
                value={
                  loadState.booking.vehicle
                    ? `${loadState.booking.vehicle.brand ?? "-"} / ${
                        loadState.booking.vehicle.model ?? "-"
                      }`
                    : "-"
                }
              />
              <DetailItem
                label="Base price"
                value={
                  loadState.booking.service
                    ? currencyFormatter.format(
                        loadState.booking.service.base_price,
                      )
                    : "-"
                }
              />
              <DetailItem
                label="Estimated time"
                value={
                  loadState.booking.service
                    ? formatDuration(
                        loadState.booking.service
                          .estimated_duration_minutes,
                      )
                    : "-"
                }
              />
              <DetailItem
                label="Created"
                value={new Date(loadState.booking.created_at).toLocaleString(
                  "th-TH",
                )}
              />
              <DetailItem
                label="Updated"
                value={new Date(loadState.booking.updated_at).toLocaleString(
                  "th-TH",
                )}
              />
            </dl>

            {loadState.booking.note ? (
              <div className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
                <p className="font-semibold text-[var(--foreground)]">Note</p>
                <p className="mt-2">{loadState.booking.note}</p>
              </div>
            ) : null}

            <p className="mt-5 break-all text-xs text-[var(--muted)]">
              Booking ID: {loadState.booking.id}
            </p>

            <div className="mt-5 flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row">
              <Link
                className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                href="/my-vehicles"
              >
                Edit vehicle
              </Link>
              <button
                className={getCancelButtonClass(loadState.booking.status)}
                disabled={
                  loadState.booking.status !== "pending" ||
                  cancelState.status === "cancelling"
                }
                onClick={handleCancelBooking}
                type="button"
              >
                {getCancelButtonLabel(
                  loadState.booking.status,
                  cancelState.status,
                )}
              </button>
            </div>

            {cancelState.status === "error" ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {cancelState.error}
              </div>
            ) : null}
          </article>

          <article className="mt-5 rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--brand)]">
                  Work Order Progress
                </p>
                <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
                  {loadState.booking.repairJob
                    ? "Repair job is being tracked"
                    : "No work order created yet"}
                </h2>
              </div>
              {loadState.booking.repairJob ? (
                <span
                  className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getRepairJobStatusStyle(
                    loadState.booking.repairJob.status,
                  )}`}
                >
                  {loadState.booking.repairJob.status}
                </span>
              ) : (
                <span className="w-fit rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Not created yet
                </span>
              )}
            </div>

            {loadState.booking.repairJob ? (
              <>
                <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-2">
                  <DetailItem
                    label="Mechanic"
                    value={
                      loadState.booking.repairJob.mechanic?.full_name ??
                      "Not assigned yet"
                    }
                  />
                  <DetailItem
                    label="Mechanic phone"
                    value={
                      loadState.booking.repairJob.mechanic?.phone_number ?? "-"
                    }
                  />
                  <DetailItem
                    label="Started"
                    value={formatNullableDateTime(
                      loadState.booking.repairJob.started_at,
                    )}
                  />
                  <DetailItem
                    label="Completed"
                    value={formatNullableDateTime(
                      loadState.booking.repairJob.completed_at,
                    )}
                  />
                </dl>

                <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-md bg-slate-50 p-4">
                    <p className="font-semibold text-[var(--foreground)]">
                      Diagnosis
                    </p>
                    <p className="mt-2 leading-6 text-[var(--muted)]">
                      {loadState.booking.repairJob.diagnosis || "-"}
                    </p>
                  </div>
                  <div className="rounded-md bg-slate-50 p-4">
                    <p className="font-semibold text-[var(--foreground)]">
                      Repair notes
                    </p>
                    <p className="mt-2 leading-6 text-[var(--muted)]">
                      {loadState.booking.repairJob.repair_notes || "-"}
                    </p>
                  </div>
                </div>

                <p className="mt-5 break-all text-xs text-[var(--muted)]">
                  Work Order ID: {loadState.booking.repairJob.id}
                </p>
              </>
            ) : (
              <p className="mt-5 border-t border-[var(--line)] pt-4 text-sm leading-6 text-[var(--muted)]">
                The garage will create a work order after confirming and
                preparing this booking for repair work.
              </p>
            )}
          </article>
        </section>
      ) : null}
    </main>
  );
}
