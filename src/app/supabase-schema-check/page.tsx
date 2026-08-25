"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type ProbeResult = {
  table: string;
  existingColumns: string[];
  missingColumns: string[];
  errors: Record<string, string>;
};

const schemaCandidates: Record<string, string[]> = {
  bookings: [
    "id",
    "profile_id",
    "customer_id",
    "vehicle_id",
    "service_id",
    "booking_date",
    "booking_time",
    "scheduled_date",
    "scheduled_time",
    "appointment_date",
    "appointment_time",
    "booking_datetime",
    "scheduled_at",
    "status",
    "note",
    "notes",
    "total_price",
    "created_at",
    "updated_at",
  ],
  profiles: [
    "id",
    "full_name",
    "name",
    "phone",
    "phone_number",
    "email",
    "role",
    "created_at",
    "updated_at",
  ],
  vehicles: [
    "id",
    "profile_id",
    "customer_id",
    "owner_id",
    "license_plate",
    "plate_number",
    "vehicle_plate",
    "brand",
    "make",
    "model",
    "year",
    "color",
    "created_at",
    "updated_at",
  ],
};

export default function SupabaseSchemaCheckPage() {
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  async function probeSchema() {
    setIsChecking(true);
    setResults([]);

    const supabase = createClient();
    const nextResults = await Promise.all(
      Object.entries(schemaCandidates).map(async ([table, columns]) => {
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

        return {
          table,
          existingColumns: columnResults
            .filter((result) => result.exists)
            .map((result) => result.column),
          missingColumns: columnResults
            .filter((result) => !result.exists)
            .map((result) => result.column),
          errors: Object.fromEntries(
            columnResults
              .filter((result) => result.error)
              .map((result) => [result.column, result.error ?? "Unknown error"]),
          ),
        } satisfies ProbeResult;
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
          Booking Schema Check
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Probe columns for bookings, vehicles, and profiles without writing
          data. This prepares the real booking insert safely.
        </p>
      </header>

      <button
        className="mt-8 min-h-11 w-fit rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isChecking}
        onClick={probeSchema}
        type="button"
      >
        {isChecking ? "Checking..." : "Check Booking Schema"}
      </button>

      {results.length > 0 ? (
        <div className="mt-6 grid gap-4">
          {results.map((result) => (
            <section
              className="rounded-lg border border-[var(--line)] bg-white p-5"
              key={result.table}
            >
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {result.table}
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-[var(--brand)]">
                    Existing columns
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {result.existingColumns.length > 0
                      ? result.existingColumns.join(", ")
                      : "No candidate columns found."}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-700">
                    Missing candidates
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {result.missingColumns.length > 0
                      ? result.missingColumns.join(", ")
                      : "None"}
                  </p>
                </div>
              </div>
            </section>
          ))}

          <pre className="max-h-[420px] overflow-auto rounded-lg border border-[var(--line)] bg-white p-4 text-sm text-[var(--foreground)]">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      ) : null}
    </main>
  );
}

