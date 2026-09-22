"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  createAdminGarageClosedDate,
  deleteAdminGarageClosedDate,
  getAdminGarageOperatingSettings,
  updateAdminGarageOperatingDay,
  type AdminAccessResult,
  type AdminGarageClosedDate,
  type AdminGarageClosedDateInput,
  type AdminGarageOperatingDay,
  type AdminGarageOperatingDayInput,
  type AdminGarageOperatingSettings,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; settings: null; error: null }
  | { status: "signed-out"; access: null; settings: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      settings: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      settings: AdminGarageOperatingSettings;
      error: null;
    }
  | { status: "error"; access: null; settings: null; error: string };

type DayActionState =
  | { status: "idle"; weekday: null; error: null; message: null }
  | { status: "saving"; weekday: number; error: null; message: null }
  | { status: "error"; weekday: number; error: string; message: null }
  | { status: "saved"; weekday: number; error: null; message: string };

type ClosedDateActionState =
  | { status: "idle"; closedDate: null; error: null; message: null }
  | { status: "saving"; closedDate: string; error: null; message: null }
  | { status: "error"; closedDate: string; error: string; message: null }
  | { status: "saved"; closedDate: string; error: null; message: string };

type CreateClosedDateState =
  | { status: "idle"; error: null; message: null }
  | { status: "creating"; error: null; message: null }
  | { status: "error"; error: string; message: null }
  | { status: "created"; error: null; message: string };

const weekdayLabels = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
];

function normalizeTime(time: string) {
  return time.slice(0, 5);
}

function getOperatingErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("garage_operating_days") ||
    normalizedMessage.includes("garage_closed_dates")
  ) {
    return "ยังไม่ได้รัน SQL สำหรับ Step 10 Part 5.1 กรุณารันไฟล์ supabase/garage-operating-days.sql ใน Supabase ก่อน";
  }

  if (normalizedMessage.includes("row-level security")) {
    return "ระบบฐานข้อมูลไม่อนุญาตให้แก้ไขข้อมูลนี้ กรุณาเข้าสู่ระบบด้วยบัญชี admin แล้วลองอีกครั้ง";
  }

  if (normalizedMessage.includes("duplicate")) {
    return "วันที่นี้ถูกเพิ่มเป็นวันหยุดพิเศษแล้ว";
  }

  return message;
}

function validateOperatingDay(input: AdminGarageOperatingDayInput) {
  if (!input.is_open) {
    return null;
  }

  if (!input.open_time || !input.close_time) {
    return "กรุณากำหนดเวลาเปิดและเวลาปิด";
  }

  if (input.open_time >= input.close_time) {
    return "เวลาเปิดต้องมาก่อนเวลาปิด";
  }

  return null;
}

function OperatingDayRow({
  actionState,
  operatingDay,
  onSave,
}: {
  actionState: DayActionState;
  operatingDay: AdminGarageOperatingDay;
  onSave: (
    operatingDay: AdminGarageOperatingDay,
    input: AdminGarageOperatingDayInput,
  ) => void;
}) {
  const [isOpen, setIsOpen] = useState(operatingDay.is_open);
  const [openTime, setOpenTime] = useState(normalizeTime(operatingDay.open_time));
  const [closeTime, setCloseTime] = useState(
    normalizeTime(operatingDay.close_time),
  );
  const [note, setNote] = useState(operatingDay.note ?? "");
  const isSaving =
    actionState.status === "saving" && actionState.weekday === operatingDay.weekday;
  const hasChanges =
    isOpen !== operatingDay.is_open ||
    openTime !== normalizeTime(operatingDay.open_time) ||
    closeTime !== normalizeTime(operatingDay.close_time) ||
    note.trim() !== (operatingDay.note ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(operatingDay, {
      close_time: closeTime,
      is_open: isOpen,
      note: note.trim() || null,
      open_time: openTime,
    });
  }

  return (
    <form
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 lg:grid-cols-[150px_110px_140px_140px_minmax(0,1fr)_110px] lg:items-end">
        <div>
          <p className="text-sm font-bold text-[var(--foreground)]">
            {weekdayLabels[operatingDay.weekday]}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {isOpen ? "เปิดรับจอง" : "ปิดทั้งวัน"}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <input
            checked={isOpen}
            className="h-4 w-4 accent-[var(--brand)]"
            onChange={(event) => setIsOpen(event.target.checked)}
            type="checkbox"
          />
          เปิดร้าน
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          เวลาเปิด
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] disabled:bg-[var(--surface-muted)]"
            disabled={!isOpen}
            onChange={(event) => setOpenTime(event.target.value)}
            type="time"
            value={openTime}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          เวลาปิด
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] disabled:bg-[var(--surface-muted)]"
            disabled={!isOpen}
            onChange={(event) => setCloseTime(event.target.value)}
            type="time"
            value={closeTime}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          หมายเหตุ
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setNote(event.target.value)}
            placeholder="เช่น ปิดประจำสัปดาห์"
            value={note}
          />
        </label>

        <button
          className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!hasChanges || isSaving}
          type="submit"
        >
          {isSaving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>

      {actionState.status === "error" &&
      actionState.weekday === operatingDay.weekday ? (
        <p className="mt-3 text-sm text-[var(--danger)]">{actionState.error}</p>
      ) : null}

      {actionState.status === "saved" &&
      actionState.weekday === operatingDay.weekday ? (
        <p className="mt-3 text-sm font-semibold text-emerald-400">
          {actionState.message}
        </p>
      ) : null}
    </form>
  );
}

function AddClosedDateForm({
  createState,
  onCreate,
}: {
  createState: CreateClosedDateState;
  onCreate: (input: AdminGarageClosedDateInput) => void;
}) {
  const [closedDate, setClosedDate] = useState("");
  const [reason, setReason] = useState("");
  const isCreating = createState.status === "creating";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      closed_date: closedDate,
      reason: reason.trim() || null,
    });
  }

  return (
    <form
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_120px] lg:items-end">
        <label className="text-sm font-semibold text-[var(--foreground)]">
          วันที่ปิดพิเศษ
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setClosedDate(event.target.value)}
            required
            type="date"
            value={closedDate}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          เหตุผล
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setReason(event.target.value)}
            placeholder="เช่น วันหยุดนักขัตฤกษ์"
            value={reason}
          />
        </label>

        <button
          className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isCreating}
          type="submit"
        >
          {isCreating ? "กำลังเพิ่ม..." : "เพิ่มวันหยุด"}
        </button>
      </div>

      {createState.status === "error" ? (
        <p className="mt-3 text-sm text-[var(--danger)]">{createState.error}</p>
      ) : null}

      {createState.status === "created" ? (
        <p className="mt-3 text-sm font-semibold text-emerald-400">
          {createState.message}
        </p>
      ) : null}
    </form>
  );
}

function ClosedDateRow({
  actionState,
  closedDate,
  onDelete,
}: {
  actionState: ClosedDateActionState;
  closedDate: AdminGarageClosedDate;
  onDelete: (closedDate: AdminGarageClosedDate) => void;
}) {
  const isDeleting =
    actionState.status === "saving" &&
    actionState.closedDate === closedDate.closed_date;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold text-[var(--foreground)]">
          {closedDate.closed_date}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {closedDate.reason ?? "วันหยุดพิเศษ"}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        <button
          className="min-h-10 rounded-md border border-red-200 bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isDeleting}
          onClick={() => onDelete(closedDate)}
          type="button"
        >
          {isDeleting ? "กำลังลบ..." : "ลบ"}
        </button>

        {actionState.status === "error" &&
        actionState.closedDate === closedDate.closed_date ? (
          <p className="text-sm text-[var(--danger)]">{actionState.error}</p>
        ) : null}
      </div>
    </article>
  );
}

export function AdminOperatingDaysPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    settings: null,
    status: "loading",
  });
  const [dayActionState, setDayActionState] = useState<DayActionState>({
    error: null,
    message: null,
    status: "idle",
    weekday: null,
  });
  const [closedDateActionState, setClosedDateActionState] =
    useState<ClosedDateActionState>({
      closedDate: null,
      error: null,
      message: null,
      status: "idle",
    });
  const [createClosedDateState, setCreateClosedDateState] =
    useState<CreateClosedDateState>({
      error: null,
      message: null,
      status: "idle",
    });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadSettings() {
      setLoadState({
        access: null,
        error: null,
        settings: null,
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
          settings: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          error: null,
          settings: null,
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
          settings: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminGarageOperatingSettings(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          error: getOperatingErrorMessage(error.message),
          settings: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        error: null,
        settings: data,
        status: "ready",
      });
    }

    loadSettings();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSettings();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function reloadSettings() {
    if (loadState.status !== "ready") {
      return;
    }

    const supabase = createClient();
    const { data, error } = await getAdminGarageOperatingSettings(supabase);

    if (error) {
      setLoadState({
        access: null,
        error: getOperatingErrorMessage(error.message),
        settings: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      settings: data,
    });
  }

  async function handleSaveOperatingDay(
    operatingDay: AdminGarageOperatingDay,
    input: AdminGarageOperatingDayInput,
  ) {
    const validationError = validateOperatingDay(input);

    if (validationError) {
      setDayActionState({
        error: validationError,
        message: null,
        status: "error",
        weekday: operatingDay.weekday,
      });
      return;
    }

    setDayActionState({
      error: null,
      message: null,
      status: "saving",
      weekday: operatingDay.weekday,
    });

    const supabase = createClient();
    const { error } = await updateAdminGarageOperatingDay(
      supabase,
      operatingDay.weekday,
      input,
    );

    if (error) {
      setDayActionState({
        error: getOperatingErrorMessage(error.message),
        message: null,
        status: "error",
        weekday: operatingDay.weekday,
      });
      return;
    }

    await reloadSettings();
    setDayActionState({
      error: null,
      message: "บันทึกวันเปิดร้านแล้ว",
      status: "saved",
      weekday: operatingDay.weekday,
    });
  }

  async function handleCreateClosedDate(input: AdminGarageClosedDateInput) {
    if (!input.closed_date) {
      setCreateClosedDateState({
        error: "กรุณาเลือกวันที่ปิดพิเศษ",
        message: null,
        status: "error",
      });
      return;
    }

    setCreateClosedDateState({
      error: null,
      message: null,
      status: "creating",
    });

    const supabase = createClient();
    const { error } = await createAdminGarageClosedDate(supabase, input);

    if (error) {
      setCreateClosedDateState({
        error: getOperatingErrorMessage(error.message),
        message: null,
        status: "error",
      });
      return;
    }

    await reloadSettings();
    setCreateClosedDateState({
      error: null,
      message: "เพิ่มวันหยุดพิเศษแล้ว",
      status: "created",
    });
  }

  async function handleDeleteClosedDate(closedDate: AdminGarageClosedDate) {
    setClosedDateActionState({
      closedDate: closedDate.closed_date,
      error: null,
      message: null,
      status: "saving",
    });

    const supabase = createClient();
    const { error } = await deleteAdminGarageClosedDate(
      supabase,
      closedDate.closed_date,
    );

    if (error) {
      setClosedDateActionState({
        closedDate: closedDate.closed_date,
        error: getOperatingErrorMessage(error.message),
        message: null,
        status: "error",
      });
      return;
    }

    await reloadSettings();
    setClosedDateActionState({
      closedDate: closedDate.closed_date,
      error: null,
      message: "ลบวันหยุดพิเศษแล้ว",
      status: "saved",
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
              ตั้งค่าวันเปิดร้าน
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              กำหนดวันเปิด-ปิดประจำสัปดาห์ และเพิ่มวันหยุดพิเศษที่ไม่ต้องการให้ลูกค้าจองคิว
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin/schedule"
            >
              ดูตารางคิว
            </Link>
            <Link
              className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin/capacity"
            >
              จัดการคิวรับงาน
            </Link>
          </div>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดวันเปิดร้าน...
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
          <div className="max-w-xl rounded-lg border border-red-200 bg-[var(--surface)] px-5 py-4 text-sm leading-6 text-[var(--danger)] shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="grid gap-6 py-6">
          <div>
            <div className="border-b border-[var(--line)] pb-3">
              <h2 className="text-xl font-bold text-[var(--foreground)]">
                วันเปิด-ปิดประจำสัปดาห์
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                วันที่ปิดทั้งวันจะไม่แสดงเวลาให้ลูกค้าเลือก และฐานข้อมูลจะกันไม่ให้สร้างการจองในวันนั้น
              </p>
            </div>

            {loadState.settings.operatingDays.length === 0 ? (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
                ยังไม่มีข้อมูลวันเปิดร้าน กรุณารัน SQL ของ Step 10 Part 5.1 ก่อน
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {loadState.settings.operatingDays.map((operatingDay) => (
                  <OperatingDayRow
                    actionState={dayActionState}
                    key={operatingDay.weekday}
                    onSave={handleSaveOperatingDay}
                    operatingDay={operatingDay}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="border-b border-[var(--line)] pb-3">
              <h2 className="text-xl font-bold text-[var(--foreground)]">
                วันหยุดพิเศษ
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                ใช้สำหรับวันที่ร้านปิดเฉพาะครั้ง เช่น วันหยุดยาวหรือวันที่ช่างไม่พร้อมรับงาน
              </p>
            </div>

            <div className="mt-4">
              <AddClosedDateForm
                createState={createClosedDateState}
                key={loadState.settings.closedDates.length}
                onCreate={handleCreateClosedDate}
              />
            </div>

            {loadState.settings.closedDates.length > 0 ? (
              <div className="mt-4 space-y-3">
                {loadState.settings.closedDates.map((closedDate) => (
                  <ClosedDateRow
                    actionState={closedDateActionState}
                    closedDate={closedDate}
                    key={closedDate.closed_date}
                    onDelete={handleDeleteClosedDate}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
                ยังไม่มีวันหยุดพิเศษ
              </div>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
