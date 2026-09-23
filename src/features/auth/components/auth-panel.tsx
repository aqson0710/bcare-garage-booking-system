"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DiagonalWaves } from "@/components/diagonal-waves";
import { getCurrentProfile, type ProfileRole } from "@/features/auth";
import { useSiteLogoUrl } from "@/features/home";
import { createClient } from "@/lib/supabase/browser";

type AuthMode = "login" | "register" | "forgot";

type AuthMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

function getPostLoginPath(role: ProfileRole | null | undefined) {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "technician") {
    return "/technician";
  }

  return "/";
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4.2M6.5 6.6C4 8.3 2 12 2 12s3.5 7 10 7a10 10 0 0 0 3.4-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

// Shared full-screen backdrop for every auth-related page (login/register
// and the password-reset page) - a dark gradient with soft brand-green
// glow blobs and a pair of slow, low-opacity waves drifting diagonally
// across the screen, instead of a plain flat background. Kept out of the
// site's normal nav/header shell so it reads as a dedicated auth screen.
export function AuthShell({ children }: { children: React.ReactNode }) {
  const logoUrl = useSiteLogoUrl();

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--background)] via-[var(--background)] to-[var(--accent-soft)]" />
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[var(--brand)]/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-[var(--brand-strong)]/10 blur-3xl" />

        <DiagonalWaves />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Link
            className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-[var(--foreground)]"
            href="/"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="BCare"
                className="h-12 w-auto max-w-[11rem] object-contain"
                src={logoUrl}
              />
            ) : null}
            <span className="text-[var(--brand-strong)]">B</span>Care
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-2xl sm:p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(null);

  function resetForm(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setMessage(null);
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setMessage({ text: "กรุณากรอกอีเมลที่ใช้สมัครบัญชี", tone: "error" });
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/reset-password`
            : undefined,
      },
    );
    setIsSubmitting(false);

    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    setMessage({
      text: "ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปที่อีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมาย",
      tone: "success",
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (mode === "forgot") {
      await handleForgotPassword();
      return;
    }

    if (!email.trim()) {
      setMessage({ text: "กรุณากรอกอีเมล", tone: "error" });
      return;
    }

    if (password.length < 6) {
      setMessage({
        text: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
        tone: "error",
      });
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setMessage({
        text: "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง",
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      setIsSubmitting(false);

      if (error) {
        setMessage({ text: error.message, tone: "error" });
        return;
      }

      setMessage({
        text: data.session
          ? "สมัครบัญชีและเข้าสู่ระบบเรียบร้อยแล้ว"
          : "สมัครบัญชีเรียบร้อยแล้ว หากเปิดยืนยันอีเมลไว้ กรุณาตรวจสอบอีเมลของคุณ",
        tone: "success",
      });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    setMessage({ text: "เข้าสู่ระบบเรียบร้อยแล้ว", tone: "success" });
    const profileResult = data.user
      ? await getCurrentProfile(supabase, data.user.id)
      : null;
    router.push(getPostLoginPath(profileResult?.data?.role));
    router.refresh();
  }

  const passwordsMatch =
    confirmPassword.length === 0 || password === confirmPassword;

  return (
    <AuthShell>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {mode === "forgot" ? "ลืมรหัสผ่าน?" : "ยินดีต้อนรับ !"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {mode === "forgot"
            ? "กรอกอีเมลที่ใช้สมัครบัญชี เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้"
            : "เข้าสู่ระบบหรือสมัครบัญชีเพื่อใช้งานการจองบริการ คำสั่งซื้อ และการแจ้งเตือน"}
        </p>
      </div>

      {mode !== "forgot" ? (
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-1">
          <button
            className={
              mode === "login"
                ? "min-h-9 rounded-md bg-[var(--brand)] text-sm font-semibold text-white"
                : "min-h-9 rounded-md text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
            }
            onClick={() => resetForm("login")}
            type="button"
          >
            เข้าสู่ระบบ
          </button>
          <button
            className={
              mode === "register"
                ? "min-h-9 rounded-md bg-[var(--brand)] text-sm font-semibold text-white"
                : "min-h-9 rounded-md text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]"
            }
            onClick={() => resetForm("register")}
            type="button"
          >
            สมัครบัญชี
          </button>
        </div>
      ) : null}

      <form className="mt-6" onSubmit={handleSubmit}>
        <div>
          <label
            className="text-sm font-medium text-[var(--foreground)]"
            htmlFor="email"
          >
            อีเมล
          </label>
          <input
            className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            id="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </div>

        {mode !== "forgot" ? (
          <div className="mt-4">
            <label
              className="text-sm font-medium text-[var(--foreground)]"
              htmlFor="password"
            >
              รหัสผ่าน
            </label>
            <div className="relative mt-2">
              <input
                className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>
        ) : null}

        {mode === "register" ? (
          <div className="mt-4">
            <label
              className="text-sm font-medium text-[var(--foreground)]"
              htmlFor="confirmPassword"
            >
              ยืนยันรหัสผ่าน
            </label>
            <div className="relative mt-2">
              <input
                className={
                  passwordsMatch
                    ? "min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                    : "min-h-11 w-full rounded-md border border-[var(--danger)] bg-[var(--surface-muted)] px-3 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[var(--danger)]"
                }
                id="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
              />
              <button
                aria-label={
                  showConfirmPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)]"
                onClick={() => setShowConfirmPassword((value) => !value)}
                type="button"
              >
                <EyeIcon open={showConfirmPassword} />
              </button>
            </div>
            {confirmPassword.length > 0 ? (
              <p
                className={
                  passwordsMatch
                    ? "mt-1.5 text-xs font-medium text-emerald-400"
                    : "mt-1.5 text-xs font-medium text-[var(--danger)]"
                }
              >
                {passwordsMatch
                  ? "รหัสผ่านตรงกัน"
                  : "รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง"}
              </p>
            ) : null}
          </div>
        ) : null}

        {mode === "login" ? (
          <div className="mt-4 flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-[var(--muted)]">
              <input
                checked={rememberMe}
                className="h-4 w-4 rounded border-[var(--line)] accent-[var(--brand)]"
                onChange={(event) => setRememberMe(event.target.checked)}
                type="checkbox"
              />
              จดจำฉัน
            </label>
            <button
              className="font-medium text-[var(--brand-strong)] hover:underline"
              onClick={() => resetForm("forgot")}
              type="button"
            >
              ลืมรหัสผ่าน?
            </button>
          </div>
        ) : null}

        <button
          className="mt-6 min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? "กำลังดำเนินการ..."
            : mode === "forgot"
              ? "ส่งลิงก์รีเซ็ตรหัสผ่าน"
              : mode === "register"
                ? "สร้างบัญชี"
                : "เข้าสู่ระบบ"}
        </button>

        {mode === "forgot" ? (
          <button
            className="mt-3 w-full text-center text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={() => resetForm("login")}
            type="button"
          >
            ย้อนกลับไปเข้าสู่ระบบ
          </button>
        ) : null}

        {message ? (
          <div
            className={
              message.tone === "error"
                ? "mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                : "mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-[var(--brand-strong)]"
            }
          >
            {message.text}
          </div>
        ) : null}
      </form>
    </AuthShell>
  );
}
