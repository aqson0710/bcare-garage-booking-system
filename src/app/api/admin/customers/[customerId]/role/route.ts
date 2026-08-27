import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/features/auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    customerId: string;
  }>;
};

type RoleUpdateBody = {
  role?: ProfileRole;
};

const allowedRoles = new Set<ProfileRole>(["admin", "customer", "technician"]);

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

async function ensureAdminRequest(request: Request) {
  const cookieSupabase = await createClient();
  const adminSupabase = createAdminClient();
  const bearerToken = getBearerToken(request);
  const userResult = bearerToken
    ? await cookieSupabase.auth.getUser(bearerToken)
    : await cookieSupabase.auth.getUser();
  const {
    data: { user },
    error: userError,
  } = userResult;

  if (userError || !user) {
    return {
      error: NextResponse.json(
        {
          message: "กรุณาเข้าสู่ระบบด้วยบัญชี admin ก่อนเปลี่ยนสิทธิ์ผู้ใช้",
          ok: false,
        },
        { status: 401 },
      ),
      userId: null,
    };
  }

  const profileResult = await adminSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResult.error) {
    return {
      error: NextResponse.json(
        {
          message: profileResult.error.message,
          ok: false,
        },
        { status: 500 },
      ),
      userId: null,
    };
  }

  if (profileResult.data?.role !== "admin") {
    return {
      error: NextResponse.json(
        {
          message: "บัญชีนี้ไม่มีสิทธิ์ admin สำหรับเปลี่ยนสิทธิ์ผู้ใช้",
          ok: false,
        },
        { status: 403 },
      ),
      userId: null,
    };
  }

  return {
    error: null,
    userId: user.id,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const adminCheck = await ensureAdminRequest(request);

  if (adminCheck.error) {
    return adminCheck.error;
  }

  const { customerId } = await context.params;
  const body = (await request.json().catch(() => null)) as RoleUpdateBody | null;
  const nextRole = body?.role;

  if (!nextRole || !allowedRoles.has(nextRole)) {
    return NextResponse.json(
      {
        message: "ประเภทบัญชีไม่ถูกต้อง",
        ok: false,
      },
      { status: 400 },
    );
  }

  if (customerId === adminCheck.userId && nextRole !== "admin") {
    return NextResponse.json(
      {
        message: "ไม่สามารถลดสิทธิ์ admin ของบัญชีที่กำลังใช้งานอยู่ได้",
        ok: false,
      },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const updateResult = await adminSupabase
    .from("profiles")
    .update({
      role: nextRole,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId)
    .select("*")
    .single();

  if (updateResult.error) {
    return NextResponse.json(
      {
        message: updateResult.error.message,
        ok: false,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: updateResult.data,
    ok: true,
  });
}
