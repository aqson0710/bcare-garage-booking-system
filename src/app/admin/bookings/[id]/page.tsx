import { redirect } from "next/navigation";

// The standalone booking detail page has been replaced by the popup on
// /admin/bookings (see admin-bookings-panel.tsx). This route is kept only
// so old bookmarks/links still land the admin in the right place, now via
// the popup instead of a full page.
export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/admin/bookings?bookingId=${id}`);
}
