"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  createAdminGarageCapacity,
  getAdminGarageCapacity,
  updateAdminGarageCapacity,
  type AdminAccessResult,
  type AdminGarageCapacity,
  type AdminGarageCapacityInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; capacity: null; error: null }
  | { status: "signed-out"; access: null; capacity: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      capacity: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      capacity: AdminGarageCapacity[];
      error: null;
    }
  | { status: "error"; access: null; capacity: null; error: string };

type ActionState =
  | { status: "idle"; capacityId: null; error: null; message: null }
  | { status: "saving"; capacityId: string; error: null; message: null }
  | { status: "error"; capacityId: string; error: string; message: null }
  | { status: "saved"; capacityId: string; error: null; message: string };

type CreateState =
  | { status: "idle"; error: null; message: null }
  | { status: "creating"; error: null; message: null }
  | { status: "error"; error: string; message: null }
  | { status: "created"; error: null; message: string };

type StatusFilter = "all" | AdminGarageCapacity["status"];

const bookingStartTime = "09:00";
const bookingEndTime = "18:00";
const bookingSlotIntervalMinutes = 30;
const statusFilters: StatusFilter[] = ["all", "open", "closed"];

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const remainingMinutes = String(minutes % 60).padStart(2, "0");

  return `${hours}:${remainingMinutes}`;
}

const bookingTimeOptions = Array.from(
  {
    length:
      Math.floor(
        (timeToMinutes(bookingEndTime) - timeToMinutes(bookingStartTime)) /
          bookingSlotIntervalMinutes,
      ) + 1,
  },
  (_, index) =>
    timeToMinutes(bookingStartTime) + index * bookingSlotIntervalMinutes,
).map(minutesToTime);

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeTime(time: string) {
  return time.slice(0, 5);
}

function getSlotKey(date: string, time: string) {
  return `${date}|${normalizeTime(time)}`;
}

function getStatusStyle(status: AdminGarageCapacity["status"]) {
  if (status === "open") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-slate-100 text-slate-700";
}

function getCapacityStatusLabel(status: AdminGarageCapacity["status"]) {
  return status === "open" ? "เปิดรับ" : "ปิดรับ";
}

function getStatusFilterLabel(status: StatusFilter) {
  if (status === "all") {
    return "ทั้งหมด";
  }

  return getCapacityStatusLabel(status);
}

function validateCapacityInput(input: AdminGarageCapacityInput) {
  if (!input.booking_date) {
    return "กรุณาเลือกวันที่";
  }

  if (!bookingTimeOptions.includes(input.booking_time)) {
    return "เวลาต้องอยู่ระหว่าง 09:00 ถึง 18:00 และแบ่งทุก 30 นาที";
  }

  if (
    !Number.isInteger(input.max_bookings) ||
    input.max_bookings < 0 ||
    input.max_bookings > 100
  ) {
    return "จำนวนคิวสูงสุดต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 100";
  }

  return null;
}

function getCapacityErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("garage_capacity_booking_slot_key")) {
    return "วันและเวลานี้มี slot อยู่แล้ว";
  }

  if (normalizedMessage.includes("garage_capacity_business_hours_check")) {
    return "slot ต้องอยู่ระหว่าง 09:00 ถึง 18:00";
  }

  if (normalizedMessage.includes("row-level security")) {
    return "ระบบฐานข้อมูลไม่อนุญาตให้แก้ไขคิว กรุณาเข้าสู่ระบบด้วยบัญชี admin แล้วลองอีกครั้ง";
  }

  return message;
}

function CapacityFormFields({
  bookingDate,
  bookingTime,
  maxBookings,
  note,
  onBookingDateChange,
  onBookingTimeChange,
  onMaxBookingsChange,
  onNoteChange,
  onStatusChange,
  status,
}: {
  bookingDate: string;
  bookingTime: string;
  maxBookings: string;
  note: string;
  onBookingDateChange: (value: string) => void;
  onBookingTimeChange: (value: string) => void;
  onMaxBookingsChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onStatusChange: (value: AdminGarageCapacity["status"]) => void;
  status: AdminGarageCapacity["status"];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[160px_140px_140px_140px_minmax(0,1fr)] lg:items-end">
      <label className="text-sm font-semibold text-[var(--foreground)]">
        วันที่
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          onChange={(event) => onBookingDateChange(event.target.value)}
          type="date"
          value={bookingDate}
        />
      </label>

      <label className="text-sm font-semibold text-[var(--foreground)]">
        เวลา
        <select
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          onChange={(event) => onBookingTimeChange(event.target.value)}
          value={bookingTime}
        >
          {bookingTimeOptions.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-semibold text-[var(--foreground)]">
        จำนวนคิวสูงสุด
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          min={0}
          onChange={(event) => onMaxBookingsChange(event.target.value)}
          type="number"
          value={maxBookings}
        />
      </label>

      <label className="text-sm font-semibold text-[var(--foreground)]">
        สถานะ
        <select
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          onChange={(event) =>
            onStatusChange(event.target.value as AdminGarageCapacity["status"])
          }
          value={status}
        >
          <option value="open">เปิดรับ</option>
          <option value="closed">ปิดรับ</option>
        </select>
      </label>

      <label className="text-sm font-semibold text-[var(--foreground)]">
        หมายเหตุ
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="หมายเหตุสำหรับผู้ดูแล"
          value={note}
        />
      </label>
    </div>
  );
}

function AddCapacityForm({
  createState,
  onCreate,
}: {
  createState: CreateState;
  onCreate: (input: AdminGarageCapacityInput) => void;
}) {
  const [bookingDate, setBookingDate] = useState(() =>
    toDateInputValue(new Date()),
  );
  const [bookingTime, setBookingTime] = useState("09:00");
  const [maxBookings, setMaxBookings] = useState("1");
  const [status, setStatus] = useState<AdminGarageCapacity["status"]>("open");
  const [note, setNote] = useState("");
  const isCreating = createState.status === "creating";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      booking_date: bookingDate,
      booking_time: bookingTime,
      max_bookings: Number(maxBookings),
      note: note.trim() || null,
      status,
    });
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="border-b border-[var(--line)] pb-4">
        <p className="text-sm font-semibold text-[var(--brand)]">เพิ่มช่วงเวลา</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          กำหนดว่าอู่รับจองได้กี่คิวในแต่ละวันและเวลา
        </p>
      </div>

      <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
        <CapacityFormFields
          bookingDate={bookingDate}
          bookingTime={bookingTime}
          maxBookings={maxBookings}
          note={note}
          onBookingDateChange={setBookingDate}
          onBookingTimeChange={setBookingTime}
          onMaxBookingsChange={setMaxBookings}
          onNoteChange={setNote}
          onStatusChange={setStatus}
          status={status}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating}
            type="submit"
          >
            {isCreating ? "กำลังเพิ่ม..." : "เพิ่มช่วงเวลา"}
          </button>

          {createState.status === "error" ? (
            <p className="text-sm text-red-700">{createState.error}</p>
          ) : null}

          {createState.status === "created" ? (
            <p className="text-sm font-semibold text-[var(--brand-strong)]">
              {createState.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function AdminCapacityRow({
  actionState,
  capacity,
  onSave,
}: {
  actionState: ActionState;
  capacity: AdminGarageCapacity;
  onSave: (capacity: AdminGarageCapacity, input: AdminGarageCapacityInput) => void;
}) {
  const [bookingDate, setBookingDate] = useState(capacity.booking_date);
  const [bookingTime, setBookingTime] = useState(
    normalizeTime(capacity.booking_time),
  );
  const [maxBookings, setMaxBookings] = useState(String(capacity.max_bookings));
  const [status, setStatus] =
    useState<AdminGarageCapacity["status"]>(capacity.status);
  const [note, setNote] = useState(capacity.note ?? "");
  const isSaving =
    actionState.status === "saving" && actionState.capacityId === capacity.id;
  const hasChanges =
    bookingDate !== capacity.booking_date ||
    bookingTime !== normalizeTime(capacity.booking_time) ||
    Number(maxBookings) !== capacity.max_bookings ||
    status !== capacity.status ||
    note.trim() !== (capacity.note ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(capacity, {
      booking_date: bookingDate,
      booking_time: bookingTime,
      max_bookings: Number(maxBookings),
      note: note.trim() || null,
      status,
    });
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                capacity.status,
              )}`}
            >
              {getCapacityStatusLabel(capacity.status)}
            </span>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              เหลือ {capacity.availableBookingCount} คิว
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            วันที่ {capacity.booking_date} เวลา {normalizeTime(capacity.booking_time)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {capacity.note ?? "-"}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-3 text-sm lg:min-w-80">
          <div className="rounded-md bg-slate-50 p-3">
            <dt className="text-xs text-[var(--muted)]">สูงสุด</dt>
            <dd className="mt-1 text-lg font-bold text-[var(--foreground)]">
              {capacity.max_bookings}
            </dd>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <dt className="text-xs text-[var(--muted)]">จองแล้ว</dt>
            <dd className="mt-1 text-lg font-bold text-[var(--foreground)]">
              {capacity.activeBookingCount}
            </dd>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <dt className="text-xs text-[var(--muted)]">เปิดรับ</dt>
            <dd className="mt-1 text-lg font-bold text-[var(--foreground)]">
              {capacity.isOpen ? "ใช่" : "ไม่ใช่"}
            </dd>
          </div>
        </dl>
      </div>

      <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
        <CapacityFormFields
          bookingDate={bookingDate}
          bookingTime={bookingTime}
          maxBookings={maxBookings}
          note={note}
          onBookingDateChange={setBookingDate}
          onBookingTimeChange={setBookingTime}
          onMaxBookingsChange={setMaxBookings}
          onNoteChange={setNote}
          onStatusChange={setStatus}
          status={status}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!hasChanges || isSaving}
            type="submit"
          >
            {isSaving ? "กำลังบันทึก..." : "บันทึกช่วงเวลา"}
          </button>

          {actionState.status === "error" &&
          actionState.capacityId === capacity.id ? (
            <p className="text-sm text-red-700">{actionState.error}</p>
          ) : null}

          {actionState.status === "saved" &&
          actionState.capacityId === capacity.id ? (
            <p className="text-sm font-semibold text-[var(--brand-strong)]">
              {actionState.message}
            </p>
          ) : null}
        </div>
      </form>
    </article>
  );
}

export function AdminCapacityPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    capacity: null,
    error: null,
    status: "loading",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [actionState, setActionState] = useState<ActionState>({
    capacityId: null,
    error: null,
    message: null,
    status: "idle",
  });
  const [createState, setCreateState] = useState<CreateState>({
    error: null,
    message: null,
    status: "idle",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadCapacity() {
      setLoadState({
        access: null,
        capacity: null,
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
          access: null,
          capacity: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          capacity: null,
          error: null,
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
          capacity: null,
          error: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminGarageCapacity(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          capacity: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        capacity: data ?? [],
        error: null,
        status: "ready",
      });
    }

    loadCapacity();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadCapacity();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredCapacity = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    return loadState.capacity.filter((capacity) => {
      const matchesStatus =
        statusFilter === "all" || capacity.status === statusFilter;
      const matchesDate = !dateFilter || capacity.booking_date === dateFilter;

      return matchesStatus && matchesDate;
    });
  }, [dateFilter, loadState, statusFilter]);

  async function reloadCapacity() {
    if (loadState.status !== "ready") {
      return;
    }

    const supabase = createClient();
    const { data, error } = await getAdminGarageCapacity(supabase);

    if (error) {
      setLoadState({
        access: null,
        capacity: null,
        error: error.message,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      capacity: data ?? [],
    });
  }

  function validateUniqueSlot(
    input: AdminGarageCapacityInput,
    ignoredCapacityId?: string,
  ) {
    if (loadState.status !== "ready") {
      return null;
    }

    const slotKey = getSlotKey(input.booking_date, input.booking_time);
    const duplicate = loadState.capacity.find(
      (capacity) =>
        capacity.id !== ignoredCapacityId &&
        getSlotKey(capacity.booking_date, capacity.booking_time) === slotKey,
    );

    return duplicate ? "วันและเวลานี้มี slot อยู่แล้ว" : null;
  }

  async function handleCreateCapacity(input: AdminGarageCapacityInput) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError =
      validateCapacityInput(input) ?? validateUniqueSlot(input);

    if (validationError) {
      setCreateState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    setCreateState({
      error: null,
      message: null,
      status: "creating",
    });

    const supabase = createClient();
    const { error } = await createAdminGarageCapacity(supabase, input);

    if (error) {
      setCreateState({
        error: getCapacityErrorMessage(error.message),
        message: null,
        status: "error",
      });
      return;
    }

    await reloadCapacity();
    setCreateState({
      error: null,
      message: "เพิ่มช่วงเวลารับจองแล้ว",
      status: "created",
    });
  }

  async function handleSaveCapacity(
    capacity: AdminGarageCapacity,
    input: AdminGarageCapacityInput,
  ) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError =
      validateCapacityInput(input) ?? validateUniqueSlot(input, capacity.id);

    if (validationError) {
      setActionState({
        capacityId: capacity.id,
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    if (input.max_bookings < capacity.activeBookingCount) {
      setActionState({
        capacityId: capacity.id,
        error: "จำนวนคิวสูงสุดต้องไม่น้อยกว่าจำนวนคิวที่มีการจองอยู่แล้ว",
        message: null,
        status: "error",
      });
      return;
    }

    setActionState({
      capacityId: capacity.id,
      error: null,
      message: null,
      status: "saving",
    });

    const supabase = createClient();
    const { error } = await updateAdminGarageCapacity(
      supabase,
      capacity.id,
      input,
    );

    if (error) {
      setActionState({
        capacityId: capacity.id,
        error: getCapacityErrorMessage(error.message),
        message: null,
        status: "error",
      });
      return;
    }

    await reloadCapacity();
    setActionState({
      capacityId: capacity.id,
      error: null,
      message: "บันทึกช่วงเวลารับจองแล้ว",
      status: "saved",
    });
  }

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
              จัดการคิวรับงาน
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ตั้งค่าจำนวนคิวที่อู่รับได้ในแต่ละวันและเวลา
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            กลับหน้า admin
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดช่วงเวลารับจอง...
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
            {getCapacityErrorMessage(loadState.error)}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          <AddCapacityForm
            createState={createState}
            key={loadState.capacity.length}
            onCreate={handleCreateCapacity}
          />

          <div className="mt-5 flex flex-col gap-4 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                แสดง {filteredCapacity.length} จาก {loadState.capacity.length} ช่วงเวลา
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                จำนวนที่จองแล้วนับจาก booking สถานะ pending และ confirmed
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
              <input
                className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] sm:w-48"
                onChange={(event) => setDateFilter(event.target.value)}
                type="date"
                value={dateFilter}
              />
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                {statusFilters.map((status) => (
                  <button
                    className={
                      statusFilter === status
                        ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                        : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                    }
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    type="button"
                  >
                    {getStatusFilterLabel(status)}
                  </button>
                ))}
              </div>
              {dateFilter ? (
                <button
                  className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                  onClick={() => setDateFilter("")}
                  type="button"
                >
                  ล้างวันที่
                </button>
              ) : null}
            </div>
          </div>

          {filteredCapacity.length > 0 ? (
            <div className="mt-5 space-y-4">
              {filteredCapacity.map((capacity) => (
                <AdminCapacityRow
                  actionState={actionState}
                  capacity={capacity}
                  key={capacity.id}
                  onSave={handleSaveCapacity}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบช่วงเวลารับจองตามตัวกรองปัจจุบัน
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
