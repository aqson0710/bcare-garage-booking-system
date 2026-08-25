import { NextResponse } from "next/server";
import { checkSupabaseHealth } from "@/lib/supabase/health";

export async function GET() {
  const result = await checkSupabaseHealth();

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
  });
}

