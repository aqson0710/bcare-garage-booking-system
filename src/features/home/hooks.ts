"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { getHomepageAppearanceSetting } from "./queries";

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
