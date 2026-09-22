"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { FormEvent, ReactNode, SyntheticEvent } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  cancelCurrentUserBooking,
  confirmBookingPickup,
  getCurrentUserBookingById,
  submitBookingPaymentSlip,
  type BookingPayment,
  type MyBooking,
} from "@/features/bookings";
import {
  getActivePaymentSetting,
  type PaymentSetting,
} from "@/features/products";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | {
      status: "loading";
      booking: null;
      error: null;
      userId: null;
      paymentSetting: null;
    }
  | {
      status: "signed-out";
      booking: null;
      error: null;
      userId: null;
      paymentSetting: null;
    }
  | {
      status: "not-found";
      booking: null;
      error: null;
      userId: string;
      paymentSetting: null;
    }
  | {
      status: "ready";
      booking: MyBooking;
      error: null;
      userId: string;
      paymentSetting: PaymentSetting | null;
    }
  | {
      status: "error";
      booking: null;
      error: string;
      userId: null;
      paymentSetting: null;
    };

type CancelState =
  | { status: "idle"; error: null }
  | { status: "cancelling"; error: null }
  | { status: "error"; error: string };

type PaymentSubmitState =
  | { status: "idle"; error: null }
  | { status: "submitting"; error: null }
  | { status: "verifying"; error: null }
  | { status: "success"; error: null }
  | { status: "error"; error: string };

type PickupState =
  | { status: "idle"; error: null }
  | { status: "confirming"; error: null }
  | { status: "error"; error: string };

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

function formatTime(time: string) {
  return time.slice(0, 5);
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
    return "ยกเลิกแล้ว";
  }

  return "เสร็จสิ้น";
}

function formatRepairJobStatus(
  status: NonNullable<MyBooking["repairJob"]>["status"],
) {
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
    return "ซ่อมเสร็จแล้ว";
  }

  return "ยกเลิก";
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

function getCancelButtonLabel(
  bookingStatus: MyBooking["status"],
  cancelStatus: CancelState["status"],
) {
  if (cancelStatus === "cancelling") {
    return "กำลังยกเลิก...";
  }

  if (bookingStatus === "cancelled") {
    return "ยกเลิกแล้ว";
  }

  if (bookingStatus === "pending") {
    return "ยกเลิกการจอง";
  }

  return "ยกเลิกไม่ได้";
}

function getCancelButtonClass(bookingStatus: MyBooking["status"]) {
  if (bookingStatus === "pending") {
    return "min-h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60";
  }

  return "min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed";
}

function handleQrImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;

  if (image.src.endsWith("/mock-promptpay-qr.svg")) {
    return;
  }

  image.src = "/mock-promptpay-qr.svg";
  image.alt = "Fallback PromptPay QR code";
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-semibold text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function formatNullableDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("th-TH");
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
    return "bg-cyan-50 text-cyan-800";
  }

  return "bg-[var(--surface-muted)] text-[var(--foreground)]";
}

export function BookingDetailPanel({ bookingId }: { bookingId: string }) {
  const [loadState, setLoadState] = useState<LoadState>({
    booking: null,
    error: null,
    paymentSetting: null,
    status: "loading",
    userId: null,
  });
  const [cancelState, setCancelState] = useState<CancelState>({
    error: null,
    status: "idle",
  });
  const [paymentMethod, setPaymentMethod] = useState<
    "promptpay" | "bank_transfer"
  >("promptpay");
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentSubmitState, setPaymentSubmitState] =
    useState<PaymentSubmitState>({
      error: null,
      status: "idle",
    });
  const [pickupState, setPickupState] = useState<PickupState>({
    error: null,
    status: "idle",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadBooking() {
      setLoadState({
        booking: null,
        error: null,
        paymentSetting: null,
        status: "loading",
        userId: null,
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
          booking: null,
          error: sessionError.message,
          paymentSetting: null,
          status: "error",
          userId: null,
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          booking: null,
          error: null,
          paymentSetting: null,
          status: "signed-out",
          userId: null,
        });
        return;
      }

      const [bookingResult, paymentSettingResult] = await Promise.all([
        getCurrentUserBookingById(supabase, session.user.id, bookingId),
        getActivePaymentSetting(supabase),
      ]);
      const { data, error } = bookingResult;

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          booking: null,
          error: error.message,
          paymentSetting: null,
          status: "error",
          userId: null,
        });
        return;
      }

      if (!data) {
        setLoadState({
          booking: null,
          error: null,
          paymentSetting: null,
          status: "not-found",
          userId: session.user.id,
        });
        return;
      }

      setLoadState({
        booking: data,
        error: null,
        paymentSetting: paymentSettingResult.data,
        status: "ready",
        userId: session.user.id,
      });
    }

    loadBooking();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadBooking();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [bookingId]);

  async function handleCancelBooking() {
    if (loadState.status !== "ready" || loadState.booking.status !== "pending") {
      return;
    }

    setCancelState({
      error: null,
      status: "cancelling",
    });

    const supabase = createClient();
    const { data, error } = await cancelCurrentUserBooking(
      supabase,
      loadState.userId,
      loadState.booking.id,
    );

    if (error) {
      setCancelState({
        error: error.message,
        status: "error",
      });
      return;
    }

    if (!data) {
      setCancelState({
        error: "ยกเลิกได้เฉพาะการจองที่ยังรอยืนยันเท่านั้น",
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      booking: {
        ...loadState.booking,
        status: data.status,
        updated_at: data.updated_at,
      },
    });
    setCancelState({
      error: null,
      status: "idle",
    });
  }

  async function handlePaymentSlipSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loadState.status !== "ready") {
      return;
    }

    if (!paymentFile) {
      setPaymentSubmitState({
        error: "กรุณาแนบรูปสลิป",
        status: "error",
      });
      return;
    }

    setPaymentSubmitState({
      error: null,
      status: "submitting",
    });

    const supabase = createClient();
    const { data, error } = await submitBookingPaymentSlip(
      supabase,
      loadState.userId,
      {
        bookingId: loadState.booking.id,
        file: paymentFile,
        paymentMethod,
      },
    );

    if (error || !data) {
      setPaymentSubmitState({
        error: error?.message ?? "ส่งสลิปไม่สำเร็จ",
        status: "error",
      });
      return;
    }

    setPaymentFile(null);
    setLoadState({
      ...loadState,
      booking: {
        ...loadState.booking,
        latestPayment: data,
        payment_status: "pending_review",
      },
    });
    setPaymentSubmitState({
      error: null,
      status: "verifying",
    });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (accessToken) {
        const verifyResponse = await fetch(
          `/api/booking-payments/${data.id}/verify-slipok`,
          {
            body: JSON.stringify({ accessToken }),
            credentials: "include",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            method: "POST",
          },
        );
        const verifyResult = (await verifyResponse
          .json()
          .catch(() => null)) as {
          booking?: { payment_status: MyBooking["payment_status"] };
          message?: string;
          ok: boolean;
          payment?: BookingPayment;
        } | null;

        if (verifyResult?.payment) {
          setLoadState((current) =>
            current.status === "ready"
              ? {
                  ...current,
                  booking: {
                    ...current.booking,
                    latestPayment: verifyResult.payment ?? null,
                    payment_status:
                      verifyResult.booking?.payment_status ??
                      current.booking.payment_status,
                  },
                }
              : current,
          );

          if (!verifyResult.ok) {
            setPaymentSubmitState({
              error:
                verifyResult.message ??
                "ระบบตรวจสลิปอัตโนมัติไม่ผ่าน กรุณาส่งสลิปใหม่",
              status: "error",
            });
            return;
          }
        }
      }
    } catch {
      // ตรวจสลิปอัตโนมัติไม่สำเร็จเพราะเครือข่าย ปล่อยให้แอดมินตรวจซ้ำได้ภายหลัง
    }

    setPaymentSubmitState({
      error: null,
      status: "success",
    });
  }

  async function handleConfirmPickup() {
    if (loadState.status !== "ready" || loadState.booking.payment_status !== "paid") {
      return;
    }

    setPickupState({
      error: null,
      status: "confirming",
    });

    const supabase = createClient();
    const { data, error } = await confirmBookingPickup(
      supabase,
      loadState.booking.id,
    );

    if (error || !data) {
      setPickupState({
        error: error?.message ?? "ยืนยันรับรถไม่สำเร็จ",
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      booking: {
        ...loadState.booking,
        picked_up_at: data.picked_up_at,
        status: data.status,
      },
    });
    setPickupState({
      error: null,
      status: "idle",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              รายละเอียดการจอง
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ตรวจสอบรายละเอียดการจอง เอกสารการจอง และยกเลิกได้เมื่อรายการยังรอยืนยัน
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/my-bookings"
          >
            กลับไปการจองของฉัน
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดการจอง...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อน</p>
            <p className="mt-1">เข้าสู่ระบบก่อนดูรายละเอียดการจองนี้</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่หน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "not-found" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 text-sm leading-6 text-[var(--muted)] shadow-sm">
            <p className="font-semibold text-[var(--foreground)]">
              ไม่พบการจอง
            </p>
            <p className="mt-1">
              การจองนี้อาจไม่มีอยู่ หรือไม่ได้เชื่อมกับบัญชีที่เข้าสู่ระบบอยู่
            </p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/my-bookings"
            >
              กลับไปการจองของฉัน
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
          <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--brand)]">
                  {loadState.booking.service?.name ?? "ไม่พบบริการ"}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                  {loadState.booking.booking_date} เวลา{" "}
                  {formatTime(loadState.booking.booking_time)}
                </h2>
              </div>
              <span
                className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                  loadState.booking.status,
                )}`}
              >
                {formatBookingStatus(loadState.booking.status)}
              </span>
            </div>

            <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-2">
              <DetailItem
                label="ทะเบียนรถ"
                value={loadState.booking.vehicle?.license_plate ?? "-"}
              />
              <DetailItem
                label="รถ"
                value={
                  loadState.booking.vehicle
                    ? `${loadState.booking.vehicle.brand ?? "-"} / ${
                        loadState.booking.vehicle.model ?? "-"
                      }`
                    : "-"
                }
              />
              <DetailItem
                label="ราคาเริ่มต้น"
                value={
                  loadState.booking.service
                    ? currencyFormatter.format(
                        loadState.booking.service.base_price,
                      )
                    : "-"
                }
              />
              <DetailItem
                label="เวลาประมาณการ"
                value={
                  loadState.booking.service
                    ? formatDuration(
                        loadState.booking.service
                          .estimated_duration_minutes,
                      )
                    : "-"
                }
              />
              <DetailItem
                label="สร้างเมื่อ"
                value={new Date(loadState.booking.created_at).toLocaleString(
                  "th-TH",
                )}
              />
              <DetailItem
                label="อัปเดตล่าสุด"
                value={new Date(loadState.booking.updated_at).toLocaleString(
                  "th-TH",
                )}
              />
            </dl>

            {loadState.booking.note ? (
              <div className="mt-5 rounded-md bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--muted)]">
                <p className="font-semibold text-[var(--foreground)]">หมายเหตุ</p>
                <p className="mt-2">{loadState.booking.note}</p>
              </div>
            ) : null}

            <p className="mt-5 break-all text-xs text-[var(--muted)]">
              รหัสการจอง: {loadState.booking.id}
            </p>

            <div className="mt-5 flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row">
              <Link
                className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                href={`/my-bookings/${loadState.booking.id}/receipt`}
              >
                เปิดเอกสารการจอง
              </Link>
              <Link
                className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
                href="/my-vehicles"
              >
                แก้ไขรถ
              </Link>
              <button
                className={getCancelButtonClass(loadState.booking.status)}
                disabled={
                  loadState.booking.status !== "pending" ||
                  cancelState.status === "cancelling"
                }
                onClick={handleCancelBooking}
                type="button"
              >
                {getCancelButtonLabel(
                  loadState.booking.status,
                  cancelState.status,
                )}
              </button>
            </div>

            {cancelState.status === "error" ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {cancelState.error}
              </div>
            ) : null}
          </article>

          <article className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--brand)]">
                  ความคืบหน้างานซ่อม
                </p>
                <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
                  {loadState.booking.repairJob
                    ? "อู่กำลังติดตามงานซ่อมรายการนี้"
                    : "ยังไม่มีใบงานซ่อม"}
                </h2>
              </div>
              {loadState.booking.repairJob ? (
                <span
                  className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getRepairJobStatusStyle(
                    loadState.booking.repairJob.status,
                  )}`}
                >
                  {formatRepairJobStatus(loadState.booking.repairJob.status)}
                </span>
              ) : (
                <span className="w-fit rounded-md bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]">
                  ยังไม่สร้าง
                </span>
              )}
            </div>

            {loadState.booking.repairJob ? (
              <>
                <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-2">
                  <DetailItem
                    label="ช่างผู้รับผิดชอบ"
                    value={
                      loadState.booking.repairJob.mechanic?.full_name ??
                      "ยังไม่ได้มอบหมาย"
                    }
                  />
                  <DetailItem
                    label="เบอร์โทรช่าง"
                    value={
                      loadState.booking.repairJob.mechanic?.phone_number ?? "-"
                    }
                  />
                  <DetailItem
                    label="เริ่มงาน"
                    value={formatNullableDateTime(
                      loadState.booking.repairJob.started_at,
                    )}
                  />
                  <DetailItem
                    label="เสร็จงาน"
                    value={formatNullableDateTime(
                      loadState.booking.repairJob.completed_at,
                    )}
                  />
                </dl>

                <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-md bg-[var(--surface-muted)] p-4">
                    <p className="font-semibold text-[var(--foreground)]">
                      ผลตรวจ/วิเคราะห์อาการ
                    </p>
                    <p className="mt-2 leading-6 text-[var(--muted)]">
                      {loadState.booking.repairJob.diagnosis || "-"}
                    </p>
                  </div>
                  <div className="rounded-md bg-[var(--surface-muted)] p-4">
                    <p className="font-semibold text-[var(--foreground)]">
                      บันทึกการซ่อม
                    </p>
                    <p className="mt-2 leading-6 text-[var(--muted)]">
                      {loadState.booking.repairJob.repair_notes || "-"}
                    </p>
                  </div>
                </div>

                <p className="mt-5 break-all text-xs text-[var(--muted)]">
                  รหัสใบงานซ่อม: {loadState.booking.repairJob.id}
                </p>
              </>
            ) : (
              <p className="mt-5 border-t border-[var(--line)] pt-4 text-sm leading-6 text-[var(--muted)]">
                อู่จะสร้างใบงานซ่อมหลังจากยืนยันการจองและเตรียมงานซ่อมเรียบร้อยแล้ว
              </p>
            )}
          </article>

          {loadState.booking.payment_status !== "not_required" ? (
            <article
              className="mt-5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm"
              id="payment"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--brand)]">
                    การชำระเงิน
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
                    {loadState.booking.payment_amount != null
                      ? currencyFormatter.format(
                          loadState.booking.payment_amount,
                        )
                      : "-"}
                  </h2>
                </div>
                <span
                  className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getBookingPaymentStatusStyle(
                    loadState.booking.payment_status,
                  )}`}
                >
                  {formatBookingPaymentStatus(loadState.booking.payment_status)}
                </span>
              </div>

              {loadState.booking.payment_status === "rejected" &&
              loadState.booking.latestPayment?.rejected_reason ? (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                  <p className="font-semibold">สลิปไม่ผ่าน</p>
                  <p className="mt-1">
                    {loadState.booking.latestPayment.rejected_reason}
                  </p>
                </div>
              ) : null}

              {loadState.booking.payment_status === "pending_review" ? (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                  ส่งสลิปแล้ว กรุณารอแอดมินตรวจสอบและยืนยันการชำระเงิน
                </div>
              ) : null}

              {loadState.booking.payment_status === "paid" ? (
                <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]">
                  แอดมินตรวจสอบและยืนยันการชำระเงินแล้ว
                </div>
              ) : null}

              {loadState.booking.payment_status === "awaiting_payment" ||
              loadState.booking.payment_status === "rejected" ? (
                <form
                  className="mt-5 grid gap-4"
                  onSubmit={handlePaymentSlipSubmit}
                >
                  <fieldset className="grid gap-3">
                    <legend className="text-sm font-semibold text-[var(--foreground)]">
                      วิธีชำระเงิน
                    </legend>
                    {loadState.paymentSetting?.promptpay_enabled !== false ? (
                      <label className="flex min-h-12 items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--foreground)]">
                        <input
                          checked={paymentMethod === "promptpay"}
                          name="paymentMethod"
                          onChange={() => setPaymentMethod("promptpay")}
                          type="radio"
                        />
                        PromptPay / QR
                      </label>
                    ) : null}
                    {loadState.paymentSetting?.bank_transfer_enabled !==
                    false ? (
                      <label className="flex min-h-12 items-center gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--foreground)]">
                        <input
                          checked={paymentMethod === "bank_transfer"}
                          name="paymentMethod"
                          onChange={() => setPaymentMethod("bank_transfer")}
                          type="radio"
                        />
                        โอนเข้าบัญชีธนาคาร
                      </label>
                    ) : null}
                  </fieldset>

                  <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-sm">
                    {paymentMethod === "promptpay" ? (
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <img
                          alt="PromptPay QR code"
                          className="h-40 w-40 rounded-md border border-[var(--line)] bg-[var(--surface)] p-2"
                          onError={handleQrImageError}
                          src={
                            loadState.paymentSetting?.promptpay_qr_image_url ??
                            "/mock-promptpay-qr.svg"
                          }
                        />
                        <dl className="grid gap-3">
                          <DetailItem
                            label="ชื่อผู้รับ"
                            value={
                              loadState.paymentSetting
                                ?.promptpay_display_name ?? "-"
                            }
                          />
                          <DetailItem
                            label="PromptPay"
                            value={
                              loadState.paymentSetting?.promptpay_id ?? "-"
                            }
                          />
                          <DetailItem
                            label="ยอดที่ต้องชำระ"
                            value={
                              loadState.booking.payment_amount != null
                                ? currencyFormatter.format(
                                    loadState.booking.payment_amount,
                                  )
                                : "-"
                            }
                          />
                        </dl>
                      </div>
                    ) : (
                      <dl className="grid gap-3">
                        <DetailItem
                          label="ธนาคาร"
                          value={loadState.paymentSetting?.bank_name ?? "-"}
                        />
                        <DetailItem
                          label="เลขบัญชี"
                          value={
                            loadState.paymentSetting?.bank_account_number ??
                            "-"
                          }
                        />
                        <DetailItem
                          label="ชื่อบัญชี"
                          value={
                            loadState.paymentSetting?.bank_account_name ?? "-"
                          }
                        />
                        <DetailItem
                          label="สาขา"
                          value={loadState.paymentSetting?.bank_branch ?? "-"}
                        />
                      </dl>
                    )}
                    {loadState.paymentSetting?.payment_instructions ? (
                      <p className="mt-3 text-xs leading-5 text-amber-400">
                        {loadState.paymentSetting.payment_instructions}
                      </p>
                    ) : null}
                  </div>

                  <label className="text-sm font-semibold text-[var(--foreground)]">
                    แนบรูปสลิปโอนเงิน
                    <input
                      accept="image/*"
                      className="mt-2 block w-full text-sm text-[var(--foreground)]"
                      onChange={(event) =>
                        setPaymentFile(event.target.files?.[0] ?? null)
                      }
                      type="file"
                    />
                  </label>
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    แนบสลิปโอนเงินแล้วระบบจะตรวจสอบให้อัตโนมัติทันที
                    หากตรวจอัตโนมัติไม่ผ่านแอดมินจะตรวจสอบให้ด้วยตนเองอีกครั้ง
                  </p>

                  <button
                    className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      paymentSubmitState.status === "submitting" ||
                      paymentSubmitState.status === "verifying"
                    }
                    type="submit"
                  >
                    {paymentSubmitState.status === "submitting"
                      ? "กำลังส่งสลิป..."
                      : paymentSubmitState.status === "verifying"
                        ? "กำลังตรวจสลิปอัตโนมัติ..."
                        : "ส่งสลิปชำระเงิน"}
                  </button>

                  {paymentSubmitState.status === "error" ? (
                    <p className="text-sm font-semibold text-[var(--danger)]">
                      {paymentSubmitState.error}
                    </p>
                  ) : null}
                  {paymentSubmitState.status === "success" ? (
                    <p className="text-sm font-semibold text-emerald-400">
                      ตรวจสลิปแล้ว หากยังรอตรวจอยู่แอดมินจะตรวจสอบให้อีกครั้ง
                    </p>
                  ) : null}
                </form>
              ) : null}

              {loadState.booking.payment_status === "paid" ? (
                <div className="mt-5 border-t border-[var(--line)] pt-5">
                  {loadState.booking.picked_up_at ? (
                    <p className="text-sm font-semibold text-[var(--brand-strong)]">
                      รับรถคืนแล้วเมื่อ{" "}
                      {formatNullableDateTime(loadState.booking.picked_up_at)}
                    </p>
                  ) : (
                    <>
                      <button
                        className="flex min-h-10 w-full items-center justify-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                        disabled={pickupState.status === "confirming"}
                        onClick={handleConfirmPickup}
                        type="button"
                      >
                        {pickupState.status === "confirming"
                          ? "กำลังยืนยัน..."
                          : "รับรถคืนแล้ว"}
                      </button>
                      {pickupState.status === "error" ? (
                        <p className="mt-2 text-sm font-semibold text-[var(--danger)]">
                          {pickupState.error}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </article>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
