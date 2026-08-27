import { CustomerBookingReceiptPanel } from "@/features/bookings/components/customer-booking-receipt-panel";

export default async function MyBookingReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <CustomerBookingReceiptPanel bookingId={id} />;
}
