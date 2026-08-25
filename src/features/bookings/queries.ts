import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  AuthenticatedBookingInput,
  AuthenticatedBookingResult,
  BookingOperatingStatus,
  BookingSlotAvailability,
  GuestBookingInput,
  GuestBookingResult,
  MyBooking,
  MyBookingRepairJob,
} from "./types";

type BCareSupabaseClient = SupabaseClient<Database>;

const bookingStartTime = "09:00";
const bookingEndTime = "18:00";

function getUniqueIds(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeLicensePlate(licensePlate: string) {
  return licensePlate.trim().replace(/\s+/g, " ").toUpperCase();
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function isBookingTimeWithinBusinessHours(time: string) {
  const normalizedTime = time.slice(0, 5);
  const minutes = timeToMinutes(normalizedTime);

  return (
    minutes >= timeToMinutes(bookingStartTime) &&
    minutes <= timeToMinutes(bookingEndTime)
  );
}

function validateBookingTime(time: string) {
  if (!isBookingTimeWithinBusinessHours(time)) {
    return new Error("Bookings can only be created from 09:00 to 18:00.");
  }

  return null;
}

function normalizeTime(time: string) {
  return time.slice(0, 5);
}

export async function getBookingOperatingStatus(
  supabase: BCareSupabaseClient,
  bookingDate: string,
) {
  const result = await supabase.rpc("get_garage_operating_status", {
    target_date: bookingDate,
  });

  if (result.error) {
    return {
      data: null,
      error: result.error,
    };
  }

  const operatingStatus = result.data?.[0];

  if (!operatingStatus) {
    return {
      data: null,
      error: null,
    };
  }

  return {
    data: {
      bookingDate: operatingStatus.booking_date,
      closedReason: operatingStatus.closed_reason,
      closeTime: normalizeTime(operatingStatus.close_time),
      isOpen: operatingStatus.is_open,
      isSpecialClosed: operatingStatus.is_special_closed,
      note: operatingStatus.note,
      openTime: normalizeTime(operatingStatus.open_time),
      weekday: operatingStatus.weekday,
    } satisfies BookingOperatingStatus,
    error: null,
  };
}

export async function getBookingSlotAvailabilities(
  supabase: BCareSupabaseClient,
  bookingDate: string,
  bookingTimes: string[],
) {
  if (bookingTimes.length === 0) {
    return {
      data: [] satisfies BookingSlotAvailability[],
      error: null,
    };
  }

  const availabilityResults = await Promise.all(
    bookingTimes.map((bookingTime) =>
      supabase.rpc("get_garage_slot_availability", {
        target_date: bookingDate,
        target_time: bookingTime,
      }),
    ),
  );

  const failedResult = availabilityResults.find((result) => result.error);

  if (failedResult?.error) {
    return {
      data: null,
      error: failedResult.error,
    };
  }

  return {
    data: availabilityResults.map((result, index) => {
      const availability = result.data?.[0];
      const bookingTime = normalizeTime(
        availability?.booking_time ?? bookingTimes[index],
      );

      return {
        activeBookingCount: availability?.active_booking_count ?? 0,
        availableBookingCount: availability?.available_booking_count ?? 0,
        bookingDate: availability?.booking_date ?? bookingDate,
        bookingTime,
        isOpen: availability?.is_open ?? false,
        maxBookings: availability?.max_bookings ?? 0,
      } satisfies BookingSlotAvailability;
    }),
    error: null,
  };
}

async function attachBookingDetails(
  supabase: BCareSupabaseClient,
  bookings: MyBooking[],
) {
  const bookingIds = getUniqueIds(bookings.map((booking) => booking.id));
  const serviceIds = getUniqueIds(
    bookings.map((booking) => booking.service_id),
  );
  const vehicleIds = getUniqueIds(
    bookings.map((booking) => booking.vehicle_id),
  );

  const [repairJobsResult, servicesResult, vehiclesResult] = await Promise.all([
    bookingIds.length > 0
      ? supabase
          .from("repair_jobs")
          .select("*")
          .in("booking_id", bookingIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length > 0
      ? supabase.from("services").select("*").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    vehicleIds.length > 0
      ? supabase.from("vehicles").select("*").in("id", vehicleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (repairJobsResult.error) {
    return {
      data: null,
      error: repairJobsResult.error,
    };
  }

  if (servicesResult.error) {
    return {
      data: null,
      error: servicesResult.error,
    };
  }

  if (vehiclesResult.error) {
    return {
      data: null,
      error: vehiclesResult.error,
    };
  }

  const repairJobs = repairJobsResult.data ?? [];
  const mechanicIds = getUniqueIds(
    repairJobs
      .map((repairJob) => repairJob.mechanic_id)
      .filter((mechanicId): mechanicId is string => Boolean(mechanicId)),
  );
  const mechanicsResult =
    mechanicIds.length > 0
      ? await supabase.from("profiles").select("*").in("id", mechanicIds)
      : { data: [], error: null };

  if (mechanicsResult.error) {
    return {
      data: null,
      error: mechanicsResult.error,
    };
  }

  const mechanicsById = new Map(
    (mechanicsResult.data ?? []).map((mechanic) => [mechanic.id, mechanic]),
  );
  const repairJobsByBookingId = new Map<string, MyBookingRepairJob>();

  for (const repairJob of repairJobs) {
    if (!repairJobsByBookingId.has(repairJob.booking_id)) {
      repairJobsByBookingId.set(repairJob.booking_id, {
        ...repairJob,
        mechanic: repairJob.mechanic_id
          ? (mechanicsById.get(repairJob.mechanic_id) ?? null)
          : null,
      });
    }
  }

  const servicesById = new Map(
    (servicesResult.data ?? []).map((service) => [service.id, service]),
  );
  const vehiclesById = new Map(
    (vehiclesResult.data ?? []).map((vehicle) => [vehicle.id, vehicle]),
  );

  return {
    data: bookings.map(
      (booking) =>
        ({
          ...booking,
          repairJob: repairJobsByBookingId.get(booking.id) ?? null,
          service: servicesById.get(booking.service_id) ?? null,
          vehicle: vehiclesById.get(booking.vehicle_id) ?? null,
        }) satisfies MyBooking,
    ),
    error: null,
  };
}

export async function getCurrentUserBookings(
  supabase: BCareSupabaseClient,
  customerId: string,
) {
  const bookingsResult = await supabase
    .from("bookings")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (bookingsResult.error) {
    return {
      data: null,
      error: bookingsResult.error,
    };
  }

  return attachBookingDetails(
    supabase,
    (bookingsResult.data ?? []).map((booking) => ({
      ...booking,
      repairJob: null,
      service: null,
      vehicle: null,
    })),
  );
}

export async function getCurrentUserBookingById(
  supabase: BCareSupabaseClient,
  customerId: string,
  bookingId: string,
) {
  const bookingResult = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (bookingResult.error) {
    return {
      data: null,
      error: bookingResult.error,
    };
  }

  if (!bookingResult.data) {
    return {
      data: null,
      error: null,
    };
  }

  const detailsResult = await attachBookingDetails(supabase, [
    {
      ...bookingResult.data,
      repairJob: null,
      service: null,
      vehicle: null,
    },
  ]);

  if (detailsResult.error) {
    return {
      data: null,
      error: detailsResult.error,
    };
  }

  return {
    data: detailsResult.data?.[0] ?? null,
    error: null,
  };
}

export async function cancelCurrentUserBooking(
  supabase: BCareSupabaseClient,
  customerId: string,
  bookingId: string,
) {
  return supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("customer_id", customerId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
}

export async function createGuestBooking(
  supabase: BCareSupabaseClient,
  input: GuestBookingInput,
) {
  const timeError = validateBookingTime(input.preferredTime);

  if (timeError) {
    return {
      data: null,
      error: timeError,
    };
  }

  const profileResult = await supabase
    .from("profiles")
    .insert({
      email: null,
      full_name: input.customerName,
      phone_number: input.phoneNumber,
    })
    .select("*")
    .single();

  if (profileResult.error) {
    return {
      data: null,
      error: profileResult.error,
    };
  }

  const vehicleResult = await supabase
    .from("vehicles")
    .insert({
      brand: "Unspecified",
      color: null,
      customer_id: profileResult.data.id,
      license_plate: input.vehiclePlate,
      model: "Unspecified",
      year: null,
    })
    .select("*")
    .single();

  if (vehicleResult.error) {
    return {
      data: null,
      error: vehicleResult.error,
    };
  }

  const bookingResult = await supabase
    .from("bookings")
    .insert({
      booking_date: input.preferredDate,
      booking_time: input.preferredTime,
      customer_id: profileResult.data.id,
      note: input.note || null,
      service_id: input.serviceId,
      status: "pending",
      vehicle_id: vehicleResult.data.id,
    })
    .select("*")
    .single();

  if (bookingResult.error) {
    return {
      data: null,
      error: bookingResult.error,
    };
  }

  return {
    data: {
      booking: bookingResult.data,
      profile: profileResult.data,
      vehicle: vehicleResult.data,
    } satisfies GuestBookingResult,
    error: null,
  };
}

export async function createAuthenticatedBooking(
  supabase: BCareSupabaseClient,
  input: AuthenticatedBookingInput,
) {
  const timeError = validateBookingTime(input.preferredTime);

  if (timeError) {
    return {
      data: null,
      error: timeError,
    };
  }

  const licensePlate = normalizeLicensePlate(input.vehiclePlate);

  const existingVehicleResult = await supabase
    .from("vehicles")
    .select("*")
    .eq("customer_id", input.customerId)
    .eq("license_plate", licensePlate)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingVehicleResult.error) {
    return {
      data: null,
      error: existingVehicleResult.error,
    };
  }

  let vehicle = existingVehicleResult.data;
  let vehicleWasReused = Boolean(vehicle);

  if (!vehicle) {
    const vehicleResult = await supabase
      .from("vehicles")
      .insert({
        brand: "Unspecified",
        color: null,
        customer_id: input.customerId,
        license_plate: licensePlate,
        model: "Unspecified",
        year: null,
      })
      .select("*")
      .single();

    if (vehicleResult.error) {
      return {
        data: null,
        error: vehicleResult.error,
      };
    }

    vehicle = vehicleResult.data;
    vehicleWasReused = false;
  }

  const bookingResult = await supabase
    .from("bookings")
    .insert({
      booking_date: input.preferredDate,
      booking_time: input.preferredTime,
      customer_id: input.customerId,
      note: input.note || null,
      service_id: input.serviceId,
      status: "pending",
      vehicle_id: vehicle.id,
    })
    .select("*")
    .single();

  if (bookingResult.error) {
    return {
      data: null,
      error: bookingResult.error,
    };
  }

  return {
    data: {
      booking: bookingResult.data,
      vehicle,
      vehicleWasReused,
    } satisfies AuthenticatedBookingResult,
    error: null,
  };
}
