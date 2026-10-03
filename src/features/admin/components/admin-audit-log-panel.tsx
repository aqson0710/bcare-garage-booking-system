"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { PageSkeleton } from "@/components/page-skeleton";
import {
  checkAdminAccess,
  getAdminAuditActors,
  getAdminAuditLogsPage,
  type AdminAccessResult,
  type AdminAuditAction,
  type AdminAuditActor,
  type AdminAuditLog,
  type AdminAuditLogFilters,
  type AdminAuditLogListResult,
} from "@/features/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/browser";
import { formatThaiDate, statusLabel, type StatusKind } from "@/lib/format";

const pageSize = 20;

type LoadState =
  | { status: "loading" }
  | { status: "signed-out" }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
    }
  | {
      status: "ready";
      result: AdminAuditLogListResult;
    }
  | { status: "error"; error: string };

const emptyFilters: AdminAuditLogFilters = {
  action: "all",
  actorId: "all",
  fromDate: "",
  search: "",
  tableName: "all",
  toDate: "",
};

// Thai names for the audited tables, in the order shown in the filter.
const tableLabels: Record<string, string> = {
  bookings: "การจอง",
  booking_payments: "ชำระเงินค่าซ่อม",
  repair_jobs: "งานซ่อม",
  service_reviews: "รีวิวบริการ",
  product_orders: "ออเดอร์สินค้า",
  product_payments: "ชำระเงินค่าสินค้า",
  products: "สินค้า",
  product_categories: "หมวดสินค้า",
  inventory_movements: "เคลื่อนไหวสต็อก",
  services: "บริการ",
  service_categories: "หมวดบริการ",
  technician_skills: "ทักษะช่าง",
  technician_profile_skills: "ทักษะของช่างแต่ละคน",
  profiles: "ผู้ใช้",
  garage_capacity: "คิวรับงาน",
  garage_closed_dates: "วันหยุดร้าน",
  garage_operating_days: "วันเปิดร้าน",
  payment_settings: "ตั้งค่าชำระเงิน",
  homepage_appearance_settings: "หน้าตาหน้าแรก",
  homepage_footer_settings: "ส่วนท้ายเว็บไซต์",
  homepage_slides: "สไลด์หน้าแรก",
};

const actionLabels: Record<AdminAuditAction, string> = {
  delete: "ลบ",
  insert: "เพิ่ม",
  update: "แก้ไข",
};

const actionStyles: Record<AdminAuditAction, string> = {
  delete: "bg-red-500/15 text-red-200",
  insert: "bg-emerald-400/15 text-emerald-200",
  update: "bg-[var(--accent)]/25 text-sky-100",
};

const fieldLabels: Record<string, string> = {
  address_line: "ที่อยู่",
  amount: "ยอดเงิน",
  background_color: "สีพื้นหลัง",
  background_image_url: "รูปพื้นหลัง",
  bank_account_name: "ชื่อบัญชี",
  bank_account_number: "เลขบัญชี",
  bank_branch: "สาขา",
  bank_name: "ธนาคาร",
  bank_transfer_enabled: "รับโอนผ่านบัญชี",
  base_price: "ราคาเริ่มต้น",
  booking_date: "วันที่",
  booking_id: "รหัสการจอง",
  booking_time: "เวลา",
  close_time: "เวลาปิด",
  closed_date: "วันที่หยุด",
  comment: "ความเห็น",
  completed_at: "เสร็จงานเมื่อ",
  cost_price: "ต้นทุน",
  customer_id: "รหัสลูกค้า",
  delivery_fee: "ค่าส่ง",
  delivery_method: "วิธีรับสินค้า",
  description: "รายละเอียด",
  diagnosis: "ผลตรวจ/วิเคราะห์อาการ",
  email: "อีเมล",
  estimated_duration_minutes: "เวลาโดยประมาณ (นาที)",
  full_name: "ชื่อ-นามสกุล",
  image_url: "รูปภาพ",
  is_open: "เปิดร้าน",
  logo_url: "โลโก้",
  max_bookings: "จำนวนคิวสูงสุด",
  mechanic_id: "ช่างผู้รับผิดชอบ",
  movement_type: "ประเภท",
  name: "ชื่อ",
  note: "หมายเหตุ",
  open_time: "เวลาเปิด",
  order_number: "เลขออเดอร์",
  paid_at: "ชำระเมื่อ",
  payment_amount: "ยอดชำระ",
  payment_instructions: "คำแนะนำการชำระเงิน",
  payment_method: "วิธีชำระเงิน",
  payment_status: "สถานะชำระเงิน",
  phone_number: "เบอร์โทร",
  picked_up_at: "ลูกค้ารับรถเมื่อ",
  product_category_id: "หมวดสินค้า",
  product_id: "รหัสสินค้า",
  promptpay_display_name: "ชื่อพร้อมเพย์",
  promptpay_enabled: "รับพร้อมเพย์",
  promptpay_id: "เลขพร้อมเพย์",
  quantity: "จำนวน",
  rating: "คะแนน",
  reason: "เหตุผล",
  rejected_reason: "เหตุผลที่ไม่ผ่าน",
  repair_notes: "บันทึกการซ่อม",
  role: "ประเภทบัญชี",
  service_category_id: "หมวดบริการ",
  service_id: "รหัสบริการ",
  skill_id: "รหัสทักษะ",
  sku: "SKU",
  sort_order: "ลำดับ",
  started_at: "เริ่มงานเมื่อ",
  status: "สถานะ",
  stock_quantity: "จำนวนคงเหลือ",
  subtitle: "หัวข้อรอง",
  subtotal_amount: "ยอดสินค้า",
  technician_id: "รหัสช่าง",
  technician_specialty: "ความถนัด",
  title: "หัวข้อ",
  total_amount: "ยอดรวม",
  unit_price: "ราคาขาย",
  verification_status: "ผลตรวจสลิป",
  verified_at: "ตรวจสอบเมื่อ",
  verified_by: "ผู้ตรวจสอบ",
  weekday: "วัน",
};

const weekdayLabels = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

const roleLabels: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  customer: "ลูกค้า",
  technician: "ช่าง",
};

const genericStatusLabels: Record<string, string> = {
  active: "เปิดใช้งาน",
  inactive: "ปิดใช้งาน",
};

// Which status vocabulary (from lib/format) a table's status fields use.
const statusKinds: Record<string, { payment?: StatusKind; status?: StatusKind }> = {
  booking_payments: { payment: "bookingPayment" },
  bookings: { payment: "bookingPayment", status: "booking" },
  product_orders: { payment: "productPayment", status: "productOrder" },
  product_payments: { payment: "productPayment" },
  repair_jobs: { status: "repairJob" },
};

// Fields that are always noise in the "whole row" view.
const hiddenRowFields = new Set(["id", "created_at", "updated_at", "updated_by"]);

const moneyFields = new Set([
  "amount",
  "base_price",
  "cost_price",
  "delivery_fee",
  "payment_amount",
  "slip_amount",
  "subtotal_amount",
  "total_amount",
  "unit_price",
]);

const dateTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTimeFormatter.format(parsed);
}

function getFieldLabel(field: string) {
  return fieldLabels[field] ?? field;
}

function formatAuditValue(tableName: string, field: string, value: Json | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    if (field === "is_open") {
      return value ? "เปิด" : "ปิด";
    }

    return value ? "ใช่" : "ไม่ใช่";
  }

  if (field === "weekday" && typeof value === "number") {
    return weekdayLabels[value] ?? String(value);
  }

  if (typeof value === "number") {
    if (moneyFields.has(field)) {
      return `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
    }

    return value.toLocaleString("th-TH");
  }

  if (typeof value === "string") {
    if (field === "role") {
      return roleLabels[value] ?? value;
    }

    if (field === "status" || field === "payment_status") {
      const kind =
        field === "status"
          ? statusKinds[tableName]?.status
          : statusKinds[tableName]?.payment;

      return kind ? statusLabel(kind, value) : genericStatusLabels[value] ?? value;
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return formatDateTime(value);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return formatThaiDate(value);
    }

    if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
      return value.slice(0, 5);
    }

    return value;
  }

  return JSON.stringify(value);
}

function getRecordLabel(log: AdminAuditLog) {
  // Settings tables have a single row keyed "default".
  if (log.record_label === "default") {
    return "การตั้งค่าหลักของร้าน";
  }

  if (log.table_name === "garage_operating_days" && log.record_label) {
    const weekday = Number(log.record_label);
    return Number.isInteger(weekday)
      ? `วัน${weekdayLabels[weekday] ?? log.record_label}`
      : log.record_label;
  }

  if (log.table_name === "bookings" && log.record_label) {
    const [date, time] = log.record_label.split(" ");
    return `คิว ${formatThaiDate(date)}${time ? ` ${time.slice(0, 5)}` : ""}`;
  }

  if (log.table_name === "garage_closed_dates" && log.record_label) {
    return formatThaiDate(log.record_label);
  }

  return log.record_label?.trim() || "-";
}

// Link to the record's own admin page, when it has one and still exists.
function getRecordHref(log: AdminAuditLog) {
  if (log.action === "delete" || !log.record_id) {
    return null;
  }

  if (log.table_name === "bookings") {
    return `/admin/bookings/${log.record_id}`;
  }

  if (log.table_name === "product_orders") {
    return `/admin/product-orders/${log.record_id}`;
  }

  if (log.table_name === "profiles") {
    return `/admin/customers/${log.record_id}`;
  }

  return null;
}

function asObject(value: Json | null): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function AuditChangeList({ log }: { log: AdminAuditLog }) {
  const oldData = asObject(log.old_data);
  const newData = asObject(log.new_data);
  const fields = log.changed_fields ?? [];

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-[var(--line)]">
      <div className="hidden grid-cols-[minmax(8rem,12rem)_1fr_1fr] bg-[var(--surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--muted)] sm:grid">
        <span>ข้อมูล</span>
        <span>ค่าเดิม</span>
        <span>ค่าใหม่</span>
      </div>
      <dl className="divide-y divide-[var(--line)]">
        {fields.map((field) => (
          <div
            className="grid gap-1 px-3 py-2.5 text-sm sm:grid-cols-[minmax(8rem,12rem)_1fr_1fr] sm:gap-3"
            key={field}
          >
            <dt className="font-semibold text-[var(--foreground)]">
              {getFieldLabel(field)}
            </dt>
            <dd className="break-words text-[var(--muted)] line-through decoration-red-300/60">
              <span className="sr-only">ค่าเดิม: </span>
              {formatAuditValue(log.table_name, field, oldData[field])}
            </dd>
            <dd className="break-words font-semibold text-[var(--brand)]">
              <span className="sr-only">ค่าใหม่: </span>
              <span aria-hidden="true" className="mr-1 text-[var(--muted)] sm:hidden">
                →
              </span>
              {formatAuditValue(log.table_name, field, newData[field])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AuditRowSnapshot({ log }: { log: AdminAuditLog }) {
  const row = asObject(log.action === "delete" ? log.old_data : log.new_data);
  const fields = Object.keys(row)
    .filter((field) => !hiddenRowFields.has(field))
    .sort((a, b) => getFieldLabel(a).localeCompare(getFieldLabel(b), "th"));

  if (fields.length === 0) {
    return null;
  }

  return (
    <details className="group mt-4 rounded-md border border-[var(--line)]">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 text-sm font-semibold text-[var(--muted)] hover:text-[var(--foreground)]">
        {log.action === "delete" ? "ข้อมูลที่ถูกลบ" : "ข้อมูลที่เพิ่ม"} (
        {fields.length} รายการ)
        <span aria-hidden="true" className="transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <dl className="grid gap-x-6 gap-y-2 border-t border-[var(--line)] px-3 py-3 text-sm sm:grid-cols-2">
        {fields.map((field) => (
          <div className="min-w-0" key={field}>
            <dt className="text-xs text-[var(--muted)]">{getFieldLabel(field)}</dt>
            <dd className="break-words text-[var(--foreground)]">
              {formatAuditValue(log.table_name, field, row[field])}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function AuditLogEntry({ log }: { log: AdminAuditLog }) {
  const href = getRecordHref(log);

  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${actionStyles[log.action]}`}
            >
              {actionLabels[log.action]}
            </span>
            <span className="text-sm font-semibold text-[var(--accent)]">
              {tableLabels[log.table_name] ?? log.table_name}
            </span>
          </div>
          <h2 className="mt-2 break-words text-lg font-bold text-[var(--foreground)]">
            {href ? (
              <Link className="hover:text-[var(--brand)] hover:underline" href={href}>
                {getRecordLabel(log)}
              </Link>
            ) : (
              getRecordLabel(log)
            )}
          </h2>
        </div>
        <div className="shrink-0 text-sm sm:text-right">
          <p className="font-semibold text-[var(--foreground)]">
            {log.actor_name ?? "ไม่ทราบชื่อ"}
          </p>
          <p className="text-[var(--muted)]">
            <time dateTime={log.occurred_at}>{formatDateTime(log.occurred_at)}</time>
          </p>
        </div>
      </div>

      {log.action === "update" ? (
        <AuditChangeList log={log} />
      ) : (
        <AuditRowSnapshot log={log} />
      )}
    </article>
  );
}

function AuditPagination({
  onPageChange,
  result,
}: {
  onPageChange: (page: number) => void;
  result: AdminAuditLogListResult;
}) {
  if (result.totalPages <= 1) {
    return (
      <p className="text-sm text-[var(--muted)]">ทั้งหมด {result.totalCount} รายการ</p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--muted)]">
        หน้า {result.page} จาก {result.totalPages} ({result.totalCount} รายการ)
      </p>
      <div className="flex gap-2">
        <button
          className="min-h-10 flex-1 rounded-md border border-[var(--line)] px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          disabled={result.page <= 1}
          onClick={() => onPageChange(result.page - 1)}
          type="button"
        >
          ก่อนหน้า
        </button>
        <button
          className="min-h-10 flex-1 rounded-md border border-[var(--line)] px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
          disabled={result.page >= result.totalPages}
          onClick={() => onPageChange(result.page + 1)}
          type="button"
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}

const inputClassName =
  "min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]";
const fieldClassName = `mt-1.5 ${inputClassName}`;

export function AdminAuditLogPanel() {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [filters, setFilters] = useState<AdminAuditLogFilters>(emptyFilters);
  const [searchDraft, setSearchDraft] = useState("");
  const [page, setPage] = useState(1);
  // Kept outside loadState so the "who" filter keeps its options while the
  // list reloads.
  const [actors, setActors] = useState<AdminAuditActor[]>([]);

  function updateFilter<Key extends keyof AdminAuditLogFilters>(
    key: Key,
    value: AdminAuditLogFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilter("search", searchDraft);
  }

  function handleClearFilters() {
    setFilters(emptyFilters);
    setSearchDraft("");
    setPage(1);
  }

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function load() {
      setLoadState({ status: "loading" });

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setLoadState({ error: sessionError.message, status: "error" });
        return;
      }

      if (!session?.user) {
        setLoadState({ status: "signed-out" });
        return;
      }

      const access = await checkAdminAccess(supabase, session.user.id);

      if (!isMounted) {
        return;
      }

      if (!access.allowed) {
        setLoadState({ access, status: "access-denied" });
        return;
      }

      const [logsResult, actorsResult] = await Promise.all([
        getAdminAuditLogsPage(supabase, { ...filters, page, pageSize }),
        getAdminAuditActors(supabase),
      ]);

      if (!isMounted) {
        return;
      }

      if (logsResult.error || actorsResult.error) {
        setLoadState({
          error: (logsResult.error ?? actorsResult.error)?.message ?? "",
          status: "error",
        });
        return;
      }

      // The page went past the end (e.g. after narrowing a filter).
      if (
        logsResult.data.logs.length === 0 &&
        logsResult.data.totalCount > 0 &&
        page > logsResult.data.totalPages
      ) {
        setPage(logsResult.data.totalPages);
        return;
      }

      setActors(actorsResult.data);
      setLoadState({
        result: logsResult.data,
        status: "ready",
      });
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [filters, page]);

  const hasFilters =
    filters.action !== "all" ||
    filters.actorId !== "all" ||
    filters.tableName !== "all" ||
    filters.fromDate !== "" ||
    filters.toDate !== "" ||
    filters.search !== "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-8 pt-0 sm:px-6 lg:px-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-[var(--foreground)] sm:text-3xl">
              ประวัติการแก้ไข
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              บันทึกทุกครั้งที่ admin เพิ่ม แก้ไข หรือลบข้อมูล ว่าใครทำ เมื่อไหร่
              และเปลี่ยนจากอะไรเป็นอะไร บันทึกนี้แก้ไขหรือลบไม่ได้
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            หน้าหลังบ้าน
          </Link>
        </div>
      </header>

      <section
        aria-label="ตัวกรอง"
        className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            ข้อมูลส่วนไหน
            <select
              className={fieldClassName}
              onChange={(event) => updateFilter("tableName", event.target.value)}
              value={filters.tableName}
            >
              <option value="all">ทั้งหมด</option>
              {Object.entries(tableLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            การกระทำ
            <select
              className={fieldClassName}
              onChange={(event) =>
                updateFilter(
                  "action",
                  event.target.value as AdminAuditLogFilters["action"],
                )
              }
              value={filters.action}
            >
              <option value="all">ทั้งหมด</option>
              <option value="insert">เพิ่ม</option>
              <option value="update">แก้ไข</option>
              <option value="delete">ลบ</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            ใครทำ
            <select
              className={fieldClassName}
              onChange={(event) => updateFilter("actorId", event.target.value)}
              value={filters.actorId}
            >
              <option value="all">admin ทุกคน</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.full_name?.trim() || actor.email || actor.id}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            ตั้งแต่วันที่
            <input
              className={fieldClassName}
              max={filters.toDate || undefined}
              onChange={(event) => updateFilter("fromDate", event.target.value)}
              type="date"
              value={filters.fromDate}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            ถึงวันที่
            <input
              className={fieldClassName}
              min={filters.fromDate || undefined}
              onChange={(event) => updateFilter("toDate", event.target.value)}
              type="date"
              value={filters.toDate}
            />
          </label>

          <form onSubmit={handleSearchSubmit}>
            <label
              className="text-sm font-semibold text-[var(--foreground)]"
              htmlFor="audit-search"
            >
              ค้นหาชื่อรายการ
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                className={inputClassName}
                id="audit-search"
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="เช่น ชื่อสินค้า, เลขออเดอร์"
                type="search"
                value={searchDraft}
              />
              <button
                className="min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--on-brand)]"
                type="submit"
              >
                ค้นหา
              </button>
            </div>
          </form>
        </div>

        {hasFilters ? (
          <button
            className="mt-4 text-sm font-semibold text-[var(--accent)] hover:underline"
            onClick={handleClearFilters}
            type="button"
          >
            ล้างตัวกรอง
          </button>
        ) : null}
      </section>

      {loadState.status === "loading" ? (
        <PageSkeleton label="กำลังโหลดประวัติการแก้ไข..." variant="list" withStats={false} />
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-300/40 bg-amber-400/15 p-5 text-sm leading-6 text-amber-200">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อน</p>
            <p className="mt-1">เข้าสู่ระบบด้วยบัญชี admin</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-[var(--on-brand)]"
              href="/auth"
            >
              ไปที่หน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-400/40 bg-red-500/15 p-5 text-sm leading-6 text-red-200">
            <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
            <p className="mt-2">{loadState.access.reason}</p>
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-400/40 bg-[var(--surface)] px-5 py-4 text-sm text-[var(--danger)] shadow-sm">
            <p className="font-semibold">โหลดประวัติการแก้ไขไม่สำเร็จ</p>
            <p className="mt-1 break-words">{loadState.error}</p>
            <p className="mt-2 text-[var(--muted)]">
              ถ้ายังไม่ได้รัน supabase/audit-log.sql ให้รันใน Supabase SQL Editor ก่อน
            </p>
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="space-y-4 py-6">
          {loadState.result.logs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] px-5 py-10 text-center text-sm text-[var(--muted)]">
              {hasFilters
                ? "ไม่พบรายการที่ตรงกับตัวกรอง"
                : "ยังไม่มีประวัติการแก้ไข ระบบจะเริ่มบันทึกตั้งแต่ตอนที่รัน audit-log.sql"}
            </div>
          ) : (
            loadState.result.logs.map((log) => <AuditLogEntry key={log.id} log={log} />)
          )}

          <AuditPagination onPageChange={setPage} result={loadState.result} />
        </section>
      ) : null}
    </main>
  );
}
