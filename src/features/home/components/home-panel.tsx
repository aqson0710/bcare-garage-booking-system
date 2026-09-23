"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { DiagonalWaves } from "@/components/diagonal-waves";
import {
  getActiveHomepageFooterSetting,
  getActiveHomepageSlides,
  getHomepageAppearanceSetting,
  getPublicHomepageStats,
  useShopOpenStatus,
  type HomepageAppearanceSetting,
  type HomepageFooterSetting,
  type HomepageSlide,
  type HomepageStats,
} from "@/features/home";
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
  slides: HomepageSlide[];
  stats: HomepageStats | null;
};

const emptyHomeData: HomeData = {
  appearanceSetting: null,
  footerSetting: null,
  slides: [],
  stats: null,
};

// Draft placeholder copy for the "about the shop" sections below - there's
// no admin-editable field for the shop's story text or founding year yet,
// so this is written to be easy to find and swap out once the owner has
// real copy. The stat NUMBERS themselves (customers/jobs/technicians) are
// no longer placeholders - they're fetched live from the database via
// getPublicHomepageStats, see the stats block further down.
const shopStory = {
  foundedYearsAgo: 8,
  highlights: [
    {
      description: "เลือกวันเวลาที่ว่าง จองคิวได้เอง ไม่ต้องโทรถาม",
      title: "จองคิวออนไลน์ได้ตลอด 24 ชม.",
    },
    {
      description: "รู้ทุกความเคลื่อนไหวของรถคุณ ตั้งแต่รับรถถึงซ่อมเสร็จ",
      title: "แจ้งเตือนความคืบหน้างานซ่อมแบบเรียลไทม์",
    },
    {
      description: "อัปโหลดสลิป ระบบตรวจสอบอัตโนมัติ ไม่ต้องรอแอดมินยืนยันนาน",
      title: "ชำระเงินง่ายผ่าน PromptPay",
    },
    {
      description: "ดูย้อนหลังได้ทุกเมื่อ ไม่ต้องเก็บใบเสร็จกระดาษ",
      title: "ประวัติการซ่อมและใบเสร็จออนไลน์ครบ",
    },
  ],
  paragraph:
    "BCare ดูแลรถให้ลูกค้ามาอย่างต่อเนื่อง ด้วยทีมช่างที่ผ่านการฝึกฝนและอุปกรณ์ตรวจเช็คที่ได้มาตรฐาน ตั้งใจทำให้ทุกขั้นตอน ตั้งแต่จองคิว ซ่อม จนถึงจ่ายเงิน เป็นเรื่องง่ายและตรวจสอบได้ทุกขั้นตอน",
  tags: [
    "ตรวจเช็คฟรีก่อนซ่อม",
    "รับประกันงานซ่อม",
    "แจ้งราคาก่อนเริ่มงานทุกครั้ง",
    "ชำระผ่าน PromptPay ได้",
    "ติดตามสถานะซ่อมออนไลน์",
  ],
};

const weekdayLabels = [
  "วันอาทิตย์",
  "วันจันทร์",
  "วันอังคาร",
  "วันพุธ",
  "วันพฤหัสบดี",
  "วันศุกร์",
  "วันเสาร์",
];

function formatDisplayTime(time: string | undefined) {
  if (!time) {
    return "-";
  }

  return time.slice(0, 5);
}

function splitDisplayLines(value: string | null | undefined) {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

// Fades a section up into place the first time it scrolls into view, then
// leaves it alone (no re-hiding on scroll-out, no per-frame work). See the
// .bcare-reveal / .bcare-reveal-visible rules in globals.css, which also
// turn this off entirely for prefers-reduced-motion.
function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`bcare-reveal ${isVisible ? "bcare-reveal-visible" : ""} ${className}`.trim()}
      ref={ref}
    >
      {children}
    </div>
  );
}

// Counts up from 0 to `value` once the number scrolls into view. Skips the
// animation and just shows the final number for prefers-reduced-motion.
function CountUpStat({
  label,
  suffix = "",
  value,
}: {
  label: string;
  suffix?: string;
  value: number;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      // Intentional: `window.matchMedia` only exists client-side, so this
      // can't be computed during render without a server/client hydration
      // mismatch - the effect is the only safe place to read it, and
      // setting display straight to the final value here (skipping the
      // animation) is the whole point of respecting reduced-motion.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }

        observer.disconnect();
        const durationMs = 1200;
        const startTime = performance.now();

        function tick(time: number) {
          const progress = Math.min((time - startTime) / durationMs, 1);
          setDisplay(Math.round(value * progress));

          if (progress < 1) {
            window.requestAnimationFrame(tick);
          }
        }

        window.requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [value]);

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 text-center">
      <p
        className="text-3xl font-black text-[var(--brand)] sm:text-4xl"
        ref={ref}
      >
        {display.toLocaleString("th-TH")}
        {suffix}
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">{label}</p>
    </div>
  );
}

// Slow, endless left-scrolling strip of highlight tags - same infinite
// translateX(-50%) loop the wave background uses (.bcare-wave in
// globals.css), just applied to a flex row of text instead of an SVG path.
function TagMarquee({ tags }: { tags: string[] }) {
  const loopTags = [...tags, ...tags];

  // The mask fades the tag row to transparent at both edges instead of
  // hard-cutting a tag off mid-word right at the container border (the
  // "eating the edge" look) - the scrolling text now looks like it's
  // dissolving in/out of the strip rather than getting chopped by it.
  const edgeFadeStyle = {
    WebkitMaskImage:
      "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
    maskImage:
      "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
  };

  return (
    <div
      className="overflow-hidden border-y border-[var(--line)] bg-[var(--surface)] py-4 sm:py-5"
      style={edgeFadeStyle}
    >
      <div
        className="bcare-wave flex w-max items-center gap-6 sm:gap-10"
        style={{ animationDuration: "32s" }}
      >
        {loopTags.map((tag, index) => (
          <span
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-semibold leading-none text-[var(--muted)] sm:text-sm"
            key={`${tag}-${index}`}
          >
            <span
              aria-hidden="true"
              className="h-1 w-1 shrink-0 rounded-full bg-[var(--brand)] sm:h-1.5 sm:w-1.5"
            />
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function ShopStatusBadge() {
  const { status, isOpen, todayHours } = useShopOpenStatus();

  if (status !== "ready") {
    return null;
  }

  return (
    <div
      className={
        isOpen
          ? "inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"
          : "inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]"
      }
    >
      <span className="relative flex h-2 w-2">
        {isOpen ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        ) : null}
        <span
          className={
            isOpen
              ? "relative inline-flex h-2 w-2 rounded-full bg-emerald-400"
              : "relative inline-flex h-2 w-2 rounded-full bg-[var(--muted)]"
          }
        />
      </span>
      {isOpen
        ? `เปิดให้บริการอยู่ตอนนี้ · ปิด ${formatDisplayTime(todayHours?.close_time)} น.`
        : "ปิดทำการแล้ว"}
    </div>
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
        <div className="mt-6 flex flex-wrap items-center gap-3">
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
          <ShopStatusBadge />
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
        <div className="mt-6 flex flex-wrap items-center gap-3">
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
          <ShopStatusBadge />
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

function ShopHoursTable() {
  const { days, status } = useShopOpenStatus();

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
        กำลังโหลดเวลาทำการ...
      </div>
    );
  }

  if (status === "error" || days.length === 0) {
    return null;
  }

  const today = new Date().getDay();

  return (
    <div className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      {days.map((day) => (
        <div
          className={
            day.weekday === today
              ? "flex items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--foreground)]"
              : "flex items-center justify-between px-4 py-3 text-sm text-[var(--muted)]"
          }
          key={day.weekday}
        >
          <span>{weekdayLabels[day.weekday]}</span>
          <span>
            {day.is_open
              ? `${formatDisplayTime(day.open_time)} - ${formatDisplayTime(day.close_time)} น.`
              : "ปิด"}
          </span>
        </div>
      ))}
    </div>
  );
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

      const [slidesResult, footerResult, appearanceResult, statsResult] =
        await Promise.all([
          getActiveHomepageSlides(supabase),
          getActiveHomepageFooterSetting(supabase),
          getHomepageAppearanceSetting(supabase),
          getPublicHomepageStats(supabase),
        ]);

      if (!isMounted) {
        return;
      }

      const data: HomeData = {
        ...emptyHomeData,
        appearanceSetting: appearanceResult.data ?? null,
        footerSetting: footerResult.data ?? null,
        slides: slidesResult.data ?? [],
        stats: statsResult.data
          ? {
              completedRepairJobsCount:
                statsResult.data.completed_repair_jobs_count,
              technicianTeamCount: statsResult.data.technician_team_count,
              trustedCustomersCount:
                statsResult.data.trusted_customers_count,
            }
          : null,
      };

      const loadError =
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
      // statsResult errors are deliberately excluded from loadError: until
      // homepage-public-stats.sql has been run in Supabase, get_homepage_stats()
      // won't exist yet, and that shouldn't block the rest of the homepage -
      // the stat cards below just fall back to 0 until then.

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
  const officeAddress = useMemo(
    () => splitDisplayLines(data.footerSetting?.office_address).join(", "),
    [data.footerSetting],
  );
  // Prefer the admin-set exact coordinates (see
  // homepage-office-coordinates.sql) over geocoding the free-text address,
  // since geocoding a short/new-business address can land on the wrong
  // building. Falls back to the address text when no pin has been set.
  const officeMapQuery = useMemo(() => {
    const latitude = data.footerSetting?.office_latitude;
    const longitude = data.footerSetting?.office_longitude;

    if (latitude != null && longitude != null) {
      return `${latitude},${longitude}`;
    }

    return officeAddress;
  }, [
    data.footerSetting?.office_latitude,
    data.footerSetting?.office_longitude,
    officeAddress,
  ]);

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

      <Reveal className="py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <p className="text-sm font-bold text-[var(--brand)]">
              เรื่องราวของเรา
            </p>
            <h2 className="mt-3 text-2xl font-black text-[var(--foreground)] sm:text-3xl">
              อู่ที่ลูกค้าวางใจ ดูแลรถให้เหมือนรถตัวเอง
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--muted)]">
              {shopStory.paragraph}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CountUpStat
              label="ปีที่ให้บริการ"
              suffix=" ปี"
              value={shopStory.foundedYearsAgo}
            />
            {/* trustedCustomers/completedJobs/technicianTeam below are real
                counts from the database (getPublicHomepageStats), not
                placeholders - see homepage-public-stats.sql. The `key`
                forces a remount once the numbers arrive so the count-up
                animation runs against the real value instead of animating
                to 0 first if this section is already on screen. */}
            <CountUpStat
              key={data.stats ? "trusted-loaded" : "trusted-loading"}
              label="ลูกค้าที่ไว้วางใจ"
              value={data.stats?.trustedCustomersCount ?? 0}
            />
            <CountUpStat
              key={data.stats ? "jobs-loaded" : "jobs-loading"}
              label="งานซ่อมสำเร็จ"
              value={data.stats?.completedRepairJobsCount ?? 0}
            />
            <CountUpStat
              key={data.stats ? "team-loaded" : "team-loading"}
              label="ทีมช่างมืออาชีพ"
              suffix=" คน"
              value={data.stats?.technicianTeamCount ?? 0}
            />
          </div>
        </div>
      </Reveal>

      <TagMarquee tags={shopStory.tags} />

      <Reveal className="py-10">
        <div className="border-b border-[var(--line)] pb-4">
          <h2 className="text-2xl font-black text-[var(--foreground)]">
            ทำไมต้องเลือก BCare
          </h2>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {shopStory.highlights.map((highlight) => (
            <div
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
              key={highlight.title}
            >
              <p className="text-base font-black text-[var(--foreground)]">
                {highlight.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {highlight.description}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] py-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
          <DiagonalWaves />
        </div>
        <div className="relative z-10 px-6">
          <div className="border-b border-[var(--line)] pb-4">
            <h2 className="text-2xl font-black text-[var(--foreground)]">
              ที่อยู่และเวลาทำการ
            </h2>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <ShopHoursTable />
              {data.footerSetting?.office_phone ||
              data.footerSetting?.office_address ? (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--foreground)]">
                  {splitDisplayLines(data.footerSetting?.office_address).map(
                    (line) => (
                      <p key={line}>{line}</p>
                    ),
                  )}
                  {data.footerSetting?.office_phone ? (
                    <p className="mt-1 font-semibold">
                      {data.footerSetting.office_phone}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {officeMapQuery ? (
              <iframe
                className="h-72 w-full rounded-lg border border-[var(--line)] lg:h-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps?q=${encodeURIComponent(officeMapQuery)}&output=embed`}
                title="แผนที่ร้าน BCare"
              />
            ) : null}
          </div>
        </div>
      </Reveal>

      <Reveal className="relative overflow-hidden rounded-lg border border-[var(--line)] bg-[#141815] py-14 text-center text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <DiagonalWaves />
        </div>
        <div className="relative z-10 px-6">
          <h2 className="text-2xl font-black sm:text-3xl">
            พร้อมให้เราดูแลรถคุณหรือยัง?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-300">
            จองคิวบริการ หรือเลือกซื้ออะไหล่ที่ต้องการได้เลยตอนนี้
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--brand)] px-6 text-sm font-black text-[var(--foreground)]"
              href="/services"
            >
              จองบริการ
            </Link>
            <Link
              className="inline-flex min-h-11 items-center rounded-md border border-white/25 px-6 text-sm font-bold text-white hover:border-[var(--brand)]"
              href="/products"
            >
              เลือกซื้อสินค้า
            </Link>
          </div>
        </div>
      </Reveal>

      <HomepageFooter setting={data.footerSetting} />
      </main>
    </div>
  );
}
