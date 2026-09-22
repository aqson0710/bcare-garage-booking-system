"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  approveAdminBookingPayment,
  checkAdminAccess,
  createAdminRepairJobFromBooking,
  getAdminBookingById,
  getAdminBookingsPage,
  getAdminMechanics,
  getAdminRepairJobByBookingId,
  rejectAdminBookingPayment,
  updateAdminBookingStatus,
  updateAdminRepairJobMechanic,
  type AdminAccessResult,
  type AdminBooking,
  type AdminBookingListResult,
  type AdminBookingListStatusFilter,
  type AdminBookingPayment,
  type AdminBookingStatusAction,
  type AdminMechanic,
  type AdminRepairJob,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type StatusFilter = AdminBookingListStatusFilter;

type LoadState =
  | { status: "loading"; access: null; result: null; error: null }
  | { status: "signed-out"; access: null; result: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      result: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      result: AdminBookingListResult;
      error: null;
    }
  | { status: "error"; access: null; result: null; error: string };

type ActionState =
  | { status: "idle"; bookingId: null; error: null }
  | { status: "updating"; bookingId: string; error: null }
  | { status: "error"; bookingId: string; error: string };

type RepairJobState =
  | { status: "idle"; repairJob: null; mechanics: AdminMechanic[]; error: null }
  | { status: "loading"; repairJob: null; mechanics: AdminMechanic[]; error: null }
  | {
      status: "ready";
      repairJob: AdminRepairJob | null;
      mechanics: AdminMechanic[];
      error: null;
    }
  | { status: "error"; repairJob: null; mechanics: AdminMechanic[]; error: string };

type WorkOrderActionState =
  | { status: "idle"; error: null }
  | { status: "creating"; error: null }
  | { status: "error"; error: string };

type MechanicAssignmentState =
  | { status: "idle"; error: null }
  | { status: "saving"; error: null }
  | { status: "error"; error: string };

const statusFilters: StatusFilter[] = [
  "all",
  "pending",
  "confirmed",
  "cancelled",
  "completed",
];
const pageSize = 10;
const editableStatuses: AdminBooking["status"][] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
];

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatTime(time: string) {
  return time.slice(0, 5);
}

function parseStatusFilter(status: string | null): StatusFilter {
  if (
    status === "pending" ||
    status === "confirmed" ||
    status === "cancelled" ||
    status === "completed"
  ) {
    return status;
  }

  return "all";
}

function parsePage(page: string | null) {
  const parsedPage = Number(page);

  if (!Number.isFinite(parsedPage) || parsedPage < 1) {
    return 1;
  }

  return Math.floor(parsedPage);
}

function getStatusStyle(status: AdminBooking["status"]) {
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

function formatBookingStatus(status: StatusFilter | AdminBooking["status"]) {
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

  return "ทั้งหมด";
}

function getBookingPaymentStatusStyle(status: AdminBooking["payment_status"]) {
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

function formatBookingPaymentStatus(status: AdminBooking["payment_status"]) {
  if (status === "awaiting_payment") {
    return "ยังไม่ชำระเงิน";
  }

  if (status === "pending_review") {
    return "รอตรวจสลิป";
  }

  if (status === "paid") {
    return "ชำระเงินแล้ว";
  }

  if (status === "rejected") {
    return "สลิปไม่ผ่าน";
  }

  return "ยังไม่ต้องชำระเงิน";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("th-TH");
}

type PaymentActionState =
  | { status: "idle"; error: null; message: null; paymentId: null }
  | { status: "updating"; error: null; message: null; paymentId: string }
  | { status: "success"; error: null; message: string; paymentId: string }
  | { status: "error"; error: string; message: null; paymentId: string };

type SlipOkVerifyResult = {
  booking?: { payment_status: AdminBooking["payment_status"] };
  failureKind?:
    | "amount_mismatch"
    | "duplicate_slip"
    | "provider_error"
    | "provider_unavailable"
    | "unauthorized_provider"
    | "unreadable_slip"
    | "verification_failed";
  message?: string;
  ok?: boolean;
  payment?: AdminBookingPayment;
};

function getSlipOkActionErrorMessage(result: SlipOkVerifyResult | null) {
  const baseMessage =
    result?.message ?? "SlipOK ตรวจสลิปไม่ผ่าน หรือระบบตรวจสลิปยังไม่พร้อม";

  if (
    result?.failureKind === "provider_error" ||
    result?.failureKind === "provider_unavailable" ||
    result?.failureKind === "unauthorized_provider"
  ) {
    return `${baseMessage} สถานะการชำระเงินยังไม่ถูกเปลี่ยน กรุณาตรวจการตั้งค่าหรือลองใหม่ภายหลัง`;
  }

  if (
    result?.failureKind === "amount_mismatch" ||
    result?.failureKind === "duplicate_slip" ||
    result?.failureKind === "unreadable_slip" ||
    result?.failureKind === "verification_failed"
  ) {
    return `${baseMessage} ระบบบันทึกเป็นสลิปไม่ผ่านแล้ว ลูกค้าสามารถส่งสลิปใหม่ได้`;
  }

  return baseMessage;
}

function formatBookingPaymentVerificationStatus(
  status: AdminBookingPayment["verification_status"],
) {
  if (status === "verified") {
    return "ตรวจสลิปผ่าน";
  }

  if (status === "rejected" || status === "failed") {
    return "ตรวจสลิปไม่ผ่าน";
  }

  return "ส่งสลิปแล้ว รอตรวจ";
}

function getBookingPaymentVerifierLabel(payment: AdminBookingPayment) {
  if (payment.verification_provider === "slipok") {
    return "ระบบ SlipOK อัตโนมัติ";
  }

  if (payment.verification_provider === "admin_manual") {
    return "แอดมิน (ตรวจด้วยตนเอง)";
  }

  return "-";
}

function getAdminActions(
  status: AdminBooking["status"],
): Array<{ label: string; status: AdminBookingStatusAction; tone: string }> {
  if (status === "pending") {
    return [
      {
        label: "ยืนยันการจอง",
        status: "confirmed",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "ยกเลิก",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  if (status === "confirmed") {
    return [
      {
        label: "ทำเครื่องหมายเสร็จสิ้น",
        status: "completed",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "ยกเลิก",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  return [];
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

function getRepairJobStatusStyle(status: AdminRepairJob["status"]) {
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

function AdminPaginationControls({
  onPageChange,
  placement,
  result,
}: {
  onPageChange: (page: number) => void;
  placement: "bottom" | "top";
  result: AdminBookingListResult;
}) {
  const inputId = `page-jump-${placement}-${result.page}-${result.totalPages}`;

  function handlePageJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const requestedPage = Number(formData.get("page"));
    onPageChange(clampPage(requestedPage, result.totalPages));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-sm text-[var(--muted)]">
        หน้า {result.page} จาก {result.totalPages}
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

function AdminBookingSummaryRow({
  booking,
  onViewDetails,
}: {
  booking: AdminBooking;
  onViewDetails: (bookingId: string) => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2">
        <span
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
            booking.status,
          )}`}
        >
          {formatBookingStatus(booking.status)}
        </span>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {booking.service?.name ?? "ไม่พบบริการ"}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {booking.booking_date} เวลา {formatTime(booking.booking_time)}
          </p>
        </div>

        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {booking.customer?.full_name ?? "-"}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {booking.vehicle?.license_plate ?? "-"}
          </p>
        </div>

        <p className="hidden shrink-0 text-sm font-semibold text-[var(--foreground)] md:block">
          {booking.service
            ? currencyFormatter.format(booking.service.base_price)
            : "-"}
        </p>

        {booking.payment_status !== "not_required" ? (
          <span
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${getBookingPaymentStatusStyle(
              booking.payment_status,
            )}`}
          >
            {formatBookingPaymentStatus(booking.payment_status)}
          </span>
        ) : null}
      </div>

      <button
        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)]"
        onClick={() => onViewDetails(booking.id)}
        type="button"
      >
        ดูรายละเอียด
      </button>
    </article>
  );
}

function AdminBookingDetailCard({
  actionState,
  assignmentState,
  booking,
  onAssignMechanic,
  onClose,
  onCreateRepairJob,
  onPaymentUpdated,
  onStatusChange,
  repairJobState,
  workOrderActionState,
}: {
  actionState: ActionState;
  assignmentState: MechanicAssignmentState;
  booking: AdminBooking;
  onAssignMechanic: (repairJob: AdminRepairJob, mechanicId: string | null) => void;
  onClose: () => void;
  onCreateRepairJob: (booking: AdminBooking) => void;
  onPaymentUpdated: (
    paymentId: string,
    payment: AdminBookingPayment | undefined,
    paymentStatus: AdminBooking["payment_status"] | undefined,
  ) => void;
  onStatusChange: (
    booking: AdminBooking,
    status: AdminBookingStatusAction,
  ) => void;
  repairJobState: RepairJobState;
  workOrderActionState: WorkOrderActionState;
}) {
  const actions = getAdminActions(booking.status);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<AdminBookingStatusAction>(booking.status);
  const [selectedMechanicId, setSelectedMechanicId] = useState("");
  const [signedSlipUrls, setSignedSlipUrls] = useState<Record<string, string>>(
    {},
  );
  const [signedUrlError, setSignedUrlError] = useState<string | null>(null);
  const [paymentActionState, setPaymentActionState] =
    useState<PaymentActionState>({
      error: null,
      message: null,
      paymentId: null,
      status: "idle",
    });
  const [rejectingPaymentId, setRejectingPaymentId] = useState<string | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const isUpdating =
    actionState.status === "updating" && actionState.bookingId === booking.id;
  const canSaveStatus = selectedStatus !== booking.status && !isUpdating;
  const repairJob =
    repairJobState.status === "ready" ? repairJobState.repairJob : null;
  const isRepairJobClosed =
    repairJob?.status === "completed" || repairJob?.status === "cancelled";
  const isSavingMechanic = assignmentState.status === "saving";
  const canSaveMechanic =
    !!repairJob &&
    !isRepairJobClosed &&
    !isSavingMechanic &&
    selectedMechanicId !== (repairJob.mechanic_id ?? "");

  useEffect(() => {
    setSelectedMechanicId(repairJob?.mechanic_id ?? "");
  }, [repairJob?.id, repairJob?.mechanic_id]);

  useEffect(() => {
    let isMounted = true;
    const paymentsWithSlip = booking.payments.filter(
      (payment) => payment.slip_image_url,
    );

    if (paymentsWithSlip.length === 0) {
      return;
    }

    async function loadSignedSlipUrls() {
      const supabase = createClient();
      const nextUrls: Record<string, string> = {};

      for (const payment of paymentsWithSlip) {
        const { data, error } = await supabase.storage
          .from("payment-slips")
          .createSignedUrl(payment.slip_image_url, 60 * 30);

        if (error) {
          if (isMounted) {
            setSignedUrlError(error.message);
          }
          continue;
        }

        if (data?.signedUrl) {
          nextUrls[payment.id] = data.signedUrl;
        }
      }

      if (isMounted) {
        setSignedSlipUrls(nextUrls);
      }
    }

    loadSignedSlipUrls();

    return () => {
      isMounted = false;
    };
  }, [booking.payments]);

  function cancelStatusEdit() {
    setSelectedStatus(booking.status);
    setIsEditingStatus(false);
  }

  async function handleVerifyWithSlipOk(paymentId: string) {
    if (!window.confirm("ตรวจสลิปนี้ด้วย SlipOK ตอนนี้หรือไม่?")) {
      return;
    }

    setPaymentActionState({
      error: null,
      message: null,
      paymentId,
      status: "updating",
    });

    let response: Response;

    try {
      const supabase = createClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setPaymentActionState({
          error: sessionError?.message ?? "กรุณาเข้าสู่ระบบ admin อีกครั้ง",
          message: null,
          paymentId,
          status: "error",
        });
        return;
      }

      const accessToken = session.access_token;

      response = await fetch(
        `/api/booking-payments/${paymentId}/verify-slipok`,
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
    } catch (error) {
      setPaymentActionState({
        error:
          error instanceof Error
            ? `เรียก SlipOK ไม่สำเร็จ: ${error.message}`
            : "เรียก SlipOK ไม่สำเร็จ",
        message: null,
        paymentId,
        status: "error",
      });
      return;
    }

    const result = (await response
      .json()
      .catch(() => null)) as SlipOkVerifyResult | null;

    if (result?.payment) {
      onPaymentUpdated(paymentId, result.payment, result.booking?.payment_status);
      setRejectingPaymentId(null);
      setRejectReason("");
    }

    if (!response.ok || result?.ok !== true) {
      setPaymentActionState({
        error: getSlipOkActionErrorMessage(result),
        message: null,
        paymentId,
        status: "error",
      });
      return;
    }

    setPaymentActionState({
      error: null,
      message: result.message ?? "SlipOK ตรวจสลิปผ่านแล้ว",
      paymentId,
      status: "success",
    });
  }

  async function handleApprovePayment(paymentId: string) {
    if (!window.confirm("อนุมัติสลิปนี้เป็นชำระเงินแล้วหรือไม่?")) {
      return;
    }

    setPaymentActionState({
      error: null,
      message: null,
      paymentId,
      status: "updating",
    });

    const supabase = createClient();
    const { data, error } = await approveAdminBookingPayment(
      supabase,
      paymentId,
    );

    if (error || !data) {
      setPaymentActionState({
        error: error?.message ?? "อนุมัติการชำระเงินไม่สำเร็จ",
        message: null,
        paymentId,
        status: "error",
      });
      return;
    }

    onPaymentUpdated(
      paymentId,
      {
        ...(booking.payments.find((payment) => payment.id === paymentId) as AdminBookingPayment),
        payment_status: "paid",
        rejected_reason: null,
        verification_provider: "admin_manual",
        verification_status: "verified",
      },
      data.payment_status,
    );
    setRejectingPaymentId(null);
    setRejectReason("");
    setPaymentActionState({
      error: null,
      message: "อนุมัติการชำระเงินแล้ว",
      paymentId,
      status: "success",
    });
  }

  async function handleRejectPayment(paymentId: string) {
    const normalizedReason = rejectReason.trim();

    if (normalizedReason.length === 0) {
      setPaymentActionState({
        error: "กรุณากรอกเหตุผลที่ปฏิเสธสลิป",
        message: null,
        paymentId,
        status: "error",
      });
      return;
    }

    setPaymentActionState({
      error: null,
      message: null,
      paymentId,
      status: "updating",
    });

    const supabase = createClient();
    const { data, error } = await rejectAdminBookingPayment(
      supabase,
      paymentId,
      normalizedReason,
    );

    if (error || !data) {
      setPaymentActionState({
        error: error?.message ?? "ปฏิเสธการชำระเงินไม่สำเร็จ",
        message: null,
        paymentId,
        status: "error",
      });
      return;
    }

    onPaymentUpdated(
      paymentId,
      {
        ...(booking.payments.find((payment) => payment.id === paymentId) as AdminBookingPayment),
        payment_status: "rejected",
        rejected_reason: normalizedReason,
        verification_status: "rejected",
      },
      data.payment_status,
    );
    setRejectingPaymentId(null);
    setRejectReason("");
    setPaymentActionState({
      error: null,
      message: "ปฏิเสธสลิปแล้ว",
      paymentId,
      status: "success",
    });
  }

  return (
    <article className="p-5">
      <div className="border-b border-[var(--line)] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[var(--brand)]">
            {booking.service?.name ?? "ไม่พบบริการ"}
          </p>
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
              booking.status,
            )}`}
          >
            {formatBookingStatus(booking.status)}
          </span>
          {booking.payment_status !== "not_required" ? (
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getBookingPaymentStatusStyle(
                booking.payment_status,
              )}`}
            >
              {formatBookingPaymentStatus(booking.payment_status)}
            </span>
          ) : null}
        </div>
        <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
          {booking.booking_date} เวลา {formatTime(booking.booking_time)}
        </h2>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm md:grid-cols-4">
        <div>
          <dt className="text-[var(--muted)]">ลูกค้า</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.customer?.full_name ?? "-"}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {booking.customer?.phone_number ?? "-"}
          </dd>
          <dd className="mt-1 break-all text-xs text-[var(--muted)]">
            {booking.customer?.email ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">รถ</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.vehicle?.license_plate ?? "-"}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {booking.vehicle
              ? `${booking.vehicle.brand ?? "-"} / ${
                  booking.vehicle.model ?? "-"
                }`
              : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">ราคา</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.service
              ? currencyFormatter.format(booking.service.base_price)
              : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">สร้างเมื่อ</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {new Date(booking.created_at).toLocaleString("th-TH")}
          </dd>
        </div>
      </dl>

      {booking.note ? (
        <div className="mt-4 rounded-md bg-[var(--surface-muted)] p-3 text-sm leading-6 text-[var(--muted)]">
          {booking.note}
        </div>
      ) : null}

      <p className="mt-4 break-all text-xs text-[var(--muted)]">
        รหัสการจอง: {booking.id}
      </p>

      <div className="mt-5 flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        {isEditingStatus ? (
          <div className="flex w-full flex-col gap-3 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="text-sm font-semibold text-[var(--foreground)]">
              แก้ไขสถานะ
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] sm:w-56"
                disabled={isUpdating}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target.value as AdminBookingStatusAction,
                  )
                }
                value={selectedStatus}
              >
                {editableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatBookingStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)]"
                disabled={isUpdating}
                onClick={cancelStatusEdit}
                type="button"
              >
                ยกเลิกการแก้ไข
              </button>
              <button
                className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSaveStatus}
                onClick={() => onStatusChange(booking, selectedStatus)}
                type="button"
              >
                {isUpdating ? "กำลังบันทึก..." : "บันทึกสถานะ"}
              </button>
            </div>
          </div>
        ) : actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                className={`min-h-10 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${action.tone}`}
                disabled={isUpdating}
                key={action.status}
                onClick={() => onStatusChange(booking, action.status)}
                type="button"
              >
                {isUpdating ? "กำลังอัปเดต..." : action.label}
              </button>
            ))}
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)]"
              disabled={isUpdating}
              onClick={() => setIsEditingStatus(true)}
              type="button"
            >
              แก้ไขสถานะ
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-[var(--muted)]">
              ไม่มีปุ่มลัดสำหรับสถานะนี้
            </p>
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)]"
              disabled={isUpdating}
              onClick={() => setIsEditingStatus(true)}
              type="button"
            >
              แก้ไขสถานะ
            </button>
          </div>
        )}

        {actionState.status === "error" &&
        actionState.bookingId === booking.id ? (
          <p className="text-sm text-[var(--danger)]">{actionState.error}</p>
        ) : null}
      </div>

      <section className="mt-5 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <p className="text-sm font-semibold text-[var(--brand)]">
          ใบงานซ่อมและช่าง
        </p>

        {repairJobState.status === "loading" ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            กำลังโหลดข้อมูลใบงานซ่อม...
          </p>
        ) : null}

        {repairJobState.status === "error" ? (
          <p className="mt-3 text-sm text-[var(--danger)]">{repairJobState.error}</p>
        ) : null}

        {repairJobState.status === "ready" && !repairJob ? (
          <div className="mt-3">
            <p className="text-sm leading-6 text-[var(--muted)]">
              สร้างใบงานซ่อมจากการจองที่ยืนยันแล้ว เพื่อให้ช่างติดตามงานต่อได้
            </p>
            {booking.status !== "confirmed" ? (
              <p className="mt-2 text-sm font-semibold text-amber-400">
                ต้องยืนยันการจองก่อนสร้างใบงานซ่อม
              </p>
            ) : null}
            <button
              className="mt-3 min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                booking.status !== "confirmed" ||
                workOrderActionState.status === "creating"
              }
              onClick={() => onCreateRepairJob(booking)}
              type="button"
            >
              {workOrderActionState.status === "creating"
                ? "กำลังสร้าง..."
                : "สร้างใบงานซ่อม"}
            </button>
            {workOrderActionState.status === "error" ? (
              <p className="mt-2 text-sm text-[var(--danger)]">
                {workOrderActionState.error}
              </p>
            ) : null}
          </div>
        ) : null}

        {repairJobState.status === "ready" && repairJob ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getRepairJobStatusStyle(
                  repairJob.status,
                )}`}
              >
                {formatRepairJobStatus(repairJob.status)}
              </span>
              <p className="break-all text-xs text-[var(--muted)]">
                รหัสใบงานซ่อม: {repairJob.id}
              </p>
            </div>

            <label className="block text-sm font-semibold text-[var(--foreground)]">
              มอบหมายช่าง
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                disabled={
                  isRepairJobClosed ||
                  isSavingMechanic ||
                  repairJobState.mechanics.length === 0
                }
                onChange={(event) =>
                  setSelectedMechanicId(event.target.value)
                }
                value={selectedMechanicId}
              >
                <option value="">ยังไม่ได้มอบหมาย</option>
                {repairJobState.mechanics.map((mechanic) => (
                  <option key={mechanic.id} value={mechanic.id}>
                    {getMechanicOptionLabel(mechanic)}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSaveMechanic}
              onClick={() =>
                onAssignMechanic(repairJob, selectedMechanicId || null)
              }
              type="button"
            >
              {isSavingMechanic ? "กำลังบันทึก..." : "บันทึกช่าง"}
            </button>

            {repairJobState.mechanics.length === 0 ? (
              <p className="text-xs font-semibold text-amber-400">
                ยังไม่พบโปรไฟล์ช่างในระบบ
              </p>
            ) : null}

            {isRepairJobClosed ? (
              <p className="text-xs font-semibold text-[var(--muted)]">
                ใบงานที่ปิดแล้วไม่สามารถเปลี่ยนช่างได้ในขั้นนี้
              </p>
            ) : null}

            {assignmentState.status === "error" ? (
              <p className="text-sm text-[var(--danger)]">{assignmentState.error}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {booking.payment_status !== "not_required" ? (
        <section className="mt-5 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--brand)]">
                การชำระเงิน
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                ตรวจหลักฐาน แล้วอนุมัติหรือปฏิเสธการชำระเงินจากหน้านี้
              </p>
            </div>
            <span
              className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getBookingPaymentStatusStyle(
                booking.payment_status,
              )}`}
            >
              {formatBookingPaymentStatus(booking.payment_status)}
            </span>
          </div>

          {signedUrlError ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
              เปิด signed slip link ไม่สำเร็จ: {signedUrlError}
            </div>
          ) : null}

          {paymentActionState.status === "success" ? (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]">
              {paymentActionState.message}
            </div>
          ) : null}

          {paymentActionState.status === "error" ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
              {paymentActionState.error}
            </div>
          ) : null}

          {booking.payments.length > 0 ? (
            <div className="mt-4 space-y-3">
              {booking.payments.map((payment) => {
                const isUpdatingPayment =
                  paymentActionState.status === "updating" &&
                  paymentActionState.paymentId === payment.id;
                const canApprove =
                  payment.payment_status === "pending" &&
                  payment.verification_status === "submitted";
                const canVerifyWithSlipOk = canApprove;
                const canReject = canApprove;

                return (
                  <div
                    className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 text-sm"
                    key={payment.id}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="font-semibold text-[var(--foreground)]">
                        {currencyFormatter.format(payment.amount)}
                      </p>
                      <span
                        className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${
                          payment.payment_status === "paid"
                            ? "bg-emerald-50 text-[var(--brand-strong)]"
                            : payment.payment_status === "rejected"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {payment.payment_status === "paid"
                          ? "อนุมัติแล้ว"
                          : payment.payment_status === "rejected"
                            ? "ปฏิเสธแล้ว"
                            : "รอตรวจ"}
                      </span>
                    </div>

                    <dl className="mt-3 grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
                      <div>
                        <dt>ส่งเมื่อ</dt>
                        <dd className="font-semibold text-[var(--foreground)]">
                          {formatDateTime(payment.submitted_at)}
                        </dd>
                      </div>
                      <div>
                        <dt>ตรวจเมื่อ</dt>
                        <dd className="font-semibold text-[var(--foreground)]">
                          {formatDateTime(payment.verified_at)}
                        </dd>
                      </div>
                      <div>
                        <dt>ผลตรวจสลิป</dt>
                        <dd className="font-semibold text-[var(--foreground)]">
                          {formatBookingPaymentVerificationStatus(
                            payment.verification_status,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>ตรวจโดย</dt>
                        <dd className="font-semibold text-[var(--foreground)]">
                          {getBookingPaymentVerifierLabel(payment)}
                        </dd>
                      </div>
                      {payment.slip_amount != null ? (
                        <div>
                          <dt>ยอดที่ตรวจพบในสลิป</dt>
                          <dd className="font-semibold text-[var(--foreground)]">
                            {currencyFormatter.format(payment.slip_amount)}
                          </dd>
                        </div>
                      ) : null}
                      {payment.rejected_reason ? (
                        <div className="sm:col-span-2">
                          <dt>เหตุผลที่ไม่ผ่าน</dt>
                          <dd className="font-semibold text-[var(--foreground)]">
                            {payment.rejected_reason}
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {signedSlipUrls[payment.id] ? (
                      <a
                        className="mt-3 inline-flex min-h-9 items-center rounded-md bg-[var(--brand)] px-3 text-sm font-semibold text-white"
                        href={signedSlipUrls[payment.id]}
                        rel="noreferrer"
                        target="_blank"
                      >
                        เปิดรูปสลิป
                      </a>
                    ) : (
                      <p className="mt-3 text-xs text-[var(--muted)]">
                        กำลังเตรียมลิงก์รูปสลิป...
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="min-h-10 rounded-md border border-cyan-200 bg-cyan-50 px-4 text-sm font-semibold text-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!canVerifyWithSlipOk || isUpdatingPayment}
                        onClick={() => handleVerifyWithSlipOk(payment.id)}
                        type="button"
                      >
                        {isUpdatingPayment ? "กำลังตรวจ..." : "ตรวจด้วย SlipOK"}
                      </button>
                      <button
                        className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!canApprove || isUpdatingPayment}
                        onClick={() => handleApprovePayment(payment.id)}
                        type="button"
                      >
                        {isUpdatingPayment ? "กำลังบันทึก..." : "อนุมัติชำระเงิน"}
                      </button>
                      <button
                        className="min-h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!canReject || isUpdatingPayment}
                        onClick={() => {
                          setRejectingPaymentId(payment.id);
                          setRejectReason(payment.rejected_reason ?? "");
                        }}
                        type="button"
                      >
                        ปฏิเสธสลิป
                      </button>
                    </div>

                    {!canApprove ? (
                      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                        ปุ่มตรวจ/อนุมัติ/ปฏิเสธจะเปิดเฉพาะสลิปที่ยังรอตรวจอยู่เท่านั้น
                      </p>
                    ) : null}

                    {rejectingPaymentId === payment.id ? (
                      <div className="mt-3 space-y-3">
                        <label className="block text-sm font-semibold text-[var(--foreground)]">
                          เหตุผลที่ปฏิเสธ
                          <textarea
                            className="mt-2 min-h-24 w-full rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                            disabled={isUpdatingPayment}
                            onChange={(event) =>
                              setRejectReason(event.target.value)
                            }
                            placeholder="เช่น ยอดเงินไม่ตรง หรือรูปสลิปไม่ชัด"
                            value={rejectReason}
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)]"
                            disabled={isUpdatingPayment}
                            onClick={() => {
                              setRejectingPaymentId(null);
                              setRejectReason("");
                            }}
                            type="button"
                          >
                            ยกเลิกการปฏิเสธ
                          </button>
                          <button
                            className="min-h-10 rounded-md bg-red-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isUpdatingPayment}
                            onClick={() => handleRejectPayment(payment.id)}
                            type="button"
                          >
                            ยืนยันปฏิเสธ
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">
              ยังไม่มีหลักฐานการชำระเงินสำหรับการจองนี้
            </p>
          )}
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-5">
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex min-h-10 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href={`/admin/bookings/${booking.id}/receipt`}
          >
            เอกสารการจอง
          </Link>
          {repairJob ? (
            <Link
              className="inline-flex min-h-10 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin/repair-jobs"
            >
              ดูใบงานซ่อมทั้งหมด
            </Link>
          ) : null}
        </div>
        <button
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md bg-[var(--brand)] px-5 text-sm font-semibold text-white"
          onClick={onClose}
          type="button"
        >
          ปิด
        </button>
      </div>
    </article>
  );
}

export function AdminBookingsPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const page = parsePage(searchParams.get("page"));
  const submittedSearch = searchParams.get("search") ?? "";
  const bookingIdParam = searchParams.get("bookingId");
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    result: null,
    error: null,
    status: "loading",
  });
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("search") ?? "",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [actionState, setActionState] = useState<ActionState>({
    bookingId: null,
    error: null,
    status: "idle",
  });
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const [selectedBookingSnapshot, setSelectedBookingSnapshot] =
    useState<AdminBooking | null>(null);
  const [repairJobState, setRepairJobState] = useState<RepairJobState>({
    error: null,
    mechanics: [],
    repairJob: null,
    status: "idle",
  });
  const [workOrderActionState, setWorkOrderActionState] =
    useState<WorkOrderActionState>({
      error: null,
      status: "idle",
    });
  const [assignmentActionState, setAssignmentActionState] =
    useState<MechanicAssignmentState>({
      error: null,
      status: "idle",
    });

  useEffect(() => {
    if (!selectedBookingId) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeBookingModal();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookingId]);

  // Open the popup automatically when the page is loaded with a
  // ?bookingId=... query param (e.g. from a notification deep link).
  useEffect(() => {
    if (bookingIdParam && bookingIdParam !== selectedBookingId) {
      setSelectedBookingId(bookingIdParam);
    }
  }, [bookingIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the booking behind the open popup directly by id, independent of
  // the (filtered/paginated) list, so the popup works for deep links and
  // stays open - unaffected by list reloads - while the admin is using it.
  useEffect(() => {
    if (!selectedBookingId) {
      setSelectedBookingSnapshot(null);
      return;
    }

    let isMounted = true;
    const supabase = createClient();

    async function loadSelectedBooking() {
      const { data, error } = await getAdminBookingById(
        supabase,
        selectedBookingId as string,
      );

      if (!isMounted) {
        return;
      }

      if (error || !data) {
        setSelectedBookingId(null);
        setSelectedBookingSnapshot(null);
        return;
      }

      setSelectedBookingSnapshot(data);
    }

    loadSelectedBooking();

    return () => {
      isMounted = false;
    };
  }, [selectedBookingId]);

  // Load the repair job (if any) and the mechanic roster whenever a
  // different booking's popup is opened.
  useEffect(() => {
    if (!selectedBookingId) {
      setRepairJobState({
        error: null,
        mechanics: [],
        repairJob: null,
        status: "idle",
      });
      return;
    }

    let isMounted = true;
    const supabase = createClient();

    async function loadRepairJobDetails() {
      setRepairJobState({
        error: null,
        mechanics: [],
        repairJob: null,
        status: "loading",
      });

      const [repairJobResult, mechanicsResult] = await Promise.all([
        getAdminRepairJobByBookingId(supabase, selectedBookingId as string),
        getAdminMechanics(supabase),
      ]);

      if (!isMounted) {
        return;
      }

      if (repairJobResult.error) {
        setRepairJobState({
          error: repairJobResult.error.message,
          mechanics: [],
          repairJob: null,
          status: "error",
        });
        return;
      }

      if (mechanicsResult.error) {
        setRepairJobState({
          error: mechanicsResult.error.message,
          mechanics: [],
          repairJob: null,
          status: "error",
        });
        return;
      }

      setRepairJobState({
        error: null,
        mechanics: mechanicsResult.data ?? [],
        repairJob: repairJobResult.data,
        status: "ready",
      });
    }

    loadRepairJobDetails();

    return () => {
      isMounted = false;
    };
  }, [selectedBookingId]);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadBookings() {
      setLoadState({
        access: null,
        result: null,
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
          result: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          result: null,
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
          result: null,
          error: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminBookingsPage(supabase, {
        page,
        pageSize,
        search: submittedSearch,
        status: statusFilter,
      });

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          result: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        result: data,
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
  }, [page, reloadKey, statusFilter, submittedSearch]);

  function updateFilters(next: {
    page?: number;
    search?: string;
    status?: StatusFilter;
  }) {
    const nextPage = next.page ?? page;
    const nextSearch = next.search ?? submittedSearch;
    const nextStatus = next.status ?? statusFilter;
    const params = new URLSearchParams();

    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }

    if (nextSearch.trim()) {
      params.set("search", nextSearch.trim());
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function openBookingModal(bookingId: string) {
    setSelectedBookingId(bookingId);

    const params = new URLSearchParams(searchParams.toString());
    params.set("bookingId", bookingId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function closeBookingModal() {
    setSelectedBookingId(null);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("bookingId");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({
      page: 1,
      search: searchInput,
    });
  }

  function handlePageChange(nextPage: number) {
    updateFilters({
      page: nextPage,
    });
  }

  async function handleStatusChange(
    booking: AdminBooking,
    nextStatus: AdminBookingStatusAction,
  ) {
    if (loadState.status !== "ready") {
      return;
    }

    setActionState({
      bookingId: booking.id,
      error: null,
      status: "updating",
    });

    const supabase = createClient();
    const { error } = await updateAdminBookingStatus(
      supabase,
      booking.id,
      nextStatus,
    );

    if (error) {
      setActionState({
        bookingId: booking.id,
        error: error.message,
        status: "error",
      });
      return;
    }

    setReloadKey((currentKey) => currentKey + 1);
    setActionState({
      bookingId: null,
      error: null,
      status: "idle",
    });

    if (selectedBookingId === booking.id) {
      const { data: refreshed } = await getAdminBookingById(
        supabase,
        booking.id,
      );

      if (refreshed) {
        setSelectedBookingSnapshot(refreshed);
      }
    }
  }

  async function handleCreateRepairJob(booking: AdminBooking) {
    if (booking.status !== "confirmed") {
      return;
    }

    setWorkOrderActionState({
      error: null,
      status: "creating",
    });

    const supabase = createClient();
    const { data, error } = await createAdminRepairJobFromBooking(
      supabase,
      booking.id,
    );

    if (error) {
      setWorkOrderActionState({
        error: error.message,
        status: "error",
      });
      return;
    }

    setRepairJobState((current) => ({
      error: null,
      mechanics: current.mechanics,
      repairJob: data,
      status: "ready",
    }));
    setWorkOrderActionState({
      error: null,
      status: "idle",
    });
  }

  async function handleAssignMechanic(
    repairJob: AdminRepairJob,
    mechanicId: string | null,
  ) {
    setAssignmentActionState({
      error: null,
      status: "saving",
    });

    const supabase = createClient();
    const { data, error } = await updateAdminRepairJobMechanic(
      supabase,
      repairJob,
      mechanicId,
    );

    if (error) {
      setAssignmentActionState({
        error: error.message,
        status: "error",
      });
      return;
    }

    setRepairJobState((current) => ({
      error: null,
      mechanics: current.mechanics,
      repairJob: data ?? current.repairJob,
      status: "ready",
    }));
    setAssignmentActionState({
      error: null,
      status: "idle",
    });
  }

  function handlePaymentUpdated(
    paymentId: string,
    payment: AdminBookingPayment | undefined,
    paymentStatus: AdminBooking["payment_status"] | undefined,
  ) {
    setSelectedBookingSnapshot((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        payment_status: paymentStatus ?? current.payment_status,
        payments: current.payments.map((existingPayment) =>
          existingPayment.id === paymentId && payment
            ? payment
            : existingPayment,
        ),
      };
    });

    if (paymentStatus) {
      setLoadState((current) => {
        if (current.status !== "ready" || !current.result) {
          return current;
        }

        return {
          ...current,
          result: {
            ...current.result,
            bookings: current.result.bookings.map((listBooking) =>
              listBooking.id === selectedBookingId
                ? { ...listBooking, payment_status: paymentStatus }
                : listBooking,
            ),
          },
        };
      });
    }
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
              รายการจองทั้งหมด
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ตรวจสอบคำขอจองจากลูกค้าทั้งหมด และจัดการสถานะการจอง
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            หน้าแอดมิน
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
          <div className="space-y-4 border-b border-[var(--line)] pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  พบรายการจอง {loadState.result.totalCount} รายการ
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  หน้า {loadState.result.page} จาก{" "}
                  {loadState.result.totalPages}
                </p>
              </div>

              <form
                className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl"
                onSubmit={handleSearchSubmit}
              >
                <input
                  className="min-h-10 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="ค้นหาลูกค้า เบอร์โทร ทะเบียนรถ บริการ หมายเหตุ หรือรหัสการจอง"
                  type="search"
                  value={searchInput}
                />
                <button
                  className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                  type="submit"
                >
                  ค้นหา
                </button>
                {submittedSearch ? (
                  <button
                    className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)]"
                    onClick={() => {
                      setSearchInput("");
                      updateFilters({
                        page: 1,
                        search: "",
                      });
                    }}
                    type="button"
                  >
                    ล้าง
                  </button>
                ) : null}
              </form>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusFilters.map((status) => (
                <button
                  className={
                    statusFilter === status
                      ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                      : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)]"
                  }
                  key={status}
                  onClick={() =>
                    updateFilters({
                      page: 1,
                      status,
                    })
                  }
                  type="button"
                >
                  {formatBookingStatus(status)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <AdminPaginationControls
              onPageChange={handlePageChange}
              placement="top"
              result={loadState.result}
            />
          </div>

          {loadState.result.bookings.length > 0 ? (
            <div className="mt-5 space-y-3">
              {loadState.result.bookings.map((booking) => (
                <AdminBookingSummaryRow
                  booking={booking}
                  key={`${booking.id}-${booking.status}`}
                  onViewDetails={openBookingModal}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบรายการจองที่ตรงกับตัวกรองปัจจุบัน
            </div>
          )}

          <div className="mt-6">
            <AdminPaginationControls
              onPageChange={handlePageChange}
              placement="bottom"
              result={loadState.result}
            />
          </div>
        </section>
      ) : null}

      {selectedBookingSnapshot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeBookingModal}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-[var(--surface)] shadow-xl">
            <AdminBookingDetailCard
              actionState={actionState}
              assignmentState={assignmentActionState}
              booking={selectedBookingSnapshot}
              key={selectedBookingSnapshot.id}
              onAssignMechanic={handleAssignMechanic}
              onClose={closeBookingModal}
              onCreateRepairJob={handleCreateRepairJob}
              onPaymentUpdated={handlePaymentUpdated}
              onStatusChange={handleStatusChange}
              repairJobState={repairJobState}
              workOrderActionState={workOrderActionState}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
