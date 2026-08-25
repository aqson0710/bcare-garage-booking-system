"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type InsertCheckResult = {
  step: string;
  ok: boolean;
  message: string;
  data?: unknown;
  error?: {
    code?: string;
    details?: string;
    hint?: string;
    message: string;
  };
};

export default function SupabaseInsertCheckPage() {
  const [results, setResults] = useState<InsertCheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  async function checkInsert() {
    setIsChecking(true);
    setResults([]);

    const supabase = createClient();
    const uniqueSuffix = crypto.randomUUID().slice(0, 8);
    const profileResult = await supabase
      .from("profiles")
      .insert({
        email: null,
        full_name: `BCare Test ${uniqueSuffix}`,
        phone_number: `099${uniqueSuffix}`,
      })
      .select("*")
      .single();

    const nextResults: InsertCheckResult[] = [
      {
        data: profileResult.data,
        error: profileResult.error ?? undefined,
        message: profileResult.error
          ? "profiles insert failed"
          : "profiles insert succeeded",
        ok: !profileResult.error,
        step: "profiles.insert",
      },
    ];

    setResults(nextResults);
    setIsChecking(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
          BCare
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
          Insert Permission Check
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Test whether the public client can insert a guest profile.
        </p>
      </header>

      <button
        className="mt-8 min-h-11 w-fit rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isChecking}
        onClick={checkInsert}
        type="button"
      >
        {isChecking ? "Checking..." : "Check Profile Insert"}
      </button>

      {results.length > 0 ? (
        <pre className="mt-6 max-h-[520px] overflow-auto rounded-lg border border-[var(--line)] bg-white p-4 text-sm text-[var(--foreground)]">
          {JSON.stringify(results, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}

