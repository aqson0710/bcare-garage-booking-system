import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { AdminBookingsPanel } from "@/features/admin/components/admin-bookings-panel";

export default function AdminBookingsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-4 pt-[126px] sm:px-6 lg:px-8">
          <PageSkeleton label="กำลังโหลดการจองหลังบ้าน..." />
        </main>
      }
    >
      <AdminBookingsPanel />
    </Suspense>
  );
}
