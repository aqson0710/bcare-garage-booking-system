"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  getTechnicianWorkOrderById,
  updateTechnicianWorkOrder,
  type TechnicianRepairJobStatus,
  type TechnicianWorkOrder,
  type TechnicianWorkOrderDetailResult,
} from "@/features/technician";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; result: null; error: null }
  | { status: "signed-out"; result: null; error: null }
  | { status: "ready"; result: TechnicianWorkOrderDetailResult; error: null }
  | { status: "error"; result: null; error: string };

type SaveState =
  | { status: "idle"; error: null }
  | { status: "saving"; error: null }
  | { status: "saved"; error: null }
  | { status: "error"; error: string };

type WorkOrderFormState = {
  diagnosis: string;
  repairNotes: string;
  status: TechnicianRepairJobStatus;
};

const technicianStatusOptions: TechnicianRepairJobStatus[] = [
  "assigned",
  "in_progress",
  "completed",
];

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("th-TH");
}

function formatBookingSchedule(workOrder: TechnicianWorkOrder) {
  if (!workOrder.booking) {
    return "-";
  }

  return `${workOrder.booking.booking_date} at ${workOrder.booking.booking_time.slice(
    0,
    5,
  )}`;
}

function getStatusStyle(status: TechnicianRepairJobStatus) {
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

function normalizeText(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function getInitialFormState(workOrder: TechnicianWorkOrder): WorkOrderFormState {
  return {
    diagnosis: workOrder.diagnosis ?? "",
    repairNotes: workOrder.repair_notes ?? "",
    status: technicianStatusOptions.includes(workOrder.status)
      ? workOrder.status
      : "assigned",
  };
}

function WorkOrderSummary({ workOrder }: { workOrder: TechnicianWorkOrder }) {
  return (
    <section className="grid gap-4 rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm md:grid-cols-2">
      <div>
        <p className="text-sm font-semibold text-[var(--brand)]">
          {workOrder.service?.name ?? "Service not found"}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
          {formatBookingSchedule(workOrder)}
        </h2>
        <span
          className={`mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
            workOrder.status,
          )}`}
        >
          {workOrder.status}
        </span>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[var(--muted)]">Customer</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {workOrder.customer?.full_name ?? "-"}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {workOrder.customer?.phone_number ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Vehicle</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {workOrder.vehicle?.license_plate ?? "-"}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {workOrder.vehicle
              ? `${workOrder.vehicle.brand ?? "-"} / ${
                  workOrder.vehicle.model ?? "-"
                }`
              : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Started</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {formatDateTime(workOrder.started_at)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">Completed</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {formatDateTime(workOrder.completed_at)}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function TechnicianWorkOrderDetailPanel({
  workOrderId,
}: {
  workOrderId: string;
}) {
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    result: null,
    status: "loading",
  });
  const [saveState, setSaveState] = useState<SaveState>({
    error: null,
    status: "idle",
  });
  const [formState, setFormState] = useState<WorkOrderFormState>({
    diagnosis: "",
    repairNotes: "",
    status: "assigned",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadWorkOrder() {
      setLoadState({
        error: null,
        result: null,
        status: "loading",
      });
      setSaveState({
        error: null,
        status: "idle",
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
          result: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          error: null,
          result: null,
          status: "signed-out",
        });
        return;
      }

      const { data, error } = await getTechnicianWorkOrderById(
        supabase,
        session.user.id,
        workOrderId,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          error: error.message,
          result: null,
          status: "error",
        });
        return;
      }

      if (data?.allowed && data.workOrder) {
        setFormState(getInitialFormState(data.workOrder));
      }

      setLoadState({
        error: null,
        result: data,
        status: "ready",
      });
    }

    loadWorkOrder();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadWorkOrder();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [workOrderId]);

  async function handleSave(nextStatus = formState.status) {
    if (
      loadState.status !== "ready" ||
      !loadState.result?.allowed ||
      !loadState.result.workOrder
    ) {
      return;
    }

    setSaveState({
      error: null,
      status: "saving",
    });

    const supabase = createClient();
    const { data, error } = await updateTechnicianWorkOrder(supabase, {
      diagnosis: normalizeText(formState.diagnosis),
      repairNotes: normalizeText(formState.repairNotes),
      status: nextStatus,
      userId: loadState.result.profile.id,
      workOrderId,
    });

    if (error) {
      setSaveState({
        error: error.message,
        status: "error",
      });
      return;
    }

    if (data) {
      setFormState(getInitialFormState(data));
      setLoadState({
        error: null,
        result: {
          ...loadState.result,
          workOrder: data,
        },
        status: "ready",
      });
    }

    setSaveState({
      error: null,
      status: "saved",
    });
  }

  const workOrder =
    loadState.status === "ready" && loadState.result?.allowed
      ? loadState.result.workOrder
      : null;
  const isClosed =
    workOrder?.status === "completed" || workOrder?.status === "cancelled";
  const isSaving = saveState.status === "saving";

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
              Technician Work Order
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Update the status, diagnosis, and repair notes for your assigned
              repair job.
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/technician/work-orders"
          >
            Back to work orders
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            Loading work order...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">Login required</p>
            <p className="mt-1">Sign in with a technician account.</p>
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

      {loadState.status === "ready" && !loadState.result?.allowed ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">Access denied</p>
            <p className="mt-2">{loadState.result?.reason}</p>
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" &&
      loadState.result?.allowed &&
      !loadState.result.workOrder ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="text-lg font-bold">Work order not found</p>
            <p className="mt-2">
              This work order may not be assigned to the signed-in technician.
            </p>
          </div>
        </section>
      ) : null}

      {workOrder ? (
        <section className="space-y-5 py-6">
          <WorkOrderSummary workOrder={workOrder} />

          <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">
                  Work update
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Save progress notes while the work order is still open.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isClosed || isSaving}
                  onClick={() => handleSave("in_progress")}
                  type="button"
                >
                  Start work
                </button>
                <button
                  className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isClosed || isSaving}
                  onClick={() => handleSave("completed")}
                  type="button"
                >
                  Complete work
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="text-sm font-semibold text-[var(--foreground)]">
                Status
                <select
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  disabled={isClosed || isSaving}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      status: event.target.value as TechnicianRepairJobStatus,
                    }))
                  }
                  value={formState.status}
                >
                  {technicianStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-[var(--foreground)]">
                Diagnosis
                <textarea
                  className="mt-2 min-h-32 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm leading-6 text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  disabled={isClosed || isSaving}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      diagnosis: event.target.value,
                    }))
                  }
                  value={formState.diagnosis}
                />
              </label>

              <label className="text-sm font-semibold text-[var(--foreground)]">
                Repair notes
                <textarea
                  className="mt-2 min-h-32 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm leading-6 text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  disabled={isClosed || isSaving}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      repairNotes: event.target.value,
                    }))
                  }
                  value={formState.repairNotes}
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isClosed || isSaving}
                  onClick={() => handleSave()}
                  type="button"
                >
                  {isSaving ? "Saving..." : "Save update"}
                </button>

                {saveState.status === "saved" ? (
                  <p className="text-sm font-semibold text-[var(--brand-strong)]">
                    Work order updated.
                  </p>
                ) : null}

                {saveState.status === "error" ? (
                  <p className="text-sm font-semibold text-red-700">
                    {saveState.error}
                  </p>
                ) : null}

                {isClosed ? (
                  <p className="text-sm font-semibold text-[var(--muted)]">
                    Closed work orders are read-only.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <dl className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-5 text-xs text-[var(--muted)] shadow-sm md:grid-cols-2">
            <div>
              <dt className="font-semibold text-[var(--foreground)]">Booking ID</dt>
              <dd className="mt-1 break-all">{workOrder.booking_id}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--foreground)]">
                Repair Job ID
              </dt>
              <dd className="mt-1 break-all">{workOrder.id}</dd>
            </div>
          </dl>
        </section>
      ) : null}
    </main>
  );
}
