import type { Database } from "@/lib/supabase/database.types";

export type HomepageSlide =
  Database["public"]["Tables"]["homepage_slides"]["Row"];

export type HomepageFooterSetting =
  Database["public"]["Tables"]["homepage_footer_settings"]["Row"];

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
  officePhone: string;
  officeTitle: string;
  servicesContent: string;
  servicesTitle: string;
  status: HomepageFooterSetting["status"];
  updatedBy: string;
};
