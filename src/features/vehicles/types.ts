import type { Database } from "@/lib/supabase/database.types";

export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];

export type VehicleInput = {
  brand: string;
  color: string;
  customerId: string;
  id: string;
  licensePlate: string;
  model: string;
  year: string;
};

export type VehicleImageInput = {
  customerId: string;
  id: string;
  imageUrl: string;
};
