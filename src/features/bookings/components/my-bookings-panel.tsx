"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { getCurrentUserBookings, type MyBooking } from "@/features/bookings";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; bookings: null; error: null }
  | { status: "signed-out"; bookings: null; error: null }
  | { status: "ready"; bookings: MyBooking[]; error: null }
  | { status: "error"; bookings: null; error: string };

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} นาที`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} ชม. ${remainingMinutes} นาที`
    : `${hours} ชม.`;
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

  return "bg-[var(--surface-muted)] text-[var(--foreground)]";
}

function formatBookingStatus(status: MyBooking["status"]) {
  if (status === "pending") {
    return "รอยืนยัน";
  }

  if (status === "confirmed") {
    return "ยืนยันแล้ว";
  }

  if (status === "cancelled") {
    return "ยกเลิก";
  }

  if (status === "completed") {
    return "เสร็จสิ้น";
  }

  return status;
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

function formatRepairJobStatus(status: NonNullable<MyBooking["repairJob"]>["status"]) {
  if (status === "pending") {
    return "รอดำเนินการ";
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

  if (status === "cancelled") {
    return "ยกเลิก";
  }

  return status;
}

function getBookingPaymentStatusStyle(status: MyBooking["payment_status"]) {
  if (status === "paid") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  if (status === "pending_review") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "rejected") {
    return "bg-red-50 text-red-700";
  }

  if (status === "awaiting_payment") {
    return "bg-amber-50 text-amber-800";
  }

  return "bg-[var(--surface-muted)] text-[var(--foreground)]";
}

function formatBookingPaymentStatus(status: MyBooking["payment_status"]) {
  if (status === "awaiting_payment") {
    return "รอชำระเงิน";
  }

  if (status === "pending_review") {
    return "ส่งสลิปแล้ว รอตรวจ";
  }

  if (status === "paid") {
    return "ชำระเงินแล้ว";
  }

  if (status === "rejected") {
    return "สลิปไม่ผ่าน กรุณาส่งใหม่";
  }

  return "ยังไม่ต้องชำระเงิน";
}

function formatTime(time: string) {
  return time.slice(0, 5);
}

function BookingCard({ booking }: { booking: MyBooking }) {
  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--brand)]">
            {booking.service?.name ?? "ไม่พบบริการ"}
          </p>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {booking.booking_date} เวลา {formatTime(booking.booking_time)}
          </h2>
        </div>
        <span
          className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
            booking.status,
          )}`}
        >
          {formatBookingStatus(booking.status)}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--muted)]">ทะเบียนรถ</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.vehicle?.license_plate ?? "-"}
          </dd>
          {booking.vehicle ? (
            <Link
              className="mt-2 inline-block text-xs font-semibold text-[var(--brand)]"
              href="/my-vehicles"
            >
              แก้ไขข้อมูลรถ
            </Link>
          ) : null}
        </div>
        <div>
          <dt className="text-[var(--muted)]">ราคาเริ่มต้น</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.service
              ? currencyFormatter.format(booking.service.base_price)
              : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">เวลาประมาณ</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.service
              ? formatDuration(booking.service.estimated_duration_minutes)
              : "-"}
          </dd>
        </div>
      </dl>

      {booking.note ? (
        <div className="mt-4 rounded-md bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--muted)]">
          {booking.note}
        </div>
      ) : null}

      <section className="mt-4 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-[var(--foreground)]">
            ความคืบหน้างานซ่อม
          </p>
          {booking.repairJob ? (
            <span
              className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getRepairJobStatusStyle(
                booking.repairJob.status,
              )}`}
            >
              {formatRepairJobStatus(booking.repairJob.status)}
            </span>
          ) : (
            <span className="w-fit rounded-md bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]">
              ยังไม่ได้สร้างงานซ่อม
            </span>
          )}
        </div>
        <p className="mt-2 text-[var(--muted)]">
          ช่างผู้รับผิดชอบ: {booking.repairJob?.mechanic?.full_name ?? "-"}
        </p>
      </section>

      {booking.payment_status !== "not_required" ? (
        <section className="mt-4 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-3 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold text-[var(--foreground)]">
              การชำระเงิน
              {booking.payment_amount != null
                ? ` · ${currencyFormatter.format(booking.payment_amount)}`
                : ""}
            </p>
            <span
              className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getBookingPaymentStatusStyle(
                booking.payment_status,
              )}`}
            >
              {formatBookingPaymentStatus(booking.payment_status)}
            </span>
          </div>
          {booking.payment_status === "awaiting_payment" ||
          booking.payment_status === "rejected" ? (
            <Link
              className="mt-2 inline-block text-xs font-semibold text-[var(--brand)]"
              href={`/my-bookings/${booking.id}#payment`}
            >
              ไปชำระเงิน
            </Link>
          ) : null}
        </section>
      ) : null}

      <p className="mt-4 break-all text-xs text-[var(--muted)]">
        รหัสการจอง: {booking.id}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="inline-flex min-h-10 items-center rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
          href={`/my-bookings/${booking.id}`}
        >
          ดูรายละเอียด
        </Link>
        <Link
          className="inline-flex min-h-10 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
          href={`/my-bookings/${booking.id}/receipt`}
        >
          เอกสารการจอง
        </Link>
      </div>
    </article>
  );
}

export function MyBookingsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    bookings: null,
    error: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadBookings() {
      setLoadState({
        bookings: null,
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
          bookings: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          bookings: null,
          error: null,
          status: "signed-out",
        });
        return;
      }

      const { data, error } = await getCurrentUserBookings(
        supabase,
        session.user.id,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          bookings: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        bookings: data ?? [],
        error: null,
        status: "ready",
      });
    }

    loadBookings();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadBookings();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              การจองของฉัน
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ดูรายการจอง สถานะบริการ และเอกสารการจองของบัญชีที่เข้าสู่ระบบอยู่
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
            href="/services"
          >
            จองบริการใหม่
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดรายการจอง...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อน</p>
            <p className="mt-1">เข้าสู่ระบบก่อนดูรายการจองของคุณ</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่หน้าบัญชี
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

      {loadState.status === "ready" ? (
        <section className="py-6">
          {loadState.bookings.length > 0 ? (
            <div className="space-y-4">
              {loadState.bookings.map((booking) => (
                <BookingCard booking={booking} key={booking.id} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
              ยังไม่มีรายการจอง เริ่มจากเลือกบริการที่ต้องการจองก่อน
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
