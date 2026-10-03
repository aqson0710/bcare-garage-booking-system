import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { AdminCapacityPanel } from "@/features/admin/components/admin-capacity-panel";

export default function AdminCapacityPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-4 pt-[126px] sm:px-6 lg:px-8">
          <PageSkeleton label="กำลังโหลดช่วงเวลารับจอง..." />
        </main>
      }
    >
      <AdminCapacityPanel />
    </Suspense>
  );
}
