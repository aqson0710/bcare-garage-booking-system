"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentProfile } from "@/features/auth";
import type { ProfileRole } from "@/features/auth";
import { NotificationNavBadge } from "@/features/notifications/components/notification-nav-badge";
import { createClient } from "@/lib/supabase/browser";

type NavLink = {
  href: string;
  label: ReactNode;
};

type NavGroup = {
  label: string;
  links: NavLink[];
  variant?: "primary" | "secondary";
};

type ViewerState = {
  isLoading: boolean;
  isSignedIn: boolean;
  role: ProfileRole | null;
};

const publicGroup: NavGroup = {
  label: "สำหรับลูกค้า",
  links: [
    { href: "/", label: "บริการ" },
    { href: "/products", label: "สินค้า" },
    { href: "/cart", label: "ตะกร้า" },
  ],
};

const customerGroup: NavGroup = {
  label: "ลูกค้า",
  links: [
    { href: "/", label: "บริการ" },
    { href: "/products", label: "สินค้า" },
    { href: "/cart", label: "ตะกร้า" },
    { href: "/checkout", label: "ชำระเงิน" },
    { href: "/my-product-orders", label: "คำสั่งซื้อ" },
    { href: "/my-bookings", label: "การจอง" },
    { href: "/my-vehicles", label: "รถของฉัน" },
    { href: "/profile", label: "บัญชี" },
  ],
};

const technicianGroup: NavGroup = {
  label: "ช่าง",
  links: [
    { href: "/technician/work-orders", label: "งานซ่อมของฉัน" },
    { href: "/technician/profile", label: "โปรไฟล์ช่าง" },
  ],
};

const adminGroup: NavGroup = {
  label: "ผู้ดูแลระบบ",
  links: [
    { href: "/admin", label: "แดชบอร์ด" },
    { href: "/admin/bookings", label: "การจอง" },
    { href: "/admin/repair-jobs", label: "งานซ่อม" },
    { href: "/admin/product-orders", label: "ออเดอร์สินค้า" },
    { href: "/admin/payment-settings", label: "ตั้งค่าชำระเงิน" },
    { href: "/admin/products", label: "สินค้า" },
    { href: "/admin/inventory", label: "คลังสินค้า" },
    { href: "/admin/services", label: "บริการ" },
    { href: "/admin/customers", label: "ลูกค้า" },
    { href: "/admin/reports", label: "รายงาน" },
  ],
};

const adminSetupGroup: NavGroup = {
  label: "ตั้งค่าระบบ",
  links: [
    { href: "/admin/schedule", label: "ตารางคิว" },
    { href: "/admin/operating-days", label: "วันเปิดร้าน" },
    { href: "/admin/capacity", label: "คิวรับงาน" },
    { href: "/admin/product-categories", label: "หมวดสินค้า" },
    { href: "/admin/inventory-review", label: "ตรวจสต็อก" },
    { href: "/admin/service-categories", label: "หมวดบริการ" },
    { href: "/admin/technician-skills", label: "ทักษะช่าง" },
  ],
  variant: "secondary",
};

function getVisibleGroups(viewer: ViewerState): NavGroup[] {
  if (viewer.isLoading) {
    return [
      {
        label: "เมนู",
        links: [{ href: "/", label: "กำลังโหลดเมนู..." }],
      },
    ];
  }

  if (!viewer.isSignedIn) {
    return [publicGroup];
  }

  if (viewer.role === "admin") {
    return [adminGroup, adminSetupGroup];
  }

  if (viewer.role === "technician") {
    return [technicianGroup];
  }

  return [customerGroup];
}

function isActiveLink(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getNotificationShortcut(viewer: ViewerState) {
  if (!viewer.isSignedIn) {
    return null;
  }

  if (viewer.role === "admin") {
    return {
      href: "/admin/notifications",
      scope: "admin" as const,
    };
  }

  if (viewer.role === "customer") {
    return {
      href: "/notifications",
      scope: "customer" as const,
    };
  }

  return null;
}

function getViewerLabel(viewer: ViewerState) {
  if (viewer.isLoading) {
    return "กำลังตรวจสอบบัญชี";
  }

  if (!viewer.isSignedIn) {
    return "ผู้เยี่ยมชม";
  }

  if (viewer.role === "admin") {
    return "Admin";
  }

  if (viewer.role === "technician") {
    return "ช่าง";
  }

  return "ลูกค้า";
}

function getLinkClassName(isActive: boolean) {
  return isActive
    ? "inline-flex min-h-11 shrink-0 items-center border-b-2 border-[var(--brand)] px-3 py-2 text-sm font-bold text-[var(--foreground)]"
    : "inline-flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--foreground)]";
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [viewer, setViewer] = useState<ViewerState>({
    isLoading: true,
    isSignedIn: false,
    role: null,
  });
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadViewer() {
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;

      if (!isMounted) {
        return;
      }

      if (!user) {
        setViewer({ isLoading: false, isSignedIn: false, role: null });
        return;
      }

      const profileResult = await getCurrentProfile(supabase, user.id);

      if (!isMounted) {
        return;
      }

      setViewer({
        isLoading: false,
        isSignedIn: true,
        role: profileResult.data?.role ?? "customer",
      });
    }

    void loadViewer();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadViewer();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const groups = useMemo(() => getVisibleGroups(viewer), [viewer]);
  const notificationShortcut = getNotificationShortcut(viewer);
  const viewerLabel = getViewerLabel(viewer);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (!error) {
      setViewer({ isLoading: false, isSignedIn: false, role: null });
      router.push("/auth");
      router.refresh();
    }

    setIsSigningOut(false);
  }

  return (
    <nav
      aria-label="เมนูหลัก"
      className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-w-0 overflow-hidden bg-[var(--brand)]"
    >
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--brand)] px-6 py-3 text-[var(--foreground)]">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex min-h-9 items-center text-2xl font-black tracking-tight text-[var(--foreground)]"
              href="/"
            >
              BCare
            </Link>
            <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--foreground)]/15 bg-white/55 px-3 text-xs font-bold text-[var(--foreground)]">
              {viewerLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {notificationShortcut ? (
              <Link
                aria-label="เปิดการแจ้งเตือน"
                className={
                  isActiveLink(pathname, notificationShortcut.href)
                    ? "inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[var(--foreground)]/20 bg-white px-3 text-sm font-semibold text-[var(--foreground)] shadow-[inset_0_-3px_0_var(--brand)]"
                    : "inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[var(--foreground)]/20 bg-white/55 px-3 text-sm font-semibold text-[var(--foreground)] hover:bg-white/80"
                }
                href={notificationShortcut.href}
                title="การแจ้งเตือน"
              >
                <BellIcon />
                <NotificationNavBadge
                  label="การแจ้งเตือน"
                  scope={notificationShortcut.scope}
                  showLabel={false}
                />
              </Link>
            ) : null}

            {viewer.isLoading ? (
              <button
                className="inline-flex min-h-10 items-center rounded-full border border-[var(--foreground)]/20 bg-white/55 px-3 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-70"
                disabled
                type="button"
              >
                กำลังตรวจสอบบัญชี...
              </button>
            ) : viewer.isSignedIn ? (
              <button
                className="inline-flex min-h-10 items-center rounded-full border border-[var(--foreground)]/20 bg-white/55 px-4 text-sm font-bold text-[var(--foreground)] hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSigningOut}
                onClick={handleSignOut}
                type="button"
              >
                {isSigningOut ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
              </button>
            ) : (
              <Link
                className={
                  isActiveLink(pathname, "/auth")
                    ? "inline-flex min-h-10 items-center rounded-full border border-[var(--foreground)]/20 bg-white px-4 text-sm font-bold text-[var(--foreground)] shadow-[inset_0_-3px_0_var(--brand)]"
                    : "inline-flex min-h-10 items-center rounded-full border border-[var(--foreground)]/20 bg-white/55 px-4 text-sm font-bold text-[var(--foreground)] hover:bg-white/80"
                }
                href="/auth"
              >
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col border-b border-[var(--line)] bg-white sm:items-center">
      {groups.map((group) => {
        const hasActiveLink = group.links.some((link) =>
          isActiveLink(pathname, link.href),
        );

        if (group.variant === "secondary") {
          return (
            <details
              className="group w-full border-t border-[var(--line)] sm:max-w-6xl"
              key={group.label}
              open={hasActiveLink}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-3 px-4 text-sm font-bold text-[var(--foreground)] hover:text-[var(--brand-strong)] [&::-webkit-details-marker]:hidden">
                <span>{group.label}</span>
                <span className="transition-transform group-open:rotate-180">
                  <ChevronIcon />
                </span>
              </summary>
              <div className="flex gap-2 overflow-x-auto border-t border-[var(--line)] px-4">
                {group.links.map((link) => {
                  const isActive = isActiveLink(pathname, link.href);

                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={getLinkClassName(isActive)}
                      href={link.href}
                      key={link.href}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </details>
          );
        }

        return (
          <div className="w-full sm:max-w-6xl" key={group.label}>
            <p className="sr-only">{group.label}</p>
            <div className="flex gap-2 overflow-x-auto px-4">
              {group.links.map((link) => {
                const isActive = isActiveLink(pathname, link.href);

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={getLinkClassName(isActive)}
                    href={link.href}
                    key={link.href}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
        </div>
      </div>
    </nav>
  );
}
