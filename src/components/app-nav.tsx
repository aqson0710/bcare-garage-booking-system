"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getCurrentProfile } from "@/features/auth";
import type { ProfileRole } from "@/features/auth";
import { useSiteLogoUrl } from "@/features/home";
import { NotificationNavBadge } from "@/features/notifications/components/notification-nav-badge";
import { createClient } from "@/lib/supabase/browser";

type NavLink = {
  href: string;
  label: ReactNode;
  activeHrefs?: string[];
};

type NavGroup = {
  label: string;
  links: NavLink[];
  variant?: "primary" | "secondary";
  showWhenActiveOnly?: boolean;
};

// Admin and technician: a topic heading ("what does this feature belong
// to") that expands to the pages inside it, shown in the left slide-in
// drawer instead of the top nav bar the customer/visitor roles still use.
type NavCategory = {
  label: string;
  links: NavLink[];
};

type ViewerState = {
  isLoading: boolean;
  isSignedIn: boolean;
  role: ProfileRole | null;
};

const publicGroup: NavGroup = {
  label: "สำหรับลูกค้า",
  links: [
    { href: "/", label: "หน้าแรก" },
    { href: "/services", label: "บริการ" },
    { href: "/products", label: "สินค้า" },
  ],
};

const customerAccountHrefs = [
  "/my-product-orders",
  "/my-bookings",
  "/my-vehicles",
  "/profile",
];

const customerGroup: NavGroup = {
  label: "ลูกค้า",
  links: [
    { href: "/", label: "หน้าแรก" },
    { href: "/services", label: "บริการ" },
    { href: "/products", label: "สินค้า" },
    {
      href: "/profile",
      label: "บัญชีของฉัน",
      activeHrefs: customerAccountHrefs,
    },
  ],
};

const customerActivityGroup: NavGroup = {
  label: "บัญชีของฉัน",
  links: [
    { href: "/my-product-orders", label: "คำสั่งซื้อ" },
    { href: "/my-bookings", label: "การจอง" },
    { href: "/my-vehicles", label: "รถของฉัน" },
    { href: "/profile", label: "บัญชี" },
  ],
  variant: "secondary",
  showWhenActiveOnly: true,
};

const technicianGroup: NavGroup = {
  label: "ช่าง",
  links: [
    { href: "/technician", label: "หน้าแรก" },
    { href: "/technician/work-orders", label: "งานซ่อมของฉัน" },
    { href: "/technician/profile", label: "โปรไฟล์ช่าง" },
  ],
};

// Every admin page, grouped by what it's for rather than left as one long
// flat list - each heading opens to show only the pages inside it.
const adminCategories: NavCategory[] = [
  {
    label: "ภาพรวม",
    links: [
      { href: "/admin", label: "แดชบอร์ด" },
      { href: "/admin/reports", label: "รายงาน" },
      { href: "/admin/homepage", label: "หน้าแรกเว็บไซต์" },
      { href: "/admin/customers", label: "ลูกค้า" },
    ],
  },
  {
    label: "งานซ่อมและบริการ",
    links: [
      { href: "/admin/bookings", label: "การจอง" },
      { href: "/admin/repair-jobs", label: "งานซ่อม" },
      { href: "/admin/schedule", label: "ตารางคิว" },
      { href: "/admin/capacity", label: "คิวรับงาน" },
      { href: "/admin/operating-days", label: "วันเปิดร้าน" },
      { href: "/admin/services", label: "บริการ" },
      { href: "/admin/service-categories", label: "หมวดบริการ" },
      { href: "/admin/technician-skills", label: "ทักษะช่าง" },
    ],
  },
  {
    label: "สินค้า ออเดอร์ และการชำระเงิน",
    links: [
      { href: "/admin/product-orders", label: "ออเดอร์สินค้า" },
      { href: "/admin/products", label: "สินค้า" },
      { href: "/admin/product-categories", label: "หมวดสินค้า" },
      { href: "/admin/inventory", label: "คลังสินค้า" },
      { href: "/admin/inventory-review", label: "ตรวจสต็อก" },
      { href: "/admin/payment-settings", label: "ตั้งค่าชำระเงิน" },
    ],
  },
];

const allAdminLinks: NavLink[] = adminCategories.flatMap(
  (category) => category.links,
);

// Technician gets the same left slide-in drawer as admin, just with its own
// (much shorter) set of categories built from the technician nav links.
const technicianCategories: NavCategory[] = [
  {
    label: "ช่าง",
    links: technicianGroup.links,
  },
];

const allTechnicianLinks: NavLink[] = technicianCategories.flatMap(
  (category) => category.links,
);

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
    // Admin doesn't use this top-bar group list at all - it gets the left
    // slide-in drawer built from adminCategories instead (see AppNav below).
    return [];
  }

  if (viewer.role === "technician") {
    // Technician also uses the left slide-in drawer (built from
    // technicianCategories) instead of this top-bar group list.
    return [];
  }

  return [customerGroup, customerActivityGroup];
}

function isActiveLink(pathname: string, href: string) {
  if (href === "/" || href === "/admin" || href === "/technician") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavLinkActive(pathname: string, link: NavLink) {
  return [link.href, ...(link.activeHrefs ?? [])].some((href) =>
    isActiveLink(pathname, href),
  );
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

function shouldShowCartShortcut(viewer: ViewerState) {
  return (
    !viewer.isLoading &&
    viewer.role !== "admin" &&
    viewer.role !== "technician"
  );
}

function getProfileShortcut(viewer: ViewerState) {
  if (!viewer.isSignedIn || viewer.role !== "customer") {
    return null;
  }

  return {
    href: "/profile",
    label: "บัญชีของฉัน",
    activeHrefs: customerAccountHrefs,
  };
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
    ? "inline-flex min-h-10 shrink-0 items-center rounded-full bg-[var(--brand)] px-4 text-sm font-bold text-white shadow-sm"
    : "inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-emerald-400";
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

function CartIcon() {
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
      <path d="M6 6h15l-1.5 8.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.6L5 3H2" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

function ProfileIcon() {
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
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
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

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [expandedDrawerCategory, setExpandedDrawerCategory] = useState<
    string | null
  >(null);
  const navRef = useRef<HTMLElement>(null);
  const [navHeight, setNavHeight] = useState(0);
  const logoUrl = useSiteLogoUrl();

  // The bar below is `fixed` so it never scrolls away, which takes it out of
  // normal document flow. This spacer (rendered right after it) is kept the
  // same height as the real bar at all times, so every page's layout keeps
  // reserving exactly the right amount of space for it - no page-by-page
  // padding needed, and it keeps working as the bar's own height changes
  // (drawer row, loading state, responsive wrapping, etc.).
  useLayoutEffect(() => {
    const node = navRef.current;

    if (!node) {
      return;
    }

    function updateHeight() {
      if (node) {
        setNavHeight(node.getBoundingClientRect().height);
      }
    }

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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

  useEffect(() => {
    setIsDrawerOpen(false);

    const categories =
      viewer.role === "admin"
        ? adminCategories
        : viewer.role === "technician"
          ? technicianCategories
          : [];

    const activeCategory = categories.find((category) =>
      category.links.some((link) => isNavLinkActive(pathname, link)),
    );
    setExpandedDrawerCategory(activeCategory?.label ?? null);
  }, [pathname, viewer.role]);

  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  const groups = useMemo(() => getVisibleGroups(viewer), [viewer]);
  const isAdminViewer = viewer.role === "admin" && !viewer.isLoading;
  const isTechnicianViewer =
    viewer.role === "technician" && !viewer.isLoading;
  const isDrawerViewer = isAdminViewer || isTechnicianViewer;
  const drawerCategories = isAdminViewer
    ? adminCategories
    : isTechnicianViewer
      ? technicianCategories
      : [];
  const allDrawerLinks = isAdminViewer
    ? allAdminLinks
    : isTechnicianViewer
      ? allTechnicianLinks
      : [];
  const currentDrawerLink = allDrawerLinks.find((link) =>
    isNavLinkActive(pathname, link),
  );
  const drawerTitle = isAdminViewer ? "เมนูผู้ดูแลระบบ" : "เมนูช่าง";
  const drawerDefaultLabel = isAdminViewer ? "แดชบอร์ด" : "หน้าแรก";
  const notificationShortcut = getNotificationShortcut(viewer);
  const profileShortcut = getProfileShortcut(viewer);
  const showCartShortcut = shouldShowCartShortcut(viewer);
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
    <>
      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 top-0 z-40 overflow-hidden border-b border-[var(--line)] bg-[var(--surface)] shadow-sm"
        ref={navRef}
      >
      <div className="flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] px-6 py-3 text-[var(--foreground)]">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex min-h-9 items-center gap-2 text-2xl font-black tracking-tight text-[var(--foreground)]"
              href="/"
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="BCare"
                  className="h-10 w-auto max-w-[9rem] object-contain"
                  src={logoUrl}
                />
              ) : null}
              BCare
            </Link>
            <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--line)] bg-[var(--accent-soft)] px-3 text-xs font-bold text-emerald-400">
              {viewerLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {profileShortcut ? (
              <Link
                aria-label="เปิดบัญชีของฉัน"
                className={
                  isNavLinkActive(pathname, profileShortcut)
                    ? "inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[var(--brand-strong)] bg-[var(--accent-soft)] px-3 text-sm font-semibold text-[var(--foreground)] shadow-[inset_0_-3px_0_var(--brand)]"
                    : "inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
                }
                href={profileShortcut.href}
                title="บัญชีของฉัน"
              >
                <ProfileIcon />
              </Link>
            ) : null}

            {showCartShortcut ? (
              <Link
                aria-label="เปิดตะกร้าสินค้า"
                className={
                  isActiveLink(pathname, "/cart") ||
                  isActiveLink(pathname, "/checkout")
                    ? "inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[var(--brand-strong)] bg-[var(--accent-soft)] px-3 text-sm font-semibold text-[var(--foreground)] shadow-[inset_0_-3px_0_var(--brand)]"
                    : "inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
                }
                href="/cart"
                title="ตะกร้าสินค้า"
              >
                <CartIcon />
              </Link>
            ) : null}

            {notificationShortcut ? (
              <Link
                aria-label="เปิดการแจ้งเตือน"
                className={
                  isActiveLink(pathname, notificationShortcut.href)
                    ? "inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[var(--brand-strong)] bg-[var(--accent-soft)] px-3 text-sm font-semibold text-[var(--foreground)] shadow-[inset_0_-3px_0_var(--brand)]"
                    : "inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
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
                className="inline-flex min-h-10 items-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-70"
                disabled
                type="button"
              >
                กำลังตรวจสอบบัญชี...
              </button>
            ) : viewer.isSignedIn ? (
              <button
                className="inline-flex min-h-10 items-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 text-sm font-bold text-[var(--foreground)] hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
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
                    ? "inline-flex min-h-10 items-center rounded-full border border-[var(--brand-strong)] bg-[var(--accent-soft)] px-4 text-sm font-bold text-[var(--foreground)] shadow-[inset_0_-3px_0_var(--brand)]"
                    : "inline-flex min-h-10 items-center rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-4 text-sm font-bold text-[var(--foreground)] hover:bg-[var(--accent-soft)]"
                }
                href="/auth"
              >
                เข้าสู่ระบบ
              </Link>
            )}
          </div>
        </div>

        {isDrawerViewer ? (
          <>
            <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
              <button
                aria-expanded={isDrawerOpen}
                aria-label={`เปิด${drawerTitle}`}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm font-bold text-[var(--foreground)] hover:border-[var(--brand)]"
                onClick={() => setIsDrawerOpen(true)}
                type="button"
              >
                <MenuIcon />
                เมนู
              </button>
              <p className="truncate text-sm font-semibold text-[var(--muted)]">
                {currentDrawerLink?.label ?? drawerDefaultLabel}
              </p>
            </div>

            <div
              aria-hidden={!isDrawerOpen}
              className={`fixed inset-0 z-50 ${
                isDrawerOpen ? "" : "pointer-events-none"
              }`}
            >
              <button
                aria-label="ปิดเมนู"
                className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
                  isDrawerOpen ? "opacity-100" : "opacity-0"
                }`}
                onClick={() => setIsDrawerOpen(false)}
                tabIndex={-1}
                type="button"
              />
              <div
                className={`absolute inset-y-0 left-0 flex w-[85vw] max-w-xs flex-col bg-[var(--surface)] shadow-xl transition-transform duration-300 ${
                  isDrawerOpen ? "translate-x-0" : "-translate-x-full"
                }`}
              >
                <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
                  <p className="text-lg font-black text-[var(--foreground)]">
                    {drawerTitle}
                  </p>
                  <button
                    aria-label="ปิดเมนู"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                    onClick={() => setIsDrawerOpen(false)}
                    type="button"
                  >
                    <CloseIcon />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto py-2">
                  {drawerCategories.map((category) => {
                    const isExpanded =
                      expandedDrawerCategory === category.label;
                    const hasActiveLink = category.links.some((link) =>
                      isNavLinkActive(pathname, link),
                    );

                    return (
                      <div
                        className="border-b border-[var(--line)]"
                        key={category.label}
                      >
                        <button
                          className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm font-bold text-[var(--foreground)]"
                          onClick={() =>
                            setExpandedDrawerCategory(
                              isExpanded ? null : category.label,
                            )
                          }
                          type="button"
                        >
                          <span>
                            {category.label}
                            {hasActiveLink ? (
                              <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                            ) : null}
                          </span>
                          <span
                            className={
                              isExpanded
                                ? "rotate-180 text-[var(--muted)] transition-transform"
                                : "text-[var(--muted)] transition-transform"
                            }
                          >
                            <ChevronIcon />
                          </span>
                        </button>

                        {isExpanded ? (
                          <div className="pb-2">
                            {category.links.map((link) => {
                              const isActive = isNavLinkActive(pathname, link);

                              return (
                                <Link
                                  aria-current={isActive ? "page" : undefined}
                                  className={
                                    isActive
                                      ? "block px-8 py-2.5 text-sm font-bold text-emerald-400 bg-[var(--accent-soft)]"
                                      : "block px-8 py-2.5 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                                  }
                                  href={link.href}
                                  key={link.href}
                                >
                                  {link.label}
                                </Link>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
        <div className="flex flex-col border-b border-[var(--line)] bg-[var(--surface-muted)] sm:items-center">
      {groups.map((group) => {
        const hasActiveLink = group.links.some((link) =>
          isNavLinkActive(pathname, link),
        );

        if (group.variant === "secondary") {
          if (group.showWhenActiveOnly && !hasActiveLink) {
            return null;
          }

          if (group.showWhenActiveOnly) {
            return (
              <div
                className="w-full border-t border-[var(--line)] sm:max-w-6xl"
                key={group.label}
              >
                <p className="sr-only">{group.label}</p>
                <div className="flex justify-center gap-2 overflow-x-auto px-4 py-2.5">
                  {group.links.map((link) => {
                    const isActive = isNavLinkActive(pathname, link);

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
          }

          return (
            <details
              className="group w-full border-t border-[var(--line)] sm:max-w-6xl"
              key={group.label}
              open={hasActiveLink}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-3 px-4 text-sm font-bold text-[var(--foreground)] hover:text-emerald-400 [&::-webkit-details-marker]:hidden">
                <span>{group.label}</span>
                <span className="transition-transform group-open:rotate-180">
                  <ChevronIcon />
                </span>
              </summary>
              <div className="flex gap-2 overflow-x-auto border-t border-[var(--line)] px-4 py-2.5">
                {group.links.map((link) => {
                  const isActive = isNavLinkActive(pathname, link);

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
            <div className="flex gap-2 overflow-x-auto px-4 py-2.5 sm:justify-center">
              {group.links.map((link) => {
                const isActive = isNavLinkActive(pathname, link);

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
        )}
      </div>
      </nav>
      <div aria-hidden="true" style={{ height: navHeight }} />
    </>
  );
}
