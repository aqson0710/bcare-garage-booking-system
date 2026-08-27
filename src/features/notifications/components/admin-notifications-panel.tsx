"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminBookingsPage,
  getAdminOpenRepairJobs,
  getAdminProductOrdersPage,
  type AdminAccessResult,
} from "@/features/admin";
import { buildAdminNotifications, type WebNotification } from "@/features/notifications";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; error: null; notifications: null; userId: null }
  | { status: "signed-out"; access: null; error: null; notifications: null; userId: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      error: null;
      notifications: null;
      userId: string;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      error: null;
      notifications: WebNotification[];
      userId: string;
    }
  | { status: "error"; access: null; error: string; notifications: null; userId: null };

type NotificationFilter = "all" | "unread" | WebNotification["source"];

const notificationFilters: NotificationFilter[] = [
  "all",
  "unread",
  "booking",
  "repair",
  "payment",
  "order",
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getToneClass(tone: WebNotification["tone"]) {
  if (tone === "success") {
    return "border-emerald-200 bg-emerald-50 text-[var(--brand-strong)]";
  }

  if (tone === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (tone === "danger") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-cyan-200 bg-cyan-50 text-cyan-800";
}

function getSourceLabel(source: WebNotification["source"]) {
  if (source === "booking") {
    return "การจอง";
  }

  if (source === "repair") {
    return "งานซ่อม";
  }

  if (source === "payment") {
    return "ชำระเงิน";
  }

  return "สินค้า";
}

function getFilterLabel(filter: NotificationFilter) {
  if (filter === "all") {
    return "ทั้งหมด";
  }

  if (filter === "unread") {
    return "ยังไม่ได้อ่าน";
  }

  return getSourceLabel(filter);
}

function getReadStorageKey(userId: string) {
  return `bcare-admin-read-notifications:${userId}`;
}

function readStoredNotificationIds(userId: string) {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const storedValue = window.localStorage.getItem(getReadStorageKey(userId));
    const parsedValue = storedValue ? (JSON.parse(storedValue) as string[]) : [];
    return new Set(parsedValue.filter((item) => typeof item === "string"));
  } catch {
    return new Set<string>();
  }
}

function writeStoredNotificationIds(userId: string, readIds: Set<string>) {
  window.localStorage.setItem(
    getReadStorageKey(userId),
    JSON.stringify([...readIds].slice(-300)),
  );
}

function NotificationCard({
  isRead,
  notification,
  onMarkRead,
}: {
  isRead: boolean;
  notification: WebNotification;
  onMarkRead: (notificationId: string) => void;
}) {
  return (
    <article
      className={`rounded-lg border bg-white p-5 shadow-sm ${
        isRead ? "border-[var(--line)] opacity-75" : "border-[var(--brand)]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${getToneClass(
                notification.tone,
              )}`}
            >
              {getSourceLabel(notification.source)}
            </span>
            {!isRead ? (
              <span className="rounded-md bg-[var(--brand)] px-2.5 py-1 text-xs font-semibold text-white">
                ใหม่
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-lg font-bold text-[var(--foreground)]">
            {notification.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {notification.message}
          </p>
          <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
            {formatDateTime(notification.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
            href={notification.href}
            onClick={() => onMarkRead(notification.id)}
          >
            เปิดจัดการ
          </Link>
          {!isRead ? (
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
              onClick={() => onMarkRead(notification.id)}
              type="button"
            >
              อ่านแล้ว
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function AdminNotificationsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    notifications: null,
    status: "loading",
    userId: null,
  });
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadNotifications() {
      setLoadState({
        access: null,
        error: null,
        notifications: null,
        status: "loading",
        userId: null,
      });

      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;

      if (!isMounted) {
        return;
      }

      if (!user) {
        setLoadState({
          access: null,
          error: null,
          notifications: null,
          status: "signed-out",
          userId: null,
        });
        return;
      }

      const access = await checkAdminAccess(supabase, user.id);

      if (!isMounted) {
        return;
      }

      if (!access.allowed) {
        setLoadState({
          access,
          error: null,
          notifications: null,
          status: "access-denied",
          userId: user.id,
        });
        return;
      }

      const [pendingBookings, confirmedBookings, pendingOrders, activeOrders, repairJobs] =
        await Promise.all([
          getAdminBookingsPage(supabase, {
            page: 1,
            pageSize: 20,
            search: "",
            status: "pending",
          }),
          getAdminBookingsPage(supabase, {
            page: 1,
            pageSize: 20,
            search: "",
            status: "confirmed",
          }),
          getAdminProductOrdersPage(supabase, {
            page: 1,
            pageSize: 20,
            paymentStatus: "pending",
            search: "",
            status: "all",
          }),
          getAdminProductOrdersPage(supabase, {
            page: 1,
            pageSize: 20,
            paymentStatus: "all",
            search: "",
            status: "pending",
          }),
          getAdminOpenRepairJobs(supabase, 30),
        ]);

      if (!isMounted) {
        return;
      }

      const firstError =
        pendingBookings.error ??
        confirmedBookings.error ??
        pendingOrders.error ??
        activeOrders.error ??
        repairJobs.error;

      if (firstError) {
        setLoadState({
          access: null,
          error: firstError.message,
          notifications: null,
          status: "error",
          userId: null,
        });
        return;
      }

      const bookings = [
        ...(pendingBookings.data?.bookings ?? []),
        ...(confirmedBookings.data?.bookings ?? []),
      ];
      const ordersById = new Map(
        [
          ...(pendingOrders.data?.orders ?? []),
          ...(activeOrders.data?.orders ?? []),
        ].map((order) => [order.id, order]),
      );

      setReadIds(readStoredNotificationIds(user.id));
      setLoadState({
        access,
        error: null,
        notifications: buildAdminNotifications({
          bookings,
          orders: [...ordersById.values()],
          repairJobs: repairJobs.data ?? [],
        }),
        status: "ready",
        userId: user.id,
      });
    }

    void loadNotifications();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadNotifications();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const unreadCount = useMemo(() => {
    if (loadState.status !== "ready") {
      return 0;
    }

    return loadState.notifications.filter(
      (notification) => !readIds.has(notification.id),
    ).length;
  }, [loadState, readIds]);
  const visibleNotifications = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    if (activeFilter === "all") {
      return loadState.notifications;
    }

    if (activeFilter === "unread") {
      return loadState.notifications.filter(
        (notification) => !readIds.has(notification.id),
      );
    }

    return loadState.notifications.filter(
      (notification) => notification.source === activeFilter,
    );
  }, [activeFilter, loadState, readIds]);

  function markAsRead(notificationId: string) {
    if (loadState.status !== "ready") {
      return;
    }

    const nextReadIds = new Set(readIds);
    nextReadIds.add(notificationId);
    setReadIds(nextReadIds);
    writeStoredNotificationIds(loadState.userId, nextReadIds);
  }

  function markAllAsRead() {
    if (loadState.status !== "ready") {
      return;
    }

    const nextReadIds = new Set([
      ...readIds,
      ...loadState.notifications.map((notification) => notification.id),
    ]);
    setReadIds(nextReadIds);
    writeStoredNotificationIds(loadState.userId, nextReadIds);
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
              แจ้งเตือนแอดมิน
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              รวมคิวงานที่ควรจัดการ เช่น การจองรอยืนยัน สลิปรอตรวจ
              ออเดอร์สินค้า และใบงานซ่อม
            </p>
          </div>
          {loadState.status === "ready" ? (
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={unreadCount === 0}
              onClick={markAllAsRead}
              type="button"
            >
              อ่านทั้งหมดแล้ว
            </button>
          ) : null}
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดแจ้งเตือนแอดมิน...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อนดูแจ้งเตือนแอดมิน</p>
            <p className="mt-1">เข้าสู่ระบบด้วยบัญชี admin</p>
            <Link
              className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
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
            <p className="font-semibold">ไม่มีสิทธิ์ดูแจ้งเตือนแอดมิน</p>
            <p className="mt-1">{loadState.access.reason}</p>
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
          <div className="mb-5 rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              มีแจ้งเตือนแอดมินทั้งหมด {loadState.notifications.length} รายการ
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              ยังไม่ได้อ่าน {unreadCount} รายการ
            </p>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {notificationFilters.map((filter) => (
                <button
                  className={
                    activeFilter === filter
                      ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                      : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                  }
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  type="button"
                >
                  {getFilterLabel(filter)}
                </button>
              ))}
            </div>
          </div>

          {visibleNotifications.length > 0 ? (
            <div className="space-y-4">
              {visibleNotifications.map((notification) => (
                <NotificationCard
                  isRead={readIds.has(notification.id)}
                  key={notification.id}
                  notification={notification}
                  onMarkRead={markAsRead}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">
                ไม่มีแจ้งเตือนในตัวกรองนี้
              </p>
              <p className="mt-1">
                เมื่อมี booking รอยืนยัน สลิปรอตรวจ ออเดอร์รอดำเนินการ
                หรือใบงานซ่อมที่ต้องจัดการ รายการจะมาแสดงที่นี่
              </p>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
