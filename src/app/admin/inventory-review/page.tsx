import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { AdminInventoryReviewPanel } from "@/features/admin/components/admin-inventory-review-panel";

export default function AdminInventoryReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-4 pt-[126px] sm:px-6 lg:px-8">
          <PageSkeleton label="กำลังโหลดข้อมูลสต็อก..." />
        </main>
      }
    >
      <AdminInventoryReviewPanel />
    </Suspense>
  );
}
