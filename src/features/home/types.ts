import type { Database } from "@/lib/supabase/database.types";

export type HomepageSlide =
  Database["public"]["Tables"]["homepage_slides"]["Row"];

export type HomepageFooterSetting =
  Database["public"]["Tables"]["homepage_footer_settings"]["Row"];

export type HomepageAppearanceSetting =
  Database["public"]["Tables"]["homepage_appearance_settings"]["Row"];

// Public (anon-readable) shop hours, used by the homepage's "open/closed
// now" badge and hours table - see homepage-operating-hours-public-read.sql.
export type PublicGarageOperatingDay =
  Database["public"]["Tables"]["garage_operating_days"]["Row"];
export type PublicGarageClosedDate =
  Database["public"]["Tables"]["garage_closed_dates"]["Row"];

// Aggregate-only counts (never individual rows) behind the homepage's
// count-up stat cards - see homepage-public-stats.sql.
export type HomepageStats = {
  completedRepairJobsCount: number;
  technicianTeamCount: number;
  trustedCustomersCount: number;
};

export type HomepageSlideInput = {
  description: string;
  imageUrl: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  sortOrder: string;
  status: HomepageSlide["status"];
  subtitle: string;
  title: string;
  updatedBy: string;
};

export type HomepageFooterSettingInput = {
  backgroundColor: string;
  contactEmail: string;
  contactPhone: string;
  contactTitle: string;
  officeAddress: string;
  officeFax: string;
  // Optional exact map pin (see homepage-office-coordinates.sql) - empty
  // string means "not set", the homepage then falls back to geocoding
  // officeAddress instead.
  officeLatitude: string;
  officeLongitude: string;
  officePhone: string;
  officeTitle: string;
  servicesContent: string;
  servicesTitle: string;
  status: HomepageFooterSetting["status"];
  updatedBy: string;
};

export type HomepageAppearanceSettingInput = {
  backgroundColor: string;
  backgroundImageUrl: string;
  updatedBy: string;
};

export type HomepageLogoSettingInput = {
  logoUrl: string;
  updatedBy: string;
};
