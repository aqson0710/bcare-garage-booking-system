import { BookingDetailPanel } from "@/features/bookings/components/booking-detail-panel";

export default async function MyBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <BookingDetailPanel bookingId={id} />;
}
