import { Suspense } from "react";
import { AdminInventoryPanel } from "@/features/admin/components/admin-inventory-panel";

export default function AdminInventoryPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto grid min-h-screen w-full max-w-6xl place-items-center px-6 py-8">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดคลังสินค้า...
          </div>
        </main>
      }
    >
      <AdminInventoryPanel />
    </Suspense>
  );
}
