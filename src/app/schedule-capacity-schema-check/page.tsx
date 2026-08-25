"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type ScheduleCandidateResult = {
  table: string;
  ok: boolean;
  count: number | null;
  existingColumns: string[];
  missingColumns: string[];
  message: string;
  error?: string;
  columnErrors: Record<string, string>;
};

type BookingSlotRow = {
  booking_date: string;
  booking_time: string;
  id: string;
  status: string;
};

type BookingSlotSummary = {
  activeCount: number;
  bookingDate: string;
  bookingTime: string;
  cancelledCount: number;
  completedCount: number;
  totalCount: number;
};

function isMissingTableError(message: string | undefined) {
  return (
    message?.includes("Could not find the table") ||
    message?.includes("schema cache")
  );
}

const scheduleCandidates: Record<string, string[]> = {
  bookings: [
    "id",
    "customer_id",
    "vehicle_id",
    "service_id",
    "booking_date",
    "booking_time",
    "status",
    "created_at",
    "updated_at",
  ],
  garage_capacity: [
    "id",
    "booking_date",
    "booking_time",
    "max_bookings",
    "status",
    "created_at",
    "updated_at",
  ],
  booking_capacity: [
    "id",
    "day_of_week",
    "booking_time",
    "max_bookings",
    "status",
    "created_at",
    "updated_at",
  ],
  schedule_capacity: [
    "id",
    "schedule_date",
    "start_time",
    "end_time",
    "max_bookings",
    "status",
    "created_at",
    "updated_at",
  ],
  booking_slots: [
    "id",
    "slot_date",
    "slot_time",
    "max_bookings",
    "booked_count",
    "status",
    "created_at",
    "updated_at",
  ],
  service_slots: [
    "id",
    "service_id",
    "slot_date",
    "slot_time",
    "max_bookings",
    "status",
    "created_at",
    "updated_at",
  ],
  mechanic_schedules: [
    "id",
    "mechanic_id",
    "schedule_date",
    "start_time",
    "end_time",
    "status",
    "created_at",
    "updated_at",
  ],
};

function getSlotKey(booking: BookingSlotRow) {
  return `${booking.booking_date}|${booking.booking_time.slice(0, 5)}`;
}

function buildBookingSlotSummaries(bookings: BookingSlotRow[]) {
  const summariesBySlot = new Map<string, BookingSlotSummary>();

  for (const booking of bookings) {
    const bookingTime = booking.booking_time.slice(0, 5);
    const key = getSlotKey(booking);
    const currentSummary =
      summariesBySlot.get(key) ??
      ({
        activeCount: 0,
        bookingDate: booking.booking_date,
        bookingTime,
        cancelledCount: 0,
        completedCount: 0,
        totalCount: 0,
      } satisfies BookingSlotSummary);

    currentSummary.totalCount += 1;

    if (booking.status === "cancelled") {
      currentSummary.cancelledCount += 1;
    } else if (booking.status === "completed") {
      currentSummary.completedCount += 1;
    } else {
      currentSummary.activeCount += 1;
    }

    summariesBySlot.set(key, currentSummary);
  }

  return Array.from(summariesBySlot.values()).sort((a, b) => {
    if (a.bookingDate !== b.bookingDate) {
      return b.bookingDate.localeCompare(a.bookingDate);
    }

    return a.bookingTime.localeCompare(b.bookingTime);
  });
}

export default function ScheduleCapacitySchemaCheckPage() {
  const [results, setResults] = useState<ScheduleCandidateResult[]>([]);
  const [bookingRows, setBookingRows] = useState<BookingSlotRow[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  async function checkScheduleCapacitySchema() {
    setIsChecking(true);
    setResults([]);
    setBookingRows([]);
    setBookingError(null);

    const supabase = createClient();
    const nextResults = await Promise.all(
      Object.entries(scheduleCandidates).map(async ([table, columns]) => {
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
          !tableProbe.error &&
          (hasExistingColumns || !allColumnErrorsAreMissingTable);

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
        } satisfies ScheduleCandidateResult;
      }),
    );

    const bookingsResult = await supabase
      .from("bookings")
      .select("id, booking_date, booking_time, status")
      .order("booking_date", { ascending: false })
      .order("booking_time", { ascending: true })
      .limit(200);

    if (bookingsResult.error) {
      setBookingError(bookingsResult.error.message);
    } else {
      setBookingRows(
        (bookingsResult.data ?? []).map((booking) => ({
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          id: booking.id,
          status: booking.status,
        })),
      );
    }

    setResults(nextResults);
    setIsChecking(false);
  }

  const hasCapacityCandidate = results.some(
    (result) => result.ok && result.table !== "bookings",
  );
  const bookingsResult = results.find((result) => result.table === "bookings");
  const bookingSlotSummaries = useMemo(
    () => buildBookingSlotSummaries(bookingRows),
    [bookingRows],
  );
  const possibleOverbookedSlots = bookingSlotSummaries.filter(
    (summary) => summary.activeCount > 1,
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
          BCare Step 10 Part 0
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
          Schedule / Capacity Schema Check
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Check whether the database already has schedule or capacity tables.
          This page only reads schema candidates and recent bookings.
        </p>
      </header>

      <button
        className="mt-8 min-h-11 w-fit rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isChecking}
        onClick={checkScheduleCapacitySchema}
        type="button"
      >
        {isChecking ? "Checking..." : "Check Schedule Capacity Schema"}
      </button>

      {results.length > 0 ? (
        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Bookings table
            </h2>
            <p
              className={
                bookingsResult?.ok
                  ? "mt-2 text-sm font-medium text-[var(--brand)]"
                  : "mt-2 text-sm font-medium text-red-700"
              }
            >
              {bookingsResult?.ok
                ? "Existing booking schedule fields are readable."
                : "Bookings schedule fields are not readable."}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Capacity table
            </h2>
            <p
              className={
                hasCapacityCandidate
                  ? "mt-2 text-sm font-medium text-[var(--brand)]"
                  : "mt-2 text-sm font-medium text-amber-800"
              }
            >
              {hasCapacityCandidate
                ? "At least one capacity table candidate is readable."
                : "No dedicated capacity table candidate was found."}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Possible conflicts
            </h2>
            <p
              className={
                possibleOverbookedSlots.length > 0
                  ? "mt-2 text-sm font-medium text-amber-800"
                  : "mt-2 text-sm font-medium text-[var(--brand)]"
              }
            >
              {possibleOverbookedSlots.length > 0
                ? `${possibleOverbookedSlots.length} slots have more than one active booking.`
                : "No duplicate active booking slots found in the latest sample."}
            </p>
          </div>
        </section>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-6 overflow-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
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

      {bookingError ? (
        <section className="mt-6 rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700">
          {bookingError}
        </section>
      ) : null}

      {bookingSlotSummaries.length > 0 ? (
        <section className="mt-6 rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Recent booking slots
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Active count includes pending and confirmed bookings. Cancelled and
            completed bookings are separated for capacity planning.
          </p>

          <div className="mt-4 overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-slate-50 text-[var(--foreground)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">Active</th>
                  <th className="px-4 py-3 font-semibold">Completed</th>
                  <th className="px-4 py-3 font-semibold">Cancelled</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {bookingSlotSummaries.map((summary) => (
                  <tr
                    className="border-b border-[var(--line)]"
                    key={`${summary.bookingDate}-${summary.bookingTime}`}
                  >
                    <td className="px-4 py-3 text-[var(--foreground)]">
                      {summary.bookingDate}
                    </td>
                    <td className="px-4 py-3 text-[var(--foreground)]">
                      {summary.bookingTime}
                    </td>
                    <td
                      className={
                        summary.activeCount > 1
                          ? "px-4 py-3 font-semibold text-amber-800"
                          : "px-4 py-3 text-[var(--muted)]"
                      }
                    >
                      {summary.activeCount}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {summary.completedCount}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {summary.cancelledCount}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {summary.totalCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {results.length > 0 ? (
        <pre className="mt-6 max-h-[420px] overflow-auto rounded-lg border border-[var(--line)] bg-white p-4 text-sm text-[var(--foreground)]">
          {JSON.stringify(
            {
              bookingSlotSummaries,
              schemaCandidates: results,
            },
            null,
            2,
          )}
        </pre>
      ) : null}
    </main>
  );
}
