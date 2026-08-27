import { Suspense } from "react";
import { AdminBookingsPanel } from "@/features/admin/components/admin-bookings-panel";

export default function AdminBookingsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto grid min-h-screen w-full max-w-6xl place-items-center px-6 py-8">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดการจองหลังบ้าน...
          </div>
        </main>
      }
    >
      <AdminBookingsPanel />
    </Suspense>
  );
}
