import type { Database } from "@/lib/supabase/database.types";

export type ServiceCategory =
  Database["public"]["Tables"]["service_categories"]["Row"];

export type Service = Database["public"]["Tables"]["services"]["Row"];

export type ServiceCategoryWithServices = ServiceCategory & {
  services: Service[];
};

