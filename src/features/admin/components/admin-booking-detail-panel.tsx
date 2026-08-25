"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  createAdminRepairJobFromBooking,
  getAdminBookingById,
  getAdminRepairJobByBookingId,
  updateAdminBookingStatus,
  type AdminAccessResult,
  type AdminBooking,
  type AdminBookingStatusAction,
  type AdminRepairJob,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; booking: null; repairJob: null; error: null }
  | { status: "signed-out"; access: null; booking: null; repairJob: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      booking: null;
      repairJob: null;
      error: null;
    }
  | {
      status: "not-found";
      access: AdminAccessResult;
      booking: null;
      repairJob: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      booking: AdminBooking;
      repairJob: AdminRepairJob | null;
      error: null;
    }
  | { status: "error"; access: null; booking: null; repairJob: null; error: string };

type ActionState =
  | { status: "idle"; error: null }
  | { status: "updating"; error: null }
  | { status: "error"; error: string };

type WorkOrderActionState =
  | { status: "idle"; error: null }
  | { status: "creating"; error: null }
  | { status: "error"; error: string };

const editableStatuses: AdminBooking["status"][] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
];

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatTime(time: string) {
  return time.slice(0, 5);
}

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

function getQuickActions(
  status: AdminBooking["status"],
): Array<{ label: string; status: AdminBookingStatusAction; tone: string }> {
  if (status === "pending") {
    return [
      {
        label: "Confirm",
        status: "confirmed",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "Cancel",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  if (status === "confirmed") {
    return [
      {
        label: "Mark completed",
        status: "completed",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "Cancel",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  return [];
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

export function AdminBookingDetailPanel({ bookingId }: { bookingId: string }) {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    booking: null,
    error: null,
    repairJob: null,
    status: "loading",
  });
  const [actionState, setActionState] = useState<ActionState>({
    error: null,
    status: "idle",
  });
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<AdminBookingStatusAction>("pending");
  const [workOrderActionState, setWorkOrderActionState] =
    useState<WorkOrderActionState>({
      error: null,
      status: "idle",
    });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadBooking() {
      setLoadState({
        access: null,
        booking: null,
        error: null,
        repairJob: null,
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
          booking: null,
          error: sessionError.message,
          repairJob: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          booking: null,
          error: null,
          repairJob: null,
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
          booking: null,
          error: null,
          repairJob: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminBookingById(supabase, bookingId);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          booking: null,
          error: error.message,
          repairJob: null,
          status: "error",
        });
        return;
      }

      if (!data) {
        setLoadState({
          access,
          booking: null,
          error: null,
          repairJob: null,
          status: "not-found",
        });
        return;
      }

      const repairJobResult = await getAdminRepairJobByBookingId(
        supabase,
        bookingId,
      );

      if (!isMounted) {
        return;
      }

      if (repairJobResult.error) {
        setLoadState({
          access: null,
          booking: null,
          error: repairJobResult.error.message,
          repairJob: null,
          status: "error",
        });
        return;
      }

      setSelectedStatus(data.status);
      setLoadState({
        access,
        booking: data,
        error: null,
        repairJob: repairJobResult.data,
        status: "ready",
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

  async function handleStatusChange(nextStatus: AdminBookingStatusAction) {
    if (loadState.status !== "ready") {
      return;
    }

    setActionState({
      error: null,
      status: "updating",
    });

    const supabase = createClient();
    const { data, error } = await updateAdminBookingStatus(
      supabase,
      loadState.booking.id,
      nextStatus,
    );

    if (error) {
      setActionState({
        error: error.message,
        status: "error",
      });
      return;
    }

    const repairJobResult = await getAdminRepairJobByBookingId(
      supabase,
      loadState.booking.id,
    );

    if (repairJobResult.error) {
      setActionState({
        error: `Booking status updated, but work order refresh failed: ${repairJobResult.error.message}`,
        status: "error",
      });
      return;
    }

    setSelectedStatus(data.status);
    setIsEditingStatus(false);
    setLoadState({
      ...loadState,
      booking: {
        ...loadState.booking,
        status: data.status,
        updated_at: data.updated_at,
      },
      repairJob: repairJobResult.data,
    });
    setActionState({
      error: null,
      status: "idle",
    });
  }

  async function handleCreateRepairJob() {
    if (loadState.status !== "ready" || loadState.booking.status !== "confirmed") {
      return;
    }

    setWorkOrderActionState({
      error: null,
      status: "creating",
    });

    const supabase = createClient();
    const { data, error } = await createAdminRepairJobFromBooking(
      supabase,
      loadState.booking.id,
    );

    if (error) {
      setWorkOrderActionState({
        error: error.message,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      repairJob: data,
    });
    setWorkOrderActionState({
      error: null,
      status: "idle",
    });
  }

  function cancelEditStatus() {
    if (loadState.status === "ready") {
      setSelectedStatus(loadState.booking.status);
    }

    setIsEditingStatus(false);
  }

  const quickActions =
    loadState.status === "ready" ? getQuickActions(loadState.booking.status) : [];
  const isUpdating = actionState.status === "updating";
  const canSaveStatus =
    loadState.status === "ready" &&
    selectedStatus !== loadState.booking.status &&
    !isUpdating;
  const canCreateRepairJob =
    loadState.status === "ready" &&
    loadState.booking.status === "confirmed" &&
    !loadState.repairJob &&
    workOrderActionState.status !== "creating";

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
              Admin Booking Detail
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Review customer, vehicle, service, and status details for this
              booking.
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin/bookings"
          >
            Back to admin bookings
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            Loading admin booking detail...
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
            <p className="font-semibold text-[var(--foreground)]">
              Booking not found
            </p>
            <p className="mt-1">This booking does not exist.</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/admin/bookings"
            >
              Back to admin bookings
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
        <section className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
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
          </article>

          <aside className="h-fit space-y-4">
            <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--brand)]">
                Customer
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <DetailItem
                  label="Name"
                  value={loadState.booking.customer?.full_name ?? "-"}
                />
                <DetailItem
                  label="Phone"
                  value={loadState.booking.customer?.phone_number ?? "-"}
                />
                <DetailItem
                  label="Email"
                  value={loadState.booking.customer?.email ?? "-"}
                />
              </dl>
            </section>

            <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--brand)]">
                Vehicle
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <DetailItem
                  label="Plate"
                  value={loadState.booking.vehicle?.license_plate ?? "-"}
                />
                <DetailItem
                  label="Brand"
                  value={loadState.booking.vehicle?.brand ?? "-"}
                />
                <DetailItem
                  label="Model"
                  value={loadState.booking.vehicle?.model ?? "-"}
                />
                <DetailItem
                  label="Year / Color"
                  value={
                    loadState.booking.vehicle
                      ? `${loadState.booking.vehicle.year ?? "-"} / ${
                          loadState.booking.vehicle.color ?? "-"
                        }`
                      : "-"
                  }
                />
              </dl>
            </section>

            <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--brand)]">
                Work order
              </p>

              {loadState.repairJob ? (
                <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]">
                  <p className="font-semibold">Repair job already created</p>
                  <p className="mt-1 break-all text-xs">
                    Repair Job ID: {loadState.repairJob.id}
                  </p>
                  <Link
                    className="mt-3 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
                    href="/admin/repair-jobs"
                  >
                    View work orders
                  </Link>
                </div>
              ) : (
                <div className="mt-4 rounded-md border border-[var(--line)] bg-slate-50 p-3 text-sm leading-6 text-[var(--muted)]">
                  <p>
                    Create a repair job from this confirmed booking when the
                    garage is ready to track the work.
                  </p>
                  {loadState.booking.status !== "confirmed" ? (
                    <p className="mt-2 font-semibold text-amber-800">
                      Confirm this booking before creating a work order.
                    </p>
                  ) : null}
                  <button
                    className="mt-3 min-h-10 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canCreateRepairJob}
                    onClick={handleCreateRepairJob}
                    type="button"
                  >
                    {workOrderActionState.status === "creating"
                      ? "Creating..."
                      : "Create work order"}
                  </button>
                </div>
              )}

              {workOrderActionState.status === "error" ? (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {workOrderActionState.error}
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--brand)]">
                Status management
              </p>

              {isEditingStatus ? (
                <div className="mt-4 rounded-md border border-[var(--line)] bg-slate-50 p-3">
                  <label className="text-sm font-semibold text-[var(--foreground)]">
                    Edit status
                    <select
                      className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                      disabled={isUpdating}
                      onChange={(event) =>
                        setSelectedStatus(
                          event.target.value as AdminBookingStatusAction,
                        )
                      }
                      value={selectedStatus}
                    >
                      {editableStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                      disabled={isUpdating}
                      onClick={cancelEditStatus}
                      type="button"
                    >
                      Cancel edit
                    </button>
                    <button
                      className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canSaveStatus}
                      onClick={() => handleStatusChange(selectedStatus)}
                      type="button"
                    >
                      {isUpdating ? "Saving..." : "Save status"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {quickActions.length > 0 ? (
                    quickActions.map((action) => (
                      <button
                        className={`min-h-10 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${action.tone}`}
                        disabled={isUpdating}
                        key={action.status}
                        onClick={() => handleStatusChange(action.status)}
                        type="button"
                      >
                        {isUpdating ? "Updating..." : action.label}
                      </button>
                    ))
                  ) : (
                    <p className="w-full text-sm font-semibold text-[var(--muted)]">
                      No quick actions for this status.
                    </p>
                  )}
                  <button
                    className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                    disabled={isUpdating}
                    onClick={() => setIsEditingStatus(true)}
                    type="button"
                  >
                    Edit status
                  </button>
                </div>
              )}

              {actionState.status === "error" ? (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {actionState.error}
                </div>
              ) : null}
            </section>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
