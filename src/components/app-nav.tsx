import Link from "next/link";

const navGroups = [
  {
    label: "ลูกค้า",
    links: [
      { href: "/", label: "บริการ" },
      { href: "/products", label: "สินค้า" },
      { href: "/cart", label: "ตะกร้า" },
      { href: "/checkout", label: "Checkout" },
      { href: "/my-product-orders", label: "คำสั่งซื้อสินค้า" },
      { href: "/my-bookings", label: "การจองของฉัน" },
      { href: "/my-vehicles", label: "รถของฉัน" },
      { href: "/auth", label: "บัญชี" },
    ],
  },
  {
    label: "ช่าง",
    links: [
      { href: "/technician/profile", label: "โปรไฟล์" },
      { href: "/technician/work-orders", label: "งานซ่อมของฉัน" },
    ],
  },
  {
    label: "ผู้ดูแล",
    links: [
      { href: "/admin", label: "แดชบอร์ด" },
      { href: "/admin/bookings", label: "การจอง" },
      { href: "/admin/repair-jobs", label: "งานซ่อม" },
      { href: "/admin/schedule", label: "ตารางคิว" },
      { href: "/admin/operating-days", label: "วันเปิดร้าน" },
      { href: "/admin/capacity", label: "คิวรับงาน" },
      { href: "/admin/customers", label: "ลูกค้า" },
      { href: "/admin/reports", label: "รายงาน" },
      { href: "/admin/product-orders", label: "ออเดอร์สินค้า" },
      { href: "/admin/payment-settings", label: "ตั้งค่าชำระเงิน" },
      { href: "/admin/products", label: "สินค้า" },
      { href: "/admin/product-categories", label: "หมวดสินค้า" },
      { href: "/admin/inventory", label: "คลังสินค้า" },
      { href: "/admin/inventory-review", label: "ตรวจสต็อก" },
      { href: "/admin/services", label: "บริการ" },
      { href: "/admin/service-categories", label: "หมวดหมู่" },
      { href: "/admin/technician-skills", label: "ทักษะช่าง" },
    ],
  },
];

export function AppNav() {
  return (
    <nav aria-label="เมนูหลัก" className="grid gap-3">
      {navGroups.map((group) => (
        <div className="grid gap-1.5" key={group.label}>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.links.map((link) => (
              <Link
                className="min-h-9 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand-strong)]"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
