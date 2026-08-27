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
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;

      if (!isMounted || !user) {
        return;
      }

      if (scope === "customer") {
        const [bookingsResult, ordersResult] = await Promise.all([
          getCurrentUserBookings(supabase, user.id),
          getCustomerProductOrders(supabase, user.id),
        ]);

        if (!isMounted || bookingsResult.error || ordersResult.error) {
          return;
        }

        const readIds = readStoredNotificationIds(scope, user.id);
        const notifications = buildCustomerNotifications({
          bookings: bookingsResult.data ?? [],
          orders: ordersResult.data ?? [],
        });

        setUnreadCount(
          notifications.filter((notification) => !readIds.has(notification.id))
            .length,
        );
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
      const readIds = readStoredNotificationIds(scope, user.id);
      const notifications = buildAdminNotifications({
        bookings,
        orders: [...ordersById.values()],
        repairJobs: repairJobs.data ?? [],
      });

      setUnreadCount(
        notifications.filter((notification) => !readIds.has(notification.id))
          .length,
      );
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
