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

function formatWorkOrderStatus(status: StatusFilter) {
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

  if (status === "cancelled") {
    return "ยกเลิก";
  }

  return "ทั้งหมด";
}

function TechnicianWorkOrderRow({
  workOrder,
}: {
  workOrder: TechnicianWorkOrder;
}) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand)]">
              {workOrder.service?.name ?? "ไม่พบบริการ"}
            </p>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                workOrder.status,
              )}`}
            >
              {formatWorkOrderStatus(workOrder.status)}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {formatBookingSchedule(workOrder)}
          </h2>
        </div>

        <Link
          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
          href={`/technician/work-orders/${workOrder.id}`}
        >
          เปิดงานซ่อม
        </Link>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm md:grid-cols-4">
        <div>
          <dt className="text-[var(--muted)]">ลูกค้า</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {workOrder.customer?.full_name ?? "-"}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {workOrder.customer?.phone_number ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">รถ</dt>
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
          <dt className="text-[var(--muted)]">เริ่มงาน</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {formatDateTime(workOrder.started_at)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">อัปเดตล่าสุด</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {formatDateTime(workOrder.updated_at)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-md bg-slate-50 p-3">
          <p className="font-semibold text-[var(--foreground)]">ผลวิเคราะห์อาการ</p>
          <p className="mt-2 leading-6 text-[var(--muted)]">
            {workOrder.diagnosis || "-"}
          </p>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="font-semibold text-[var(--foreground)]">บันทึกงานซ่อม</p>
          <p className="mt-2 leading-6 text-[var(--muted)]">
            {workOrder.repair_notes || "-"}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)] md:grid-cols-3">
        <div>
          <dt className="font-semibold text-[var(--foreground)]">เสร็จงาน</dt>
          <dd className="mt-1">{formatDateTime(workOrder.completed_at)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--foreground)]">รหัสการจอง</dt>
          <dd className="mt-1 break-all">{workOrder.booking_id}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--foreground)]">รหัสงานซ่อม</dt>
          <dd className="mt-1 break-all">{workOrder.id}</dd>
        </div>
      </dl>
    </article>
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

  const statusCounts = useMemo(() => {
    const counts = new Map<TechnicianWorkOrder["status"], number>(
      statusOrder.map((status) => [status, 0]),
    );

    if (loadState.status !== "ready" || !loadState.result?.allowed) {
      return counts;
    }

    for (const workOrder of loadState.result.workOrders) {
      counts.set(workOrder.status, (counts.get(workOrder.status) ?? 0) + 1);
    }

    return counts;
  }, [loadState]);

  const filteredWorkOrders = useMemo(() => {
    if (loadState.status !== "ready" || !loadState.result?.allowed) {
      return [];
    }

    if (statusFilter === "all") {
      return loadState.result.workOrders;
    }

    return loadState.result.workOrders.filter(
      (workOrder) => workOrder.status === statusFilter,
    );
  }, [loadState, statusFilter]);

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
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
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
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
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
        <section className="py-6">
          <div className="grid gap-3 border-b border-[var(--line)] pb-5 sm:grid-cols-2 lg:grid-cols-6">
            <button
              className={`rounded-lg border p-4 text-left shadow-sm ${
                statusFilter === "all"
                  ? "border-[var(--brand)] bg-emerald-50"
                  : "border-[var(--line)] bg-white"
              }`}
              onClick={() => setStatusFilter("all")}
              type="button"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                ทั้งหมด
              </p>
              <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                {loadState.result.workOrders.length}
              </p>
            </button>
            {statusOrder.map((status) => (
              <button
                className={`rounded-lg border p-4 text-left shadow-sm ${
                  statusFilter === status
                    ? "border-[var(--brand)] bg-emerald-50"
                    : "border-[var(--line)] bg-white"
                }`}
                key={status}
                onClick={() => setStatusFilter(status)}
                type="button"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {formatWorkOrderStatus(status)}
                </p>
                <p className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                  {statusCounts.get(status) ?? 0}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-white p-4 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[var(--foreground)]">
                แสดง {filteredWorkOrders.length} จาก{" "}
                {loadState.result.workOrders.length} งานซ่อม
              </p>
              <p className="mt-1 text-[var(--muted)]">
                ตัวกรอง: {formatWorkOrderStatus(statusFilter)}
              </p>
            </div>
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
              type="button"
            >
              ล้างตัวกรอง
            </button>
          </div>

          {filteredWorkOrders.length > 0 ? (
            <div className="mt-5 space-y-4">
              {filteredWorkOrders.map((workOrder) => (
                <TechnicianWorkOrderRow
                  key={`${workOrder.id}-${workOrder.status}`}
                  workOrder={workOrder}
                />
              ))}
            </div>
          ) : loadState.result.workOrders.length > 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบงานซ่อมที่ตรงกับตัวกรองนี้
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              ยังไม่มีงานซ่อมที่มอบหมายให้คุณ
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
