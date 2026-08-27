"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminBookingsPage,
  updateAdminBookingStatus,
  type AdminAccessResult,
  type AdminBooking,
  type AdminBookingListResult,
  type AdminBookingListStatusFilter,
  type AdminBookingStatusAction,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type StatusFilter = AdminBookingListStatusFilter;

type LoadState =
  | { status: "loading"; access: null; result: null; error: null }
  | { status: "signed-out"; access: null; result: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      result: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      result: AdminBookingListResult;
      error: null;
    }
  | { status: "error"; access: null; result: null; error: string };

type ActionState =
  | { status: "idle"; bookingId: null; error: null }
  | { status: "updating"; bookingId: string; error: null }
  | { status: "error"; bookingId: string; error: string };

const statusFilters: StatusFilter[] = [
  "all",
  "pending",
  "confirmed",
  "cancelled",
  "completed",
];
const pageSize = 10;
const editableStatuses: AdminBooking["status"][] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
];

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatTime(time: string) {
  return time.slice(0, 5);
}

function parseStatusFilter(status: string | null): StatusFilter {
  if (
    status === "pending" ||
    status === "confirmed" ||
    status === "cancelled" ||
    status === "completed"
  ) {
    return status;
  }

  return "all";
}

function parsePage(page: string | null) {
  const parsedPage = Number(page);

  if (!Number.isFinite(parsedPage) || parsedPage < 1) {
    return 1;
  }

  return Math.floor(parsedPage);
}

function getStatusStyle(status: AdminBooking["status"]) {
  if (status === "pending") {
    return "bg-amber-50 text-amber-800";
  }

  if (status === "confirmed") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  if (status === "cancelled") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function formatBookingStatus(status: StatusFilter | AdminBooking["status"]) {
  if (status === "pending") {
    return "รอยืนยัน";
  }

  if (status === "confirmed") {
    return "ยืนยันแล้ว";
  }

  if (status === "cancelled") {
    return "ยกเลิก";
  }

  if (status === "completed") {
    return "เสร็จสิ้น";
  }

  return "ทั้งหมด";
}

function getAdminActions(
  status: AdminBooking["status"],
): Array<{ label: string; status: AdminBookingStatusAction; tone: string }> {
  if (status === "pending") {
    return [
      {
        label: "ยืนยันการจอง",
        status: "confirmed",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "ยกเลิก",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  if (status === "confirmed") {
    return [
      {
        label: "ทำเครื่องหมายเสร็จสิ้น",
        status: "completed",
        tone: "bg-[var(--brand)] text-white",
      },
      {
        label: "ยกเลิก",
        status: "cancelled",
        tone: "border border-red-200 bg-red-50 text-red-700",
      },
    ];
  }

  return [];
}

function clampPage(page: number, totalPages: number) {
  if (!Number.isFinite(page)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.floor(page)), totalPages);
}

function AdminPaginationControls({
  onPageChange,
  placement,
  result,
}: {
  onPageChange: (page: number) => void;
  placement: "bottom" | "top";
  result: AdminBookingListResult;
}) {
  const inputId = `page-jump-${placement}-${result.page}-${result.totalPages}`;

  function handlePageJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const requestedPage = Number(formData.get("page"));
    onPageChange(clampPage(requestedPage, result.totalPages));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
      <p className="text-sm text-[var(--muted)]">
        หน้า {result.page} จาก {result.totalPages}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <button
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={result.page <= 1}
            onClick={() => onPageChange(result.page - 1)}
            type="button"
          >
            ก่อนหน้า
          </button>
          <button
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={result.page >= result.totalPages}
            onClick={() => onPageChange(result.page + 1)}
            type="button"
          >
            ถัดไป
          </button>
        </div>

        <form
          className="flex items-center gap-2"
          key={inputId}
          onSubmit={handlePageJump}
        >
          <label
            className="whitespace-nowrap text-sm font-semibold text-[var(--muted)]"
            htmlFor={inputId}
          >
            ไปหน้า
          </label>
          <input
            className="min-h-10 w-24 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            defaultValue={result.page}
            id={inputId}
            inputMode="numeric"
            max={result.totalPages}
            min={1}
            name="page"
            type="number"
          />
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
            type="submit"
          >
            ไป
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminBookingRow({
  actionState,
  booking,
  onStatusChange,
}: {
  actionState: ActionState;
  booking: AdminBooking;
  onStatusChange: (
    booking: AdminBooking,
    status: AdminBookingStatusAction,
  ) => void;
}) {
  const actions = getAdminActions(booking.status);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<AdminBookingStatusAction>(booking.status);
  const isUpdating =
    actionState.status === "updating" && actionState.bookingId === booking.id;
  const canSaveStatus = selectedStatus !== booking.status && !isUpdating;

  function cancelStatusEdit() {
    setSelectedStatus(booking.status);
    setIsEditingStatus(false);
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--brand)]">
              {booking.service?.name ?? "ไม่พบบริการ"}
            </p>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                booking.status,
              )}`}
            >
              {formatBookingStatus(booking.status)}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {booking.booking_date} เวลา {formatTime(booking.booking_time)}
          </h2>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 text-sm md:grid-cols-4">
        <div>
          <dt className="text-[var(--muted)]">ลูกค้า</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.customer?.full_name ?? "-"}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {booking.customer?.phone_number ?? "-"}
          </dd>
          <dd className="mt-1 break-all text-xs text-[var(--muted)]">
            {booking.customer?.email ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">รถ</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.vehicle?.license_plate ?? "-"}
          </dd>
          <dd className="mt-1 text-xs text-[var(--muted)]">
            {booking.vehicle
              ? `${booking.vehicle.brand ?? "-"} / ${
                  booking.vehicle.model ?? "-"
                }`
              : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">ราคา</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {booking.service
              ? currencyFormatter.format(booking.service.base_price)
              : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">สร้างเมื่อ</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {new Date(booking.created_at).toLocaleString("th-TH")}
          </dd>
        </div>
      </dl>

      {booking.note ? (
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm leading-6 text-[var(--muted)]">
          {booking.note}
        </div>
      ) : null}

      <p className="mt-4 break-all text-xs text-[var(--muted)]">
        รหัสการจอง: {booking.id}
      </p>

      <div className="mt-5 flex flex-col gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        {isEditingStatus ? (
          <div className="flex w-full flex-col gap-3 rounded-md border border-[var(--line)] bg-slate-50 p-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="text-sm font-semibold text-[var(--foreground)]">
              แก้ไขสถานะ
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] sm:w-56"
                disabled={isUpdating}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target.value as AdminBookingStatusAction,
                  )
                }
                value={selectedStatus}
              >
                {editableStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatBookingStatus(status)}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                disabled={isUpdating}
                onClick={cancelStatusEdit}
                type="button"
              >
                ยกเลิกการแก้ไข
              </button>
              <button
                className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!canSaveStatus}
                onClick={() => onStatusChange(booking, selectedStatus)}
                type="button"
              >
                {isUpdating ? "กำลังบันทึก..." : "บันทึกสถานะ"}
              </button>
            </div>
          </div>
        ) : actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                className={`min-h-10 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${action.tone}`}
                disabled={isUpdating}
                key={action.status}
                onClick={() => onStatusChange(booking, action.status)}
                type="button"
              >
                {isUpdating ? "กำลังอัปเดต..." : action.label}
              </button>
            ))}
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
              disabled={isUpdating}
              onClick={() => setIsEditingStatus(true)}
              type="button"
            >
              แก้ไขสถานะ
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-[var(--muted)]">
              ไม่มีปุ่มลัดสำหรับสถานะนี้
            </p>
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
              disabled={isUpdating}
              onClick={() => setIsEditingStatus(true)}
              type="button"
            >
              แก้ไขสถานะ
            </button>
          </div>
        )}

        {actionState.status === "error" &&
        actionState.bookingId === booking.id ? (
          <p className="text-sm text-red-700">{actionState.error}</p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="inline-flex min-h-10 items-center rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
          href={`/admin/bookings/${booking.id}`}
        >
          ดูรายละเอียด
        </Link>
        <Link
          className="inline-flex min-h-10 items-center rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
          href={`/admin/bookings/${booking.id}/receipt`}
        >
          เอกสารการจอง
        </Link>
      </div>
    </article>
  );
}

export function AdminBookingsPanel() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = parseStatusFilter(searchParams.get("status"));
  const page = parsePage(searchParams.get("page"));
  const submittedSearch = searchParams.get("search") ?? "";
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    result: null,
    error: null,
    status: "loading",
  });
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get("search") ?? "",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [actionState, setActionState] = useState<ActionState>({
    bookingId: null,
    error: null,
    status: "idle",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadBookings() {
      setLoadState({
        access: null,
        result: null,
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
          result: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          result: null,
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
          result: null,
          error: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminBookingsPage(supabase, {
        page,
        pageSize,
        search: submittedSearch,
        status: statusFilter,
      });

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          result: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        result: data,
        error: null,
        status: "ready",
      });
    }

    loadBookings();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadBookings();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [page, reloadKey, statusFilter, submittedSearch]);

  function updateFilters(next: {
    page?: number;
    search?: string;
    status?: StatusFilter;
  }) {
    const nextPage = next.page ?? page;
    const nextSearch = next.search ?? submittedSearch;
    const nextStatus = next.status ?? statusFilter;
    const params = new URLSearchParams();

    if (nextStatus !== "all") {
      params.set("status", nextStatus);
    }

    if (nextSearch.trim()) {
      params.set("search", nextSearch.trim());
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({
      page: 1,
      search: searchInput,
    });
  }

  function handlePageChange(nextPage: number) {
    updateFilters({
      page: nextPage,
    });
  }

  async function handleStatusChange(
    booking: AdminBooking,
    nextStatus: AdminBookingStatusAction,
  ) {
    if (loadState.status !== "ready") {
      return;
    }

    setActionState({
      bookingId: booking.id,
      error: null,
      status: "updating",
    });

    const supabase = createClient();
    const { error } = await updateAdminBookingStatus(
      supabase,
      booking.id,
      nextStatus,
    );

    if (error) {
      setActionState({
        bookingId: booking.id,
        error: error.message,
        status: "error",
      });
      return;
    }

    setReloadKey((currentKey) => currentKey + 1);
    setActionState({
      bookingId: null,
      error: null,
      status: "idle",
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
              รายการจองทั้งหมด
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ตรวจสอบคำขอจองจากลูกค้าทั้งหมด และจัดการสถานะการจอง
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            หน้าแอดมิน
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดรายการจอง...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อน</p>
            <p className="mt-1">เข้าสู่ระบบด้วยบัญชี admin</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่หน้าบัญชี
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
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          <div className="space-y-4 border-b border-[var(--line)] pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  พบรายการจอง {loadState.result.totalCount} รายการ
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  หน้า {loadState.result.page} จาก{" "}
                  {loadState.result.totalPages}
                </p>
              </div>

              <form
                className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl"
                onSubmit={handleSearchSubmit}
              >
                <input
                  className="min-h-10 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="ค้นหาลูกค้า เบอร์โทร ทะเบียนรถ บริการ หมายเหตุ หรือรหัสการจอง"
                  type="search"
                  value={searchInput}
                />
                <button
                  className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                  type="submit"
                >
                  ค้นหา
                </button>
                {submittedSearch ? (
                  <button
                    className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                    onClick={() => {
                      setSearchInput("");
                      updateFilters({
                        page: 1,
                        search: "",
                      });
                    }}
                    type="button"
                  >
                    ล้าง
                  </button>
                ) : null}
              </form>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusFilters.map((status) => (
                <button
                  className={
                    statusFilter === status
                      ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                      : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                  }
                  key={status}
                  onClick={() =>
                    updateFilters({
                      page: 1,
                      status,
                    })
                  }
                  type="button"
                >
                  {formatBookingStatus(status)}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <AdminPaginationControls
              onPageChange={handlePageChange}
              placement="top"
              result={loadState.result}
            />
          </div>

          {loadState.result.bookings.length > 0 ? (
            <div className="mt-5 space-y-4">
              {loadState.result.bookings.map((booking) => (
                <AdminBookingRow
                  actionState={actionState}
                  booking={booking}
                  key={`${booking.id}-${booking.status}`}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบรายการจองที่ตรงกับตัวกรองปัจจุบัน
            </div>
          )}

          <div className="mt-6">
            <AdminPaginationControls
              onPageChange={handlePageChange}
              placement="bottom"
              result={loadState.result}
            />
          </div>
        </section>
      ) : null}
    </main>
  );
}
