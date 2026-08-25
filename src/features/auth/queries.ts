import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ProfileInput } from "./types";

type BCareSupabaseClient = SupabaseClient<Database>;

export async function getCurrentProfile(
  supabase: BCareSupabaseClient,
  userId: string,
) {
  return supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
}

export async function upsertCurrentProfile(
  supabase: BCareSupabaseClient,
  input: ProfileInput,
) {
  return supabase
    .from("profiles")
    .upsert(
      {
        email: input.email,
        full_name: input.fullName,
        id: input.userId,
        phone_number: input.phoneNumber,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();
}

