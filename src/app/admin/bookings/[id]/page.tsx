import { AdminBookingDetailPanel } from "@/features/admin/components/admin-booking-detail-panel";

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AdminBookingDetailPanel bookingId={id} />;
}
