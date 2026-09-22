import { Suspense } from "react";
import { AdminCapacityPanel } from "@/features/admin/components/admin-capacity-panel";

export default function AdminCapacityPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto grid min-h-screen w-full max-w-6xl place-items-center px-6 py-8">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดช่วงเวลารับจอง...
          </div>
        </main>
      }
    >
      <AdminCapacityPanel />
    </Suspense>
  );
}
