import { Suspense } from "react";
import { AdminInventoryReviewPanel } from "@/features/admin/components/admin-inventory-review-panel";

export default function AdminInventoryReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto grid min-h-screen w-full max-w-6xl place-items-center px-6 py-8">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดข้อมูลสต็อก...
          </div>
        </main>
      }
    >
      <AdminInventoryReviewPanel />
    </Suspense>
  );
}
