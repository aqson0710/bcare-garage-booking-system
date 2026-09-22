import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type RepairJob = Database["public"]["Tables"]["repair_jobs"]["Row"];
export type BookingPayment =
  Database["public"]["Tables"]["booking_payments"]["Row"];

export type GuestBookingInput = {
  customerName: string;
  phoneNumber: string;
  vehiclePlate: string;
  preferredDate: string;
  preferredTime: string;
  note: string;
  serviceId: string;
};

export type GuestBookingResult = {
  booking: Booking;
  profile: Profile;
  vehicle: Vehicle;
};

export type AuthenticatedBookingInput = {
  customerId: string;
  vehiclePlate: string;
  preferredDate: string;
  preferredTime: string;
  note: string;
  serviceId: string;
};

export type AuthenticatedBookingResult = {
  booking: Booking;
  vehicle: Vehicle;
  vehicleWasReused: boolean;
};

export type BookingSlotAvailability = {
  activeBookingCount: number;
  availableBookingCount: number;
  bookingDate: string;
  bookingTime: string;
  isOpen: boolean;
  maxBookings: number;
};

export type BookingOperatingStatus = {
  bookingDate: string;
  closedReason: string | null;
  closeTime: string;
  isOpen: boolean;
  isSpecialClosed: boolean;
  note: string | null;
  openTime: string;
  weekday: number;
};

export type MyBookingRepairJob = RepairJob & {
  mechanic: Profile | null;
};

export type MyBooking = Booking & {
  repairJob: MyBookingRepairJob | null;
  service: Service | null;
  vehicle: Vehicle | null;
  latestPayment: BookingPayment | null;
};

export type BookingPaymentSlipInput = {
  bookingId: string;
  file: File;
  paymentMethod: Extract<BookingPayment["payment_method"], "bank_transfer" | "promptpay">;
};
