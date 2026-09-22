"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminCustomers,
  type AdminAccessResult,
  type AdminCustomerSummary,
} from "@/features/admin";
import type { ProfileRole } from "@/features/auth";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; customers: null; error: null }
  | { status: "signed-out"; access: null; customers: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      customers: null;
      error: null;
    }
  | {
      status: "ready";
      access: Extract<AdminAccessResult, { allowed: true }>;
      customers: AdminCustomerSummary[];
      error: null;
    }
  | { status: "error"; access: null; customers: null; error: string };

type RoleFilter = "all" | ProfileRole;

type RoleUpdateState =
  | { status: "idle"; error: null; message: null }
  | { status: "saving"; error: null; message: null }
  | { status: "success"; error: null; message: string }
  | { status: "error"; error: string; message: null };

const roleOptions: { label: string; value: ProfileRole }[] = [
  { label: "ลูกค้า", value: "customer" },
  { label: "ช่าง", value: "technician" },
  { label: "ผู้ดูแล", value: "admin" },
];

const roleFilterOptions: { label: string; value: RoleFilter }[] = [
  { label: "ทุกสิทธิ์", value: "all" },
  ...roleOptions,
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH");
}

function getRoleLabel(role: ProfileRole) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

async function requestCustomerRoleUpdate(
  customerId: string,
  role: ProfileRole,
) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(`/api/admin/customers/${customerId}/role`, {
    body: JSON.stringify({ role }),
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
    method: "PATCH",
  });
  const result = (await response.json().catch(() => null)) as
    | {
        data?: { role: ProfileRole; updated_at: string };
        message?: string;
        ok?: boolean;
      }
    | null;

  if (!response.ok || !result?.ok || !result.data) {
    return {
      data: null,
      error: result?.message ?? "เปลี่ยนสิทธิ์ผู้ใช้ไม่สำเร็จ",
    };
  }

  return {
    data: result.data,
    error: null,
  };
}

function CustomerCard({
  currentAdminId,
  customer,
  onRoleChanged,
}: {
  currentAdminId: string;
  customer: AdminCustomerSummary;
  onRoleChanged: (customer: AdminCustomerSummary) => void;
}) {
  const [roleState, setRoleState] = useState<RoleUpdateState>({
    error: null,
    message: null,
    status: "idle",
  });
  const isCurrentAdmin = customer.id === currentAdminId;

  async function handleRoleChange(nextRole: ProfileRole) {
    if (nextRole === customer.role) {
      return;
    }

    setRoleState({
      error: null,
      message: null,
      status: "saving",
    });

    const { data, error } = await requestCustomerRoleUpdate(
      customer.id,
      nextRole,
    );

    if (error || !data) {
      setRoleState({
        error: error ?? "เปลี่ยนสิทธิ์ผู้ใช้ไม่สำเร็จ",
        message: null,
        status: "error",
      });
      return;
    }

    onRoleChanged({
      ...customer,
      role: data.role,
      updated_at: data.updated_at,
    });
    setRoleState({
      error: null,
      message: `เปลี่ยนสิทธิ์เป็น ${getRoleLabel(data.role)} แล้ว`,
      status: "success",
    });
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand)]">
              {getRoleLabel(customer.role)}
            </p>
            <span className="rounded-md bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)]">
              {customer.email ?? "ไม่มีอีเมล"}
            </span>
            {isCurrentAdmin ? (
              <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                บัญชีที่ใช้งานอยู่
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {customer.full_name}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {customer.phone_number}
          </p>
        </div>

        <div className="grid gap-2 sm:min-w-48">
          <label className="text-sm font-medium text-[var(--foreground)]">
            สิทธิ์ผู้ใช้
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-[var(--brand)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--muted)]"
              disabled={isCurrentAdmin || roleState.status === "saving"}
              onChange={(event) =>
                handleRoleChange(event.target.value as ProfileRole)
              }
              value={customer.role}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href={`/admin/customers/${customer.id}`}
          >
            ดูข้อมูลผู้ใช้
          </Link>
        </div>
      </div>

      {roleState.status === "success" ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-[var(--brand-strong)]">
          {roleState.message}
        </div>
      ) : null}

      {roleState.status === "error" ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {roleState.error}
        </div>
      ) : null}

      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[var(--muted)]">รถ</dt>
          <dd className="mt-1 text-lg font-bold text-[var(--foreground)]">
            {customer.vehicleCount}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">การจอง</dt>
          <dd className="mt-1 text-lg font-bold text-[var(--foreground)]">
            {customer.bookingCount}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">การจองล่าสุด</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {customer.latestBooking
              ? `${customer.latestBooking.booking_date} ${customer.latestBooking.booking_time.slice(
                  0,
                  5,
                )}`
              : "-"}
          </dd>
          {customer.latestBooking ? (
            <dd className="mt-1 text-xs text-[var(--muted)]">
              {customer.latestBooking.status}
            </dd>
          ) : null}
        </div>
        <div>
          <dt className="text-[var(--muted)]">วันที่สร้างบัญชี</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {formatDateTime(customer.created_at)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function AdminCustomersPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    customers: null,
    error: null,
    status: "loading",
  });
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadCustomers() {
      setLoadState({
        access: null,
        customers: null,
        error: null,
        status: "loading",
      });

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setLoadState({
          access: null,
          customers: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          customers: null,
          error: null,
          status: "signed-out",
        });
        return;
      }

      const access = await checkAdminAccess(supabase, session.user.id);

      if (!isMounted) {
        return;
      }

      if (!access.allowed) {
        setLoadState({
          access,
          customers: null,
          error: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminCustomers(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          customers: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        customers: data ?? [],
        error: null,
        status: "ready",
      });
    }

    loadCustomers();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadCustomers();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    const normalizedSearch = searchInput.trim().toLowerCase();

    return loadState.customers.filter((customer) => {
      if (roleFilter !== "all" && customer.role !== roleFilter) {
        return false;
      }

      if (normalizedSearch) {
        return (
          customer.full_name.toLowerCase().includes(normalizedSearch) ||
          customer.phone_number.toLowerCase().includes(normalizedSearch) ||
          (customer.email ?? "").toLowerCase().includes(normalizedSearch)
        );
      }

      return true;
    });
  }, [loadState, roleFilter, searchInput]);

  function handleCustomerRoleChanged(nextCustomer: AdminCustomerSummary) {
    if (loadState.status !== "ready") {
      return;
    }

    setLoadState({
      ...loadState,
      customers: loadState.customers.map((customer) =>
        customer.id === nextCustomer.id
          ? {
              ...customer,
              role: nextCustomer.role,
              updated_at: nextCustomer.updated_at,
            }
          : customer,
      ),
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              รายชื่อผู้ใช้
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ตรวจสอบโปรไฟล์ผู้ใช้ จำนวนรถ ประวัติการจอง และจัดการสิทธิ์ลูกค้า/ช่าง/ผู้ดูแล
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            หน้าแอดมิน
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดรายชื่อลูกค้า...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบ</p>
            <p className="mt-1">กรุณาเข้าสู่ระบบด้วยบัญชีแอดมิน</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่บัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
            <p className="mt-2">{loadState.access.reason}</p>
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-200 bg-[var(--surface)] px-5 py-4 text-sm text-[var(--danger)] shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {filteredCustomers.length} จาก {loadState.customers.length}{" "}
                ผู้ใช้
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                ใช้ role `technician` สำหรับบัญชีช่างในระบบ
              </p>
            </div>

            <div className="grid w-full gap-3 sm:grid-cols-[180px_minmax(0,1fr)] lg:max-w-2xl">
              <label className="text-sm font-medium text-[var(--foreground)]">
                กรองสิทธิ์
                <select
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) =>
                    setRoleFilter(event.target.value as RoleFilter)
                  }
                  value={roleFilter}
                >
                  {roleFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-[var(--foreground)]">
                ค้นหา
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="ค้นหาชื่อ เบอร์โทร หรืออีเมล"
                  type="search"
                  value={searchInput}
                />
              </label>
            </div>
          </div>

          {filteredCustomers.length > 0 ? (
            <div className="mt-5 space-y-4">
              {filteredCustomers.map((customer) => (
                <CustomerCard
                  currentAdminId={loadState.access.profile.id}
                  customer={customer}
                  key={customer.id}
                  onRoleChanged={handleCustomerRoleChanged}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบผู้ใช้ที่ตรงกับตัวกรอง
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
