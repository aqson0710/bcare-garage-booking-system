"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type ProductInventoryProbeResult = {
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

const productInventoryCandidates: Record<string, string[]> = {
  product_categories: [
    "id",
    "name",
    "description",
    "status",
    "created_at",
    "updated_at",
  ],
  products: [
    "id",
    "product_category_id",
    "name",
    "description",
    "sku",
    "unit_price",
    "cost_price",
    "stock_quantity",
    "status",
    "created_at",
    "updated_at",
  ],
  inventory_items: [
    "id",
    "product_id",
    "sku",
    "quantity",
    "unit_cost",
    "reorder_level",
    "status",
    "created_at",
    "updated_at",
  ],
  inventory_movements: [
    "id",
    "product_id",
    "movement_type",
    "quantity",
    "reference_type",
    "reference_id",
    "note",
    "created_by",
    "created_at",
  ],
  stock_movements: [
    "id",
    "product_id",
    "movement_type",
    "quantity",
    "reference_type",
    "reference_id",
    "note",
    "created_by",
    "created_at",
  ],
  product_orders: [
    "id",
    "customer_id",
    "status",
    "total_amount",
    "delivery_method",
    "created_at",
    "updated_at",
  ],
  product_order_items: [
    "id",
    "product_order_id",
    "product_id",
    "quantity",
    "unit_price",
    "total_price",
    "created_at",
  ],
};

export default function ProductInventorySchemaCheckPage() {
  const [results, setResults] = useState<ProductInventoryProbeResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  async function checkProductInventorySchema() {
    setIsChecking(true);
    setResults([]);

    const supabase = createClient();
    const nextResults = await Promise.all(
      Object.entries(productInventoryCandidates).map(async ([table, columns]) => {
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
        } satisfies ProductInventoryProbeResult;
      }),
    );

    setResults(nextResults);
    setIsChecking(false);
  }

  const readableTables = results.filter((result) => result.ok);
  const hasProductTable = results.some(
    (result) => result.ok && result.table === "products",
  );
  const hasInventoryMovementTable = results.some(
    (result) =>
      result.ok &&
      ["inventory_movements", "stock_movements"].includes(result.table),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
          BCare Step 11 Part 0
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
          Product / Inventory Schema Check
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Check whether the database already has product, inventory, or product
          order table candidates. This page only reads schema candidates and
          does not create or update data.
        </p>
      </header>

      <button
        className="mt-8 min-h-11 w-fit rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isChecking}
        onClick={checkProductInventorySchema}
        type="button"
      >
        {isChecking ? "Checking..." : "Check Product / Inventory Schema"}
      </button>

      {results.length > 0 ? (
        <section className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Product tables
            </h2>
            <p
              className={
                hasProductTable
                  ? "mt-2 text-sm font-medium text-[var(--brand)]"
                  : "mt-2 text-sm font-medium text-amber-800"
              }
            >
              {hasProductTable
                ? "A products table candidate is readable."
                : "No readable products table candidate was found."}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Inventory movement
            </h2>
            <p
              className={
                hasInventoryMovementTable
                  ? "mt-2 text-sm font-medium text-[var(--brand)]"
                  : "mt-2 text-sm font-medium text-amber-800"
              }
            >
              {hasInventoryMovementTable
                ? "A stock movement table candidate is readable."
                : "No stock movement table candidate was found."}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Readable candidates
            </h2>
            <p
              className={
                readableTables.length > 0
                  ? "mt-2 text-sm font-medium text-[var(--brand)]"
                  : "mt-2 text-sm font-medium text-red-700"
              }
            >
              {readableTables.length > 0
                ? `${readableTables.length} candidate tables are readable.`
                : "No readable product or inventory candidates were found."}
            </p>
          </div>
        </section>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-6 overflow-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-slate-50 text-[var(--foreground)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Table</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Count</th>
                <th className="px-4 py-3 font-semibold">Existing Columns</th>
                <th className="px-4 py-3 font-semibold">Missing Candidates</th>
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
                    {result.missingColumns.length > 0
                      ? result.missingColumns.join(", ")
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
