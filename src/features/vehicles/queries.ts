import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { VehicleInput } from "./types";

type BCareSupabaseClient = SupabaseClient<Database>;

function normalizeLicensePlate(licensePlate: string) {
  return licensePlate.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeOptionalText(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeRequiredVehicleText(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : "Unspecified";
}

function normalizeYear(value: string) {
  if (!value.trim()) {
    return null;
  }

  return Number(value);
}

export async function getCurrentUserVehicles(
  supabase: BCareSupabaseClient,
  customerId: string,
) {
  return supabase
    .from("vehicles")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
}

export async function updateCurrentUserVehicle(
  supabase: BCareSupabaseClient,
  input: VehicleInput,
) {
  return supabase
    .from("vehicles")
    .update({
      brand: normalizeRequiredVehicleText(input.brand),
      color: normalizeOptionalText(input.color),
      license_plate: normalizeLicensePlate(input.licensePlate),
      model: normalizeRequiredVehicleText(input.model),
      year: normalizeYear(input.year),
    })
    .eq("id", input.id)
    .eq("customer_id", input.customerId)
    .select("*")
    .single();
}
