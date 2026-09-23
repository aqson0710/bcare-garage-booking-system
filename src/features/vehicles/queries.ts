import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { VehicleImageInput, VehicleInput } from "./types";

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

export async function deleteCurrentUserVehicle(
  supabase: BCareSupabaseClient,
  input: { customerId: string; id: string },
) {
  // Guard in the app too, not just in the vehicle-delete-policy.sql RLS
  // policy. bookings.vehicle_id and repair_jobs.vehicle_id are both
  // ON DELETE SET NULL (see vehicle-delete-fk-fix.sql), so deleting a
  // vehicle never destroys booking/repair-job history - it just clears
  // the vehicle link on those rows. A vehicle can be deleted once it has
  // no bookings left, or every booking on it is either cancelled or has
  // finished (booking marked completed, or its repair job is done).
  const bookingsResult = await supabase
    .from("bookings")
    .select("id, status")
    .eq("vehicle_id", input.id);

  if (bookingsResult.error) {
    return {
      data: null,
      error: bookingsResult.error,
    };
  }

  const bookings = bookingsResult.data ?? [];
  const unresolvedBookings = bookings.filter(
    (booking) => booking.status !== "cancelled" && booking.status !== "completed",
  );

  if (unresolvedBookings.length > 0) {
    const bookingIds = unresolvedBookings.map((booking) => booking.id);

    const repairJobsResult = await supabase
      .from("repair_jobs")
      .select("booking_id, status")
      .in("booking_id", bookingIds);

    if (repairJobsResult.error) {
      return {
        data: null,
        error: repairJobsResult.error,
      };
    }

    const completedBookingIds = new Set(
      (repairJobsResult.data ?? [])
        .filter((repairJob) => repairJob.status === "completed")
        .map((repairJob) => repairJob.booking_id),
    );

    const stillBlocking = unresolvedBookings.some(
      (booking) => !completedBookingIds.has(booking.id),
    );

    if (stillBlocking) {
      return {
        data: null,
        error: new Error(
          "ลบรถคันนี้ไม่ได้ เพราะยังมีการจองที่ยังไม่เสร็จสิ้นอยู่ ต้องยกเลิกการจองหรือรอให้ซ่อมเสร็จก่อน",
        ),
      };
    }
  }

  const deleteResult = await supabase
    .from("vehicles")
    .delete()
    .eq("id", input.id)
    .eq("customer_id", input.customerId)
    .select("id");

  if (deleteResult.error) {
    return {
      data: null,
      error: deleteResult.error,
    };
  }

  if (!deleteResult.data || deleteResult.data.length === 0) {
    return {
      data: null,
      error: new Error("ไม่พบรถคันนี้ หรือไม่มีสิทธิ์ลบ"),
    };
  }

  return {
    data: deleteResult.data[0],
    error: null,
  };
}

export async function updateCurrentUserVehicleImage(
  supabase: BCareSupabaseClient,
  input: VehicleImageInput,
) {
  return supabase
    .from("vehicles")
    .update({
      image_url: input.imageUrl,
    })
    .eq("id", input.id)
    .eq("customer_id", input.customerId)
    .select("*")
    .single();
}
