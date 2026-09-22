"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { FormEvent, SyntheticEvent } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminPaymentSetting,
  saveAdminPaymentSetting,
  type AdminAccessResult,
  type AdminPaymentSetting,
  type AdminPaymentSettingUpdateInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; setting: null; error: null }
  | { status: "signed-out"; access: null; setting: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      setting: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      setting: AdminPaymentSetting | null;
      error: null;
    }
  | { status: "error"; access: null; setting: null; error: string };

type SaveState =
  | { status: "idle"; error: null; message: null }
  | { status: "saving"; error: null; message: null }
  | { status: "saved"; error: null; message: string }
  | { status: "error"; error: string; message: null };

type UploadState =
  | { status: "idle"; error: null; message: null }
  | { status: "uploading"; error: null; message: null }
  | { status: "uploaded"; error: null; message: string }
  | { status: "error"; error: string; message: null };

type PaymentSettingsFormState = {
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string;
  bank_name: string;
  bank_transfer_enabled: boolean;
  payment_instructions: string;
  promptpay_display_name: string;
  promptpay_enabled: boolean;
  promptpay_id: string;
  promptpay_qr_image_url: string;
  status: AdminPaymentSetting["status"];
};

const defaultFormState: PaymentSettingsFormState = {
  bank_account_name: "BigO-RepairCar Co., Ltd.",
  bank_account_number: "123-4-56789-0",
  bank_branch: "สาขาทดสอบ",
  bank_name: "ธนาคารกสิกรไทย",
  bank_transfer_enabled: true,
  payment_instructions:
    "โอนยอดให้ตรงกับคำสั่งซื้อ แล้วแนบสลิปเพื่อให้ระบบตรวจสอบ",
  promptpay_display_name: "BigO-RepairCar",
  promptpay_enabled: true,
  promptpay_id: "099-999-9999",
  promptpay_qr_image_url: "/mock-promptpay-qr.svg",
  status: "active",
};

const previewAmount = 1230;
const paymentAssetsBucket = "payment-assets";
const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function settingToFormState(
  setting: AdminPaymentSetting | null,
): PaymentSettingsFormState {
  if (!setting) {
    return defaultFormState;
  }

  return {
    bank_account_name:
      setting.bank_account_name ?? defaultFormState.bank_account_name,
    bank_account_number:
      setting.bank_account_number ?? defaultFormState.bank_account_number,
    bank_branch: setting.bank_branch ?? "",
    bank_name: setting.bank_name ?? defaultFormState.bank_name,
    bank_transfer_enabled: setting.bank_transfer_enabled,
    payment_instructions: setting.payment_instructions ?? "",
    promptpay_display_name: setting.promptpay_display_name,
    promptpay_enabled: setting.promptpay_enabled,
    promptpay_id: setting.promptpay_id ?? "",
    promptpay_qr_image_url:
      setting.promptpay_qr_image_url ?? defaultFormState.promptpay_qr_image_url,
    status: setting.status,
  };
}

function toNullableText(value: string) {
  return value.trim() || null;
}

function validatePaymentSettings(input: PaymentSettingsFormState) {
  if (!input.promptpay_enabled && !input.bank_transfer_enabled) {
    return "ต้องเปิดอย่างน้อย 1 ช่องทางชำระเงิน";
  }

  if (input.promptpay_enabled) {
    if (!input.promptpay_display_name.trim()) {
      return "กรุณากรอกชื่อผู้รับ PromptPay";
    }

    if (!input.promptpay_qr_image_url.trim()) {
      return "กรุณากรอก URL รูป QR Code";
    }
  }

  if (input.bank_transfer_enabled) {
    if (!input.bank_name.trim()) {
      return "กรุณากรอกชื่อธนาคาร";
    }

    if (!input.bank_account_number.trim()) {
      return "กรุณากรอกเลขบัญชี";
    }

    if (!input.bank_account_name.trim()) {
      return "กรุณากรอกชื่อบัญชี";
    }
  }

  return null;
}

function getSafeQrImageExtension(file: File) {
  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function handleQrImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;

  if (image.src.endsWith("/mock-promptpay-qr.svg")) {
    return;
  }

  image.src = "/mock-promptpay-qr.svg";
  image.alt = "Fallback payment QR preview";
}

function TextInput({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="text-sm font-semibold text-[var(--foreground)]">
      {label}
      <input
        className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function PaymentPreview({ formState }: { formState: PaymentSettingsFormState }) {
  return (
    <aside className="h-fit rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm lg:sticky lg:top-6">
      <p className="text-sm font-semibold text-[var(--brand)]">
        ตัวอย่างหน้าลูกค้า
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Preview นี้ใช้ยอดตัวอย่าง {currencyFormatter.format(previewAmount)}
      </p>

      {formState.status !== "active" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          ตั้งค่านี้ยัง inactive ลูกค้าจะไม่เห็นข้อมูลชุดนี้
        </div>
      ) : null}

      {formState.promptpay_enabled ? (
        <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-4">
          <p className="font-semibold text-[var(--foreground)]">
            PromptPay / QR
          </p>
          <img
            alt="Payment QR preview"
            className="mt-3 h-40 w-40 rounded-md border border-[var(--line)] bg-[var(--surface)] p-2"
            onError={handleQrImageError}
            src={formState.promptpay_qr_image_url || "/mock-promptpay-qr.svg"}
          />
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="text-[var(--muted)]">ชื่อผู้รับ</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {formState.promptpay_display_name || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">PromptPay</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {formState.promptpay_id || "-"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {formState.bank_transfer_enabled ? (
        <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-4">
          <p className="font-semibold text-[var(--foreground)]">
            โอนเข้าบัญชีธนาคาร
          </p>
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="text-[var(--muted)]">ธนาคาร</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {formState.bank_name || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">เลขบัญชี</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {formState.bank_account_number || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">ชื่อบัญชี</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {formState.bank_account_name || "-"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted)]">สาขา</dt>
              <dd className="font-semibold text-[var(--foreground)]">
                {formState.bank_branch || "-"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {formState.payment_instructions.trim() ? (
        <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          {formState.payment_instructions}
        </div>
      ) : null}

      <div className="mt-4 rounded-md bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--muted)]">
        ถ้า QR URL โหลดไม่ได้ preview จะใช้รูปสำรองชั่วคราว แต่ควรแก้ URL หรืออัปโหลดรูปใหม่ก่อนใช้งานจริง
      </div>
    </aside>
  );
}

export function AdminPaymentSettingsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    setting: null,
    status: "loading",
  });
  const [formState, setFormState] =
    useState<PaymentSettingsFormState>(defaultFormState);
  const [saveState, setSaveState] = useState<SaveState>({
    error: null,
    message: null,
    status: "idle",
  });
  const [uploadState, setUploadState] = useState<UploadState>({
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
        setting: null,
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
          setting: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          error: null,
          setting: null,
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
          setting: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminPaymentSetting(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          error:
            error.code === "PGRST205"
              ? "ยังไม่มีตาราง payment_settings กรุณารันไฟล์ supabase/payment-settings-schema.sql ใน Supabase SQL Editor ก่อน"
              : error.message,
          setting: null,
          status: "error",
        });
        return;
      }

      setFormState(settingToFormState(data ?? null));
      setLoadState({
        access,
        error: null,
        setting: data ?? null,
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

  function patchFormState(partial: Partial<PaymentSettingsFormState>) {
    setFormState((current) => ({
      ...current,
      ...partial,
    }));
    setSaveState({
      error: null,
      message: null,
      status: "idle",
    });
  }

  async function handleQrUpload(file: File | null) {
    if (loadState.status !== "ready" || !file) {
      return;
    }

    if (
      file.type !== "image/png" &&
      file.type !== "image/jpeg" &&
      file.type !== "image/webp"
    ) {
      setUploadState({
        error: "รองรับเฉพาะไฟล์ PNG, JPG หรือ WEBP",
        message: null,
        status: "error",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setUploadState({
        error: "ไฟล์ QR ต้องไม่เกิน 2 MB",
        message: null,
        status: "error",
      });
      return;
    }

    setUploadState({
      error: null,
      message: null,
      status: "uploading",
    });

    const extension = getSafeQrImageExtension(file);
    const uploadPath = `qr/default/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    const uploadResult = await supabase.storage
      .from(paymentAssetsBucket)
      .upload(uploadPath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (uploadResult.error) {
      setUploadState({
        error:
          uploadResult.error.message.includes("Bucket not found") ||
          uploadResult.error.message.includes("bucket")
            ? "ยังไม่มี bucket payment-assets กรุณารันไฟล์ supabase/payment-settings-storage.sql ก่อน"
            : uploadResult.error.message,
        message: null,
        status: "error",
      });
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(paymentAssetsBucket).getPublicUrl(uploadPath);

    patchFormState({
      promptpay_qr_image_url: publicUrl,
    });
    setUploadState({
      error: null,
      message: "อัปโหลด QR แล้ว กดบันทึกการตั้งค่าเพื่อใช้งานรูปนี้",
      status: "uploaded",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validatePaymentSettings(formState);

    if (validationError) {
      setSaveState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    setSaveState({
      error: null,
      message: null,
      status: "saving",
    });

    const input: AdminPaymentSettingUpdateInput = {
      bank_account_name: toNullableText(formState.bank_account_name),
      bank_account_number: toNullableText(formState.bank_account_number),
      bank_branch: toNullableText(formState.bank_branch),
      bank_name: toNullableText(formState.bank_name),
      bank_transfer_enabled: formState.bank_transfer_enabled,
      payment_instructions: toNullableText(formState.payment_instructions),
      promptpay_display_name: formState.promptpay_display_name.trim(),
      promptpay_enabled: formState.promptpay_enabled,
      promptpay_id: toNullableText(formState.promptpay_id),
      promptpay_qr_image_url: toNullableText(formState.promptpay_qr_image_url),
      status: formState.status,
      updated_by: loadState.access.allowed ? loadState.access.profile.id : null,
    };
    const supabase = createClient();
    const { data, error } = await saveAdminPaymentSetting(supabase, input);

    if (error) {
      setSaveState({
        error:
          error.code === "PGRST205"
            ? "ยังไม่มีตาราง payment_settings กรุณารันไฟล์ supabase/payment-settings-schema.sql ก่อน"
            : error.message,
        message: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      setting: data,
    });
    setFormState(settingToFormState(data));
    setSaveState({
      error: null,
      message: "บันทึกช่องทางชำระเงินแล้ว",
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
              ตั้งค่าการชำระเงิน
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ตั้งค่า QR Code, PromptPay และบัญชีธนาคารที่ลูกค้าจะเห็นในหน้าชำระเงิน
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            กลับหน้า admin
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดการตั้งค่าชำระเงิน...
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
              ไปที่หน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าหน้านี้</p>
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
        <section className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm"
            onSubmit={handleSubmit}
          >
            <div className="border-b border-[var(--line)] pb-4">
              <p className="text-sm font-semibold text-[var(--brand)]">
                ช่องทางรับเงิน
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                อัปโหลดรูป QR จากเครื่อง หรือใส่ URL รูป QR เองก็ได้
              </p>
            </div>

            <div className="mt-4 grid gap-5">
              <label className="text-sm font-semibold text-[var(--foreground)]">
                สถานะ
                <select
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) =>
                    patchFormState({
                      status: event.target.value as AdminPaymentSetting["status"],
                    })
                  }
                  value={formState.status}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>

              <section className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <label className="flex min-h-10 items-center gap-3 text-sm font-semibold text-[var(--foreground)]">
                  <input
                    checked={formState.promptpay_enabled}
                    onChange={(event) =>
                      patchFormState({
                        promptpay_enabled: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  เปิด PromptPay / QR
                </label>

                <div className="mt-4 grid gap-3">
                  <TextInput
                    label="ชื่อผู้รับ PromptPay"
                    onChange={(value) =>
                      patchFormState({ promptpay_display_name: value })
                    }
                    value={formState.promptpay_display_name}
                  />
                  <TextInput
                    label="เบอร์/เลข PromptPay"
                    onChange={(value) => patchFormState({ promptpay_id: value })}
                    placeholder="เช่น 099-999-9999"
                    value={formState.promptpay_id}
                  />
                  <TextInput
                    label="URL รูป QR Code"
                    onChange={(value) =>
                      patchFormState({ promptpay_qr_image_url: value })
                    }
                    placeholder="/mock-promptpay-qr.svg หรือ URL รูปจริง"
                    value={formState.promptpay_qr_image_url}
                  />
                  <label className="text-sm font-semibold text-[var(--foreground)]">
                    อัปโหลดรูป QR Code
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                      disabled={uploadState.status === "uploading"}
                      onChange={(event) => {
                        void handleQrUpload(event.target.files?.[0] ?? null);
                        event.target.value = "";
                      }}
                      type="file"
                    />
                  </label>

                  {uploadState.status === "uploading" ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                      กำลังอัปโหลด QR...
                    </div>
                  ) : null}

                  {uploadState.status === "uploaded" ? (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]">
                      {uploadState.message}
                    </div>
                  ) : null}

                  {uploadState.status === "error" ? (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                      {uploadState.error}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                <label className="flex min-h-10 items-center gap-3 text-sm font-semibold text-[var(--foreground)]">
                  <input
                    checked={formState.bank_transfer_enabled}
                    onChange={(event) =>
                      patchFormState({
                        bank_transfer_enabled: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  เปิดโอนเข้าบัญชีธนาคาร
                </label>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <TextInput
                    label="ธนาคาร"
                    onChange={(value) => patchFormState({ bank_name: value })}
                    value={formState.bank_name}
                  />
                  <TextInput
                    label="เลขบัญชี"
                    onChange={(value) =>
                      patchFormState({ bank_account_number: value })
                    }
                    value={formState.bank_account_number}
                  />
                  <TextInput
                    label="ชื่อบัญชี"
                    onChange={(value) =>
                      patchFormState({ bank_account_name: value })
                    }
                    value={formState.bank_account_name}
                  />
                  <TextInput
                    label="สาขา"
                    onChange={(value) => patchFormState({ bank_branch: value })}
                    value={formState.bank_branch}
                  />
                </div>
              </section>

              <label className="text-sm font-semibold text-[var(--foreground)]">
                ข้อความแนะนำการชำระเงิน
                <textarea
                  className="mt-2 min-h-24 w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) =>
                    patchFormState({
                      payment_instructions: event.target.value,
                    })
                  }
                  value={formState.payment_instructions}
                />
              </label>

              {saveState.status === "error" ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                  {saveState.error}
                </div>
              ) : null}

              {saveState.status === "saved" ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]">
                  {saveState.message}
                </div>
              ) : null}

              {uploadState.status === "uploaded" &&
              saveState.status !== "saved" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                  อัปโหลด QR แล้ว แต่ยังต้องกดบันทึกการตั้งค่าชำระเงินก่อน ลูกค้าถึงจะเห็นรูปใหม่
                </div>
              ) : null}

              <button
                className="min-h-11 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saveState.status === "saving"}
                type="submit"
              >
                {saveState.status === "saving"
                  ? "กำลังบันทึก..."
                  : "บันทึกการตั้งค่าชำระเงิน"}
              </button>
            </div>
          </form>

          <PaymentPreview formState={formState} />
        </section>
      ) : null}
    </main>
  );
}
