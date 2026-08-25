import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  Service,
  ServiceCategory,
  ServiceCategoryWithServices,
} from "./types";

type BCareSupabaseClient = SupabaseClient<Database>;

export async function getActiveServiceCategories(
  supabase: BCareSupabaseClient,
) {
  return supabase
    .from("service_categories")
    .select("*")
    .eq("status", "active")
    .order("name", { ascending: true });
}

export async function getActiveServices(supabase: BCareSupabaseClient) {
  return supabase
    .from("services")
    .select("*")
    .eq("status", "active")
    .order("name", { ascending: true });
}

export async function getServicesWithCategories(
  supabase: BCareSupabaseClient,
) {
  const [categoriesResult, servicesResult] = await Promise.all([
    getActiveServiceCategories(supabase),
    getActiveServices(supabase),
  ]);

  if (categoriesResult.error) {
    return {
      data: null,
      error: categoriesResult.error,
    };
  }

  if (servicesResult.error) {
    return {
      data: null,
      error: servicesResult.error,
    };
  }

  const categories = categoriesResult.data as ServiceCategory[];
  const services = servicesResult.data as Service[];

  const data: ServiceCategoryWithServices[] = categories.map((category) => ({
    ...category,
    services: services.filter(
      (service) => service.service_category_id === category.id,
    ),
  }));

  return {
    data,
    error: null,
  };
}

