"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminMechanics,
  getAdminRepairJobsPage,
  getAdminRepairJobStatusCounts,
  updateAdminRepairJobMechanic,
  type AdminAccessResult,
  type AdminMechanic,
  type AdminRepairJob,
  type AdminRepairJobListResult,
  type AdminRepairJobListStatusFilter,
  type AdminRepairJobStatusCounts,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

const pageSize = 10;

type LoadState =
  | {
      status: "loading";
      access: null;
      result: null;
      statusCounts: null;
      error: null;
    }
  | {
      status: "signed-out";
      access: null;
      result: null;
      statusCounts: null;
      error: null;
    }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      result: null;
      statusCounts: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      result: AdminRepairJobListResult;
      statusCounts: AdminRepairJobStatusCounts;
      error: null;
    }
  | {
      status: "error";
      access: null;
      result: null;
      statusCounts: null;
      error: string;
    };

type AssignmentState =
  | { status: "idle"; repairJobId: null; error: null }
  | { status: "saving"; repairJobId: string; error: null }
  | { status: "error"; repairJobId: string; error: string };

const statusOrder: AdminRepairJob["status"][] = [
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

function formatBookingSchedule(booking: AdminRepairJob["booking"]) {
  if (!booking) {
    return "-";
  }

  return `${booking.booking_date} เวลา ${booking.booking_time.slice(0, 5)}`;
}

function getStatusStyle(status: AdminRepairJob["status"]) {
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

function formatRepairJobStatus(status: AdminRepairJob["status"]) {
  if (status === "pending") {
    return "รอเริ่มงาน";
  }

  if (status === "assigned") {
    return "มอบหมายช่างแล้ว";
  }

  if (status === "in_progress") {
    return "กำลังซ่อม";
  }

  if (status === "completed") {
    return "เสร็จสิ้น";
  }

  return "ยกเลิก";
}

function getMechanicSkillsLabel(mechanic: AdminMechanic | null) {
  if (!mechanic) {
    return "-";
  }

  if (mechanic.skills.length > 0) {
    return mechanic.skills.map((skill) => skill.name).join(", ");
  }

  return mechanic.technician_specialty?.trim() || "ยังไม่ได้ตั้งค่าทักษะ";
}

function getMechanicOptionLabel(mechanic: AdminMechanic) {
  const contact = mechanic.email ?? mechanic.phone_number;
  return `${mechanic.full_name} - ${getMechanicSkillsLabel(mechanic)} (${contact})`;
}

function clampPage(page: number, totalPages: number) {
  if (!Number.isFinite(page)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.floor(page)), totalPages);
}

function AdminRepairJobsPaginationControls({
  onPageChange,
  result,
}: {
  onPageChange: (page: number) => void;
  result: AdminRepairJobListResult;
}) {
  const inputId = `repair-job-page-jump-${result.page}-${result.totalPages}`;

  function handlePageJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const requestedPage = Number(formData.get("page"));
    onPageChange(clampPage(requestedPage, result.totalPages));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-sm text-[var(--muted)]">
        หน้า {result.page} จาก {result.totalPages} ({result.totalCount} รายการ)
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <button
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={result.page <= 1}
            onClick={() => onPageChange(result.page - 1)}
            type="button"
          >
            ก่อนหน้า
          </button>
          <button
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={result.page >= result.totalPages}
            onClick={() => onPageChange(result.page + 1)}
            type="button"
          >
            ถัดไป
          </button>
        </div>

        <form
          className="flex items-center gap-2"
          key={inputId}
          onSubmit={handlePageJump}
        >
          <label
            className="whitespace-nowrap text-sm font-semibold text-[var(--muted)]"
            htmlFor={inputId}
          >
            ไปหน้า
          </label>
          <input
            className="min-h-10 w-24 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            defaultValue={result.page}
            id={inputId}
            inputMode="numeric"
            max={result.totalPages}
            min={1}
            name="page"
            type="number"
          />
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
            type="submit"
          >
            ไป
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminRepairJobRow({
  assignmentState,
  mechanics,
  onMechanicSave,
  repairJob,
}: {
  assignmentState: AssignmentState;
  mechanics: AdminMechanic[];
  onMechanicSave: (repairJob: AdminRepairJob, mechanicId: string | null) => void;
  repairJob: AdminRepairJob;
}) {
  const [selectedMechanicId, setSelectedMechanicId] = useState(
    repairJob.mechanic_id ?? "",
  );
  const isSaving =
    assignmentState.status === "saving" &&
    assignmentState.repairJobId === repairJob.id;
  const isClosed =
    repairJob.status === "completed" || repairJob.status === "cancelled";
  const canSave =
    !isClosed &&
    !isSaving &&
    selectedMechanicId !== (repairJob.mechanic_id ?? "");

  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand)]">
              {repairJob.service?.name ?? "ไม่พบบริการ"}
            </p>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                repairJob.status,
              )}`}
            >
              {formatRepairJobStatus(repairJob.status)}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {formatBookingSchedule(repairJob.booking)}
          </h2>
        </div>

        {repairJob.booking ? (
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href={`/admin/bookings?bookingId=${repairJob.booking.id}`}
          >
            ดูการจอง
          </Link>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm md:grid-cols-4">
        <div>
          <dt className="text-[var(--muted)]">ลูกค้า</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {repairJob.customer?.full_name ?? "-"}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {repairJob.customer?.phone_number ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">รถ</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {repairJob.vehicle?.license_plate ?? "-"}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {repairJob.vehicle
              ? `${repairJob.vehicle.brand ?? "-"} / ${
                  repairJob.vehicle.model ?? "-"
                }`
              : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">ช่างผู้รับผิดชอบ</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {repairJob.mechanic?.full_name ?? "ยังไม่ได้มอบหมาย"}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {getMechanicSkillsLabel(repairJob.mechanic)}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {repairJob.mechanic?.email ?? repairJob.mechanic?.phone_number ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">อัปเดตล่าสุด</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {formatDateTime(repairJob.updated_at)}
          </dd>
        </div>
      </dl>

      <section className="mt-4 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            มอบหมายช่าง
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] lg:w-80"
              disabled={isClosed || isSaving || mechanics.length === 0}
              onChange={(event) => setSelectedMechanicId(event.target.value)}
              value={selectedMechanicId}
            >
              <option value="">ยังไม่ได้มอบหมาย</option>
              {mechanics.map((mechanic) => (
                <option key={mechanic.id} value={mechanic.id}>
                  {getMechanicOptionLabel(mechanic)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSave}
            onClick={() =>
              onMechanicSave(repairJob, selectedMechanicId || null)
            }
            type="button"
          >
            {isSaving ? "กำลังบันทึก..." : "บันทึกช่าง"}
          </button>
        </div>

        {mechanics.length === 0 ? (
          <p className="mt-2 text-xs font-semibold text-amber-400">
            ยังไม่พบโปรไฟล์ช่างในระบบ
          </p>
        ) : null}

        {isClosed ? (
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
            ใบงานที่ปิดแล้วไม่สามารถเปลี่ยนช่างได้ในขั้นนี้
          </p>
        ) : null}

        {assignmentState.status === "error" &&
        assignmentState.repairJobId === repairJob.id ? (
          <p className="mt-2 text-sm text-[var(--danger)]">{assignmentState.error}</p>
        ) : null}
      </section>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-md bg-[var(--surface-muted)] p-3">
          <p className="font-semibold text-[var(--foreground)]">ผลตรวจ/วิเคราะห์อาการ</p>
          <p className="mt-2 leading-6 text-[var(--muted)]">
            {repairJob.diagnosis || "-"}
          </p>
        </div>
        <div className="rounded-md bg-[var(--surface-muted)] p-3">
          <p className="font-semibold text-[var(--foreground)]">บันทึกการซ่อม</p>
          <p className="mt-2 leading-6 text-[var(--muted)]">
            {repairJob.repair_notes || "-"}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)] md:grid-cols-3">
        <div>
          <dt className="font-semibold text-[var(--foreground)]">เริ่มงาน</dt>
          <dd className="mt-1">{formatDateTime(repairJob.started_at)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--foreground)]">เสร็จงาน</dt>
          <dd className="mt-1">{formatDateTime(repairJob.completed_at)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--foreground)]">รหัสใบงานซ่อม</dt>
          <dd className="mt-1 break-all">{repairJob.id}</dd>
        </div>
      </dl>
    </article>
  );
}

export function AdminRepairJobsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    result: null,
    status: "loading",
    statusCounts: null,
  });
  const [mechanics, setMechanics] = useState<AdminMechanic[]>([]);
  const [assignmentState, setAssignmentState] = useState<AssignmentState>({
    error: null,
    repairJobId: null,
    status: "idle",
  });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] =
    useState<AdminRepairJobListStatusFilter>("all");

  function handleStatusFilterChange(next: AdminRepairJobListStatusFilter) {
    setStatusFilter(next);
    setPage(1);
  }

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadRepairJobs() {
      setLoadState({
        access: null,
        error: null,
        result: null,
        status: "loading",
        statusCounts: null,
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
          result: null,
          status: "error",
          statusCounts: null,
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          error: null,
          result: null,
          status: "signed-out",
          statusCounts: null,
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
          result: null,
          status: "access-denied",
          statusCounts: null,
        });
        return;
      }

      const [repairJobsResult, statusCountsResult, mechanicsResult] =
        await Promise.all([
          getAdminRepairJobsPage(supabase, { page, pageSize, status: statusFilter }),
          getAdminRepairJobStatusCounts(supabase),
          getAdminMechanics(supabase),
        ]);

      if (!isMounted) {
        return;
      }

      if (repairJobsResult.error) {
        setLoadState({
          access: null,
          error: repairJobsResult.error.message,
          result: null,
          status: "error",
          statusCounts: null,
        });
        return;
      }

      if (statusCountsResult.error) {
        setLoadState({
          access: null,
          error: statusCountsResult.error.message,
          result: null,
          status: "error",
          statusCounts: null,
        });
        return;
      }

      if (mechanicsResult.error) {
        setLoadState({
          access: null,
          error: mechanicsResult.error.message,
          result: null,
          status: "error",
          statusCounts: null,
        });
        return;
      }

      if (!repairJobsResult.data) {
        return;
      }

      if (
        repairJobsResult.data.page < repairJobsResult.data.totalPages &&
        repairJobsResult.data.repairJobs.length === 0 &&
        repairJobsResult.data.totalCount > 0
      ) {
        setPage(clampPage(page, repairJobsResult.data.totalPages));
        return;
      }

      setMechanics(mechanicsResult.data ?? []);

      setLoadState({
        access,
        error: null,
        result: repairJobsResult.data,
        status: "ready",
        statusCounts: statusCountsResult.data,
      });
    }

    loadRepairJobs();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadRepairJobs();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [page, statusFilter]);

  async function handleMechanicSave(
    repairJob: AdminRepairJob,
    mechanicId: string | null,
  ) {
    if (loadState.status !== "ready") {
      return;
    }

    setAssignmentState({
      error: null,
      repairJobId: repairJob.id,
      status: "saving",
    });

    const supabase = createClient();
    const { data, error } = await updateAdminRepairJobMechanic(
      supabase,
      repairJob,
      mechanicId,
    );

    if (error) {
      setAssignmentState({
        error: error.message,
        repairJobId: repairJob.id,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      result: {
        ...loadState.result,
        repairJobs: loadState.result.repairJobs.map((currentRepairJob) =>
          currentRepairJob.id === repairJob.id && data
            ? data
            : currentRepairJob,
        ),
      },
    });
    setAssignmentState({
      error: null,
      repairJobId: null,
      status: "idle",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              ใบงานซ่อมหลังบ้าน
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ตรวจสอบใบงานซ่อมจากการจองที่ยืนยันแล้ว และมอบหมายช่างผู้รับผิดชอบ
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            หน้าหลังบ้าน
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดใบงานซ่อม...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อน</p>
            <p className="mt-1">เข้าสู่ระบบด้วยบัญชี admin</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่หน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
            <p className="mt-2">{loadState.access.reason}</p>
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

      {loadState.status === "ready" ? (
        <section className="py-6">
          <div className="flex divide-x divide-[var(--line)] overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <button
              className={`min-w-[7.5rem] flex-1 px-4 py-3 text-left transition ${
                statusFilter === "all"
                  ? "bg-[var(--accent-soft)]"
                  : "hover:bg-[var(--accent-soft)]"
              }`}
              onClick={() => handleStatusFilterChange("all")}
              type="button"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                ทั้งหมด
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {Object.values(loadState.statusCounts).reduce(
                  (sum, count) => sum + count,
                  0,
                )}
              </p>
            </button>
            {statusOrder.map((status) => (
              <button
                className={`min-w-[7.5rem] flex-1 px-4 py-3 text-left transition ${
                  statusFilter === status
                    ? "bg-[var(--accent-soft)]"
                    : "hover:bg-[var(--accent-soft)]"
                }`}
                key={status}
                onClick={() => handleStatusFilterChange(status)}
                type="button"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {formatRepairJobStatus(status)}
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                  {loadState.statusCounts[status] ?? 0}
                </p>
              </button>
            ))}
          </div>

          {loadState.result.totalCount > 0 ? (
            <div className="mt-5">
              <AdminRepairJobsPaginationControls
                onPageChange={setPage}
                result={loadState.result}
              />
            </div>
          ) : null}

          {loadState.result.repairJobs.length > 0 ? (
            <div className="mt-5 space-y-4">
              {loadState.result.repairJobs.map((repairJob) => (
                <AdminRepairJobRow
                  assignmentState={assignmentState}
                  key={`${repairJob.id}-${repairJob.status}-${repairJob.mechanic_id ?? "unassigned"}`}
                  mechanics={mechanics}
                  onMechanicSave={handleMechanicSave}
                  repairJob={repairJob}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
              {statusFilter === "all"
                ? "ยังไม่พบใบงานซ่อมในระบบ"
                : "ไม่พบใบงานซ่อมในสถานะที่เลือก"}
            </div>
          )}

          {loadState.result.totalCount > 0 ? (
            <div className="mt-5">
              <AdminRepairJobsPaginationControls
                onPageChange={setPage}
                result={loadState.result}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
