import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { AdminInventoryPanel } from "@/features/admin/components/admin-inventory-panel";

export default function AdminInventoryPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-4 pt-[126px] sm:px-6 lg:px-8">
          <PageSkeleton label="กำลังโหลดคลังสินค้า..." />
        </main>
      }
    >
      <AdminInventoryPanel />
    </Suspense>
  );
}
