import type { Profile } from "@/features/auth";
import type { Booking, Service, Vehicle } from "@/features/bookings";
import type { Database } from "@/lib/supabase/database.types";

export type TechnicianSkill =
  Database["public"]["Tables"]["technician_skills"]["Row"];

export type TechnicianProfile =
  | {
      allowed: true;
      profile: Profile;
      selectedSkillIds: string[];
      skills: TechnicianSkill[];
    }
  | {
      allowed: false;
      profile: Profile | null;
      reason: string;
      selectedSkillIds: string[];
      skills: TechnicianSkill[];
    };

export type TechnicianProfileUpdateInput = {
  fullName: string;
  phoneNumber: string;
  selectedSkillIds: string[];
  technicianSpecialty: string | null;
  userId: string;
};

export type TechnicianRepairJob =
  Database["public"]["Tables"]["repair_jobs"]["Row"];
export type TechnicianRepairJobStatus = TechnicianRepairJob["status"];

export type TechnicianWorkOrder = TechnicianRepairJob & {
  booking: Booking | null;
  customer: Profile | null;
  service: Service | null;
  vehicle: Vehicle | null;
};

export type TechnicianWorkOrdersResult =
  | {
      allowed: true;
      profile: Profile;
      workOrders: TechnicianWorkOrder[];
    }
  | {
      allowed: false;
      profile: Profile | null;
      reason: string;
      workOrders: TechnicianWorkOrder[];
    };

export type TechnicianWorkOrderDetailResult =
  | {
      allowed: true;
      profile: Profile;
      workOrder: TechnicianWorkOrder | null;
    }
  | {
      allowed: false;
      profile: Profile | null;
      reason: string;
      workOrder: null;
    };

export type TechnicianWorkOrderUpdateInput = {
  diagnosis: string | null;
  repairNotes: string | null;
  status: TechnicianRepairJobStatus;
  userId: string;
  workOrderId: string;
};
