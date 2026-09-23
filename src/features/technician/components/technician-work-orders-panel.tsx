"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  getTechnicianWorkOrders,
  type TechnicianWorkOrder,
  type TechnicianWorkOrdersResult,
} from "@/features/technician";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; result: null; error: null }
  | { status: "signed-out"; result: null; error: null }
  | { status: "ready"; result: TechnicianWorkOrdersResult; error: null }
  | { status: "error"; result: null; error: string };

type StatusFilter = "all" | TechnicianWorkOrder["status"];

const statusOrder: TechnicianWorkOrder["status"][] = [
  "pending",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
];

function formatBookingSchedule(workOrder: TechnicianWorkOrder) {
  if (!workOrder.booking) {
    return "-";
  }

  return `${workOrder.booking.booking_date} เวลา ${workOrder.booking.booking_time.slice(
    0,
    5,
  )}`;
}

function getStatusStyle(status: TechnicianWorkOrder["status"]) {
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

function formatWorkOrderStatus(status: TechnicianWorkOrder["status"]) {
  if (status === "pending") {
    return "รอดำเนินการ";
  }

  if (status === "assigned") {
    return "มอบหมายแล้ว";
  }

  if (status === "in_progress") {
    return "กำลังซ่อม";
  }

  if (status === "completed") {
    return "เสร็จสิ้น";
  }

  return "ยกเลิก";
}

// Kept deliberately minimal - just enough to recognize and open the right
// job (time/service/status, who/what car). Everything else (diagnosis,
// repair notes, started/completed timestamps, ids) only shows once a
// technician actually opens a job, on technician-work-order-detail-panel.tsx
// - nothing here is lost, it's just one tap away instead of all on screen
// at once.
function TechnicianWorkOrderRow({
  workOrder,
}: {
  workOrder: TechnicianWorkOrder;
}) {
  return (
    <Link
      className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm transition hover:border-[var(--brand)] sm:flex-row sm:items-center sm:justify-between"
      href={`/technician/work-orders/${workOrder.id}`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
              workOrder.status,
            )}`}
          >
            {formatWorkOrderStatus(workOrder.status)}
          </span>
          <span className="text-sm font-semibold text-[var(--brand)]">
            {workOrder.service?.name ?? "ไม่พบบริการ"}
          </span>
        </div>
        <p className="mt-1 text-lg font-bold text-[var(--foreground)]">
          {formatBookingSchedule(workOrder)}
        </p>
      </div>

      <div className="text-sm sm:text-right">
        <p className="font-semibold text-[var(--foreground)]">
          {workOrder.customer?.full_name ?? "-"}
        </p>
        <p className="mt-1 text-[var(--muted)]">
          {workOrder.vehicle?.license_plate ?? "-"}
        </p>
      </div>
    </Link>
  );
}

// Same "strip with dividers" pattern used across the rest of the app,
// but each item is a clickable filter button (like the stock-filter
// strip on admin-inventory-review-panel.tsx) rather than a plain stat -
// tint the background instead of the old bordered-button style to show
// which status is selected.
function FilterItem({
  isActive,
  label,
  onClick,
  value,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
  value: number;
}) {
  return (
    <button
      className={`min-w-[7rem] flex-1 px-4 py-3 text-left transition ${
        isActive
          ? "bg-[var(--accent-soft)]"
          : "hover:bg-[var(--accent-soft)]"
      }`}
      onClick={onClick}
      type="button"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
        {value}
      </p>
    </button>
  );
}

export function TechnicianWorkOrdersPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    result: null,
    status: "loading",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadWorkOrders() {
      setLoadState({
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

      const { data, error } = await getTechnicianWorkOrders(
        supabase,
        session.user.id,
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

      setLoadState({
        error: null,
        result: data,
        status: "ready",
      });
    }

    loadWorkOrders();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadWorkOrders();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const workOrders =
    loadState.status === "ready" && loadState.result?.allowed
      ? loadState.result.workOrders
      : [];

  const statusCounts = useMemo(() => {
    const counts = new Map<TechnicianWorkOrder["status"], number>();
    for (const status of statusOrder) {
      counts.set(status, 0);
    }
    for (const workOrder of workOrders) {
      counts.set(workOrder.status, (counts.get(workOrder.status) ?? 0) + 1);
    }
    return counts;
  }, [workOrders]);

  const filteredWorkOrders = useMemo(() => {
    if (statusFilter === "all") {
      return workOrders;
    }
    return workOrders.filter((workOrder) => workOrder.status === statusFilter);
  }, [statusFilter, workOrders]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          งานซ่อมของฉัน
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          ตรวจสอบงานซ่อมที่ถูกมอบหมายให้บัญชีช่างของคุณ และเปิดรายละเอียดเพื่ออัปเดตสถานะ ผลวิเคราะห์อาการ และบันทึกงานซ่อม
        </p>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดงานซ่อมของช่าง...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบ</p>
            <p className="mt-1">กรุณาเข้าสู่ระบบด้วยบัญชีช่าง</p>
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
          <div className="max-w-xl rounded-lg border border-red-200 bg-[var(--surface)] px-5 py-4 text-sm text-[var(--danger)] shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" && !loadState.result?.allowed ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
            <p className="mt-2">{loadState.result?.reason}</p>
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" && loadState.result?.allowed ? (
        <section className="flex flex-col gap-4 py-6">
          {workOrders.length > 0 ? (
            <div className="flex divide-x divide-[var(--line)] overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-sm">
              <FilterItem
                isActive={statusFilter === "all"}
                label="ทั้งหมด"
                onClick={() => setStatusFilter("all")}
                value={workOrders.length}
              />
              {statusOrder.map((status) => (
                <FilterItem
                  isActive={statusFilter === status}
                  key={status}
                  label={formatWorkOrderStatus(status)}
                  onClick={() => setStatusFilter(status)}
                  value={statusCounts.get(status) ?? 0}
                />
              ))}
            </div>
          ) : null}

          {filteredWorkOrders.length > 0 ? (
            <div className="space-y-3">
              {filteredWorkOrders.map((workOrder) => (
                <TechnicianWorkOrderRow
                  key={workOrder.id}
                  workOrder={workOrder}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
              {workOrders.length > 0
                ? "ไม่มีงานซ่อมในสถานะที่เลือก"
                : "ยังไม่มีงานซ่อมที่มอบหมายให้คุณ"}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
