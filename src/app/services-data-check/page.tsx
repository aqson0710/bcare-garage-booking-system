"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  getServicesWithCategories,
  type ServiceCategoryWithServices,
} from "@/features/services";

type CheckResult = {
  ok: boolean;
  categoryCount: number;
  serviceCount: number;
  data: ServiceCategoryWithServices[] | null;
  message: string;
  error?: string;
};

export default function ServicesDataCheckPage() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loadServices() {
    setIsLoading(true);
    setResult(null);

    const supabase = createClient();
    const { data, error } = await getServicesWithCategories(supabase);

    if (error) {
      setResult({
        ok: false,
        categoryCount: 0,
        serviceCount: 0,
        data: null,
        message: "Could not load services data.",
        error: error.message,
      });
      setIsLoading(false);
      return;
    }

    const serviceCount =
      data?.reduce((total, category) => total + category.services.length, 0) ??
      0;

    setResult({
      ok: true,
      categoryCount: data?.length ?? 0,
      serviceCount,
      data,
      message: "Services data layer loaded categories and services.",
    });
    setIsLoading(false);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
          BCare
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">
          Services Data Layer Check
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Load active service categories and services through the shared data
          layer that the first feature UI will use.
        </p>
      </header>

      <button
        className="mt-8 min-h-11 w-fit rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading}
        onClick={loadServices}
        type="button"
      >
        {isLoading ? "Loading..." : "Load Services Data"}
      </button>

      {result ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--line)] bg-white p-4">
            <p className="text-sm text-[var(--muted)]">Status</p>
            <p className="mt-2 text-lg font-semibold text-[var(--brand)]">
              {result.ok ? "Ready" : "Failed"}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white p-4">
            <p className="text-sm text-[var(--muted)]">Categories</p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {result.categoryCount}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-white p-4">
            <p className="text-sm text-[var(--muted)]">Services</p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {result.serviceCount}
            </p>
          </div>
        </div>
      ) : null}

      {result ? (
        <pre className="mt-6 max-h-[420px] overflow-auto rounded-lg border border-[var(--line)] bg-white p-4 text-sm text-[var(--foreground)]">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}

