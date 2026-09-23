"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  getTechnicianProfile,
  getTechnicianWorkOrders,
  type TechnicianProfile,
  type TechnicianWorkOrder,
} from "@/features/technician";
import { createClient } from "@/lib/supabase/browser";

type ReadyData = {
  profile: TechnicianProfile;
  workOrders: TechnicianWorkOrder[];
};

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "signed-out"; data: null; error: null }
  | { status: "ready"; data: ReadyData; error: null }
  | { status: "error"; data: null; error: string };

// Local YYYY-MM-DD (not toISOString, which shifts to UTC and can land on
// the wrong day depending on the technician's timezone) - matches the
// plain "date" column format booking_date is stored/displayed in
// elsewhere (see technician-work-orders-panel.tsx).
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatThaiDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  });
}

function formatBookingTime(value: string) {
  return value.slice(0, 5);
}

function formatShortDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
  });
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

function getSelectedSkillNames(profile: TechnicianProfile) {
  const selectedSkillIds = new Set(profile.selectedSkillIds);
  return profile.skills
    .filter((skill) => selectedSkillIds.has(skill.id))
    .map((skill) => skill.name);
}

// One shared strip cut into sections by dividing lines, instead of 4
// separate bordered cards - reads as a single summary bar rather than
// 4 competing boxes, while the numbers stay just as large/bold.
function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[7.5rem] flex-1 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function QueueRow({
  showDate = false,
  workOrder,
}: {
  showDate?: boolean;
  workOrder: TechnicianWorkOrder;
}) {
  return (
    <Link
      className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm transition hover:border-[var(--brand)] sm:flex-row sm:items-center sm:justify-between"
      href={`/technician/work-orders/${workOrder.id}`}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {showDate && workOrder.booking ? (
            <span className="text-sm font-semibold text-[var(--muted)]">
              {formatShortDate(workOrder.booking.booking_date)}
            </span>
          ) : null}
          <span className="text-lg font-bold text-[var(--foreground)]">
            {workOrder.booking
              ? formatBookingTime(workOrder.booking.booking_time)
              : "-"}
          </span>
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
              workOrder.status,
            )}`}
          >
            {formatWorkOrderStatus(workOrder.status)}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-[var(--brand)]">
          {workOrder.service?.name ?? "ไม่พบบริการ"}
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

export function TechnicianHomePanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    data: null,
    error: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadHome() {
      setLoadState({ data: null, error: null, status: "loading" });

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setLoadState({
          data: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({ data: null, error: null, status: "signed-out" });
        return;
      }

      const [profileResult, workOrdersResult] = await Promise.all([
        getTechnicianProfile(supabase, session.user.id),
        getTechnicianWorkOrders(supabase, session.user.id),
      ]);

      if (!isMounted) {
        return;
      }

      if (profileResult.error) {
        setLoadState({
          data: null,
          error: profileResult.error.message,
          status: "error",
        });
        return;
      }

      if (workOrdersResult.error) {
        setLoadState({
          data: null,
          error: workOrdersResult.error.message,
          status: "error",
        });
        return;
      }

      if (!profileResult.data?.allowed || !workOrdersResult.data?.allowed) {
        setLoadState({
          data: null,
          error:
            profileResult.data?.reason ??
            workOrdersResult.data?.reason ??
            "ไม่มีสิทธิ์เข้าถึงหน้านี้",
          status: "error",
        });
        return;
      }

      setLoadState({
        data: {
          profile: profileResult.data,
          workOrders: workOrdersResult.data.workOrders,
        },
        error: null,
        status: "ready",
      });
    }

    loadHome();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadHome();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const todayDateString = useMemo(() => getTodayDateString(), []);

  const grouped = useMemo(() => {
    if (loadState.status !== "ready") {
      return null;
    }

    const workOrders = loadState.data.workOrders;

    const todayQueue = workOrders
      .filter(
        (workOrder) =>
          workOrder.status !== "cancelled" &&
          workOrder.booking?.booking_date === todayDateString,
      )
      .sort((a, b) => {
        const timeA = a.booking?.booking_time ?? "";
        const timeB = b.booking?.booking_time ?? "";
        return timeA.localeCompare(timeB);
      });

    const inProgress = workOrders.filter(
      (workOrder) => workOrder.status === "in_progress",
    );

    const openCount = workOrders.filter(
      (workOrder) =>
        workOrder.status === "pending" || workOrder.status === "assigned",
    ).length;

    const completedTodayCount = workOrders.filter(
      (workOrder) =>
        workOrder.status === "completed" &&
        (workOrder.completed_at ?? "").slice(0, 10) === todayDateString,
    ).length;

    const upcoming = workOrders
      .filter(
        (workOrder) =>
          workOrder.status !== "cancelled" &&
          workOrder.status !== "completed" &&
          (workOrder.booking?.booking_date ?? "") > todayDateString,
      )
      .sort((a, b) => {
        const dateA = a.booking?.booking_date ?? "";
        const dateB = b.booking?.booking_date ?? "";
        if (dateA !== dateB) {
          return dateA.localeCompare(dateB);
        }
        const timeA = a.booking?.booking_time ?? "";
        const timeB = b.booking?.booking_time ?? "";
        return timeA.localeCompare(timeB);
      })
      .slice(0, 5);

    return {
      completedTodayCount,
      inProgress,
      openCount,
      todayQueue,
      upcoming,
    };
  }, [loadState, todayDateString]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          {loadState.status === "ready"
            ? `สวัสดี, ${loadState.data.profile.profile?.full_name ?? "ช่าง"}`
            : "หน้าแรกของช่าง"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          {formatThaiDate(todayDateString)} - ภาพรวมงานซ่อมของคุณวันนี้
        </p>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดข้อมูล...
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

      {loadState.status === "ready" && grouped ? (
        <section className="flex flex-col gap-6 py-6">
          <div className="flex divide-x divide-[var(--line)] overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <StatItem label="คิวงานวันนี้" value={grouped.todayQueue.length} />
            <StatItem label="กำลังทำอยู่" value={grouped.inProgress.length} />
            <StatItem label="รอเริ่มงาน" value={grouped.openCount} />
            <StatItem
              label="เสร็จวันนี้"
              value={grouped.completedTodayCount}
            />
          </div>

          {grouped.inProgress.length > 0 ? (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm font-bold text-indigo-900">
                มีงานที่กำลังทำค้างอยู่ - กลับไปทำต่อได้เลย
              </p>
              <div className="mt-3 space-y-3">
                {grouped.inProgress.map((workOrder) => (
                  <QueueRow key={workOrder.id} workOrder={workOrder} />
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                คิวงานวันนี้
              </h2>
              <Link
                className="text-sm font-semibold text-[var(--brand-strong)] hover:underline"
                href="/technician/work-orders"
              >
                ดูงานซ่อมทั้งหมด
              </Link>
            </div>

            {grouped.todayQueue.length > 0 ? (
              <div className="mt-3 space-y-3">
                {grouped.todayQueue.map((workOrder) => (
                  <QueueRow key={workOrder.id} workOrder={workOrder} />
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
                วันนี้ยังไม่มีคิวงานที่นัดไว้
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--foreground)]">
                งานที่ใกล้จะมาถึง
              </h2>
              <Link
                className="text-sm font-semibold text-[var(--brand-strong)] hover:underline"
                href="/technician/work-orders"
              >
                ดูงานซ่อมทั้งหมด
              </Link>
            </div>

            {grouped.upcoming.length > 0 ? (
              <div className="mt-3 space-y-3">
                {grouped.upcoming.map((workOrder) => (
                  <QueueRow key={workOrder.id} showDate workOrder={workOrder} />
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
                ยังไม่มีงานที่นัดไว้ล่วงหน้า
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <h2 className="text-sm font-bold text-[var(--foreground)]">
                ข้อมูลช่าง
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-[var(--muted)]">ชื่อ</dt>
                  <dd className="font-semibold text-[var(--foreground)]">
                    {loadState.data.profile.profile?.full_name ?? "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">ความเชี่ยวชาญ</dt>
                  <dd className="font-semibold text-[var(--foreground)]">
                    {loadState.data.profile.profile?.technician_specialty ||
                      "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">ทักษะ</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {getSelectedSkillNames(loadState.data.profile).length > 0
                      ? getSelectedSkillNames(loadState.data.profile).map(
                          (skillName) => (
                            <span
                              className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-emerald-400"
                              key={skillName}
                            >
                              {skillName}
                            </span>
                          ),
                        )
                      : (
                          <span className="text-[var(--muted)]">
                            ยังไม่ได้เลือกทักษะ
                          </span>
                        )}
                  </dd>
                </div>
              </dl>
              <Link
                className="mt-4 inline-flex min-h-9 items-center text-sm font-semibold text-[var(--brand-strong)] hover:underline"
                href="/technician/profile"
              >
                แก้ไขโปรไฟล์ช่าง
              </Link>
            </div>

            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
              <h2 className="text-sm font-bold text-[var(--foreground)]">
                ทางลัด
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--brand)]"
                  href="/technician/work-orders"
                >
                  งานซ่อมของฉัน
                </Link>
                <Link
                  className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--brand)]"
                  href="/technician/profile"
                >
                  โปรไฟล์ช่าง
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
