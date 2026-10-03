import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { AdminProductOrdersPanel } from "@/features/admin/components/admin-product-orders-panel";

export default function AdminProductOrdersPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-4 pt-[126px] sm:px-6 lg:px-8">
          <PageSkeleton label="กำลังโหลดคำสั่งซื้อสินค้า..." />
        </main>
      }
    >
      <AdminProductOrdersPanel />
    </Suspense>
  );
}
