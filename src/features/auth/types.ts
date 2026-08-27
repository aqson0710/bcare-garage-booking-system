import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileRole = Profile["role"];

export type ProfileInput = {
  avatarUrl?: string | null;
  email: string | null;
  fullName: string;
  phoneNumber: string;
  userId: string;
};
