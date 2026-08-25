"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type WorkOrderProbeResult = {
  table: string;
  ok: boolean;
  count: number | null;
  existingColumns: string[];
  missingColumns: string[];
  message: string;
  error?: string;
  columnErrors: Record<string, string>;
};

function isMissingTableError(message: string | undefined) {
  return (
    message?.includes("Could not find the table") ||
    message?.includes("schema cache")
  );
}

const workOrderCandidates: Record<string, string[]> = {
  work_orders: [
    "id",
    "booking_id",
    "customer_id",
    "vehicle_id",
    "mechanic_id",
    "status",
    "diagnosis",
    "work_notes",
    "started_at",
    "completed_at",
    "created_at",
    "updated_at",
  ],
  repair_jobs: [
    "id",
    "booking_id",
    "customer_id",
    "mechanic_id",
    "status",
    "diagnosis",
    "repair_notes",
    "started_at",
    "completed_at",
    "created_at",
    "updated_at",
  ],
};

export default function WorkOrderSchemaCheckPage() {
  const [results, setResults] = useState<WorkOrderProbeResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  async function checkWorkOrderSchema() {
    setIsChecking(true);
    setResults([]);

    const supabase = createClient();
    const nextResults = await Promise.all(
      Object.entries(workOrderCandidates).map(async ([table, columns]) => {
        const tableProbe = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        const columnResults = await Promise.all(
          columns.map(async (column) => {
            const { error } = await supabase
              .from(table)
              .select(column)
              .limit(0);

            return {
              column,
              error: error?.message,
              exists: !error,
            };
          }),
        );

        const existingColumns = columnResults
          .filter((result) => result.exists)
          .map((result) => result.column);
        const missingColumns = columnResults
          .filter((result) => !result.exists)
          .map((result) => result.column);
        const columnErrors = Object.fromEntries(
          columnResults
            .filter((result) => result.error)
            .map((result) => [result.column, result.error ?? "Unknown error"]),
        );
        const hasExistingColumns = existingColumns.length > 0;
        const allColumnErrorsAreMissingTable =
          columnResults.length > 0 &&
          columnResults.every((result) => isMissingTableError(result.error));
        const tableExists =
          !tableProbe.error && (hasExistingColumns || !allColumnErrorsAreMissingTable);

        return {
          table,
          ok: tableExists,
          count: tableExists ? (tableProbe.count ?? null) : null,
          existingColumns,
          missingColumns,
          message: tableExists
            ? "Found and readable with the current Supabase client."
            : "Not found or not readable with the current Supabase client.",
          error: tableExists
            ? undefined
            : (tableProbe.error?.message ??
              Object.values(columnErrors)[0] ??
              "Table was not found or is not readable."),
          columnErrors,
        } satisfies WorkOrderProbeResult;
      }),
    );

    setResults(nextResults);
    setIsChecking(false);
  }

  const hasCandidate = results.some((result) => result.ok);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
          BCare Step 9 Part 0
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
          Work Order Schema Check
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Check whether the database already has a work order table candidate.
          This page only reads schema candidates and does not create or update
          data.
        </p>
      </header>

      <button
        className="mt-8 min-h-11 w-fit rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isChecking}
        onClick={checkWorkOrderSchema}
        type="button"
      >
        {isChecking ? "Checking..." : "Check Work Order Schema"}
      </button>

      {results.length > 0 ? (
        <section className="mt-6 rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Summary
          </h2>
          <p
            className={
              hasCandidate
                ? "mt-2 text-sm font-medium text-[var(--brand)]"
                : "mt-2 text-sm font-medium text-red-700"
            }
          >
            {hasCandidate
              ? "At least one work order table candidate is readable."
              : "No readable work order table candidate was found."}
          </p>
        </section>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-6 overflow-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-slate-50 text-[var(--foreground)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Table</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Count</th>
                <th className="px-4 py-3 font-semibold">Existing Columns</th>
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
                        result.ok ? "text-[var(--brand)]" : "text-red-700"
                      }
                    >
                      {result.ok ? "Readable" : "Not readable"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {result.count ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {result.existingColumns.length > 0
                      ? result.existingColumns.join(", ")
                      : "-"}
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
        <pre className="mt-6 max-h-[420px] overflow-auto rounded-lg border border-[var(--line)] bg-white p-4 text-sm text-[var(--foreground)]">
          {JSON.stringify(results, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}
