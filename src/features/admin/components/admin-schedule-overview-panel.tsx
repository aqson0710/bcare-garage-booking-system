"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminScheduleOverview,
  type AdminAccessResult,
  type AdminScheduleOverview,
  type AdminScheduleSlot,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; overview: null; error: null }
  | { status: "signed-out"; access: null; overview: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      overview: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      overview: AdminScheduleOverview;
      error: null;
    }
  | { status: "error"; access: null; overview: null; error: string };

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  });
}

function getSlotStyle(slot: AdminScheduleSlot) {
  if (slot.status === "closed" || slot.maxBookings <= 0) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  if (slot.availableBookingCount === 0) {
    return "border-red-200 bg-red-50 text-red-800";
  }

  if (!slot.hasCapacityRule) {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-emerald-200 bg-emerald-50 text-[var(--brand-strong)]";
}

function getSlotStatusLabel(slot: AdminScheduleSlot) {
  if (slot.status === "closed" || slot.maxBookings <= 0) {
    return "ปิด";
  }

  if (slot.availableBookingCount === 0) {
    return "เต็ม";
  }

  return "ว่าง";
}

function getMetricTotals(overview: AdminScheduleOverview) {
  return overview.days.reduce(
    (totals, day) => ({
      activeBookingCount: totals.activeBookingCount + day.activeBookingCount,
      availableBookingCount:
        totals.availableBookingCount + day.availableBookingCount,
      closedSlotCount: totals.closedSlotCount + day.closedSlotCount,
      maxBookings: totals.maxBookings + day.maxBookings,
    }),
    {
      activeBookingCount: 0,
      availableBookingCount: 0,
      closedSlotCount: 0,
      maxBookings: 0,
    },
  );
}

function ScheduleCell({ slot }: { slot: AdminScheduleSlot }) {
  return (
    <td className="min-w-32 border border-[var(--line)] p-2 align-top">
      <div className={`rounded-md border p-2 text-xs ${getSlotStyle(slot)}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold">{getSlotStatusLabel(slot)}</span>
          <span>{slot.activeBookingCount}/{slot.maxBookings}</span>
        </div>
        <p className="mt-1">
          เหลือ {slot.availableBookingCount} คิว
        </p>
        {!slot.hasCapacityRule ? (
          <p className="mt-1 text-[11px]">ค่าเริ่มต้น</p>
        ) : null}
      </div>
    </td>
  );
}

export function AdminScheduleOverviewPanel() {
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [reloadKey, setReloadKey] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    overview: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadOverview() {
      setLoadState({
        access: null,
        error: null,
        overview: null,
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
          error: sessionError.message,
          overview: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          error: null,
          overview: null,
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
          error: null,
          overview: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminScheduleOverview(
        supabase,
        startDate,
        7,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          error: error.message,
          overview: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        error: null,
        overview: data,
        status: "ready",
      });
    }

    loadOverview();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadOverview();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [reloadKey, startDate]);

  const metricTotals = useMemo(() => {
    if (loadState.status !== "ready") {
      return null;
    }

    return getMetricTotals(loadState.overview);
  }, [loadState]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
            BCare
          </p>
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              ภาพรวมตารางคิว
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ดูจำนวนคิวที่รับได้ จองแล้ว และคิวที่เหลือของแต่ละวันและเวลา
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="text-sm font-semibold text-[var(--foreground)]">
              วันที่เริ่มต้น
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] sm:w-44"
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                value={startDate}
              />
            </label>
            <button
              className="min-h-10 self-end rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
              onClick={() => setReloadKey((currentKey) => currentKey + 1)}
              type="button"
            >
              โหลดใหม่
            </button>
            <Link
              className="min-h-10 self-end rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/admin/capacity"
            >
              จัดการคิวรับงาน
            </Link>
          </div>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดตารางคิว...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อน</p>
            <p className="mt-1">กรุณาเข้าสู่ระบบด้วยบัญชี admin</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปหน้าบัญชี
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
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm leading-6 text-red-700 shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" && metricTotals ? (
        <section className="py-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">รับได้รวม</p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {metricTotals.maxBookings}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">จองแล้ว</p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {metricTotals.activeBookingCount}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">คิวว่าง</p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {metricTotals.availableBookingCount}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-xs text-[var(--muted)]">ช่วงเวลาปิดรับ</p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {metricTotals.closedSlotCount}
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[var(--muted)]">
                  <th className="sticky left-0 z-10 min-w-24 border border-[var(--line)] bg-slate-50 p-3">
                    เวลา
                  </th>
                  {loadState.overview.days.map((day) => (
                    <th
                      className="min-w-36 border border-[var(--line)] p-3"
                      key={day.bookingDate}
                    >
                      <p className="font-bold text-[var(--foreground)]">
                        {formatDateLabel(day.bookingDate)}
                      </p>
                      <p className="mt-1 text-xs">
                        จอง {day.activeBookingCount} / รับได้ {day.maxBookings}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadState.overview.timeSlots.map((timeSlot, timeIndex) => (
                  <tr key={timeSlot}>
                    <th className="sticky left-0 z-10 border border-[var(--line)] bg-white p-3 text-left font-bold text-[var(--foreground)]">
                      {timeSlot}
                    </th>
                    {loadState.overview.days.map((day) => (
                      <ScheduleCell
                        key={`${day.bookingDate}-${timeSlot}`}
                        slot={day.slots[timeIndex]}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
            ช่องที่ขึ้นค่าเริ่มต้นคือช่วงเวลาที่ยังไม่ได้ตั้งค่าในหน้า
            จัดการคิวรับงาน ระบบจะถือว่าเปิดรับ 1 คิวตามกติกา MVP
          </p>
        </section>
      ) : null}
    </main>
  );
}
