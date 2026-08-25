"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type CheckResult = {
  ok: boolean;
  reachable?: boolean;
  status?: number;
  message: string;
  error?: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default function SupabaseCheckPage() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function checkConnection() {
    setIsChecking(true);
    setResult(null);

    if (!supabaseUrl || !supabaseKey) {
      setResult({
        ok: false,
        message: "Missing Supabase environment variables.",
      });
      setIsChecking(false);
      return;
    }

    try {
      const supabase = createClient();
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      const isReachable =
        response.ok || response.status === 401 || response.status === 403;

      setResult({
        ok: isReachable,
        reachable: isReachable,
        status: response.status,
        message: response.ok
          ? "Browser can reach Supabase."
          : `Browser reached Supabase. SDK loaded successfully. Session check returned ${session ? "an active session" : "no active session"}${sessionError ? ` with error: ${sessionError.message}` : ""}.`,
      });
    } catch (error) {
      setResult({
        ok: false,
        message: "Browser could not reach Supabase.",
        error: error instanceof Error ? error.message : "Unknown error.",
      });
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
        BCare
      </p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
        Supabase Browser Check
      </h1>
      <p className="mt-4 text-base leading-7 text-[var(--muted)]">
        This checks whether the browser can reach the configured Supabase project.
        Status 401 or 403 is accepted for this root endpoint because it requires
        elevated access.
      </p>

      <button
        className="mt-8 w-fit rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isChecking}
        onClick={checkConnection}
        type="button"
      >
        {isChecking ? "Checking..." : "Check Connection"}
      </button>

      {result ? (
        <pre className="mt-6 overflow-auto rounded-lg border border-[var(--line)] bg-white p-4 text-sm text-[var(--foreground)]">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}
