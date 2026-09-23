import type { Profile } from "@/features/auth";
import type { Booking, Service, Vehicle } from "@/features/bookings";
import type {
  ProductOrder,
  ProductOrderItemWithProduct,
  ProductPayment,
  PaymentSetting,
} from "@/features/products";
import type { ServiceCategory } from "@/features/services";
import type { Database } from "@/lib/supabase/database.types";

export type AdminAccessResult =
  | { allowed: true; profile: Profile }
  | { allowed: false; profile: Profile | null; reason: string };

export type AdminBookingPayment =
  Database["public"]["Tables"]["booking_payments"]["Row"];

export type AdminBooking = Booking & {
  customer: Profile | null;
  service: Service | null;
  vehicle: Vehicle | null;
  payments: AdminBookingPayment[];
};

export type RepairJob =
  Database["public"]["Tables"]["repair_jobs"]["Row"];

export type GarageCapacity =
  Database["public"]["Tables"]["garage_capacity"]["Row"];

export type GarageClosedDate =
  Database["public"]["Tables"]["garage_closed_dates"]["Row"];

export type GarageOperatingDay =
  Database["public"]["Tables"]["garage_operating_days"]["Row"];

export type TechnicianSkill =
  Database["public"]["Tables"]["technician_skills"]["Row"];

export type TechnicianProfileSkill =
  Database["public"]["Tables"]["technician_profile_skills"]["Row"];

export type Product =
  Database["public"]["Tables"]["products"]["Row"];

export type ProductCategory =
  Database["public"]["Tables"]["product_categories"]["Row"];

export type InventoryMovement =
  Database["public"]["Tables"]["inventory_movements"]["Row"];

export type AdminMechanic = Profile & {
  skills: TechnicianSkill[];
};

export type AdminRepairJob = RepairJob & {
  booking: Booking | null;
  customer: Profile | null;
  mechanic: AdminMechanic | null;
  service: Service | null;
  vehicle: Vehicle | null;
};

export type AdminCustomerBooking = Booking & {
  service: Service | null;
  vehicle: Vehicle | null;
};

export type AdminCustomerSummary = Profile & {
  bookingCount: number;
  latestBooking: Booking | null;
  vehicleCount: number;
};

export type AdminCustomerDetail = Profile & {
  bookings: AdminCustomerBooking[];
  vehicles: Vehicle[];
};

export type AdminCustomerListRoleFilter = "all" | Profile["role"];

export type AdminCustomerListParams = {
  page: number;
  pageSize: number;
  role: AdminCustomerListRoleFilter;
  search: string;
};

export type AdminCustomerListResult = {
  customers: AdminCustomerSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminBookingStatusAction = AdminBooking["status"];

export type AdminService = Service & {
  category: ServiceCategory | null;
};

export type AdminServiceUpdateInput = {
  base_price: number;
  estimated_duration_minutes: number;
  image_url: string | null;
  service_category_id: string;
  status: AdminService["status"];
};

export type AdminServiceCategory = ServiceCategory;

export type AdminServiceCategoryUpdateInput = {
  description: string | null;
  name: string;
  status: AdminServiceCategory["status"];
};

export type AdminServiceCategoryCreateInput = AdminServiceCategoryUpdateInput;

export type AdminProductCategory = ProductCategory;

export type AdminProductCategoryUpdateInput = {
  description: string | null;
  name: string;
  status: AdminProductCategory["status"];
};

export type AdminProductCategoryCreateInput =
  AdminProductCategoryUpdateInput;

export type AdminProduct = Product & {
  category: AdminProductCategory | null;
};

export type AdminProductUpdateInput = {
  cost_price: number;
  description: string | null;
  image_url: string | null;
  name: string;
  product_category_id: string;
  sku: string | null;
  status: AdminProduct["status"];
  unit_price: number;
};

export type AdminProductCreateInput = AdminProductUpdateInput;

export type AdminInventoryMovement = InventoryMovement & {
  createdBy: Profile | null;
  product: Product | null;
};

export type AdminProductOrder = ProductOrder & {
  customer: Profile | null;
  items: ProductOrderItemWithProduct[];
  payments: ProductPayment[];
  returnMovements: AdminInventoryMovement[];
  saleMovements: AdminInventoryMovement[];
};

export type AdminProductOrderItem = ProductOrderItemWithProduct;

export type AdminProductOrderStatusAction = AdminProductOrder["status"];

export type AdminPaymentSetting = PaymentSetting;

export type AdminPaymentSettingUpdateInput = {
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  bank_name: string | null;
  bank_transfer_enabled: boolean;
  payment_instructions: string | null;
  promptpay_display_name: string;
  promptpay_enabled: boolean;
  promptpay_id: string | null;
  promptpay_qr_image_url: string | null;
  status: AdminPaymentSetting["status"];
  updated_by: string | null;
};

export type AdminInventoryMovementCreateInput = {
  movement_type: AdminInventoryMovement["movement_type"];
  note: string | null;
  product_id: string;
  quantity: number;
  reference_id?: string | null;
  reference_type?: string | null;
};

export type AdminGarageCapacity = GarageCapacity & {
  activeBookingCount: number;
  availableBookingCount: number;
  isOpen: boolean;
};

export type AdminGarageCapacityInput = {
  booking_date: string;
  booking_time: string;
  max_bookings: number;
  note: string | null;
  status: AdminGarageCapacity["status"];
};

export type AdminGarageClosedDate = GarageClosedDate;

export type AdminGarageClosedDateInput = {
  closed_date: string;
  reason: string | null;
};

export type AdminGarageOperatingDay = GarageOperatingDay;

export type AdminGarageOperatingDayInput = {
  close_time: string;
  is_open: boolean;
  note: string | null;
  open_time: string;
};

export type AdminGarageOperatingSettings = {
  closedDates: AdminGarageClosedDate[];
  operatingDays: AdminGarageOperatingDay[];
};

export type AdminScheduleSlot = {
  activeBookingCount: number;
  availableBookingCount: number;
  bookingDate: string;
  bookingTime: string;
  hasCapacityRule: boolean;
  isOpen: boolean;
  maxBookings: number;
  status: AdminGarageCapacity["status"];
};

export type AdminScheduleDay = {
  activeBookingCount: number;
  availableBookingCount: number;
  bookingDate: string;
  closedSlotCount: number;
  maxBookings: number;
  slots: AdminScheduleSlot[];
};

export type AdminScheduleOverview = {
  days: AdminScheduleDay[];
  endDate: string;
  startDate: string;
  timeSlots: string[];
};

export type AdminTechnicianSkill = TechnicianSkill;

export type AdminTechnicianSkillUpdateInput = {
  description: string | null;
  name: string;
  status: AdminTechnicianSkill["status"];
};

export type AdminTechnicianSkillCreateInput =
  AdminTechnicianSkillUpdateInput;

export type AdminBookingListStatusFilter = "all" | AdminBooking["status"];

export type AdminBookingStatusCounts = Record<AdminBooking["status"], number>;

// A simplified, admin-facing grouping of AdminProductOrder["status"] for the
// order list filter tabs only - "in_progress" collapses
// confirmed/preparing/ready_for_pickup/out_for_delivery into one tab, since
// admins filter by "is this done yet", not by the exact fulfillment step.
// The order's own `status` column still stores the full granular value; only
// the filter UI and this query param are simplified.
export type AdminProductOrderListStatusFilter =
  | "all"
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export type AdminProductOrderListPaymentFilter =
  | "all"
  | AdminProductOrder["payment_status"];

export type AdminProductOrderStatusCounts = {
  cancelled: number;
  completed: number;
  in_progress: number;
  pending: number;
};

// Partial, not a full Record: getAdminProductOrderPaymentStatusCounts only
// queries unpaid/pending/paid today, but the admin UI's filter buttons
// cover every AdminProductOrder["payment_status"] value (including
// partially_paid/refunded/cancelled, added later for the payment ledger),
// so the type has to allow a status with no count yet - the UI already
// falls back to "-" for a missing key.
export type AdminProductOrderPaymentStatusCounts = Partial<
  Record<AdminProductOrder["payment_status"], number>
>;

export type AdminBookingListParams = {
  page: number;
  pageSize: number;
  search: string;
  status: AdminBookingListStatusFilter;
};

export type AdminBookingListResult = {
  bookings: AdminBooking[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminProductOrderListParams = {
  page: number;
  pageSize: number;
  paymentStatus: AdminProductOrderListPaymentFilter;
  search: string;
  status: AdminProductOrderListStatusFilter;
};

export type AdminProductOrderListResult = {
  orders: AdminProductOrder[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type AdminRepairJobListStatusFilter = "all" | AdminRepairJob["status"];

export type AdminRepairJobListParams = {
  page: number;
  pageSize: number;
  status: AdminRepairJobListStatusFilter;
};

export type AdminRepairJobListResult = {
  page: number;
  pageSize: number;
  repairJobs: AdminRepairJob[];
  totalCount: number;
  totalPages: number;
};

export type AdminRepairJobStatusCounts = Record<
  AdminRepairJob["status"],
  number
>;

export type AdminReportStatusCount = {
  count: number;
  status: Booking["status"];
};

export type AdminReportServiceCount = {
  bookingCount: number;
  service: Service | null;
};

export type AdminReportCustomerCount = {
  bookingCount: number;
  customer: Profile | null;
};

export type AdminReportVehicleCount = {
  bookingCount: number;
  vehicle: Vehicle | null;
};

export type AdminReports = {
  activeCustomerCount: number;
  averageBookingValue: number;
  estimatedRevenue: number;
  statusCounts: AdminReportStatusCount[];
  topCustomers: AdminReportCustomerCount[];
  topServices: AdminReportServiceCount[];
  topVehicles: AdminReportVehicleCount[];
  totalBookingCount: number;
  totalCustomerCount: number;
  totalVehicleCount: number;
};
