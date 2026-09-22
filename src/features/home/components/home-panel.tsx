"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  getActiveHomepageFooterSetting,
  getActiveHomepageSlides,
  getHomepageAppearanceSetting,
  type HomepageAppearanceSetting,
  type HomepageFooterSetting,
  type HomepageSlide,
} from "@/features/home";
import {
  getStorefrontProducts,
  type ProductWithCategory,
} from "@/features/products";
import {
  getServicesWithCategories,
  type ServiceCategoryWithServices,
} from "@/features/services";
import { createClient } from "@/lib/supabase/browser";

type HomeState =
  | {
      status: "loading";
      error: null;
      data: null;
    }
  | {
      status: "ready";
      error: null;
      data: HomeData;
    }
  | {
      status: "error";
      error: string;
      data: HomeData | null;
    };

type HomeData = {
  appearanceSetting: HomepageAppearanceSetting | null;
  footerSetting: HomepageFooterSetting | null;
  products: ProductWithCategory[];
  serviceCategories: ServiceCategoryWithServices[];
  slides: HomepageSlide[];
};

const emptyHomeData: HomeData = {
  appearanceSetting: null,
  footerSetting: null,
  products: [],
  serviceCategories: [],
  slides: [],
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

const productPlaceholder = "/product-placeholder.svg";
const servicePlaceholder = "/service-placeholder.svg";

function getServicePreview(categories: ServiceCategoryWithServices[]) {
  return categories.flatMap((category) =>
    category.services.slice(0, 1).map((service) => ({
      category,
      service,
    })),
  );
}

function HomeQuickLink({
  description,
  href,
  label,
}: {
  description: string;
  href: string;
  label: string;
}) {
  return (
    <Link
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:border-[var(--brand)]"
      href={href}
    >
      <span className="text-sm font-bold text-[var(--foreground)]">{label}</span>
      <span className="mt-2 block text-xs leading-5 text-[var(--muted)]">
        {description}
      </span>
    </Link>
  );
}

function splitDisplayLines(value: string | null | undefined) {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function HomepageFooter({
  setting,
}: {
  setting: HomepageFooterSetting | null;
}) {
  // No active footer setting (never configured, or admin turned it off) -
  // hide the footer entirely instead of falling back to placeholder content.
  if (!setting) {
    return null;
  }

  const footer = setting;
  const officeAddressLines = splitDisplayLines(footer.office_address);
  const serviceLines = splitDisplayLines(footer.services_content);

  return (
    <footer
      className="relative left-1/2 right-1/2 mt-10 w-screen -translate-x-1/2 text-white"
      style={{ backgroundColor: footer.background_color }}
    >
      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-12 md:grid-cols-[1fr_0.9fr]">
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-black">{footer.office_title}</h2>
            <div className="mt-5 space-y-1 text-sm leading-6 text-white/90">
              {officeAddressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {footer.office_phone ? <p>{footer.office_phone}</p> : null}
              {footer.office_fax ? <p>{footer.office_fax}</p> : null}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black">{footer.contact_title}</h2>
            <div className="mt-5 space-y-1 text-sm leading-6 text-white/90">
              {footer.contact_phone ? <p>{footer.contact_phone}</p> : null}
              {footer.contact_email ? <p>{footer.contact_email}</p> : null}
            </div>
          </section>
        </div>

        <section>
          <h2 className="text-xl font-black">{footer.services_title}</h2>
          <div className="mt-5 space-y-1 text-sm leading-6 text-white/90">
            {serviceLines.map((line, index) =>
              line.length > 0 ? (
                <p key={`${line}-${index}`}>{line}</p>
              ) : null,
            )}
          </div>
        </section>
      </div>
    </footer>
  );
}

function HeroCarousel({ slides }: { slides: HomepageSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedActiveIndex =
    slides.length > 0 ? activeIndex % slides.length : 0;
  const activeSlide = slides[normalizedActiveIndex] ?? null;

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % slides.length);
    }, 6000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [slides.length]);

  if (!activeSlide) {
    return (
      <div className="flex min-h-[500px] flex-col justify-end rounded-lg border border-[var(--line)] bg-[#242424] p-6 text-white md:p-8">
        <p className="text-sm font-bold text-[var(--brand)]">
          ระบบอู่ซ่อมรถออนไลน์
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight md:text-5xl">
          จองคิวซ่อมรถ ซื้ออะไหล่ และติดตามงานซ่อมได้ในที่เดียว
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-200">
          BCare ช่วยให้ลูกค้าจัดการรถ การจองบริการ คำสั่งซื้อสินค้า และหลักฐานการชำระเงินได้อย่างเป็นระบบ
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--brand)] px-5 text-sm font-black text-[var(--foreground)]"
            href="/services"
          >
            จองบริการ
          </Link>
          <Link
            className="inline-flex min-h-11 items-center rounded-md border border-white/25 px-5 text-sm font-bold text-white hover:border-[var(--brand)]"
            href="/products"
          >
            เลือกซื้อสินค้า
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="relative min-h-[500px] overflow-hidden rounded-lg border border-[var(--line)] bg-[#242424] text-white">
      <img
        alt={activeSlide.title}
        className="absolute inset-0 h-full w-full object-cover"
        src={activeSlide.image_url}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/10" />
      <div className="relative z-10 flex min-h-[500px] flex-col justify-end p-6 md:p-8">
        {activeSlide.subtitle ? (
          <p className="text-sm font-bold text-[var(--brand)]">
            {activeSlide.subtitle}
          </p>
        ) : null}
        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight md:text-5xl">
          {activeSlide.title}
        </h1>
        {activeSlide.description ? (
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-100">
            {activeSlide.description}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--brand)] px-5 text-sm font-black text-[var(--foreground)]"
            href={activeSlide.primary_href}
          >
            {activeSlide.primary_label}
          </Link>
          {activeSlide.secondary_label && activeSlide.secondary_href ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-md border border-white/35 px-5 text-sm font-bold text-white hover:border-[var(--brand)]"
              href={activeSlide.secondary_href}
            >
              {activeSlide.secondary_label}
            </Link>
          ) : null}
        </div>
        {slides.length > 1 ? (
          <div className="mt-6 flex gap-2">
            {slides.map((slide, index) => (
              <button
                aria-label={`เปิดสไลด์ ${index + 1}`}
                className={
                  index === normalizedActiveIndex
                    ? "h-2.5 w-8 rounded-full bg-[var(--brand)]"
                    : "h-2.5 w-2.5 rounded-full bg-white/60"
                }
                key={slide.id}
                onClick={() => setActiveIndex(index)}
                type="button"
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function HomePanel() {
  const [homeState, setHomeState] = useState<HomeState>({
    data: null,
    error: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadHome() {
      setHomeState({
        data: null,
        error: null,
        status: "loading",
      });

      const [
        servicesResult,
        productsResult,
        slidesResult,
        footerResult,
        appearanceResult,
      ] = await Promise.all([
        getServicesWithCategories(supabase),
        getStorefrontProducts(supabase),
        getActiveHomepageSlides(supabase),
        getActiveHomepageFooterSetting(supabase),
        getHomepageAppearanceSetting(supabase),
      ]);

      if (!isMounted) {
        return;
      }

      const data: HomeData = {
        ...emptyHomeData,
        appearanceSetting: appearanceResult.data ?? null,
        footerSetting: footerResult.data ?? null,
        products: productsResult.data?.products.slice(0, 4) ?? [],
        serviceCategories: servicesResult.data ?? [],
        slides: slidesResult.data ?? [],
      };

      const loadError =
        servicesResult.error?.message ||
        productsResult.error?.message ||
        slidesResult.error?.message ||
        (footerResult.error?.message.includes("homepage_footer_settings")
          ? null
          : footerResult.error?.message) ||
        (appearanceResult.error?.message.includes(
          "homepage_appearance_settings",
        )
          ? null
          : appearanceResult.error?.message) ||
        null;

      if (loadError) {
        setHomeState({
          data,
          error: loadError,
          status: "error",
        });
        return;
      }

      setHomeState({
        data,
        error: null,
        status: "ready",
      });
    }

    void loadHome();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadHome();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const data = homeState.data ?? emptyHomeData;
  const servicePreview = useMemo(
    () => getServicePreview(data.serviceCategories).slice(0, 6),
    [data.serviceCategories],
  );

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={
        data.appearanceSetting?.background_color
          ? { backgroundColor: data.appearanceSetting.background_color }
          : undefined
      }
    >
      {data.appearanceSetting?.background_image_url ? (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${data.appearanceSetting.background_image_url})`,
            }}
          />
          {/* Dark scrim so page text stays readable no matter what the
              admin's chosen photo looks like. */}
          <div aria-hidden="true" className="absolute inset-0 bg-black/55" />
        </>
      ) : null}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-6 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
      </header>

      <section className="py-8">
        <HeroCarousel slides={data.slides} />
      </section>

      {homeState.status === "loading" ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
          กำลังโหลดข้อมูลหน้าแรก...
        </div>
      ) : null}

      {homeState.status === "error" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          โหลดข้อมูลบางส่วนไม่สำเร็จ: {homeState.error}
        </div>
      ) : null}

      <section className="grid gap-3 py-6 md:grid-cols-3">
        <HomeQuickLink
          description="เลือกบริการ เลือกวันเวลา แล้วส่งคำขอจองให้อู่ตรวจสอบ"
          href="/services"
          label="จองบริการ"
        />
        <HomeQuickLink
          description="เลือกซื้ออะไหล่หรือสินค้า ดูสต็อก และสร้างคำสั่งซื้อ"
          href="/products"
          label="สินค้าและอะไหล่"
        />
        <HomeQuickLink
          description="ดูประวัติการจอง คำสั่งซื้อ รถของฉัน และข้อมูลบัญชี"
          href="/profile"
          label="บัญชีของฉัน"
        />
      </section>

      <section className="py-6">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[var(--foreground)]">
              บริการยอดนิยมของอู่
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              ดึงจากบริการที่เปิดใช้งานจริงในระบบ
            </p>
          </div>
          <Link
            className="text-sm font-bold text-[var(--foreground)] underline decoration-[var(--brand)] decoration-2 underline-offset-4"
            href="/services"
          >
            ดูบริการทั้งหมด
          </Link>
        </div>

        {servicePreview.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {servicePreview.map(({ category, service }) => (
              <Link
                className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] transition hover:border-[var(--brand)]"
                href="/services"
                key={service.id}
              >
                <img
                  alt={`รูปบริการ ${service.name}`}
                  className="h-36 w-full border-b border-[var(--line)] bg-[var(--surface-muted)] object-cover"
                  src={service.image_url || servicePlaceholder}
                />
                <div className="p-4">
                  <p className="text-xs font-bold text-[var(--brand)]">
                    {category.name}
                  </p>
                  <h3 className="mt-2 text-base font-black text-[var(--foreground)]">
                    {service.name}
                  </h3>
                  <p className="mt-3 text-sm font-bold text-[var(--foreground)]">
                    เริ่มต้น {currencyFormatter.format(service.base_price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            ยังไม่มีบริการที่เปิดใช้งาน
          </div>
        )}
      </section>

      <section className="py-6">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-[var(--foreground)]">
              สินค้าและอะไหล่แนะนำ
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              เลือกจากสินค้าที่เปิดขายอยู่ในระบบ
            </p>
          </div>
          <Link
            className="text-sm font-bold text-[var(--foreground)] underline decoration-[var(--brand)] decoration-2 underline-offset-4"
            href="/products"
          >
            ดูสินค้าทั้งหมด
          </Link>
        </div>

        {data.products.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {data.products.map((product) => (
              <Link
                className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] transition hover:border-[var(--brand)]"
                href="/products"
                key={product.id}
              >
                <img
                  alt={`รูปสินค้า ${product.name}`}
                  className="h-36 w-full border-b border-[var(--line)] bg-[var(--surface-muted)] object-cover"
                  src={product.image_url || productPlaceholder}
                />
                <div className="p-4">
                  <p className="text-xs font-bold text-[var(--muted)]">
                    {product.category?.name ?? "สินค้า"}
                  </p>
                  <h3 className="mt-2 line-clamp-2 min-h-10 text-sm font-black leading-5 text-[var(--foreground)]">
                    {product.name}
                  </h3>
                  <p className="mt-3 text-sm font-bold text-[var(--foreground)]">
                    {currencyFormatter.format(product.unit_price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            ยังไม่มีสินค้าที่เปิดขาย
          </div>
        )}
      </section>

      <HomepageFooter setting={data.footerSetting} />
      </main>
    </div>
  );
}
