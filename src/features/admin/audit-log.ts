// Reading the admin audit log (public.audit_logs, see supabase/audit-log.sql).
// Entries are written by a database trigger whenever an admin inserts,
// updates or deletes a row, so this module only ever reads.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type BCareSupabaseClient = SupabaseClient<Database>;

export type AdminAuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export type AdminAuditAction = AdminAuditLog["action"];

export type AdminAuditLogFilters = {
  action: AdminAuditAction | "all";
  actorId: string | "all";
  // yyyy-mm-dd, Thai time. Empty string = no limit.
  fromDate: string;
  // Text to look for in the record name (product name, order number, ...).
  search: string;
  tableName: string | "all";
  toDate: string;
};

export type AdminAuditLogListResult = {
  logs: AdminAuditLog[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminAuditActor = {
  email: string | null;
  full_name: string | null;
  id: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nextDay(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export async function getAdminAuditLogsPage(
  supabase: BCareSupabaseClient,
  params: AdminAuditLogFilters & { page: number; pageSize: number },
): Promise<
  | { data: AdminAuditLogListResult; error: null }
  | { data: null; error: { message: string } }
> {
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const rangeStart = (page - 1) * pageSize;

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false });

  if (params.tableName !== "all") {
    query = query.eq("table_name", params.tableName);
  }

  if (params.action !== "all") {
    query = query.eq("action", params.action);
  }

  if (params.actorId !== "all") {
    query = query.eq("actor_id", params.actorId);
  }

  // Dates are picked in Thai time (UTC+7).
  if (params.fromDate) {
    query = query.gte("occurred_at", `${params.fromDate}T00:00:00+07:00`);
  }

  if (params.toDate) {
    query = query.lt("occurred_at", `${nextDay(params.toDate)}T00:00:00+07:00`);
  }

  const search = params.search.trim();

  if (search) {
    if (uuidPattern.test(search)) {
      query = query.eq("record_id", search.toLowerCase());
    } else {
      // Strip characters that have a meaning in LIKE patterns.
      const safeSearch = search.replace(/[%_\\]/g, "");
      query = query.ilike("record_label", `%${safeSearch}%`);
    }
  }

  const { count, data, error } = await query.range(
    rangeStart,
    rangeStart + pageSize - 1,
  );

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  const totalCount = count ?? 0;

  return {
    data: {
      logs: data ?? [],
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
    error: null,
  };
}

// Admin accounts, for the "who" filter.
export async function getAdminAuditActors(
  supabase: BCareSupabaseClient,
): Promise<
  | { data: AdminAuditActor[]; error: null }
  | { data: null; error: { message: string } }
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "admin")
    .order("full_name", { ascending: true });

  if (error) {
    return { data: null, error: { message: error.message } };
  }

  return { data: data ?? [], error: null };
}
