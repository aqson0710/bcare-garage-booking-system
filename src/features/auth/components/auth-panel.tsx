"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppNav } from "@/components/app-nav";
import { getCurrentProfile, type ProfileRole } from "@/features/auth";
import { createClient } from "@/lib/supabase/browser";

type AuthMode = "login" | "register";

type AuthMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

const emptyMessage: AuthMessage | null = null;

function getPostLoginPath(role: ProfileRole | null | undefined) {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "technician") {
    return "/technician/work-orders";
  }

  return "/";
}

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(emptyMessage);

  function resetForm(nextMode: AuthMode) {
    setMode(nextMode);
    setEmail("");
    setPassword("");
    setMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

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

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
          เข้าสู่ระบบ
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          เข้าสู่ระบบหรือสมัครบัญชีเพื่อใช้งานการจองบริการ คำสั่งซื้อ และการแจ้งเตือน
        </p>
      </header>

      <div className="flex flex-1 justify-center py-8">
        <form
          className="h-fit w-full max-w-md rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-2 gap-2">
            <button
              className={
                mode === "login"
                  ? "min-h-10 rounded-md bg-[var(--brand)] px-3 text-sm font-semibold text-white"
                  : "min-h-10 rounded-md border border-[var(--line)] px-3 text-sm font-semibold text-[var(--muted)]"
              }
              onClick={() => resetForm("login")}
              type="button"
            >
              เข้าสู่ระบบ
            </button>
            <button
              className={
                mode === "register"
                  ? "min-h-10 rounded-md bg-[var(--brand)] px-3 text-sm font-semibold text-white"
                  : "min-h-10 rounded-md border border-[var(--line)] px-3 text-sm font-semibold text-[var(--muted)]"
              }
              onClick={() => resetForm("register")}
              type="button"
            >
              สมัครบัญชี
            </button>
          </div>

          <div className="mt-5">
            <label
              className="text-sm font-medium text-[var(--foreground)]"
              htmlFor="email"
            >
              อีเมล
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              id="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </div>

          <div className="mt-4">
            <label
              className="text-sm font-medium text-[var(--foreground)]"
              htmlFor="password"
            >
              รหัสผ่าน
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              id="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </div>

          <button
            className="mt-5 min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? "กำลังดำเนินการ..."
              : mode === "register"
                ? "สร้างบัญชี"
                : "เข้าสู่ระบบ"}
          </button>

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
      </div>
    </section>
  );
}
