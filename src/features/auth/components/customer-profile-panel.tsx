"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  getCurrentProfile,
  upsertCurrentProfile,
  type Profile,
} from "@/features/auth";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; profile: null; error: null; userId: null; email: null }
  | {
      status: "signed-out";
      profile: null;
      error: null;
      userId: null;
      email: null;
    }
  | {
      status: "ready";
      profile: Profile | null;
      error: null;
      userId: string;
      email: string | null;
    }
  | { status: "error"; profile: null; error: string; userId: null; email: null };

type SaveState =
  | { status: "idle"; message: null; error: null }
  | { status: "saving"; message: null; error: null }
  | { status: "success"; message: string; error: null }
  | { status: "error"; message: null; error: string };

type UploadState =
  | { status: "idle"; message: null; error: null }
  | { status: "uploading"; message: null; error: null }
  | { status: "uploaded"; message: string; error: null }
  | { status: "error"; message: null; error: string };

const profileImagesBucket = "profile-images";

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") {
    return "jpg";
  }

  if (extension === "png" || extension === "webp") {
    return extension;
  }

  return "jpg";
}

function getRoleLabel(profile: Profile | null) {
  if (!profile) {
    return "ลูกค้า";
  }

  if (profile.role === "admin") {
    return "ผู้ดูแลระบบ";
  }

  if (profile.role === "technician") {
    return "ช่าง";
  }

  return "ลูกค้า";
}

function getInitials(name: string, email: string | null) {
  const text = name.trim() || email?.trim() || "BCare";
  return text.slice(0, 2).toUpperCase();
}

export function CustomerProfilePanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    email: null,
    error: null,
    profile: null,
    status: "loading",
    userId: null,
  });
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
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

    async function loadProfile() {
      setLoadState({
        email: null,
        error: null,
        profile: null,
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
          email: null,
          error: sessionError.message,
          profile: null,
          status: "error",
          userId: null,
        });
        return;
      }

      if (!session?.user) {
        setFullName("");
        setPhoneNumber("");
        setAvatarUrl("");
        setLoadState({
          email: null,
          error: null,
          profile: null,
          status: "signed-out",
          userId: null,
        });
        return;
      }

      const { data, error } = await getCurrentProfile(
        supabase,
        session.user.id,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          email: null,
          error: error.message,
          profile: null,
          status: "error",
          userId: null,
        });
        return;
      }

      setFullName(data?.full_name ?? "");
      setPhoneNumber(data?.phone_number ?? "");
      setAvatarUrl(data?.avatar_url ?? "");
      setLoadState({
        email: session.user.email ?? null,
        error: null,
        profile: data ?? null,
        status: "ready",
        userId: session.user.id,
      });
    }

    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loadState.status !== "ready") {
      return;
    }

    if (!fullName.trim()) {
      setSaveState({
        error: "กรุณากรอกชื่อ-นามสกุล",
        message: null,
        status: "error",
      });
      return;
    }

    if (!phoneNumber.trim()) {
      setSaveState({
        error: "กรุณากรอกเบอร์โทรศัพท์",
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

    const supabase = createClient();
    const { data, error } = await upsertCurrentProfile(supabase, {
      email: loadState.email,
      avatarUrl: avatarUrl.trim() || null,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      userId: loadState.userId,
    });

    if (error) {
      setSaveState({
        error: error.message,
        message: null,
        status: "error",
      });
      return;
    }

    setFullName(data.full_name);
    setPhoneNumber(data.phone_number);
    setAvatarUrl(data.avatar_url ?? "");
    setLoadState({
      ...loadState,
      profile: data,
    });
    setSaveState({
      error: null,
      message: "บันทึกโปรไฟล์เรียบร้อยแล้ว",
      status: "success",
    });
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || loadState.status !== "ready") {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setUploadState({
        error: "กรุณาเลือกรูปภาพเท่านั้น",
        message: null,
        status: "error",
      });
      return;
    }

    if (!fullName.trim() || !phoneNumber.trim()) {
      setUploadState({
        error: "กรุณากรอกชื่อและเบอร์โทรศัพท์ก่อนอัปโหลดรูปโปรไฟล์",
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

    const supabase = createClient();
    const extension = getFileExtension(file);
    const uploadPath = `${loadState.userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const uploadResult = await supabase.storage
      .from(profileImagesBucket)
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
            ? "ยังไม่มี bucket profile-images กรุณารันไฟล์ supabase/profile-avatar-schema.sql ก่อน"
            : uploadResult.error.message,
        message: null,
        status: "error",
      });
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(profileImagesBucket).getPublicUrl(uploadPath);

    const { data, error } = await upsertCurrentProfile(supabase, {
      email: loadState.email,
      avatarUrl: publicUrl,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      userId: loadState.userId,
    });

    if (error) {
      setUploadState({
        error: error.message,
        message: null,
        status: "error",
      });
      return;
    }

    setAvatarUrl(data.avatar_url ?? publicUrl);
    setFullName(data.full_name);
    setPhoneNumber(data.phone_number);
    setLoadState({
      ...loadState,
      profile: data,
    });
    setUploadState({
      error: null,
      message: "อัปโหลดและบันทึกรูปโปรไฟล์เรียบร้อยแล้ว",
      status: "uploaded",
    });
  }

  const roleLabel =
    loadState.status === "ready" ? getRoleLabel(loadState.profile) : "ลูกค้า";
  const initials =
    loadState.status === "ready"
      ? getInitials(fullName, loadState.email)
      : "BC";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[var(--brand)]">
              บัญชีลูกค้า
            </p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
              โปรไฟล์ของฉัน
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              จัดการข้อมูลติดต่อที่ใช้กับการจองบริการ คำสั่งซื้อ และการติดตามงานซ่อม
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--foreground)]"
            href="/auth"
          >
            จัดการการเข้าสู่ระบบ
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดโปรไฟล์...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="text-lg font-bold">ต้องเข้าสู่ระบบก่อน</p>
            <p className="mt-2">
              หน้าโปรไฟล์ใช้สำหรับบัญชีลูกค้าที่เข้าสู่ระบบแล้ว
            </p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปหน้าเข้าสู่ระบบ
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
        <section className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form
            className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm"
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-center">
              {avatarUrl ? (
                <div
                  aria-label="รูปโปรไฟล์"
                  className="h-16 w-16 shrink-0 rounded-md border border-[var(--line)] bg-cover bg-center"
                  role="img"
                  style={{ backgroundImage: `url(${avatarUrl})` }}
                />
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-[var(--brand)] text-xl font-black text-[var(--foreground)]">
                  {initials}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--brand)]">
                  ข้อมูลหลักของบัญชี
                </p>
                <h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">
                  {fullName.trim() || "ยังไม่ได้กรอกชื่อ"}
                </h2>
                <p className="mt-1 break-all text-sm text-[var(--muted)]">
                  {loadState.email ?? "-"}
                </p>
              </div>
            </div>

            <section className="mt-5 rounded-md border border-[var(--line)] bg-slate-50 p-4">
              <label className="text-sm font-medium text-[var(--foreground)]">
                รูปโปรไฟล์
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="mt-2 block w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"
                  disabled={uploadState.status === "uploading"}
                  onChange={handleAvatarUpload}
                  type="file"
                />
              </label>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                รองรับ PNG, JPG, WEBP ขนาดไม่เกิน 2MB และบันทึก URL ลงโปรไฟล์ของคุณ
              </p>
              {uploadState.status === "uploading" ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  กำลังอัปโหลดรูปโปรไฟล์...
                </div>
              ) : null}
              {uploadState.status === "uploaded" ? (
                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-[var(--brand-strong)]">
                  {uploadState.message}
                </div>
              ) : null}
              {uploadState.status === "error" ? (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {uploadState.error}
                </div>
              ) : null}
            </section>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-[var(--foreground)]">
                ชื่อ-นามสกุล
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) => setFullName(event.target.value)}
                  value={fullName}
                />
              </label>

              <label className="text-sm font-medium text-[var(--foreground)]">
                เบอร์โทรศัพท์
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  inputMode="tel"
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  value={phoneNumber}
                />
              </label>

              <label className="text-sm font-medium text-[var(--foreground)]">
                อีเมล
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-slate-50 px-3 text-sm text-[var(--muted)]"
                  readOnly
                  value={loadState.email ?? "-"}
                />
              </label>

              <label className="text-sm font-medium text-[var(--foreground)]">
                ประเภทบัญชี
                <input
                  className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-slate-50 px-3 text-sm text-[var(--muted)]"
                  readOnly
                  value={roleLabel}
                />
              </label>
            </div>

            <div className="mt-5 rounded-md border border-dashed border-[var(--line)] bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
              ข้อมูลนี้จะถูกใช้เติมข้อมูลเริ่มต้นในหน้าจองบริการและช่วยให้อู่ติดต่อกลับได้ถูกต้อง
            </div>

            <button
              className="mt-5 min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saveState.status === "saving"}
              type="submit"
            >
              {saveState.status === "saving"
                ? "กำลังบันทึก..."
                : "บันทึกโปรไฟล์"}
            </button>

            {saveState.status === "success" ? (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-[var(--brand-strong)]">
                {saveState.message}
              </div>
            ) : null}

            {saveState.status === "error" ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {saveState.error}
              </div>
            ) : null}
          </form>

          <aside className="space-y-4">
            <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--brand)]">
                ใช้ข้อมูลนี้กับ
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                <p>การจองบริการและการติดต่อกลับจากอู่</p>
                <p>คำสั่งซื้อสินค้าและหลักฐานการชำระเงิน</p>
                <p>ประวัติรถและสถานะงานซ่อมของคุณ</p>
              </div>
            </section>

            <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--brand)]">
                ทางลัดของลูกค้า
              </p>
              <div className="mt-4 grid gap-2">
                <Link
                  className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                  href="/my-vehicles"
                >
                  รถของฉัน
                </Link>
                <Link
                  className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                  href="/my-bookings"
                >
                  การจองของฉัน
                </Link>
                <Link
                  className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                  href="/my-product-orders"
                >
                  คำสั่งซื้อสินค้า
                </Link>
                <Link
                  className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
                  href="/notifications"
                >
                  การแจ้งเตือน
                </Link>
              </div>
            </section>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
