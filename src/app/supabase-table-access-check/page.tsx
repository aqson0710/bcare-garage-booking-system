"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type TableAccessResult = {
  table: string;
  ok: boolean;
  count: number | null;
  sample: Record<string, unknown>[] | null;
  message: string;
  error?: string;
};

const coreTables = [
  "services",
  "service_categories",
  "vehicles",
  "bookings",
  "profiles",
];

export default function SupabaseTableAccessCheckPage() {
  const [results, setResults] = useState<TableAccessResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  async function checkTables() {
    setIsChecking(true);
    setResults([]);

    const supabase = createClient();
    const nextResults = await Promise.all(
      coreTables.map(async (table) => {
        const { data, error, count } = await supabase
          .from(table)
          .select("*", { count: "exact" })
          .limit(2);

        return {
          table,
          ok: !error,
          count: count ?? null,
          sample: data,
          message: error
            ? "Not readable with the current public client."
            : "Readable with the current public client.",
          error: error?.message,
        } satisfies TableAccessResult;
      }),
    );

    setResults(nextResults);
    setIsChecking(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
          BCare
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
          Core Table Access Check
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Check which core BCare tables are readable with the current Supabase
          public client. This is for setup review before feature UI work begins.
        </p>
      </header>

      <button
        className="mt-8 min-h-11 w-fit rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isChecking}
        onClick={checkTables}
        type="button"
      >
        {isChecking ? "Checking..." : "Check Core Tables"}
      </button>

      {results.length > 0 ? (
        <div className="mt-6 overflow-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-slate-50 text-[var(--foreground)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Table</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Count</th>
                <th className="px-4 py-3 font-semibold">Message</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr className="border-b border-[var(--line)]" key={result.table}>
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">
                    {result.table}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        result.ok
                          ? "text-[var(--brand)]"
                          : "text-red-700"
                      }
                    >
                      {result.ok ? "Readable" : "Blocked"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {result.count ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {result.error ?? result.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {results.length > 0 ? (
        <pre className="mt-6 max-h-[360px] overflow-auto rounded-lg border border-[var(--line)] bg-white p-4 text-sm text-[var(--foreground)]">
          {JSON.stringify(results, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}
