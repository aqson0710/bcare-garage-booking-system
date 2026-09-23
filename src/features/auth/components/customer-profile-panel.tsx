"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
const maxAvatarBytes = 2 * 1024 * 1024;

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

function formatMemberSince(dateString: string | undefined) {
  if (!dateString) {
    return null;
  }

  return new Date(dateString).toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
  });
}

// Shared account-settings sidebar - just the sections this app actually
// has (profile + the customer's own vehicles/bookings/orders/
// notifications), styled after a familiar "account settings" layout
// rather than inventing sections the app doesn't back.
function AccountSidebar({
  avatarUrl,
  email,
  fullName,
  initials,
}: {
  avatarUrl: string;
  email: string | null;
  fullName: string;
  initials: string;
}) {
  const shortcuts = [
    { href: "/my-vehicles", label: "รถของฉัน" },
    { href: "/my-bookings", label: "การจองของฉัน" },
    { href: "/my-product-orders", label: "คำสั่งซื้อสินค้า" },
    { href: "/notifications", label: "การแจ้งเตือน" },
  ];

  return (
    <nav className="w-full shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm lg:w-60">
      <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
        {avatarUrl ? (
          <div
            className="h-10 w-10 shrink-0 rounded-full border border-[var(--line)] bg-cover bg-center"
            style={{ backgroundImage: `url(${avatarUrl})` }}
          />
        ) : (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-sm font-black text-[var(--foreground)]">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--foreground)]">
            {fullName.trim() || "ยังไม่ได้กรอกชื่อ"}
          </p>
          <p className="truncate text-xs text-[var(--muted)]">
            {email ?? "-"}
          </p>
        </div>
      </div>

      <p className="mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        บัญชีของฉัน
      </p>
      <div className="mt-2 flex flex-col gap-1">
        <span className="rounded-md bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--brand-strong)]">
          ข้อมูลส่วนตัว
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-1 border-t border-[var(--line)] pt-4">
        {shortcuts.map((shortcut) => (
          <Link
            className="rounded-md px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
            href={shortcut.href}
            key={shortcut.href}
          >
            {shortcut.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function ProfileFormRow({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center">
      <label className="w-full shrink-0 text-sm font-medium text-[var(--foreground)] sm:w-40">
        {label}
      </label>
      <div className="w-full sm:flex-1">{children}</div>
    </div>
  );
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
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

    if (file.size > maxAvatarBytes) {
      setUploadState({
        error: "ขนาดไฟล์ต้องไม่เกิน 2MB",
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
      message: "อัปเดตรูปโปรไฟล์เรียบร้อยแล้ว",
      status: "uploaded",
    });

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  }

  const roleLabel =
    loadState.status === "ready" ? getRoleLabel(loadState.profile) : "ลูกค้า";
  const initials =
    loadState.status === "ready"
      ? getInitials(fullName, loadState.email)
      : "BC";
  const memberSince =
    loadState.status === "ready"
      ? formatMemberSince(loadState.profile?.created_at)
      : null;
  const isUploading = uploadState.status === "uploading";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
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
          <div className="max-w-xl rounded-lg border border-red-200 bg-[var(--surface)] px-5 py-4 text-sm text-[var(--danger)] shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="flex flex-col gap-6 py-6 lg:flex-row lg:items-start">
          <AccountSidebar
            avatarUrl={avatarUrl}
            email={loadState.email}
            fullName={fullName}
            initials={initials}
          />

          <div className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="border-b border-[var(--line)] pb-4">
              <h1 className="text-xl font-bold text-[var(--foreground)]">
                ข้อมูลส่วนตัว
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                จัดการข้อมูลติดต่อที่ใช้กับการจองบริการ คำสั่งซื้อ และงานซ่อมของคุณ
              </p>
            </div>

            <form
              className="grid gap-6 pt-2 lg:grid-cols-[minmax(0,1fr)_200px]"
              onSubmit={handleSubmit}
            >
              <div>
                <div className="divide-y divide-[var(--line)]">
                  <ProfileFormRow label="ชื่อ-นามสกุล">
                    <input
                      className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                      onChange={(event) => setFullName(event.target.value)}
                      value={fullName}
                    />
                  </ProfileFormRow>

                  <ProfileFormRow label="เบอร์โทรศัพท์">
                    <input
                      className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                      inputMode="tel"
                      onChange={(event) => setPhoneNumber(event.target.value)}
                      value={phoneNumber}
                    />
                  </ProfileFormRow>

                  <ProfileFormRow label="อีเมล">
                    <p className="text-sm text-[var(--foreground)]">
                      {loadState.email ?? "-"}
                    </p>
                  </ProfileFormRow>

                  <ProfileFormRow label="ประเภทบัญชี">
                    <p className="text-sm text-[var(--foreground)]">
                      {roleLabel}
                    </p>
                  </ProfileFormRow>

                  {memberSince ? (
                    <ProfileFormRow label="สมาชิกตั้งแต่">
                      <p className="text-sm text-[var(--foreground)]">
                        {memberSince}
                      </p>
                    </ProfileFormRow>
                  ) : null}
                </div>

                <button
                  className="mt-5 min-h-11 rounded-md bg-[var(--brand)] px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
              </div>

              <div className="flex flex-col items-center gap-3 self-start rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-muted)] p-5 text-center">
                {avatarUrl ? (
                  <div
                    className="h-20 w-20 rounded-full border border-[var(--line)] bg-cover bg-center"
                    style={{ backgroundImage: `url(${avatarUrl})` }}
                  />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-[var(--brand)] text-2xl font-black text-[var(--foreground)]">
                    {initials}
                  </div>
                )}

                <button
                  className="min-h-9 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isUploading}
                  onClick={() => avatarInputRef.current?.click()}
                  type="button"
                >
                  {isUploading ? "กำลังอัปโหลด..." : "เลือกรูป"}
                </button>
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={isUploading}
                  onChange={handleAvatarUpload}
                  ref={avatarInputRef}
                  type="file"
                />

                <p className="text-xs leading-5 text-[var(--muted)]">
                  ขนาดไฟล์สูงสุด 2MB
                  <br />
                  รองรับ .JPEG, .PNG, .WEBP
                </p>

                {uploadState.status === "uploaded" ? (
                  <p className="text-xs font-semibold text-[var(--brand-strong)]">
                    {uploadState.message}
                  </p>
                ) : null}

                {uploadState.status === "error" ? (
                  <p className="text-xs font-semibold text-red-700">
                    {uploadState.error}
                  </p>
                ) : null}
              </div>
            </form>
          </div>
        </section>
      ) : null}
    </main>
  );
}
