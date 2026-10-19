import { NextResponse } from "next/server";
import { checkSupabaseHealth } from "@/lib/supabase/health";

// Health check for Docker HEALTHCHECK, the deploy workflow and uptime checks.
// Returns 200 when the Supabase database API is reachable and 503 when it is
// not. Never throws, so the app keeps running while the database is down.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await checkSupabaseHealth();

    return NextResponse.json(
      { status: result.ok ? "ok" : "error", database: result.ok ? "up" : "down", message: result.message },
      { status: result.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "error", database: "down", message: "Health check failed." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
