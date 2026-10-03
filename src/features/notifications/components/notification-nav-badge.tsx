"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  checkAdminAccess,
  getAdminBookingsPage,
  getAdminOpenRepairJobs,
  getAdminProductOrdersPage,
} from "@/features/admin";
import { getCurrentUserBookings } from "@/features/bookings";
import {
  buildAdminNotifications,
  buildCustomerNotifications,
} from "@/features/notifications";
import { getCustomerProductOrders } from "@/features/products";
import { createClient } from "@/lib/supabase/browser";

type NotificationBadgeScope = "admin" | "customer";

function getReadStorageKey(scope: NotificationBadgeScope, userId: string) {
  return scope === "admin"
    ? `bcare-admin-read-notifications:${userId}`
    : `bcare-read-notifications:${userId}`;
}

function readStoredNotificationIds(scope: NotificationBadgeScope, userId: string) {
  try {
    const storedValue = window.localStorage.getItem(
      getReadStorageKey(scope, userId),
    );
    const parsedValue = storedValue ? (JSON.parse(storedValue) as string[]) : [];
    return new Set(parsedValue.filter((item) => typeof item === "string"));
  } catch {
    return new Set<string>();
  }
}

// The navigation bar (and this badge with it) is re-mounted on every page
// change, so without a cache every click re-downloaded the customer's whole
// booking/order history (or 5 admin queries) just to draw this number. The
// notification ids are kept here for a short time and shared across page
// changes; the unread count is still recomputed from localStorage on every
// mount, so marking notifications as read shows up immediately.
const NOTIFICATION_IDS_CACHE_MS = 60_000;
const notificationIdsCache = new Map<
  string,
  { ids: string[]; loadedAt: number }
>();

function getCacheKey(scope: NotificationBadgeScope, userId: string) {
  return `${scope}:${userId}`;
}

function countUnread(
  scope: NotificationBadgeScope,
  userId: string,
  ids: string[],
) {
  const readIds = readStoredNotificationIds(scope, userId);
  return ids.filter((id) => !readIds.has(id)).length;
}

function formatBadgeCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export function NotificationNavBadge({
  label,
  scope,
  showLabel = true,
}: {
  label: ReactNode;
  scope: NotificationBadgeScope;
  showLabel?: boolean;
}) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadCount() {
      const supabase = createClient();
      // getSession() reads the locally stored session (no network call).
      // This badge only decides what number to show; the data queries below
      // are still protected by RLS on the server.
      const sessionResult = await supabase.auth.getSession();
      const user = sessionResult.data.session?.user ?? null;

      if (!isMounted || !user) {
        return;
      }

      const cacheKey = getCacheKey(scope, user.id);
      const cached = notificationIdsCache.get(cacheKey);

      if (cached) {
        setUnreadCount(countUnread(scope, user.id, cached.ids));

        if (Date.now() - cached.loadedAt < NOTIFICATION_IDS_CACHE_MS) {
          return;
        }
      }

      if (scope === "customer") {
        const [bookingsResult, ordersResult] = await Promise.all([
          getCurrentUserBookings(supabase, user.id),
          getCustomerProductOrders(supabase, user.id),
        ]);

        if (!isMounted || bookingsResult.error || ordersResult.error) {
          return;
        }

        const notifications = buildCustomerNotifications({
          bookings: bookingsResult.data ?? [],
          orders: ordersResult.data ?? [],
        });
        const ids = notifications.map((notification) => notification.id);

        notificationIdsCache.set(cacheKey, { ids, loadedAt: Date.now() });
        setUnreadCount(countUnread(scope, user.id, ids));
        return;
      }

      const access = await checkAdminAccess(supabase, user.id);

      if (!isMounted || !access.allowed) {
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

      if (
        !isMounted ||
        pendingBookings.error ||
        confirmedBookings.error ||
        pendingOrders.error ||
        activeOrders.error ||
        repairJobs.error
      ) {
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
      const notifications = buildAdminNotifications({
        bookings,
        orders: [...ordersById.values()],
        repairJobs: repairJobs.data ?? [],
      });
      const ids = notifications.map((notification) => notification.id);

      notificationIdsCache.set(cacheKey, { ids, loadedAt: Date.now() });
      setUnreadCount(countUnread(scope, user.id, ids));
    }

    void loadCount();

    return () => {
      isMounted = false;
    };
  }, [scope]);

  return (
    <span className="inline-flex items-center gap-2">
      <span className={showLabel ? undefined : "sr-only"}>{label}</span>
      {unreadCount > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold leading-5 text-white">
          {formatBadgeCount(unreadCount)}
        </span>
      ) : null}
    </span>
  );
}
