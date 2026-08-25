import Link from "next/link";
import { AppNav } from "@/components/app-nav";

export const dynamic = "force-dynamic";

type ReadinessItem = {
  description: string;
  isReady: boolean;
  label: string;
};

function hasEnvValue(name: string) {
  return Boolean(process.env[name]?.trim());
}

const requiredEnvItems: ReadinessItem[] = [
  {
    description: "ใช้เรียก Supabase จาก server เพื่ออ่านสลิปและอัปเดตผลตรวจ",
    isReady: hasEnvValue("SUPABASE_SERVICE_ROLE_KEY"),
    label: "SUPABASE_SERVICE_ROLE_KEY",
  },
  {
    description: "รหัสสาขา SlipOK ที่อยู่ท้าย URL ของ API",
    isReady: hasEnvValue("SLIPOK_BRANCH_ID"),
    label: "SLIPOK_BRANCH_ID",
  },
  {
    description: "API key สำหรับ header x-authorization ตอนเรียก SlipOK",
    isReady: hasEnvValue("SLIPOK_API_KEY"),
    label: "SLIPOK_API_KEY",
  },
];

const schemaItems: ReadinessItem[] = [
  {
    description: "ตารางเก็บข้อมูลการชำระเงินและผลตรวจสลิป",
    isReady: true,
    label: "product_payments",
  },
  {
    description: "bucket ส่วนตัวสำหรับเก็บรูปสลิปที่ลูกค้าอัปโหลด",
    isReady: true,
    label: "payment-slips",
  },
  {
    description: "ฟิลด์สำหรับเก็บ response, reference, bank, amount และเวลาตรวจ",
    isReady: true,
    label: "SlipOK-ready payment fields",
  },
  {
    description: "manual approval ยังทำงานเป็น fallback ถ้า SlipOK ล่มหรือตรวจไม่ได้",
    isReady: true,
    label: "Manual fallback flow",
  },
];

function ReadinessCard({ item }: { item: ReadinessItem }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-[var(--foreground)]">{item.label}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {item.description}
          </p>
        </div>
        <span
          className={
            item.isReady
              ? "w-fit rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[var(--brand-strong)]"
              : "w-fit rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
          }
        >
          {item.isReady ? "พร้อม" : "ยังไม่ตั้งค่า"}
        </span>
      </div>
    </div>
  );
}

export default function SlipOkReadinessCheckPage() {
  const envReadyCount = requiredEnvItems.filter((item) => item.isReady).length;
  const isReadyForPart1 = envReadyCount === requiredEnvItems.length;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
            BCare
          </p>
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              SlipOK Readiness Check
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ตรวจความพร้อมก่อนเชื่อม SlipOK อัตโนมัติ หน้านี้แสดงเฉพาะสถานะ
              ไม่แสดงค่า secret จริง
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin/product-orders?payment=pending"
          >
            ไปคิวรอตรวจสลิป
          </Link>
        </div>
      </header>

      <section className="py-6">
        <div
          className={
            isReadyForPart1
              ? "rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm leading-6 text-[var(--brand-strong)]"
              : "rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800"
          }
        >
          <p className="text-lg font-bold">
            {isReadyForPart1
              ? "พร้อมเริ่ม Step 13 Part 1"
              : "ยังต้องตั้งค่า env เพิ่มก่อนเริ่มยิง SlipOK จริง"}
          </p>
          <p className="mt-2">
            Env พร้อม {envReadyCount} จาก {requiredEnvItems.length} รายการ
          </p>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section>
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              Server env ที่ต้องใช้
            </h2>
            <div className="mt-4 space-y-3">
              {requiredEnvItems.map((item) => (
                <ReadinessCard item={item} key={item.label} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[var(--foreground)]">
              โครงสร้างระบบที่พร้อมแล้ว
            </h2>
            <div className="mt-4 space-y-3">
              {schemaItems.map((item) => (
                <ReadinessCard item={item} key={item.label} />
              ))}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)] shadow-sm">
          <p className="font-semibold text-[var(--foreground)]">
            Flow ที่จะทำใน Part ถัดไป
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>ลูกค้าส่งสลิปเหมือนเดิม</li>
            <li>server route อ่านรูปสลิปจาก private bucket</li>
            <li>server route ส่งไฟล์ไป SlipOK พร้อม amount</li>
            <li>ถ้า SlipOK ผ่าน ระบบอัปเดต order เป็นชำระแล้วอัตโนมัติ</li>
            <li>ถ้า SlipOK ไม่ผ่าน ลูกค้าเห็นเหตุผลและส่งสลิปใหม่ได้</li>
            <li>ถ้า SlipOK ล่ม ระบบยังคง fallback ให้ admin ตรวจ manual ได้</li>
          </ol>
        </section>
      </section>
    </main>
  );
}
