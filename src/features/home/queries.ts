import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { HomepageFooterSettingInput, HomepageSlideInput } from "./types";

type BCareSupabaseClient = SupabaseClient<Database>;

function nullableText(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeSortOrder(value: string) {
  const sortOrder = Number(value);

  return Number.isFinite(sortOrder) ? sortOrder : 0;
}

function toSlidePayload(input: HomepageSlideInput) {
  return {
    description: nullableText(input.description),
    image_url: input.imageUrl.trim(),
    primary_href: input.primaryHref.trim() || "/services",
    primary_label: input.primaryLabel.trim() || "จองบริการ",
    secondary_href: nullableText(input.secondaryHref),
    secondary_label: nullableText(input.secondaryLabel),
    sort_order: normalizeSortOrder(input.sortOrder),
    status: input.status,
    subtitle: nullableText(input.subtitle),
    title: input.title.trim(),
    updated_by: input.updatedBy,
  };
}

function toFooterPayload(input: HomepageFooterSettingInput) {
  return {
    background_color: input.backgroundColor.trim() || "#C81010",
    contact_email: nullableText(input.contactEmail),
    contact_phone: nullableText(input.contactPhone),
    contact_title: input.contactTitle.trim() || "สอบถามข้อมูล",
    office_address: nullableText(input.officeAddress),
    office_fax: nullableText(input.officeFax),
    office_phone: nullableText(input.officePhone),
    office_title: input.officeTitle.trim() || "สำนักงานใหญ่",
    services_content: nullableText(input.servicesContent),
    services_title: input.servicesTitle.trim() || "สินค้าและบริการ",
    setting_key: "default",
    status: input.status,
    updated_by: input.updatedBy,
  };
}

export async function getActiveHomepageSlides(supabase: BCareSupabaseClient) {
  return supabase
    .from("homepage_slides")
    .select("*")
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

export async function getAdminHomepageSlides(supabase: BCareSupabaseClient) {
  return supabase
    .from("homepage_slides")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

export async function getActiveHomepageFooterSetting(
  supabase: BCareSupabaseClient,
) {
  return supabase
    .from("homepage_footer_settings")
    .select("*")
    .eq("setting_key", "default")
    .eq("status", "active")
    .maybeSingle();
}

export async function getAdminHomepageFooterSetting(
  supabase: BCareSupabaseClient,
) {
  return supabase
    .from("homepage_footer_settings")
    .select("*")
    .eq("setting_key", "default")
    .maybeSingle();
}

export async function createHomepageSlide(
  supabase: BCareSupabaseClient,
  input: HomepageSlideInput,
) {
  return supabase
    .from("homepage_slides")
    .insert(toSlidePayload(input))
    .select("*")
    .single();
}

export async function updateHomepageSlide(
  supabase: BCareSupabaseClient,
  id: string,
  input: HomepageSlideInput,
) {
  return supabase
    .from("homepage_slides")
    .update(toSlidePayload(input))
    .eq("id", id)
    .select("*")
    .single();
}

export async function deleteHomepageSlide(
  supabase: BCareSupabaseClient,
  id: string,
) {
  return supabase.from("homepage_slides").delete().eq("id", id);
}

export async function upsertHomepageFooterSetting(
  supabase: BCareSupabaseClient,
  input: HomepageFooterSettingInput,
) {
  return supabase
    .from("homepage_footer_settings")
    .upsert(toFooterPayload(input), { onConflict: "setting_key" })
    .select("*")
    .single();
}
