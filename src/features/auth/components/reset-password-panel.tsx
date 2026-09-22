"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { AuthShell } from "./auth-panel";

type ResetMessage = {
  tone: "success" | "error";
  text: string;
};

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

export function ResetPasswordPanel() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<ResetMessage | null>(null);

  useEffect(() => {
    // Clicking the emailed reset link lands here with a recovery token in
    // the URL - supabase-js reads it automatically and fires this event
    // once a temporary session is established, which is what lets
    // updateUser({ password }) below work.
    const supabase = createClient();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
          setIsReady(true);
        }
      },
    );

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsReady(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const passwordsMatch =
    confirmPassword.length === 0 || password === confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 6) {
      setMessage({
        text: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
        tone: "error",
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({
        text: "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง",
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    setMessage({
      text: "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กำลังพาไปหน้าเข้าสู่ระบบ...",
      tone: "success",
    });
    window.setTimeout(() => {
      router.push("/auth");
    }, 1500);
  }

  return (
    <AuthShell>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          ตั้งรหัสผ่านใหม่
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          กรอกรหัสผ่านใหม่ที่ต้องการใช้เข้าสู่ระบบ
        </p>
      </div>

      {!isReady ? (
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          กำลังตรวจสอบลิงก์สำหรับตั้งรหัสผ่านใหม่...
        </p>
      ) : (
        <form className="mt-6" onSubmit={handleSubmit}>
          <div>
            <label
              className="text-sm font-medium text-[var(--foreground)]"
              htmlFor="newPassword"
            >
              รหัสผ่านใหม่
            </label>
            <div className="relative mt-2">
              <input
                className="min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                id="newPassword"
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

          <div className="mt-4">
            <label
              className="text-sm font-medium text-[var(--foreground)]"
              htmlFor="confirmNewPassword"
            >
              ยืนยันรหัสผ่านใหม่
            </label>
            <div className="relative mt-2">
              <input
                className={
                  passwordsMatch
                    ? "min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                    : "min-h-11 w-full rounded-md border border-[var(--danger)] bg-[var(--surface-muted)] px-3 pr-10 text-sm text-[var(--foreground)] outline-none focus:border-[var(--danger)]"
                }
                id="confirmNewPassword"
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

          <button
            className="mt-6 min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
          </button>
        </form>
      )}

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
    </AuthShell>
  );
}
