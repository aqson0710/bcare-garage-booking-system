"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AppNav } from "@/components/app-nav";
import {
  getCurrentProfile,
  upsertCurrentProfile,
  type Profile,
} from "@/features/auth";
import { createClient } from "@/lib/supabase/browser";

type AuthMode = "login" | "register";

type AuthMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

const emptyMessage: AuthMessage | null = null;

export function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [message, setMessage] = useState<AuthMessage | null>(emptyMessage);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileFullName, setProfileFullName] = useState("");
  const [profilePhoneNumber, setProfilePhoneNumber] = useState("");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile(nextUser: User | null) {
      if (!nextUser) {
        setProfile(null);
        setProfileFullName("");
        setProfilePhoneNumber("");
        return;
      }

      const { data } = await getCurrentProfile(supabase, nextUser.id);
      setProfile(data ?? null);
      setProfileFullName(data?.full_name ?? "");
      setProfilePhoneNumber(data?.phone_number ?? "");
    }

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
      setMessage({ text: "Email is required.", tone: "error" });
      return;
    }

    if (password.length < 6) {
      setMessage({
        text: "Password must be at least 6 characters.",
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

      setUser(data.user ?? null);
      setMessage({
        text: data.session
          ? "Account created and signed in."
          : "Account created. Check your email if confirmation is enabled.",
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

    setUser(data.user ?? null);
    setMessage({ text: "Signed in successfully.", tone: "success" });
  }

  async function handleSignOut() {
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    setUser(null);
    setProfile(null);
    setProfileFullName("");
    setProfilePhoneNumber("");
    setMessage({ text: "Signed out from this browser.", tone: "success" });
  }

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setMessage({ text: "Sign in before saving a profile.", tone: "error" });
      return;
    }

    if (!profileFullName.trim()) {
      setMessage({ text: "Full name is required.", tone: "error" });
      return;
    }

    if (!profilePhoneNumber.trim()) {
      setMessage({ text: "Phone number is required.", tone: "error" });
      return;
    }

    setIsSavingProfile(true);
    setMessage(null);

    const supabase = createClient();
    const { data, error } = await upsertCurrentProfile(supabase, {
      email: user.email ?? null,
      fullName: profileFullName.trim(),
      phoneNumber: profilePhoneNumber.trim(),
      userId: user.id,
    });

    setIsSavingProfile(false);

    if (error) {
      setMessage({ text: error.message, tone: "error" });
      return;
    }

    setProfile(data);
    setProfileFullName(data.full_name);
    setProfilePhoneNumber(data.phone_number);
    setMessage({ text: "Profile saved successfully.", tone: "success" });
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
            BCare
          </p>
          <AppNav />
        </div>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
          Account and Profile
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Sign in, register, and keep your customer profile ready for booking
          requests.
        </p>
      </header>

      <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm"
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
              Login
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
              Register
            </button>
          </div>

          <div className="mt-5">
            <label
              className="text-sm font-medium text-[var(--foreground)]"
              htmlFor="email"
            >
              Email
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
              Password
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
              ? "Working..."
              : mode === "register"
                ? "Create account"
                : "Sign in"}
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

        <div className="space-y-6">
          <aside className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--brand)]">
              Current session
            </p>
            {user ? (
              <div className="mt-4">
                <p className="break-all text-sm font-semibold text-[var(--foreground)]">
                  {user.email}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  User ID: {user.id}
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Role: {profile?.role ?? "customer"}
                </p>
                <button
                  className="mt-5 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                  onClick={handleSignOut}
                  type="button"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                No active session in this browser.
              </p>
            )}
          </aside>

          <form
            className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm"
            onSubmit={handleProfileSubmit}
          >
            <p className="text-sm font-semibold text-[var(--brand)]">
              Customer profile
            </p>
            {user ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label
                    className="text-sm font-medium text-[var(--foreground)]"
                    htmlFor="profileFullName"
                  >
                    Full name
                  </label>
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                    id="profileFullName"
                    onChange={(event) =>
                      setProfileFullName(event.target.value)
                    }
                    value={profileFullName}
                  />
                </div>
                <div>
                  <label
                    className="text-sm font-medium text-[var(--foreground)]"
                    htmlFor="profilePhoneNumber"
                  >
                    Phone number
                  </label>
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                    id="profilePhoneNumber"
                    inputMode="tel"
                    onChange={(event) =>
                      setProfilePhoneNumber(event.target.value)
                    }
                    value={profilePhoneNumber}
                  />
                </div>
                <button
                  className="min-h-10 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSavingProfile}
                  type="submit"
                >
                  {isSavingProfile ? "Saving..." : "Save profile"}
                </button>
                {profile ? (
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    Profile row is linked to this auth user.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                Sign in or register before creating a customer profile.
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
