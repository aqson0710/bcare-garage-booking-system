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

  // Current role, for the audit log entry below.
  const previousResult = await adminSupabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", customerId)
    .maybeSingle();

  if (previousResult.error) {
    return NextResponse.json(
      {
        message: previousResult.error.message,
        ok: false,
      },
      { status: 500 },
    );
  }

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

  // This update runs with the service role, so the database audit trigger
  // can't tell which admin made it. Record it here instead.
  if (previousResult.data && previousResult.data.role !== nextRole) {
    await writeRoleChangeAuditLog(adminSupabase, {
      actorId: adminCheck.userId,
      customerId,
      customerLabel:
        previousResult.data.full_name?.trim() || previousResult.data.email,
      nextRole,
      previousRole: previousResult.data.role,
    });
  }

  return NextResponse.json({
    data: updateResult.data,
    ok: true,
  });
}

async function writeRoleChangeAuditLog(
  adminSupabase: ReturnType<typeof createAdminClient>,
  entry: {
    actorId: string;
    customerId: string;
    customerLabel: string | null;
    nextRole: ProfileRole;
    previousRole: string | null;
  },
) {
  const actorResult = await adminSupabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", entry.actorId)
    .maybeSingle();

  const { error } = await adminSupabase.from("audit_logs").insert({
    action: "update",
    actor_id: entry.actorId,
    actor_name:
      actorResult.data?.full_name?.trim() || actorResult.data?.email || null,
    changed_fields: ["role"],
    new_data: { role: entry.nextRole },
    old_data: { role: entry.previousRole },
    record_id: entry.customerId,
    record_label: entry.customerLabel,
    table_name: "profiles",
  });

  // The role change itself already succeeded; don't fail the request, but
  // leave a trace in the server log.
  if (error) {
    console.error("Could not write role change to audit log:", error.message);
  }
}
