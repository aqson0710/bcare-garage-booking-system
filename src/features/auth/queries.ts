import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Profile, ProfileInput } from "./types";

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
  const payload: Database["public"]["Tables"]["profiles"]["Insert"] = {
    email: input.email,
    full_name: input.fullName,
    id: input.userId,
    phone_number: input.phoneNumber,
  };

  if (input.avatarUrl !== undefined) {
    payload.avatar_url = input.avatarUrl;
  }

  return supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
}

// A customer account counts as "set up" once it has a name and a phone
// number. Accounts created through the register form have no profile row
// yet (or an empty one), so they are sent to /profile to fill these in
// before using the rest of the site. Staff accounts are never forced.
export function needsProfileSetup(
  profile: Pick<Profile, "full_name" | "phone_number" | "role"> | null | undefined,
) {
  if (!profile) {
    return true;
  }

  if (profile.role !== "customer") {
    return false;
  }

  return !profile.full_name?.trim() || !profile.phone_number?.trim();
}
