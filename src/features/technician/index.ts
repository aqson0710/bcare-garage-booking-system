export {
  getTechnicianProfile,
  getTechnicianWorkOrderById,
  getTechnicianWorkOrders,
  reopenTechnicianWorkOrder,
  updateTechnicianProfile,
  updateTechnicianWorkOrder,
} from "./queries";
export type {
  TechnicianProfile,
  TechnicianProfileUpdateInput,
  TechnicianRepairJob,
  TechnicianRepairJobStatus,
  TechnicianSkill,
  TechnicianWorkOrder,
  TechnicianWorkOrderDetailResult,
  TechnicianWorkOrderUpdateInput,
  TechnicianWorkOrdersResult,
} from "./types";
