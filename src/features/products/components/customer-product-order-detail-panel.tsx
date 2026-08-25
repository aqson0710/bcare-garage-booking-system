"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { FormEvent, ReactNode, SyntheticEvent } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  getActivePaymentSetting,
  getCustomerProductOrderById,
  submitProductPaymentSlip,
  type PaymentSetting,
  type ProductPayment,
  type ProductOrderWithItems,
} from "@/features/products";
import { createClient } from "@/lib/supabase/browser";
import { ProductImageThumb } from "./product-image-thumb";

type LoadState =
  | {
      status: "loading";
      order: null;
      error: null;
      userId: null;
      paymentSetting: null;
    }
  | {
      status: "signed-out";
      order: null;
      error: null;
      userId: null;
      paymentSetting: null;
    }
  | {
      status: "not-found";
      order: null;
      error: null;
      userId: string;
      paymentSetting: null;
    }
  | {
      status: "ready";
      order: ProductOrderWithItems;
      error: null;
      userId: string;
      paymentSetting: PaymentSetting | null;
    }
  | {
      status: "error";
      order: null;
      error: string;
      userId: null;
      paymentSetting: null;
    };

type PaymentSubmitState =
  | { status: "idle"; error: null }
  | { status: "submitting"; error: null }
  | { status: "success"; error: null }
  | { status: "error"; error: string };

type PaymentNotice = {
  message: string;
  tone: string;
  title: string;
};

type PaymentDisplaySettings = {
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankBranch: string | null;
  bankName: string | null;
  bankTransferEnabled: boolean;
  instructions: string | null;
  isFallback: boolean;
  promptPayDisplayName: string;
  promptPayEnabled: boolean;
  promptPayId: string | null;
  promptPayQrImageUrl: string | null;
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

const mockPaymentSettings = {
  bank: {
    accountName: "BigO-RepairCar Co., Ltd.",
    accountNumber: "123-4-56789-0",
    bankName: "ธนาคารกสิกรไทย",
    branch: "สาขาทดสอบ",
  },
  promptPay: {
    displayName: "BigO-RepairCar",
    id: "099-999-9999",
    qrImageUrl: "/mock-promptpay-qr.svg",
  },
};

function getPaymentDisplaySettings(
  setting: PaymentSetting | null,
): PaymentDisplaySettings {
  if (!setting) {
    return {
      bankAccountName: mockPaymentSettings.bank.accountName,
      bankAccountNumber: mockPaymentSettings.bank.accountNumber,
      bankBranch: mockPaymentSettings.bank.branch,
      bankName: mockPaymentSettings.bank.bankName,
      bankTransferEnabled: true,
      instructions: "ข้อมูลนี้เป็นข้อมูลทดสอบชั่วคราว ก่อนทำหน้า Payment Settings",
      isFallback: true,
      promptPayDisplayName: mockPaymentSettings.promptPay.displayName,
      promptPayEnabled: true,
      promptPayId: mockPaymentSettings.promptPay.id,
      promptPayQrImageUrl: mockPaymentSettings.promptPay.qrImageUrl,
    };
  }

  return {
    bankAccountName: setting.bank_account_name,
    bankAccountNumber: setting.bank_account_number,
    bankBranch: setting.bank_branch,
    bankName: setting.bank_name,
    bankTransferEnabled: setting.bank_transfer_enabled,
    instructions: setting.payment_instructions,
    isFallback: false,
    promptPayDisplayName: setting.promptpay_display_name,
    promptPayEnabled: setting.promptpay_enabled,
    promptPayId: setting.promptpay_id,
    promptPayQrImageUrl: setting.promptpay_qr_image_url,
  };
}

function getOrderStatusStyle(status: ProductOrderWithItems["status"]) {
  if (status === "pending") {
    return "bg-amber-50 text-amber-800";
  }

  if (
    status === "confirmed" ||
    status === "preparing" ||
    status === "ready_for_pickup" ||
    status === "out_for_delivery"
  ) {
    return "bg-cyan-50 text-cyan-800";
  }

  if (status === "completed") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-red-50 text-red-700";
}

function getPaymentStatusStyle(status: ProductOrderWithItems["payment_status"]) {
  if (status === "paid") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  if (status === "pending") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "refunded") {
    return "bg-cyan-50 text-cyan-800";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function getVerificationStatusStyle(status: ProductPayment["verification_status"]) {
  if (status === "verified") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  if (status === "submitted") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "rejected" || status === "failed") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatOrderStatus(status: ProductOrderWithItems["status"]) {
  if (status === "pending") {
    return "รอรับออเดอร์";
  }

  if (status === "confirmed") {
    return "ยืนยันออเดอร์แล้ว";
  }

  if (status === "preparing") {
    return "กำลังจัดเตรียม";
  }

  if (status === "ready_for_pickup") {
    return "พร้อมรับที่อู่";
  }

  if (status === "out_for_delivery") {
    return "กำลังจัดส่ง";
  }

  if (status === "completed") {
    return "สำเร็จ";
  }

  return "ยกเลิกแล้ว";
}

function formatPaymentStatus(status: ProductOrderWithItems["payment_status"]) {
  if (status === "paid") {
    return "ชำระเงินแล้ว";
  }

  if (status === "pending") {
    return "รอตรวจชำระเงิน";
  }

  if (status === "refunded") {
    return "คืนเงินแล้ว";
  }

  if (status === "cancelled") {
    return "ยกเลิกการชำระเงิน";
  }

  return "ยังไม่ชำระเงิน";
}

function formatDeliveryMethod(method: ProductOrderWithItems["delivery_method"]) {
  return method === "delivery" ? "จัดส่งถึงบ้าน" : "รับที่อู่";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPaymentMethod(method: ProductPayment["payment_method"]) {
  if (method === "promptpay") {
    return "PromptPay / QR";
  }

  if (method === "bank_transfer") {
    return "โอนเข้าบัญชีธนาคาร";
  }

  if (method === "cash") {
    return "จ่ายที่อู่";
  }

  if (method === "card") {
    return "บัตร";
  }

  return "อื่น ๆ";
}

function formatVerificationStatus(
  status: ProductPayment["verification_status"],
) {
  if (status === "not_submitted") {
    return "ยังไม่ส่งสลิป";
  }

  if (status === "submitted") {
    return "ส่งสลิปแล้ว รอตรวจ";
  }

  if (status === "verified") {
    return "ตรวจสลิปผ่าน";
  }

  if (status === "rejected") {
    return "สลิปไม่ผ่าน";
  }

  return "ตรวจสลิปล้มเหลว";
}

function getPaymentVerifierLabel(payment: ProductPayment | null) {
  if (!payment) {
    return "-";
  }

  if (payment.verification_provider === "slipok") {
    return "SlipOK";
  }

  return "แอดมิน";
}

function getPaymentNotice(
  order: ProductOrderWithItems,
  latestPayment: ProductPayment | null,
): PaymentNotice {
  if (order.status === "cancelled") {
    return {
      message: "คำสั่งซื้อนี้ถูกยกเลิกแล้ว จึงไม่สามารถส่งสลิปเพิ่มได้",
      title: "ออเดอร์ถูกยกเลิก",
      tone: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (
    order.payment_status === "paid" ||
    latestPayment?.verification_status === "verified"
  ) {
    const verifierLabel = getPaymentVerifierLabel(latestPayment);

    return {
      message:
        verifierLabel === "SlipOK"
          ? "SlipOK ตรวจสลิปผ่านแล้ว ระบบอัปเดตออเดอร์เป็นชำระเงินแล้ว"
          : "แอดมินตรวจหลักฐานและยืนยันการชำระเงินแล้ว",
      title: "ชำระเงินแล้ว",
      tone: "border-emerald-200 bg-emerald-50 text-[var(--brand-strong)]",
    };
  }

  if (
    latestPayment?.verification_status === "rejected" ||
    latestPayment?.payment_status === "failed"
  ) {
    const verifierLabel = getPaymentVerifierLabel(latestPayment);

    return {
      message: latestPayment.rejected_reason
        ? `${verifierLabel} ตรวจไม่ผ่าน: ${latestPayment.rejected_reason}`
        : `${verifierLabel} ตรวจไม่ผ่าน สามารถส่งสลิปใหม่ได้`,
      title: "สลิปไม่ผ่าน",
      tone: "border-red-200 bg-red-50 text-red-700",
    };
  }

  if (latestPayment?.verification_status === "submitted") {
    return {
      message:
        latestPayment.verification_provider === "slipok"
          ? "ระบบบันทึกสลิปแล้ว รอการตรวจจาก SlipOK หรือแอดมิน"
          : "ระบบบันทึกสลิปแล้ว กรุณารอแอดมินตรวจและอนุมัติ",
      title: "ส่งสลิปแล้ว รอตรวจ",
      tone: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  return {
    message: "แนบสลิปโอนเงินเพื่อให้แอดมินตรวจและยืนยันการชำระเงิน",
    title: "ยังไม่ส่งสลิป",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  };
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

function handleQrImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;

  if (image.src.endsWith("/mock-promptpay-qr.svg")) {
    return;
  }

  image.src = "/mock-promptpay-qr.svg";
  image.alt = "Fallback PromptPay QR code";
}

function PaymentInstructionPanel({
  amount,
  displaySettings,
  paymentMethod,
}: {
  amount: number;
  displaySettings: PaymentDisplaySettings;
  paymentMethod: "promptpay" | "bank_transfer";
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-slate-50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {paymentMethod === "promptpay" ? (
          <>
            <img
              alt="PromptPay QR code"
              className="h-40 w-40 rounded-md border border-[var(--line)] bg-white p-2"
              onError={handleQrImageError}
              src={
                displaySettings.promptPayQrImageUrl ??
                mockPaymentSettings.promptPay.qrImageUrl
              }
            />
            <div className="grid gap-3 text-sm">
              <p className="font-semibold text-[var(--foreground)]">
                สแกน QR เพื่อชำระเงิน
              </p>
              <DetailItem
                label="ชื่อผู้รับ"
                value={displaySettings.promptPayDisplayName}
              />
              <DetailItem
                label="PromptPay"
                value={displaySettings.promptPayId ?? "-"}
              />
              <DetailItem
                label="ยอดที่ต้องชำระ"
                value={currencyFormatter.format(amount)}
              />
              {displaySettings.instructions ? (
                <p className="text-xs leading-5 text-amber-700">
                  {displaySettings.instructions}
                </p>
              ) : null}
              {displaySettings.isFallback ? (
                <p className="text-xs leading-5 text-red-700">
                  ระบบยังใช้ QR ทดสอบอยู่ กรุณาให้แอดมินตั้งค่าช่องทางชำระเงินจริงก่อนใช้งานจริง
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="grid gap-3 text-sm">
            <p className="font-semibold text-[var(--foreground)]">
              โอนเข้าบัญชีธนาคาร
            </p>
            <DetailItem
              label="ธนาคาร"
              value={displaySettings.bankName ?? "-"}
            />
            <DetailItem
              label="เลขบัญชี"
              value={displaySettings.bankAccountNumber ?? "-"}
            />
            <DetailItem
              label="ชื่อบัญชี"
              value={displaySettings.bankAccountName ?? "-"}
            />
            <DetailItem
              label="สาขา"
              value={displaySettings.bankBranch ?? "-"}
            />
            <DetailItem
              label="ยอดที่ต้องชำระ"
              value={currencyFormatter.format(amount)}
            />
            {displaySettings.instructions ? (
              <p className="text-xs leading-5 text-amber-700">
                {displaySettings.instructions}
              </p>
            ) : null}
            {displaySettings.isFallback ? (
              <p className="text-xs leading-5 text-red-700">
                ระบบยังใช้บัญชีทดสอบอยู่ กรุณาให้แอดมินตั้งค่าช่องทางชำระเงินจริงก่อนใช้งานจริง
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentSlipUploadPanel({
  onPaymentUpdated,
  order,
  paymentSetting,
  userId,
}: {
  onPaymentUpdated: (
    payment: ProductPayment,
    orderPaymentStatus?: ProductOrderWithItems["payment_status"],
  ) => void;
  order: ProductOrderWithItems;
  paymentSetting: PaymentSetting | null;
  userId: string;
}) {
  const latestPayment = order.payments[0] ?? null;
  const paymentNotice = getPaymentNotice(order, latestPayment);
  const displaySettings = getPaymentDisplaySettings(paymentSetting);
  const hasPaymentMethod =
    displaySettings.promptPayEnabled || displaySettings.bankTransferEnabled;
  const hasPayableAmount = order.total_amount > 0;
  const canSubmit =
    order.status !== "cancelled" &&
    order.payment_status !== "paid" &&
    hasPaymentMethod &&
    hasPayableAmount &&
    (!latestPayment ||
      latestPayment.payment_status === "failed" ||
      latestPayment.verification_status === "failed" ||
      latestPayment.verification_status === "not_submitted" ||
      latestPayment.verification_status === "rejected");
  const [paymentMethod, setPaymentMethod] =
    useState<"promptpay" | "bank_transfer">("promptpay");
  const [amount, setAmount] = useState(String(order.total_amount));
  const [slipReference, setSlipReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitState, setSubmitState] = useState<PaymentSubmitState>({
    error: null,
    status: "idle",
  });
  const resolvedPaymentMethod =
    paymentMethod === "promptpay" && displaySettings.promptPayEnabled
      ? "promptpay"
      : paymentMethod === "bank_transfer" && displaySettings.bankTransferEnabled
        ? "bank_transfer"
        : displaySettings.promptPayEnabled
          ? "promptpay"
          : "bank_transfer";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasPaymentMethod) {
      setSubmitState({
        error: "ยังไม่มีช่องทางชำระเงินที่เปิดใช้งาน",
        status: "error",
      });
      return;
    }

    if (!file) {
      setSubmitState({
        error: "กรุณาแนบรูปสลิป",
        status: "error",
      });
      return;
    }

    const resolvedAmount = Number(amount);

    if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
      setSubmitState({
        error: "กรุณากรอกยอดเงินให้ถูกต้อง",
        status: "error",
      });
      return;
    }

    setSubmitState({
      error: null,
      status: "submitting",
    });

    const supabase = createClient();
    const { data, error } = await submitProductPaymentSlip(supabase, userId, {
      amount: resolvedAmount,
      file,
      orderId: order.id,
      paymentMethod: resolvedPaymentMethod,
      slipReference: slipReference.trim() || null,
    });

    if (error) {
      setSubmitState({
        error: error.message,
        status: "error",
      });
      return;
    }

    if (!data) {
      setSubmitState({
        error: "ไม่สามารถบันทึกหลักฐานการชำระเงินได้",
        status: "error",
      });
      return;
    }

    setSubmitState({
      error: null,
      status: "success",
    });
    setFile(null);
    setSlipReference("");
    onPaymentUpdated(data, "pending");
  }

  return (
    <section
      className="mt-5 scroll-mt-6 rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm"
      id="payment"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--brand)]">
            หลักฐานการชำระเงิน
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            แนบสลิปโอนเงินแล้วรอแอดมินตรวจ หากสลิปไม่ผ่านจะส่งใหม่ได้
          </p>
        </div>
        <span
          className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${
            latestPayment
              ? getVerificationStatusStyle(latestPayment.verification_status)
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {latestPayment
            ? formatVerificationStatus(latestPayment.verification_status)
            : "ยังไม่ส่งสลิป"}
        </span>
      </div>

      <div
        className={`mt-4 rounded-md border p-3 text-sm leading-6 ${paymentNotice.tone}`}
      >
        <p className="font-semibold">{paymentNotice.title}</p>
        <p className="mt-1">{paymentNotice.message}</p>
      </div>

      {!hasPaymentMethod ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
          ยังไม่มีช่องทางชำระเงินที่เปิดใช้งาน กรุณาติดต่ออู่ก่อนส่งสลิป
        </div>
      ) : null}

      {!hasPayableAmount ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
          ยอดรวมของออเดอร์นี้เป็น 0 บาท จึงยังไม่สามารถส่งสลิปได้ กรุณาให้แอดมินตรวจราคาสินค้าหรือสร้างออเดอร์ใหม่หลังตั้งราคาสินค้า
        </div>
      ) : null}

      {latestPayment ? (
        <dl className="mt-4 grid gap-3 rounded-md bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <DetailItem
            label="วิธีชำระ"
            value={formatPaymentMethod(latestPayment.payment_method)}
          />
          <DetailItem
            label="ยอดที่ส่งตรวจ"
            value={currencyFormatter.format(latestPayment.amount)}
          />
          <DetailItem
            label="เลขอ้างอิงสลิป"
            value={latestPayment.slip_reference ?? "-"}
          />
          <DetailItem
            label="ส่งเมื่อ"
            value={
              latestPayment.submitted_at
                ? formatDateTime(latestPayment.submitted_at)
                : "-"
            }
          />
          <DetailItem
            label="ตรวจเมื่อ"
            value={
              latestPayment.verified_at
                ? formatDateTime(latestPayment.verified_at)
                : "-"
            }
          />
          <DetailItem
            label="ผลตรวจ"
            value={formatVerificationStatus(latestPayment.verification_status)}
          />
          <DetailItem
            label="ตรวจโดย"
            value={getPaymentVerifierLabel(latestPayment)}
          />
          <DetailItem
            label="เหตุผลที่ไม่ผ่าน"
            value={latestPayment.rejected_reason ?? "-"}
          />
        </dl>
      ) : null}

      {canSubmit ? (
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold text-[var(--foreground)]">
              วิธีชำระเงิน
            </legend>
            {displaySettings.promptPayEnabled ? (
              <label className="flex min-h-12 items-center gap-3 rounded-md border border-[var(--line)] bg-white px-4 text-sm text-[var(--foreground)]">
                <input
                  checked={resolvedPaymentMethod === "promptpay"}
                  name="paymentMethod"
                  onChange={() => setPaymentMethod("promptpay")}
                  type="radio"
                />
                PromptPay / QR
              </label>
            ) : null}
            {displaySettings.bankTransferEnabled ? (
              <label className="flex min-h-12 items-center gap-3 rounded-md border border-[var(--line)] bg-white px-4 text-sm text-[var(--foreground)]">
                <input
                  checked={resolvedPaymentMethod === "bank_transfer"}
                  name="paymentMethod"
                  onChange={() => setPaymentMethod("bank_transfer")}
                  type="radio"
                />
                โอนเข้าบัญชีธนาคาร
              </label>
            ) : null}
          </fieldset>

          <PaymentInstructionPanel
            amount={order.total_amount}
            displaySettings={displaySettings}
            paymentMethod={resolvedPaymentMethod}
          />

          <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
            ยอดเงินบนสลิป
            <input
              className="min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)]"
              min="1"
              onChange={(event) => setAmount(event.target.value)}
              required
              step="0.01"
              type="number"
              value={amount}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
            เลขอ้างอิงสลิป
            <input
              className="min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--brand)]"
              onChange={(event) => setSlipReference(event.target.value)}
              placeholder="ถ้ามี เช่น เลขอ้างอิงจากแอปธนาคาร"
              value={slipReference}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
            รูปสลิป
            <input
              accept="image/png,image/jpeg"
              className="min-h-11 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
              type="file"
            />
          </label>

          {submitState.status === "error" ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
              {submitState.error}
            </div>
          ) : null}

          {submitState.status === "success" ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]">
              บันทึกหลักฐานการชำระเงินแล้ว
            </div>
          ) : null}

          <button
            className="min-h-11 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitState.status === "submitting"}
            type="submit"
          >
            {submitState.status === "submitting"
              ? "กำลังบันทึกสลิป..."
              : latestPayment
                ? "ส่งสลิปใหม่"
                : "ส่งหลักฐานการชำระเงิน"}
          </button>
        </form>
      ) : (
        <div className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
          {order.payment_status === "paid"
            ? "ออเดอร์นี้ชำระเงินแล้ว จึงไม่ต้องส่งสลิปเพิ่ม"
            : latestPayment?.verification_status === "submitted"
              ? "ส่งสลิปแล้ว กรุณารอแอดมินตรวจ หากไม่ผ่านจึงจะส่งใหม่ได้"
              : !hasPaymentMethod
                ? "ยังไม่มีช่องทางชำระเงินที่เปิดใช้งาน กรุณาติดต่ออู่"
                : !hasPayableAmount
                  ? "ออเดอร์ยอดรวม 0 บาท ยังไม่สามารถส่งสลิปได้"
              : "ออเดอร์นี้ไม่สามารถส่งสลิปใหม่ได้ในสถานะปัจจุบัน"}
        </div>
      )}
    </section>
  );
}

export function CustomerProductOrderDetailPanel({
  orderId,
}: {
  orderId: string;
}) {
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    order: null,
    paymentSetting: null,
    status: "loading",
    userId: null,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadOrder() {
      setLoadState({
        error: null,
        order: null,
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
          error: sessionError.message,
          order: null,
          paymentSetting: null,
          status: "error",
          userId: null,
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          error: null,
          order: null,
          paymentSetting: null,
          status: "signed-out",
          userId: null,
        });
        return;
      }

      const { data, error } = await getCustomerProductOrderById(
        supabase,
        session.user.id,
        orderId,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          error: error.message,
          order: null,
          paymentSetting: null,
          status: "error",
          userId: null,
        });
        return;
      }

      if (!data) {
        setLoadState({
          error: null,
          order: null,
          paymentSetting: null,
          status: "not-found",
          userId: session.user.id,
        });
        return;
      }

      const paymentSettingResult = await getActivePaymentSetting(supabase);

      if (!isMounted) {
        return;
      }

      setLoadState({
        error: null,
        order: data,
        paymentSetting: paymentSettingResult.data ?? null,
        status: "ready",
        userId: session.user.id,
      });
    }

    loadOrder();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        loadOrder();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [orderId, refreshKey]);

  useEffect(() => {
    if (loadState.status !== "ready" || window.location.hash !== "#payment") {
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById("payment")?.scrollIntoView({
        block: "start",
      });
    });
  }, [loadState.status]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
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
              รายละเอียดคำสั่งซื้อสินค้า
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ตรวจรายการสินค้า วิธีรับสินค้า สถานะออเดอร์ และยอดเงินของออเดอร์นี้
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/my-product-orders"
          >
            กลับไปคำสั่งซื้อ
          </Link>
          <button
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            รีเฟรชสถานะ
          </button>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดคำสั่งซื้อ...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อนดูคำสั่งซื้อ</p>
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
          <div className="max-w-lg rounded-lg border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)] shadow-sm">
            <p className="font-semibold text-[var(--foreground)]">
              ไม่พบคำสั่งซื้อ
            </p>
            <p className="mt-1">
              ออเดอร์นี้อาจไม่มีอยู่ หรือไม่ได้เป็นของบัญชีที่เข้าสู่ระบบอยู่
            </p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/my-product-orders"
            >
              กลับไปคำสั่งซื้อ
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--brand)]">
                    {loadState.order.order_number}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-[var(--foreground)]">
                    {formatDateTime(loadState.order.created_at)}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getOrderStatusStyle(
                      loadState.order.status,
                    )}`}
                  >
                    {formatOrderStatus(loadState.order.status)}
                  </span>
                  <span
                    className={`w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${getPaymentStatusStyle(
                      loadState.order.payment_status,
                    )}`}
                  >
                    {formatPaymentStatus(loadState.order.payment_status)}
                  </span>
                </div>
              </div>

              {loadState.order.status === "cancelled" ? (
                <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                  <p className="font-semibold">คำสั่งซื้อนี้ถูกยกเลิกแล้ว</p>
                  <p className="mt-1">
                    รายการสินค้านี้จะไม่ถูกจัดเตรียมหรือจัดส่ง หากมีข้อสงสัยเรื่องการชำระเงิน กรุณาติดต่ออู่
                  </p>
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                {loadState.order.items.length > 0 ? (
                  loadState.order.items.map((item) => (
                    <div
                      className="grid gap-3 rounded-lg border border-[var(--line)] bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_110px_140px]"
                      key={item.id}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <ProductImageThumb
                          alt={`รูปสินค้า ${item.product?.name ?? "สินค้า"}`}
                          size="md"
                          src={item.product?.image_url}
                        />
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">
                            {item.product?.name ?? "สินค้า"}
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {item.product?.category?.name ?? "ไม่พบหมวดสินค้า"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            SKU: {item.product?.sku ?? "-"}
                          </p>
                        </div>
                      </div>
                      <div className="text-sm">
                        <p className="text-[var(--muted)]">จำนวน</p>
                        <p className="mt-1 font-semibold text-[var(--foreground)]">
                          {item.quantity}
                        </p>
                      </div>
                      <div className="text-sm sm:text-right">
                        <p className="text-[var(--muted)]">รวม</p>
                        <p className="mt-1 font-semibold text-[var(--foreground)]">
                          {currencyFormatter.format(item.total_price)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {currencyFormatter.format(item.unit_price)} / ชิ้น
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--line)] bg-slate-50 p-4 text-sm text-[var(--muted)]">
                    ไม่พบรายการสินค้าในคำสั่งซื้อนี้
                  </div>
                )}
              </div>

              {loadState.order.note ? (
                <div className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
                  <p className="font-semibold text-[var(--foreground)]">
                    หมายเหตุ
                  </p>
                  <p className="mt-2">{loadState.order.note}</p>
                </div>
              ) : null}

              <p className="mt-5 break-all text-xs text-[var(--muted)]">
                รหัสออเดอร์: {loadState.order.id}
              </p>
            </article>

            <PaymentSlipUploadPanel
              onPaymentUpdated={(payment, orderPaymentStatus) => {
                setLoadState({
                  ...loadState,
                  order: {
                    ...loadState.order,
                    payment_status:
                      orderPaymentStatus ?? loadState.order.payment_status,
                    payments: [
                      payment,
                      ...loadState.order.payments.filter(
                        (item) => item.id !== payment.id,
                      ),
                    ],
                  },
                });
              }}
              order={loadState.order}
              paymentSetting={loadState.paymentSetting}
              userId={loadState.userId}
            />
          </div>

          <aside className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <p className="text-sm font-semibold text-[var(--brand)]">
              สรุปคำสั่งซื้อ
            </p>
            <dl className="mt-4 space-y-4 text-sm">
              <DetailItem
                label="วิธีรับสินค้า"
                value={formatDeliveryMethod(loadState.order.delivery_method)}
              />
              <DetailItem
                label="สร้างเมื่อ"
                value={formatDateTime(loadState.order.created_at)}
              />
              <DetailItem
                label="อัปเดตล่าสุด"
                value={formatDateTime(loadState.order.updated_at)}
              />
              <div className="border-t border-[var(--line)] pt-4">
                <dt className="text-sm text-[var(--muted)]">ยอดสินค้า</dt>
                <dd className="mt-1 font-semibold text-[var(--foreground)]">
                  {currencyFormatter.format(loadState.order.subtotal_amount)}
                </dd>
              </div>
              <DetailItem
                label="ค่าจัดส่ง"
                value={currencyFormatter.format(loadState.order.delivery_fee)}
              />
              <div className="border-t border-[var(--line)] pt-4">
                <dt className="text-sm text-[var(--muted)]">ยอดรวม</dt>
                <dd className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                  {currencyFormatter.format(loadState.order.total_amount)}
                </dd>
              </div>
            </dl>

            {loadState.order.delivery_method === "delivery" ? (
              <div className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
                <p className="font-semibold text-[var(--foreground)]">
                  ที่อยู่จัดส่ง
                </p>
                <p className="mt-2 whitespace-pre-line">
                  {loadState.order.delivery_address ?? "-"}
                </p>
              </div>
            ) : null}

            <Link
              className="mt-5 flex min-h-10 items-center justify-center rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
              href="/products"
            >
              เลือกสินค้าเพิ่ม
            </Link>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
