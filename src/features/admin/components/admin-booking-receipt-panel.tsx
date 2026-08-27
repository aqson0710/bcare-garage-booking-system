"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  checkAdminAccess,
  getAdminBookingById,
  getAdminRepairJobByBookingId,
  type AdminAccessResult,
  type AdminBooking,
  type AdminRepairJob,
} from "@/features/admin";
import { BookingReceiptDocument } from "@/features/bookings/components/booking-receipt-document";
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

export function AdminBookingReceiptPanel({ bookingId }: { bookingId: string }) {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    booking: null,
    error: null,
    repairJob: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadReceipt() {
      const supabase = createClient();
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;

      if (!isMounted) {
        return;
      }

      if (!user) {
        setLoadState({
          access: null,
          booking: null,
          error: null,
          repairJob: null,
          status: "signed-out",
        });
        return;
      }

      const access = await checkAdminAccess(supabase, user.id);

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

      const [bookingResult, repairJobResult] = await Promise.all([
        getAdminBookingById(supabase, bookingId),
        getAdminRepairJobByBookingId(supabase, bookingId),
      ]);

      if (!isMounted) {
        return;
      }

      if (bookingResult.error) {
        setLoadState({
          access: null,
          booking: null,
          error: bookingResult.error.message,
          repairJob: null,
          status: "error",
        });
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

      if (!bookingResult.data) {
        setLoadState({
          access,
          booking: null,
          error: null,
          repairJob: null,
          status: "not-found",
        });
        return;
      }

      setLoadState({
        access,
        booking: bookingResult.data,
        error: null,
        repairJob: repairJobResult.data,
        status: "ready",
      });
    }

    void loadReceipt();

    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  if (loadState.status === "loading") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)] shadow-sm">
          กำลังโหลดเอกสารการจอง...
        </div>
      </main>
    );
  }

  if (loadState.status === "signed-out") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
          <p className="font-semibold">
            กรุณาเข้าสู่ระบบด้วยบัญชี admin ก่อนดูเอกสารการจอง
          </p>
          <Link
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
            href="/auth"
          >
            ไปที่หน้าบัญชี
          </Link>
        </div>
      </main>
    );
  }

  if (loadState.status === "access-denied") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
          <p className="font-semibold">ไม่มีสิทธิ์ดูเอกสาร admin</p>
          <p className="mt-1">{loadState.access.reason}</p>
        </div>
      </main>
    );
  }

  if (loadState.status === "not-found") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)] shadow-sm">
          <p className="font-semibold text-[var(--foreground)]">
            ไม่พบเอกสารของการจองนี้
          </p>
          <Link
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
            href="/admin/bookings"
          >
            กลับไป booking admin
          </Link>
        </div>
      </main>
    );
  }

  if (loadState.status === "error") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700 shadow-sm">
          {loadState.error}
        </div>
      </main>
    );
  }

  return (
    <BookingReceiptDocument
      backHref={`/admin/bookings/${loadState.booking.id}`}
      booking={{
        ...loadState.booking,
        repairJob: loadState.repairJob,
      }}
    />
  );
}
