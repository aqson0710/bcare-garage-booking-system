"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type CheckResult = {
  step: string;
  ok: boolean;
  message: string;
  data?: unknown;
  error?: string;
};

export default function AuthRlsCheckPage() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  async function runCheck() {
    setIsChecking(true);
    setResults([]);

    const supabase = createClient();
    const nextResults: CheckResult[] = [];

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setResults([
        {
          error: userError?.message,
          message: "Sign in before running authenticated RLS checks.",
          ok: false,
          step: "auth.getUser",
        },
      ]);
      setIsChecking(false);
      return;
    }

    nextResults.push({
      data: { email: user.email, id: user.id },
      message: "Current user loaded.",
      ok: true,
      step: "auth.getUser",
    });

    const profileResult = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    nextResults.push({
      data: profileResult.data,
      error: profileResult.error?.message,
      message: profileResult.error
        ? "Could not read current user's profile."
        : "Current user's profile is readable.",
      ok: !profileResult.error,
      step: "profiles.select.own",
    });

    if (profileResult.error || !profileResult.data) {
      setResults(nextResults);
      setIsChecking(false);
      return;
    }

    const uniqueSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
    const vehicleResult = await supabase
      .from("vehicles")
      .insert({
        brand: "Test",
        color: null,
        customer_id: user.id,
        license_plate: `TEST-${uniqueSuffix}`,
        model: "RLS",
        year: null,
      })
      .select("*")
      .single();

    nextResults.push({
      data: vehicleResult.data,
      error: vehicleResult.error?.message,
      message: vehicleResult.error
        ? "Could not insert current user's vehicle."
        : "Current user's vehicle insert is allowed.",
      ok: !vehicleResult.error,
      step: "vehicles.insert.own",
    });

    if (vehicleResult.error || !vehicleResult.data) {
      setResults(nextResults);
      setIsChecking(false);
      return;
    }

    const serviceResult = await supabase
      .from("services")
      .select("id")
      .eq("status", "active")
      .limit(1)
      .single();

    nextResults.push({
      data: serviceResult.data,
      error: serviceResult.error?.message,
      message: serviceResult.error
        ? "Could not read an active service."
        : "Active service loaded for booking test.",
      ok: !serviceResult.error,
      step: "services.select.active",
    });

    if (serviceResult.error || !serviceResult.data) {
      setResults(nextResults);
      setIsChecking(false);
      return;
    }

    const bookingResult = await supabase
      .from("bookings")
      .insert({
        booking_date: new Date().toISOString().slice(0, 10),
        booking_time: "09:00",
        customer_id: user.id,
        note: "RLS test booking",
        service_id: serviceResult.data.id,
        status: "pending",
        vehicle_id: vehicleResult.data.id,
      })
      .select("*")
      .single();

    nextResults.push({
      data: bookingResult.data,
      error: bookingResult.error?.message,
      message: bookingResult.error
        ? "Could not insert current user's booking."
        : "Current user's booking insert is allowed.",
      ok: !bookingResult.error,
      step: "bookings.insert.own",
    });

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
          Authenticated RLS Check
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
          Verify that a signed-in customer can read their profile and create
          their own vehicle and booking records.
        </p>
      </header>

      <button
        className="mt-8 min-h-11 w-fit rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isChecking}
        onClick={runCheck}
        type="button"
      >
        {isChecking ? "Checking..." : "Run Auth RLS Check"}
      </button>

      {results.length > 0 ? (
        <pre className="mt-6 max-h-[520px] overflow-auto rounded-lg border border-[var(--line)] bg-white p-4 text-sm text-[var(--foreground)]">
          {JSON.stringify(results, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}

