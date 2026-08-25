"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type QueryResult = {
  ok: boolean;
  table: string;
  count: number | null;
  rows: Record<string, unknown>[] | null;
  message: string;
  error?: string;
};

const suggestedTables = [
  "services",
  "bookings",
  "customers",
  "vehicles",
  "garage_services",
  "profiles",
];

export default function SupabaseDataCheckPage() {
  const [tableName, setTableName] = useState(suggestedTables[0]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function queryTable(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalizedTableName = tableName.trim();

    if (!normalizedTableName) {
      setResult({
        ok: false,
        table: "",
        count: null,
        rows: null,
        message: "Enter a table name before querying.",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    const supabase = createClient();
    const { data, error, count } = await supabase
      .from(normalizedTableName)
      .select("*", { count: "exact" })
      .limit(5);

    setResult({
      ok: !error,
      table: normalizedTableName,
      count: count ?? null,
      rows: data,
      message: error
        ? "Supabase returned an error for this table."
        : "Supabase query succeeded.",
      error: error?.message,
    });
    setIsLoading(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6 py-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
        BCare
      </p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
        Supabase Data Query Check
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
        Query one real table from the configured Supabase project. This is a
        diagnostic page for setup review, not the final BCare app UI.
      </p>

      <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={queryTable}>
        <input
          className="min-h-11 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          onChange={(event) => setTableName(event.target.value)}
          placeholder="services"
          value={tableName}
        />
        <button
          className="min-h-11 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? "Querying..." : "Query Table"}
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {suggestedTables.map((table) => (
          <button
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
            key={table}
            onClick={() => setTableName(table)}
            type="button"
          >
            {table}
          </button>
        ))}
      </div>

      {result ? (
        <pre className="mt-6 max-h-[420px] overflow-auto rounded-lg border border-[var(--line)] bg-white p-4 text-sm text-[var(--foreground)]">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}

