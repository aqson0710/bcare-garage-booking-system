"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  getHomepageAppearanceSetting,
  getPublicGarageClosedDates,
  getPublicGarageOperatingDays,
} from "./queries";
import type { PublicGarageOperatingDay } from "./types";

// Shared across every page (nav bar, login/register/forgot/reset-password)
// so the site logo, once set by the admin, shows up everywhere without each
// page needing to fetch homepage_appearance_settings on its own.
export function useSiteLogoUrl() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    getHomepageAppearanceSetting(supabase).then(({ data, error }) => {
      if (!isMounted || error) {
        return;
      }
      setLogoUrl(data?.logo_url ?? null);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return logoUrl;
}

export type ShopOpenStatus = {
  days: PublicGarageOperatingDay[];
  isOpen: boolean | null;
  status: "loading" | "ready" | "error";
  todayHours: PublicGarageOperatingDay | null;
};

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Powers the homepage's "open/closed now" badge and weekly-hours table.
// Loads the shop's operating days + closed dates once, then re-derives
// open/closed every minute (not on every render) so the badge stays live
// without re-fetching from Supabase.
export function useShopOpenStatus(): ShopOpenStatus {
  const [days, setDays] = useState<PublicGarageOperatingDay[]>([]);
  const [closedDateKeys, setClosedDateKeys] = useState<Set<string>>(new Set());
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function load() {
      const [daysResult, closedDatesResult] = await Promise.all([
        getPublicGarageOperatingDays(supabase),
        getPublicGarageClosedDates(supabase),
      ]);

      if (!isMounted) {
        return;
      }

      if (daysResult.error || closedDatesResult.error) {
        setLoadStatus("error");
        return;
      }

      setDays(daysResult.data ?? []);
      setClosedDateKeys(
        new Set(
          (closedDatesResult.data ?? []).map(
            (closedDate) => closedDate.closed_date,
          ),
        ),
      );
      setLoadStatus("ready");
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  // Only starts ticking once mounted on the client, so the very first
  // server-rendered pass and the first client render agree (both show
  // nothing until "now" is known) and React doesn't complain about a
  // hydration mismatch from using `new Date()` directly during render.
  // The initial setNow() call here is intentional, not a candidate for
  // deriving during render - `new Date()` must NOT run during the
  // server-rendered pass, only after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  if (loadStatus !== "ready" || !now) {
    return { days, isOpen: null, status: loadStatus, todayHours: null };
  }

  const todayHours = days.find((day) => day.weekday === now.getDay()) ?? null;
  const isClosedToday = closedDateKeys.has(toLocalDateKey(now));

  let isOpen = false;

  if (todayHours?.is_open && !isClosedToday) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = timeToMinutes(todayHours.open_time);
    const closeMinutes = timeToMinutes(todayHours.close_time);
    isOpen = nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }

  return { days, isOpen, status: "ready", todayHours };
}
