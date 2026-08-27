import { AdminBookingReceiptPanel } from "@/features/admin/components/admin-booking-receipt-panel";

export default async function AdminBookingReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AdminBookingReceiptPanel bookingId={id} />;
}
