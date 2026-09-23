import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/features/auth";
import type { Database } from "@/lib/supabase/database.types";
import type {
  TechnicianProfile,
  TechnicianProfileUpdateInput,
  TechnicianRepairJob,
  TechnicianRepairJobStatus,
  TechnicianWorkOrder,
  TechnicianWorkOrderDetailResult,
  TechnicianWorkOrderUpdateInput,
  TechnicianWorkOrdersResult,
} from "./types";

type BCareSupabaseClient = SupabaseClient<Database>;

function getUniqueIds(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

function canTechnicianSetStatus(status: TechnicianRepairJobStatus) {
  return (
    status === "assigned" ||
    status === "in_progress" ||
    status === "completed"
  );
}

function buildTechnicianWorkOrderUpdate(input: TechnicianWorkOrderUpdateInput) {
  const now = new Date().toISOString();

  return {
    completed_at: input.status === "completed" ? now : null,
    diagnosis: input.diagnosis,
    repair_notes: input.repairNotes,
    started_at:
      input.status === "in_progress" || input.status === "completed"
        ? now
        : undefined,
    status: input.status,
  };
}

export async function getTechnicianProfile(
  supabase: BCareSupabaseClient,
  userId: string,
) {
  const [profileResult, skillsResult, selectedSkillsResult] = await Promise.all([
    getCurrentProfile(supabase, userId),
    supabase
      .from("technician_skills")
      .select("*")
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("technician_profile_skills")
      .select("*")
      .eq("technician_id", userId),
  ]);

  if (profileResult.error) {
    return {
      data: null,
      error: profileResult.error,
    };
  }

  if (skillsResult.error) {
    return {
      data: null,
      error: skillsResult.error,
    };
  }

  if (selectedSkillsResult.error) {
    return {
      data: null,
      error: selectedSkillsResult.error,
    };
  }

  const profile = profileResult.data ?? null;
  const skills = skillsResult.data ?? [];
  const selectedSkillIds = (selectedSkillsResult.data ?? []).map(
    (selectedSkill) => selectedSkill.skill_id,
  );

  if (!profile) {
    return {
      data: {
        allowed: false,
        profile: null,
        reason: "Profile is required before technician profile can be used.",
        selectedSkillIds,
        skills,
      } satisfies TechnicianProfile,
      error: null,
    };
  }

  if (profile.role !== "technician") {
    return {
      data: {
        allowed: false,
        profile,
        reason: "This account is not assigned the technician role.",
        selectedSkillIds,
        skills,
      } satisfies TechnicianProfile,
      error: null,
    };
  }

  return {
    data: {
      allowed: true,
      profile,
      selectedSkillIds,
      skills,
    } satisfies TechnicianProfile,
    error: null,
  };
}

export async function updateTechnicianProfile(
  supabase: BCareSupabaseClient,
  input: TechnicianProfileUpdateInput,
) {
  const payload: Database["public"]["Tables"]["profiles"]["Update"] = {
    full_name: input.fullName,
    phone_number: input.phoneNumber,
    technician_specialty: input.technicianSpecialty,
  };

  if (input.avatarUrl !== undefined) {
    payload.avatar_url = input.avatarUrl;
  }

  const profileResult = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", input.userId)
    .select("*")
    .single();

  if (profileResult.error) {
    return {
      data: null,
      error: profileResult.error,
    };
  }

  const deleteResult = await supabase
    .from("technician_profile_skills")
    .delete()
    .eq("technician_id", input.userId);

  if (deleteResult.error) {
    return {
      data: null,
      error: deleteResult.error,
    };
  }

  if (input.selectedSkillIds.length > 0) {
    const insertResult = await supabase.from("technician_profile_skills").insert(
      input.selectedSkillIds.map((skillId) => ({
        skill_id: skillId,
        technician_id: input.userId,
      })),
    );

    if (insertResult.error) {
      return {
        data: null,
        error: insertResult.error,
      };
    }
  }

  return getTechnicianProfile(supabase, input.userId);
}

async function attachTechnicianWorkOrderDetails(
  supabase: BCareSupabaseClient,
  repairJobs: TechnicianRepairJob[],
) {
  const bookingIds = getUniqueIds(
    repairJobs.map((repairJob) => repairJob.booking_id),
  );
  const customerIds = getUniqueIds(
    repairJobs
      .map((repairJob) => repairJob.customer_id)
      .filter((customerId): customerId is string => Boolean(customerId)),
  );
  const vehicleIds = getUniqueIds(
    repairJobs.map((repairJob) => repairJob.vehicle_id),
  );

  const bookingsResult =
    bookingIds.length > 0
      ? await supabase.from("bookings").select("*").in("id", bookingIds)
      : { data: [], error: null };

  if (bookingsResult.error) {
    return {
      data: null,
      error: bookingsResult.error,
    };
  }

  const bookings = bookingsResult.data ?? [];
  const bookingCustomerIds = bookings.map((booking) => booking.customer_id);
  const bookingVehicleIds = bookings.map((booking) => booking.vehicle_id);
  const serviceIds = getUniqueIds(bookings.map((booking) => booking.service_id));
  const allCustomerIds = getUniqueIds([...customerIds, ...bookingCustomerIds]);
  const allVehicleIds = getUniqueIds([...vehicleIds, ...bookingVehicleIds]);

  const [customersResult, servicesResult, vehiclesResult] = await Promise.all([
    allCustomerIds.length > 0
      ? supabase.from("profiles").select("*").in("id", allCustomerIds)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length > 0
      ? supabase.from("services").select("*").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    allVehicleIds.length > 0
      ? supabase.from("vehicles").select("*").in("id", allVehicleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customersResult.error) {
    return {
      data: null,
      error: customersResult.error,
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

  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
  const customersById = new Map(
    (customersResult.data ?? []).map((customer) => [customer.id, customer]),
  );
  const servicesById = new Map(
    (servicesResult.data ?? []).map((service) => [service.id, service]),
  );
  const vehiclesById = new Map(
    (vehiclesResult.data ?? []).map((vehicle) => [vehicle.id, vehicle]),
  );

  return {
    data: repairJobs.map((repairJob) => {
      const booking = bookingsById.get(repairJob.booking_id) ?? null;
      const customerId = repairJob.customer_id ?? booking?.customer_id ?? null;

      return {
        ...repairJob,
        booking,
        customer: customerId ? (customersById.get(customerId) ?? null) : null,
        service: booking ? (servicesById.get(booking.service_id) ?? null) : null,
        vehicle:
          (repairJob.vehicle_id
            ? (vehiclesById.get(repairJob.vehicle_id) ?? null)
            : null) ??
          (booking?.vehicle_id
            ? (vehiclesById.get(booking.vehicle_id) ?? null)
            : null),
      } satisfies TechnicianWorkOrder;
    }),
    error: null,
  };
}

export async function getTechnicianWorkOrders(
  supabase: BCareSupabaseClient,
  userId: string,
) {
  const profileResult = await getCurrentProfile(supabase, userId);

  if (profileResult.error) {
    return {
      data: null,
      error: profileResult.error,
    };
  }

  if (!profileResult.data) {
    return {
      data: {
        allowed: false,
        profile: null,
        reason: "Profile is required before technician work orders can be used.",
        workOrders: [],
      } satisfies TechnicianWorkOrdersResult,
      error: null,
    };
  }

  if (profileResult.data.role !== "technician") {
    return {
      data: {
        allowed: false,
        profile: profileResult.data,
        reason: "This account is not assigned the technician role.",
        workOrders: [],
      } satisfies TechnicianWorkOrdersResult,
      error: null,
    };
  }

  const repairJobsResult = await supabase
    .from("repair_jobs")
    .select("*")
    .eq("mechanic_id", userId)
    .order("updated_at", { ascending: false });

  if (repairJobsResult.error) {
    return {
      data: null,
      error: repairJobsResult.error,
    };
  }

  const detailsResult = await attachTechnicianWorkOrderDetails(
    supabase,
    repairJobsResult.data ?? [],
  );

  if (detailsResult.error) {
    return {
      data: null,
      error: detailsResult.error,
    };
  }

  return {
    data: {
      allowed: true,
      profile: profileResult.data,
      workOrders: detailsResult.data ?? [],
    } satisfies TechnicianWorkOrdersResult,
    error: null,
  };
}

export async function getTechnicianWorkOrderById(
  supabase: BCareSupabaseClient,
  userId: string,
  workOrderId: string,
) {
  const profileResult = await getCurrentProfile(supabase, userId);

  if (profileResult.error) {
    return {
      data: null,
      error: profileResult.error,
    };
  }

  if (!profileResult.data) {
    return {
      data: {
        allowed: false,
        profile: null,
        reason: "Profile is required before technician work orders can be used.",
        workOrder: null,
      } satisfies TechnicianWorkOrderDetailResult,
      error: null,
    };
  }

  if (profileResult.data.role !== "technician") {
    return {
      data: {
        allowed: false,
        profile: profileResult.data,
        reason: "This account is not assigned the technician role.",
        workOrder: null,
      } satisfies TechnicianWorkOrderDetailResult,
      error: null,
    };
  }

  const repairJobResult = await supabase
    .from("repair_jobs")
    .select("*")
    .eq("id", workOrderId)
    .eq("mechanic_id", userId)
    .maybeSingle();

  if (repairJobResult.error) {
    return {
      data: null,
      error: repairJobResult.error,
    };
  }

  if (!repairJobResult.data) {
    return {
      data: {
        allowed: true,
        profile: profileResult.data,
        workOrder: null,
      } satisfies TechnicianWorkOrderDetailResult,
      error: null,
    };
  }

  const detailsResult = await attachTechnicianWorkOrderDetails(supabase, [
    repairJobResult.data,
  ]);

  if (detailsResult.error) {
    return {
      data: null,
      error: detailsResult.error,
    };
  }

  return {
    data: {
      allowed: true,
      profile: profileResult.data,
      workOrder: detailsResult.data?.[0] ?? null,
    } satisfies TechnicianWorkOrderDetailResult,
    error: null,
  };
}

export async function updateTechnicianWorkOrder(
  supabase: BCareSupabaseClient,
  input: TechnicianWorkOrderUpdateInput,
) {
  if (!canTechnicianSetStatus(input.status)) {
    return {
      data: null,
      error: new Error(
        "Technicians can only set assigned, in_progress, or completed.",
      ),
    };
  }

  const currentResult = await supabase
    .from("repair_jobs")
    .select("*")
    .eq("id", input.workOrderId)
    .eq("mechanic_id", input.userId)
    .maybeSingle();

  if (currentResult.error) {
    return {
      data: null,
      error: currentResult.error,
    };
  }

  if (!currentResult.data) {
    return {
      data: null,
      error: new Error("Work order not found for this technician account."),
    };
  }

  if (
    currentResult.data.status === "completed" ||
    currentResult.data.status === "cancelled"
  ) {
    return {
      data: null,
      error: new Error("Closed work orders cannot be updated by technicians."),
    };
  }

  let repairJobData: TechnicianRepairJob;

  if (input.status === "completed") {
    // Closing a work order also snapshots the service price onto the
    // linked booking and flips it into "awaiting_payment", which the
    // technician's own session doesn't otherwise have rights to touch -
    // done atomically via this security-definer RPC rather than a plain
    // .update() here. See supabase/booking-payment-pickup.sql.
    const rpcResult = await supabase.rpc(
      "complete_repair_job_and_request_payment",
      {
        diagnosis_text: input.diagnosis,
        repair_notes_text: input.repairNotes,
        target_work_order_id: input.workOrderId,
      },
    );

    if (rpcResult.error) {
      return {
        data: null,
        error: rpcResult.error,
      };
    }

    repairJobData = rpcResult.data;
  } else {
    const updateInput = buildTechnicianWorkOrderUpdate(input);
    const repairJobResult = await supabase
      .from("repair_jobs")
      .update({
        completed_at: updateInput.completed_at,
        diagnosis: updateInput.diagnosis,
        repair_notes: updateInput.repair_notes,
        started_at:
          currentResult.data.started_at ?? updateInput.started_at ?? null,
        status: updateInput.status,
      })
      .eq("id", input.workOrderId)
      .eq("mechanic_id", input.userId)
      .select("*")
      .single();

    if (repairJobResult.error) {
      return {
        data: null,
        error: repairJobResult.error,
      };
    }

    repairJobData = repairJobResult.data;
  }

  const detailsResult = await attachTechnicianWorkOrderDetails(supabase, [
    repairJobData,
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

export async function reopenTechnicianWorkOrder(
  supabase: BCareSupabaseClient,
  userId: string,
  workOrderId: string,
) {
  const currentResult = await supabase
    .from("repair_jobs")
    .select("*")
    .eq("id", workOrderId)
    .eq("mechanic_id", userId)
    .maybeSingle();

  if (currentResult.error) {
    return {
      data: null,
      error: currentResult.error,
    };
  }

  if (!currentResult.data) {
    return {
      data: null,
      error: new Error("Work order not found for this technician account."),
    };
  }

  if (currentResult.data.status !== "completed") {
    return {
      data: null,
      error: new Error("Only completed work orders can be reopened."),
    };
  }

  // Reopening reverses the payment-request side effect that completing
  // the job set on the linked booking (payment_status back to
  // not_required), which the technician's own session doesn't otherwise
  // have rights to touch - done atomically via this security-definer
  // RPC. It refuses (with a Thai message) once the customer has engaged
  // with payment at all. See supabase/technician-work-order-reopen.sql.
  const rpcResult = await supabase.rpc("reopen_repair_job", {
    target_work_order_id: workOrderId,
  });

  if (rpcResult.error) {
    return {
      data: null,
      error: rpcResult.error,
    };
  }

  const detailsResult = await attachTechnicianWorkOrderDetails(supabase, [
    rpcResult.data,
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
