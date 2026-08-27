"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentProfile, type Profile } from "@/features/auth";
import { getCurrentUserBookingById, type MyBooking } from "@/features/bookings";
import { createClient } from "@/lib/supabase/browser";
import { BookingReceiptDocument } from "./booking-receipt-document";

type LoadState =
  | { status: "loading"; booking: null; profile: null; error: null }
  | { status: "signed-out"; booking: null; profile: null; error: null }
  | { status: "not-found"; booking: null; profile: null; error: null }
  | { status: "ready"; booking: MyBooking; profile: Profile | null; error: null }
  | { status: "error"; booking: null; profile: null; error: string };

export function CustomerBookingReceiptPanel({
  bookingId,
}: {
  bookingId: string;
}) {
  const [loadState, setLoadState] = useState<LoadState>({
    booking: null,
    error: null,
    profile: null,
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
          booking: null,
          error: null,
          profile: null,
          status: "signed-out",
        });
        return;
      }

      const [bookingResult, profileResult] = await Promise.all([
        getCurrentUserBookingById(supabase, user.id, bookingId),
        getCurrentProfile(supabase, user.id),
      ]);

      if (!isMounted) {
        return;
      }

      if (bookingResult.error) {
        setLoadState({
          booking: null,
          error: bookingResult.error.message,
          profile: null,
          status: "error",
        });
        return;
      }

      if (!bookingResult.data) {
        setLoadState({
          booking: null,
          error: null,
          profile: null,
          status: "not-found",
        });
        return;
      }

      setLoadState({
        booking: bookingResult.data,
        error: null,
        profile: profileResult.data ?? null,
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
          <p className="font-semibold">ต้องเข้าสู่ระบบก่อนดูเอกสารการจอง</p>
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

  if (loadState.status === "not-found") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)] shadow-sm">
          <p className="font-semibold text-[var(--foreground)]">
            ไม่พบเอกสารของการจองนี้
          </p>
          <Link
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
            href="/my-bookings"
          >
            กลับไปการจองของฉัน
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
      backHref={`/my-bookings/${loadState.booking.id}`}
      booking={{
        ...loadState.booking,
        customer: loadState.profile,
      }}
    />
  );
}
