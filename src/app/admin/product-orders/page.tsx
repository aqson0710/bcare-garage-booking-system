import { Suspense } from "react";
import { AdminProductOrdersPanel } from "@/features/admin/components/admin-product-orders-panel";

export default function AdminProductOrdersPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto grid min-h-screen w-full max-w-6xl place-items-center px-6 py-8">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดคำสั่งซื้อสินค้า...
          </div>
        </main>
      }
    >
      <AdminProductOrdersPanel />
    </Suspense>
  );
}
