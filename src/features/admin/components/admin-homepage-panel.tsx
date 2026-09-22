"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { checkAdminAccess } from "@/features/admin";
import {
  createHomepageSlide,
  deleteHomepageSlide,
  getAdminHomepageFooterSetting,
  getAdminHomepageSlides,
  getHomepageAppearanceSetting,
  updateHomepageSlide,
  upsertHomepageAppearanceSetting,
  upsertHomepageFooterSetting,
  upsertHomepageLogoSetting,
  type HomepageAppearanceSetting,
  type HomepageAppearanceSettingInput,
  type HomepageFooterSetting,
  type HomepageFooterSettingInput,
  type HomepageLogoSettingInput,
  type HomepageSlide,
  type HomepageSlideInput,
} from "@/features/home";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | {
      status: "loading";
      error: null;
      appearanceSetting: null;
      footerSetting: null;
      slides: null;
      userId: null;
    }
  | {
      status: "signed-out";
      error: null;
      appearanceSetting: null;
      footerSetting: null;
      slides: null;
      userId: null;
    }
  | {
      status: "denied";
      error: string;
      appearanceSetting: null;
      footerSetting: null;
      slides: null;
      userId: null;
    }
  | {
      status: "ready";
      error: null;
      appearanceSetting: HomepageAppearanceSetting | null;
      footerSetting: HomepageFooterSetting | null;
      slides: HomepageSlide[];
      userId: string;
    }
  | {
      status: "error";
      error: string;
      appearanceSetting: null;
      footerSetting: null;
      slides: null;
      userId: null;
    };

type SaveState =
  | { status: "idle"; error: null; message: null }
  | { status: "saving"; error: null; message: null }
  | { status: "success"; error: null; message: string }
  | { status: "error"; error: string; message: null };

type UploadState =
  | { status: "idle"; error: null; message: null }
  | { status: "uploading"; error: null; message: null }
  | { status: "uploaded"; error: null; message: string }
  | { status: "error"; error: string; message: null };

type SlideFormState = {
  description: string;
  imageUrl: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  sortOrder: string;
  status: HomepageSlide["status"];
  subtitle: string;
  title: string;
};

type FooterFormState = {
  backgroundColor: string;
  contactEmail: string;
  contactPhone: string;
  contactTitle: string;
  officeAddress: string;
  officeFax: string;
  officePhone: string;
  officeTitle: string;
  servicesContent: string;
  servicesTitle: string;
  status: HomepageFooterSetting["status"];
};

type AppearanceFormState = {
  backgroundColor: string;
  backgroundImageUrl: string;
};

type SettingsTab = "footer" | "slides" | "background";

const homepageSlidesBucket = "homepage-slides";

const emptyFormState: SlideFormState = {
  description: "",
  imageUrl: "",
  primaryHref: "/services",
  primaryLabel: "จองบริการ",
  secondaryHref: "/products",
  secondaryLabel: "เลือกซื้อสินค้า",
  sortOrder: "0",
  status: "active",
  subtitle: "ระบบอู่ซ่อมรถออนไลน์",
  title: "",
};

const defaultFooterFormState: FooterFormState = {
  backgroundColor: "#C81010",
  contactEmail: "Email : bcare.service@example.com",
  contactPhone: "02-538-8111 หรือศูนย์บริการใกล้บ้าน",
  contactTitle: "สอบถามข้อมูล",
  officeAddress:
    "99/9 ถนนพระราม 9\nแขวงสวนหลวง เขตสวนหลวง\nกรุงเทพฯ 10250",
  officeFax: "โทรสาร. 02-933-1241",
  officePhone: "โทร. 02-538-8111",
  officeTitle: "สำนักงานใหญ่",
  servicesContent:
    "งานบริการ\nจำหน่ายอะไหล่รถยนต์\nผลิตภัณฑ์ดูแลรถยนต์\nบริการจัดส่งสินค้า\n\nกรุงเทพมหานครและปริมณฑล",
  servicesTitle: "สินค้าและบริการ",
  status: "active",
};

const defaultAppearanceFormState: AppearanceFormState = {
  backgroundColor: "#0a0d0b",
  backgroundImageUrl: "",
};

function toFormState(slide: HomepageSlide): SlideFormState {
  return {
    description: slide.description ?? "",
    imageUrl: slide.image_url,
    primaryHref: slide.primary_href,
    primaryLabel: slide.primary_label,
    secondaryHref: slide.secondary_href ?? "",
    secondaryLabel: slide.secondary_label ?? "",
    sortOrder: String(slide.sort_order),
    status: slide.status,
    subtitle: slide.subtitle ?? "",
    title: slide.title,
  };
}

function toFooterFormState(setting: HomepageFooterSetting): FooterFormState {
  return {
    backgroundColor: setting.background_color,
    contactEmail: setting.contact_email ?? "",
    contactPhone: setting.contact_phone ?? "",
    contactTitle: setting.contact_title,
    officeAddress: setting.office_address ?? "",
    officeFax: setting.office_fax ?? "",
    officePhone: setting.office_phone ?? "",
    officeTitle: setting.office_title,
    servicesContent: setting.services_content ?? "",
    servicesTitle: setting.services_title,
    status: setting.status,
  };
}

function toAppearanceFormState(
  setting: HomepageAppearanceSetting,
): AppearanceFormState {
  return {
    backgroundColor: setting.background_color,
    backgroundImageUrl: setting.background_image_url ?? "",
  };
}

function getSafeImageExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") {
    return "jpg";
  }

  if (extension === "png" || extension === "webp") {
    return extension;
  }

  return "jpg";
}

function validateForm(formState: SlideFormState) {
  if (!formState.title.trim()) {
    return "กรุณากรอกหัวข้อสไลด์";
  }

  if (!formState.imageUrl.trim()) {
    return "กรุณาอัปโหลดหรือกรอก URL รูปสไลด์";
  }

  if (!formState.primaryLabel.trim() || !formState.primaryHref.trim()) {
    return "กรุณากรอกปุ่มหลักให้ครบ";
  }

  return null;
}

function validateFooterForm(formState: FooterFormState) {
  if (!formState.officeTitle.trim()) {
    return "กรุณากรอกหัวข้อสำนักงานใหญ่";
  }

  if (!formState.contactTitle.trim()) {
    return "กรุณากรอกหัวข้อสอบถามข้อมูล";
  }

  if (!formState.servicesTitle.trim()) {
    return "กรุณากรอกหัวข้อสินค้าและบริการ";
  }

  return null;
}

function validateAppearanceForm(formState: AppearanceFormState) {
  if (!/^#[0-9a-fA-F]{6}$/.test(formState.backgroundColor.trim())) {
    return "กรุณาเลือกสีให้ถูกต้อง เช่น #0A0D0B";
  }

  return null;
}

async function uploadSlideImage(file: File) {
  if (
    file.type !== "image/png" &&
    file.type !== "image/jpeg" &&
    file.type !== "image/webp"
  ) {
    return { error: "รองรับเฉพาะไฟล์ PNG, JPG หรือ WEBP", publicUrl: null };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "รูปสไลด์ต้องไม่เกิน 5 MB", publicUrl: null };
  }

  const supabase = createClient();
  const extension = getSafeImageExtension(file);
  const uploadPath = `slides/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const uploadResult = await supabase.storage
    .from(homepageSlidesBucket)
    .upload(uploadPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) {
    return {
      error:
        uploadResult.error.message.includes("Bucket not found") ||
        uploadResult.error.message.includes("bucket")
          ? "ยังไม่มี bucket homepage-slides กรุณารันไฟล์ supabase/homepage-slides-schema.sql ก่อน"
          : uploadResult.error.message,
      publicUrl: null,
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(homepageSlidesBucket).getPublicUrl(uploadPath);

  return { error: null, publicUrl };
}

// Reuses the same storage bucket as slide images (same upload/read
// policies already cover it) - just a different path prefix so the two
// kinds of image stay easy to tell apart in the bucket listing.
async function uploadBackgroundImage(file: File) {
  if (
    file.type !== "image/png" &&
    file.type !== "image/jpeg" &&
    file.type !== "image/webp"
  ) {
    return { error: "รองรับเฉพาะไฟล์ PNG, JPG หรือ WEBP", publicUrl: null };
  }

  if (file.size > 8 * 1024 * 1024) {
    return { error: "รูปพื้นหลังต้องไม่เกิน 8 MB", publicUrl: null };
  }

  const supabase = createClient();
  const extension = getSafeImageExtension(file);
  const uploadPath = `backgrounds/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const uploadResult = await supabase.storage
    .from(homepageSlidesBucket)
    .upload(uploadPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) {
    return {
      error:
        uploadResult.error.message.includes("Bucket not found") ||
        uploadResult.error.message.includes("bucket")
          ? "ยังไม่มี bucket homepage-slides กรุณารันไฟล์ supabase/homepage-slides-schema.sql ก่อน"
          : uploadResult.error.message,
      publicUrl: null,
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(homepageSlidesBucket).getPublicUrl(uploadPath);

  return { error: null, publicUrl };
}

// Same bucket as slides/background images, different path prefix (logos/)
// so no new storage bucket or RLS policy is needed for this feature.
async function uploadLogoImage(file: File) {
  if (
    file.type !== "image/png" &&
    file.type !== "image/jpeg" &&
    file.type !== "image/webp"
  ) {
    return { error: "รองรับเฉพาะไฟล์ PNG, JPG หรือ WEBP", publicUrl: null };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { error: "รูปโลโก้ต้องไม่เกิน 2 MB", publicUrl: null };
  }

  const supabase = createClient();
  const extension = getSafeImageExtension(file);
  const uploadPath = `logos/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const uploadResult = await supabase.storage
    .from(homepageSlidesBucket)
    .upload(uploadPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) {
    return {
      error:
        uploadResult.error.message.includes("Bucket not found") ||
        uploadResult.error.message.includes("bucket")
          ? "ยังไม่มี bucket homepage-slides กรุณารันไฟล์ supabase/homepage-slides-schema.sql ก่อน"
          : uploadResult.error.message,
      publicUrl: null,
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(homepageSlidesBucket).getPublicUrl(uploadPath);

  return { error: null, publicUrl };
}

function buildInput(
  formState: SlideFormState,
  userId: string,
): HomepageSlideInput {
  return {
    ...formState,
    updatedBy: userId,
  };
}

function buildFooterInput(
  formState: FooterFormState,
  userId: string,
): HomepageFooterSettingInput {
  return {
    ...formState,
    updatedBy: userId,
  };
}

function buildAppearanceInput(
  formState: AppearanceFormState,
  userId: string,
): HomepageAppearanceSettingInput {
  return {
    ...formState,
    updatedBy: userId,
  };
}

function buildLogoInput(
  logoUrl: string,
  userId: string,
): HomepageLogoSettingInput {
  return {
    logoUrl,
    updatedBy: userId,
  };
}

function SlideFormFields({
  formState,
  onPatch,
}: {
  formState: SlideFormState;
  onPatch: (partial: Partial<SlideFormState>) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium text-[var(--foreground)]">
        หัวข้อหลัก
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          onChange={(event) => onPatch({ title: event.target.value })}
          value={formState.title}
        />
      </label>
      <label className="text-sm font-medium text-[var(--foreground)]">
        หัวข้อย่อย
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          onChange={(event) => onPatch({ subtitle: event.target.value })}
          value={formState.subtitle}
        />
      </label>
      <label className="md:col-span-2 text-sm font-medium text-[var(--foreground)]">
        รายละเอียด
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
          onChange={(event) => onPatch({ description: event.target.value })}
          value={formState.description}
        />
      </label>
      <label className="md:col-span-2 text-sm font-medium text-[var(--foreground)]">
        URL รูปสไลด์
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          onChange={(event) => onPatch({ imageUrl: event.target.value })}
          value={formState.imageUrl}
        />
      </label>
      <label className="text-sm font-medium text-[var(--foreground)]">
        ปุ่มหลัก
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          onChange={(event) => onPatch({ primaryLabel: event.target.value })}
          value={formState.primaryLabel}
        />
      </label>
      <label className="text-sm font-medium text-[var(--foreground)]">
        ลิงก์ปุ่มหลัก
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          onChange={(event) => onPatch({ primaryHref: event.target.value })}
          value={formState.primaryHref}
        />
      </label>
      <label className="text-sm font-medium text-[var(--foreground)]">
        ปุ่มรอง
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          onChange={(event) => onPatch({ secondaryLabel: event.target.value })}
          value={formState.secondaryLabel}
        />
      </label>
      <label className="text-sm font-medium text-[var(--foreground)]">
        ลิงก์ปุ่มรอง
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          onChange={(event) => onPatch({ secondaryHref: event.target.value })}
          value={formState.secondaryHref}
        />
      </label>
      <label className="text-sm font-medium text-[var(--foreground)]">
        ลำดับ
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          inputMode="numeric"
          onChange={(event) => onPatch({ sortOrder: event.target.value })}
          value={formState.sortOrder}
        />
      </label>
      <label className="text-sm font-medium text-[var(--foreground)]">
        สถานะ
        <select
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          onChange={(event) =>
            onPatch({ status: event.target.value as HomepageSlide["status"] })
          }
          value={formState.status}
        >
          <option value="active">เปิดใช้งาน</option>
          <option value="inactive">ปิดใช้งาน</option>
        </select>
      </label>
    </div>
  );
}

function SlideImageUpload({
  disabled,
  onUploaded,
}: {
  disabled?: boolean;
  onUploaded: (publicUrl: string) => void;
}) {
  const [uploadState, setUploadState] = useState<UploadState>({
    error: null,
    message: null,
    status: "idle",
  });

  async function handleUpload(file: File | null) {
    if (!file) {
      return;
    }

    setUploadState({ error: null, message: null, status: "uploading" });
    const result = await uploadSlideImage(file);

    if (result.error || !result.publicUrl) {
      setUploadState({
        error: result.error ?? "อัปโหลดรูปไม่สำเร็จ",
        message: null,
        status: "error",
      });
      return;
    }

    onUploaded(result.publicUrl);
    setUploadState({
      error: null,
      message: "อัปโหลดรูปแล้ว กดบันทึกเพื่อใช้รูปนี้",
      status: "uploaded",
    });
  }

  return (
    <div>
      <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--foreground)] hover:border-[var(--brand)]">
        {uploadState.status === "uploading" ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}
        <input
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={disabled || uploadState.status === "uploading"}
          onChange={(event) => {
            void handleUpload(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
          type="file"
        />
      </label>
      {uploadState.status === "uploaded" ? (
        <p className="mt-2 text-xs text-[var(--success)]">
          {uploadState.message}
        </p>
      ) : null}
      {uploadState.status === "error" ? (
        <p className="mt-2 text-xs text-[var(--danger)]">{uploadState.error}</p>
      ) : null}
    </div>
  );
}

function BackgroundImageUpload({
  disabled,
  onUploaded,
}: {
  disabled?: boolean;
  onUploaded: (publicUrl: string) => void;
}) {
  const [uploadState, setUploadState] = useState<UploadState>({
    error: null,
    message: null,
    status: "idle",
  });

  async function handleUpload(file: File | null) {
    if (!file) {
      return;
    }

    setUploadState({ error: null, message: null, status: "uploading" });
    const result = await uploadBackgroundImage(file);

    if (result.error || !result.publicUrl) {
      setUploadState({
        error: result.error ?? "อัปโหลดรูปไม่สำเร็จ",
        message: null,
        status: "error",
      });
      return;
    }

    onUploaded(result.publicUrl);
    setUploadState({
      error: null,
      message: "อัปโหลดรูปแล้ว กดบันทึกเพื่อใช้รูปนี้",
      status: "uploaded",
    });
  }

  return (
    <div>
      <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--foreground)] hover:border-[var(--brand)]">
        {uploadState.status === "uploading" ? "กำลังอัปโหลด..." : "อัปโหลดรูปพื้นหลัง"}
        <input
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={disabled || uploadState.status === "uploading"}
          onChange={(event) => {
            void handleUpload(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
          type="file"
        />
      </label>
      {uploadState.status === "uploaded" ? (
        <p className="mt-2 text-xs text-[var(--success)]">
          {uploadState.message}
        </p>
      ) : null}
      {uploadState.status === "error" ? (
        <p className="mt-2 text-xs text-[var(--danger)]">{uploadState.error}</p>
      ) : null}
    </div>
  );
}

function LogoImageUpload({
  disabled,
  onUploaded,
}: {
  disabled?: boolean;
  onUploaded: (publicUrl: string) => void;
}) {
  const [uploadState, setUploadState] = useState<UploadState>({
    error: null,
    message: null,
    status: "idle",
  });

  async function handleUpload(file: File | null) {
    if (!file) {
      return;
    }

    setUploadState({ error: null, message: null, status: "uploading" });
    const result = await uploadLogoImage(file);

    if (result.error || !result.publicUrl) {
      setUploadState({
        error: result.error ?? "อัปโหลดรูปไม่สำเร็จ",
        message: null,
        status: "error",
      });
      return;
    }

    onUploaded(result.publicUrl);
    setUploadState({
      error: null,
      message: "อัปโหลดโลโก้แล้ว กดบันทึกเพื่อใช้โลโก้นี้",
      status: "uploaded",
    });
  }

  return (
    <div>
      <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--foreground)] hover:border-[var(--brand)]">
        {uploadState.status === "uploading" ? "กำลังอัปโหลด..." : "อัปโหลดโลโก้"}
        <input
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={disabled || uploadState.status === "uploading"}
          onChange={(event) => {
            void handleUpload(event.target.files?.[0] ?? null);
            event.target.value = "";
          }}
          type="file"
        />
      </label>
      {uploadState.status === "uploaded" ? (
        <p className="mt-2 text-xs text-[var(--success)]">
          {uploadState.message}
        </p>
      ) : null}
      {uploadState.status === "error" ? (
        <p className="mt-2 text-xs text-[var(--danger)]">{uploadState.error}</p>
      ) : null}
    </div>
  );
}

function LogoSettingsCard({
  disabled,
  logoUrl,
  onPatch,
  onSubmit,
  saveState,
}: {
  disabled: boolean;
  logoUrl: string;
  onPatch: (nextLogoUrl: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  saveState: SaveState;
}) {
  const hasLogo = logoUrl.trim().length > 0;

  return (
    <form
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-[var(--foreground)]">
            โลโก้เว็บไซต์
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--muted)]">
            โลโก้นี้จะแสดงแทนชื่อ &quot;BCare&quot; บนแถบเมนูด้านบนของทุกหน้า รวมถึงหน้าเข้าสู่ระบบ
          </p>
        </div>
        {hasLogo ? (
          <img
            alt="ตัวอย่างโลโก้"
            className="h-14 w-auto max-w-[10rem] rounded-md border border-[var(--line)] bg-[var(--surface-muted)] object-contain p-2"
            src={logoUrl}
          />
        ) : (
          <div className="grid h-14 w-32 shrink-0 place-items-center rounded-md border border-dashed border-[var(--line)] bg-[var(--surface-muted)] text-xs text-[var(--muted)]">
            ยังไม่มีโลโก้
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <LogoImageUpload disabled={disabled} onUploaded={onPatch} />
        {hasLogo ? (
          <button
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
            onClick={() => onPatch("")}
            type="button"
          >
            เอาโลโก้ออก
          </button>
        ) : null}
      </div>

      <button
        className="mt-5 min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        {saveState.status === "saving" ? "กำลังบันทึก..." : "บันทึกโลโก้"}
      </button>
      {saveState.status === "success" ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-[var(--success)]">
          {saveState.message}
        </p>
      ) : null}
      {saveState.status === "error" ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveState.error}
        </p>
      ) : null}
    </form>
  );
}

function AdminSlideCard({
  onDeleted,
  onSaved,
  slide,
  userId,
}: {
  onDeleted: (id: string) => void;
  onSaved: (slide: HomepageSlide) => void;
  slide: HomepageSlide;
  userId: string;
}) {
  const [formState, setFormState] = useState<SlideFormState>(() =>
    toFormState(slide),
  );
  const [saveState, setSaveState] = useState<SaveState>({
    error: null,
    message: null,
    status: "idle",
  });

  function patchFormState(partial: Partial<SlideFormState>) {
    setFormState((current) => ({ ...current, ...partial }));
    setSaveState({ error: null, message: null, status: "idle" });
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm(formState);

    if (validationError) {
      setSaveState({ error: validationError, message: null, status: "error" });
      return;
    }

    setSaveState({ error: null, message: null, status: "saving" });
    const supabase = createClient();
    const { data, error } = await updateHomepageSlide(
      supabase,
      slide.id,
      buildInput(formState, userId),
    );

    if (error) {
      setSaveState({ error: error.message, message: null, status: "error" });
      return;
    }

    onSaved(data);
    setFormState(toFormState(data));
    setSaveState({
      error: null,
      message: "บันทึกสไลด์เรียบร้อยแล้ว",
      status: "success",
    });
  }

  async function handleDelete() {
    const supabase = createClient();
    const { error } = await deleteHomepageSlide(supabase, slide.id);

    if (error) {
      setSaveState({ error: error.message, message: null, status: "error" });
      return;
    }

    onDeleted(slide.id);
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
      <form onSubmit={handleSave}>
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div>
            {formState.imageUrl ? (
              <img
                alt={formState.title || "รูปสไลด์หน้าแรก"}
                className="h-40 w-full rounded-md border border-[var(--line)] bg-[var(--surface-muted)] object-cover"
                src={formState.imageUrl}
              />
            ) : (
              <div className="grid h-40 place-items-center rounded-md border border-dashed border-[var(--line)] bg-[var(--surface-muted)] text-sm text-[var(--muted)]">
                ยังไม่มีรูป
              </div>
            )}
            <div className="mt-3">
              <SlideImageUpload
                disabled={saveState.status === "saving"}
                onUploaded={(publicUrl) => patchFormState({ imageUrl: publicUrl })}
              />
            </div>
          </div>
          <div>
            <SlideFormFields formState={formState} onPatch={patchFormState} />
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saveState.status === "saving"}
                type="submit"
              >
                {saveState.status === "saving" ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button
                className="min-h-10 rounded-md border border-red-200 bg-[var(--surface)] px-4 text-sm font-bold text-[var(--danger)]"
                onClick={handleDelete}
                type="button"
              >
                ลบ
              </button>
            </div>
            {saveState.status === "success" ? (
              <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-[var(--success)]">
                {saveState.message}
              </p>
            ) : null}
            {saveState.status === "error" ? (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveState.error}
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </article>
  );
}

function FooterSettingsForm({
  formState,
  onPatch,
  onSubmit,
  saveState,
}: {
  formState: FooterFormState;
  onPatch: (partial: Partial<FooterFormState>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  saveState: SaveState;
}) {
  const previewServiceLines = formState.servicesContent
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

  return (
    <form
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
      onSubmit={onSubmit}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">
                แถบล่างหน้าแรก
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                แก้ข้อมูลติดต่อ สินค้าและบริการ ที่แสดงด้านล่างสุดของหน้าแรก
              </p>
            </div>
            <label className="text-sm font-medium text-[var(--foreground)]">
              สถานะ
              <select
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                onChange={(event) =>
                  onPatch({
                    status: event.target.value as HomepageFooterSetting["status"],
                  })
                }
                value={formState.status}
              >
                <option value="active">เปิดใช้งาน</option>
                <option value="inactive">ปิดใช้งาน</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-[var(--foreground)]">
              สีพื้นหลัง
              <div className="mt-2 flex gap-2">
                <input
                  aria-label="เลือกสีพื้นหลัง"
                  className="h-10 w-14 rounded-md border border-[var(--line)] bg-[var(--surface)] p-1"
                  onChange={(event) =>
                    onPatch({ backgroundColor: event.target.value })
                  }
                  type="color"
                  value={formState.backgroundColor}
                />
                <input
                  className="min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                  onChange={(event) =>
                    onPatch({ backgroundColor: event.target.value })
                  }
                  value={formState.backgroundColor}
                />
              </div>
            </label>
            <label className="text-sm font-medium text-[var(--foreground)]">
              หัวข้อสำนักงานใหญ่
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                onChange={(event) =>
                  onPatch({ officeTitle: event.target.value })
                }
                value={formState.officeTitle}
              />
            </label>
            <label className="md:col-span-2 text-sm font-medium text-[var(--foreground)]">
              ที่อยู่สำนักงานใหญ่
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                onChange={(event) =>
                  onPatch({ officeAddress: event.target.value })
                }
                value={formState.officeAddress}
              />
            </label>
            <label className="text-sm font-medium text-[var(--foreground)]">
              เบอร์โทร
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                onChange={(event) =>
                  onPatch({ officePhone: event.target.value })
                }
                value={formState.officePhone}
              />
            </label>
            <label className="text-sm font-medium text-[var(--foreground)]">
              โทรสาร
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                onChange={(event) => onPatch({ officeFax: event.target.value })}
                value={formState.officeFax}
              />
            </label>
            <label className="text-sm font-medium text-[var(--foreground)]">
              หัวข้อสอบถามข้อมูล
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                onChange={(event) =>
                  onPatch({ contactTitle: event.target.value })
                }
                value={formState.contactTitle}
              />
            </label>
            <label className="text-sm font-medium text-[var(--foreground)]">
              เบอร์สอบถามข้อมูล
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                onChange={(event) =>
                  onPatch({ contactPhone: event.target.value })
                }
                value={formState.contactPhone}
              />
            </label>
            <label className="md:col-span-2 text-sm font-medium text-[var(--foreground)]">
              อีเมล
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                onChange={(event) =>
                  onPatch({ contactEmail: event.target.value })
                }
                value={formState.contactEmail}
              />
            </label>
            <label className="text-sm font-medium text-[var(--foreground)]">
              หัวข้อสินค้าและบริการ
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                onChange={(event) =>
                  onPatch({ servicesTitle: event.target.value })
                }
                value={formState.servicesTitle}
              />
            </label>
            <label className="md:col-span-2 text-sm font-medium text-[var(--foreground)]">
              รายการสินค้าและบริการ
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                onChange={(event) =>
                  onPatch({ servicesContent: event.target.value })
                }
                value={formState.servicesContent}
              />
            </label>
          </div>

          <button
            className="mt-5 min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saveState.status === "saving"}
            type="submit"
          >
            {saveState.status === "saving" ? "กำลังบันทึก..." : "บันทึกแถบล่าง"}
          </button>
          {saveState.status === "success" ? (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-[var(--success)]">
              {saveState.message}
            </p>
          ) : null}
          {saveState.status === "error" ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveState.error}
            </p>
          ) : null}
        </div>

        <aside
          className="rounded-lg p-5 text-white"
          style={{ backgroundColor: formState.backgroundColor }}
        >
          <h3 className="text-lg font-black">{formState.officeTitle}</h3>
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/90">
            {formState.officeAddress}
          </p>
          <p className="mt-3 text-sm leading-6 text-white/90">
            {formState.officePhone}
          </p>
          <h3 className="mt-7 text-lg font-black">{formState.contactTitle}</h3>
          <p className="mt-4 text-sm leading-6 text-white/90">
            {formState.contactPhone}
          </p>
          <h3 className="mt-7 text-lg font-black">{formState.servicesTitle}</h3>
          <div className="mt-4 space-y-1 text-sm leading-6 text-white/90">
            {previewServiceLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </aside>
      </div>
    </form>
  );
}

function AppearanceSettingsForm({
  formState,
  onPatch,
  onSubmit,
  saveState,
}: {
  formState: AppearanceFormState;
  onPatch: (partial: Partial<AppearanceFormState>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  saveState: SaveState;
}) {
  const hasImage = formState.backgroundImageUrl.trim().length > 0;

  return (
    <form
      className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
      onSubmit={onSubmit}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h2 className="text-xl font-black text-[var(--foreground)]">
            พื้นหลังหน้าแรก
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            เปลี่ยนพื้นหลังของหน้าแรกทั้งหน้า (แยกจากสีแถบล่าง) ใช้ได้ไม่ว่าจะเปิดหรือปิดแถบล่างก็ตาม
          </p>

          <label className="mt-4 block text-sm font-medium text-[var(--foreground)]">
            สีพื้นหลัง
            <div className="mt-2 flex gap-2">
              <input
                aria-label="เลือกสีพื้นหลังหน้าแรก"
                className="h-10 w-14 rounded-md border border-[var(--line)] bg-[var(--surface)] p-1"
                onChange={(event) =>
                  onPatch({ backgroundColor: event.target.value })
                }
                type="color"
                value={formState.backgroundColor}
              />
              <input
                className="min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)]"
                onChange={(event) =>
                  onPatch({ backgroundColor: event.target.value })
                }
                value={formState.backgroundColor}
              />
            </div>
          </label>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            {hasImage
              ? "ตอนนี้ใช้รูปภาพเป็นพื้นหลัง สีนี้จะไม่แสดง (เอารูปออกเพื่อกลับไปใช้สีอีกครั้ง)"
              : "เลือกสีเข้มไว้ก่อน เพราะตัวหนังสือบนหน้าแรกเป็นสีขาว ถ้าเลือกสีอ่อนเกินไปอาจอ่านยาก ลองดูตัวอย่างด้านขวา"}
          </p>

          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <p className="text-sm font-medium text-[var(--foreground)]">
              หรือใช้รูปภาพแทนสี
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              ถ้าอัปโหลดรูป ระบบจะใช้รูปแทนสีพื้นหลังทันที และจะคลุมด้วยเงามืดบางๆ ให้ตัวหนังสือยังอ่านง่าย
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <BackgroundImageUpload
                disabled={saveState.status === "saving"}
                onUploaded={(publicUrl) =>
                  onPatch({ backgroundImageUrl: publicUrl })
                }
              />
              {hasImage ? (
                <button
                  className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                  onClick={() => onPatch({ backgroundImageUrl: "" })}
                  type="button"
                >
                  เอารูปออก
                </button>
              ) : null}
            </div>
          </div>

          <button
            className="mt-5 min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={saveState.status === "saving"}
            type="submit"
          >
            {saveState.status === "saving" ? "กำลังบันทึก..." : "บันทึกพื้นหลัง"}
          </button>
          {saveState.status === "success" ? (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-[var(--success)]">
              {saveState.message}
            </p>
          ) : null}
          {saveState.status === "error" ? (
            <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {saveState.error}
            </p>
          ) : null}
        </div>

        <aside
          className="relative overflow-hidden rounded-lg border border-[var(--line)] p-5"
          style={{
            backgroundColor: formState.backgroundColor,
          }}
        >
          {hasImage ? (
            <>
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${formState.backgroundImageUrl})`,
                }}
              />
              <div aria-hidden="true" className="absolute inset-0 bg-black/55" />
            </>
          ) : null}
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-wide text-white/60">
              ตัวอย่าง
            </p>
            <h3 className="mt-3 text-lg font-black text-white">
              จองคิวซ่อมรถ ซื้ออะไหล่ และติดตามงานซ่อม
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/80">
              นี่คือตัวอย่างข้อความบนพื้นหลังที่เลือก ลองดูว่าอ่านง่ายหรือไม่
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}

export function AdminHomepagePanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    appearanceSetting: null,
    error: null,
    footerSetting: null,
    slides: null,
    status: "loading",
    userId: null,
  });
  const [newFormState, setNewFormState] =
    useState<SlideFormState>(emptyFormState);
  const [footerFormState, setFooterFormState] = useState<FooterFormState>(
    defaultFooterFormState,
  );
  const [appearanceFormState, setAppearanceFormState] =
    useState<AppearanceFormState>(defaultAppearanceFormState);
  const [logoUrl, setLogoUrl] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTab>("footer");
  const [createState, setCreateState] = useState<SaveState>({
    error: null,
    message: null,
    status: "idle",
  });
  const [footerSaveState, setFooterSaveState] = useState<SaveState>({
    error: null,
    message: null,
    status: "idle",
  });
  const [appearanceSaveState, setAppearanceSaveState] = useState<SaveState>({
    error: null,
    message: null,
    status: "idle",
  });
  const [logoSaveState, setLogoSaveState] = useState<SaveState>({
    error: null,
    message: null,
    status: "idle",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadSlides() {
      setLoadState({
        appearanceSetting: null,
        error: null,
        footerSetting: null,
        slides: null,
        status: "loading",
        userId: null,
      });

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setLoadState({
          appearanceSetting: null,
          error: sessionError.message,
          footerSetting: null,
          slides: null,
          status: "error",
          userId: null,
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          appearanceSetting: null,
          error: null,
          footerSetting: null,
          slides: null,
          status: "signed-out",
          userId: null,
        });
        return;
      }

      const access = await checkAdminAccess(supabase, session.user.id);

      if (!isMounted) {
        return;
      }

      if (!access.allowed) {
        setLoadState({
          appearanceSetting: null,
          error: access.reason,
          footerSetting: null,
          slides: null,
          status: "denied",
          userId: null,
        });
        return;
      }

      const [slidesResult, footerResult, appearanceResult] =
        await Promise.all([
          getAdminHomepageSlides(supabase),
          getAdminHomepageFooterSetting(supabase),
          getHomepageAppearanceSetting(supabase),
        ]);

      if (!isMounted) {
        return;
      }

      if (slidesResult.error) {
        setLoadState({
          appearanceSetting: null,
          error:
            slidesResult.error.message.includes("homepage_slides")
              ? "ยังไม่มีตาราง homepage_slides กรุณารันไฟล์ supabase/homepage-slides-schema.sql ก่อน"
              : slidesResult.error.message,
          footerSetting: null,
          slides: null,
          status: "error",
          userId: null,
        });
        return;
      }

      if (footerResult.error) {
        setLoadState({
          appearanceSetting: null,
          error:
            footerResult.error.message.includes("homepage_footer_settings")
              ? "ยังไม่มีตาราง homepage_footer_settings กรุณารันไฟล์ supabase/homepage-slides-schema.sql เวอร์ชันล่าสุดก่อน"
              : footerResult.error.message,
          footerSetting: null,
          slides: null,
          status: "error",
          userId: null,
        });
        return;
      }

      if (
        appearanceResult.error &&
        !appearanceResult.error.message.includes(
          "homepage_appearance_settings",
        )
      ) {
        setLoadState({
          appearanceSetting: null,
          error: appearanceResult.error.message,
          footerSetting: null,
          slides: null,
          status: "error",
          userId: null,
        });
        return;
      }

      setFooterFormState(
        footerResult.data
          ? toFooterFormState(footerResult.data)
          : defaultFooterFormState,
      );
      setAppearanceFormState(
        appearanceResult.data
          ? toAppearanceFormState(appearanceResult.data)
          : defaultAppearanceFormState,
      );
      setLogoUrl(appearanceResult.data?.logo_url ?? "");
      setLoadState({
        appearanceSetting: appearanceResult.data ?? null,
        error: null,
        footerSetting: footerResult.data ?? null,
        slides: slidesResult.data ?? [],
        status: "ready",
        userId: session.user.id,
      });
    }

    void loadSlides();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadSlides();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function patchNewFormState(partial: Partial<SlideFormState>) {
    setNewFormState((current) => ({ ...current, ...partial }));
    setCreateState({ error: null, message: null, status: "idle" });
  }

  function patchFooterFormState(partial: Partial<FooterFormState>) {
    setFooterFormState((current) => ({ ...current, ...partial }));
    setFooterSaveState({ error: null, message: null, status: "idle" });
  }

  function patchAppearanceFormState(partial: Partial<AppearanceFormState>) {
    setAppearanceFormState((current) => ({ ...current, ...partial }));
    setAppearanceSaveState({ error: null, message: null, status: "idle" });
  }

  function patchLogoUrl(nextLogoUrl: string) {
    setLogoUrl(nextLogoUrl);
    setLogoSaveState({ error: null, message: null, status: "idle" });
  }

  async function handleFooterSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateFooterForm(footerFormState);

    if (validationError) {
      setFooterSaveState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    setFooterSaveState({ error: null, message: null, status: "saving" });
    const supabase = createClient();
    const { data, error } = await upsertHomepageFooterSetting(
      supabase,
      buildFooterInput(footerFormState, loadState.userId),
    );

    if (error) {
      setFooterSaveState({
        error: error.message.includes("homepage_footer_settings")
          ? "ยังไม่มีตาราง footer กรุณารันไฟล์ supabase/homepage-slides-schema.sql เวอร์ชันล่าสุดก่อน"
          : error.message,
        message: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      footerSetting: data,
    });
    setFooterFormState(toFooterFormState(data));
    setFooterSaveState({
      error: null,
      message: "บันทึกแถบล่างหน้าแรกเรียบร้อยแล้ว",
      status: "success",
    });
  }

  async function handleAppearanceSave(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateAppearanceForm(appearanceFormState);

    if (validationError) {
      setAppearanceSaveState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    setAppearanceSaveState({ error: null, message: null, status: "saving" });
    const supabase = createClient();
    const { data, error } = await upsertHomepageAppearanceSetting(
      supabase,
      buildAppearanceInput(appearanceFormState, loadState.userId),
    );

    if (error) {
      setAppearanceSaveState({
        error: error.message.includes("homepage_appearance_settings")
          ? "ยังไม่มีตาราง homepage_appearance_settings กรุณารันไฟล์ supabase/homepage-appearance-schema.sql ก่อน"
          : error.message,
        message: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      appearanceSetting: data,
    });
    setAppearanceFormState(toAppearanceFormState(data));
    setAppearanceSaveState({
      error: null,
      message: "บันทึกสีพื้นหลังหน้าแรกเรียบร้อยแล้ว",
      status: "success",
    });
  }

  async function handleLogoSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loadState.status !== "ready") {
      return;
    }

    setLogoSaveState({ error: null, message: null, status: "saving" });
    const supabase = createClient();
    const { data, error } = await upsertHomepageLogoSetting(
      supabase,
      buildLogoInput(logoUrl, loadState.userId),
    );

    if (error) {
      setLogoSaveState({
        error: error.message.includes("homepage_appearance_settings")
          ? "ยังไม่มีตาราง homepage_appearance_settings กรุณารันไฟล์ supabase/homepage-appearance-schema.sql ก่อน"
          : error.message,
        message: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      appearanceSetting: data,
    });
    setLogoUrl(data.logo_url ?? "");
    setLogoSaveState({
      error: null,
      message: "บันทึกโลโก้เรียบร้อยแล้ว",
      status: "success",
    });
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateForm(newFormState);

    if (validationError) {
      setCreateState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    setCreateState({ error: null, message: null, status: "saving" });
    const supabase = createClient();
    const { data, error } = await createHomepageSlide(
      supabase,
      buildInput(newFormState, loadState.userId),
    );

    if (error) {
      setCreateState({ error: error.message, message: null, status: "error" });
      return;
    }

    setLoadState({
      ...loadState,
      slides: [...loadState.slides, data].sort(
        (a, b) => a.sort_order - b.sort_order,
      ),
    });
    setNewFormState({
      ...emptyFormState,
      sortOrder: String(loadState.slides.length + 1),
    });
    setCreateState({
      error: null,
      message: "เพิ่มสไลด์หน้าแรกเรียบร้อยแล้ว",
      status: "success",
    });
  }

  function handleSaved(nextSlide: HomepageSlide) {
    if (loadState.status !== "ready") {
      return;
    }

    setLoadState({
      ...loadState,
      slides: loadState.slides
        .map((slide) => (slide.id === nextSlide.id ? nextSlide : slide))
        .sort((a, b) => a.sort_order - b.sort_order),
    });
  }

  function handleDeleted(id: string) {
    if (loadState.status !== "ready") {
      return;
    }

    setLoadState({
      ...loadState,
      slides: loadState.slides.filter((slide) => slide.id !== id),
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-10 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--brand)]">Admin</p>
          <h1 className="mt-2 text-3xl font-black text-[var(--foreground)]">
            ตั้งค่าหน้าแรก
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            จัดการรูปสไลด์ ข้อความ และปุ่มบนหน้าแรกของเว็บไซต์
          </p>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="py-8">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            กำลังโหลดสไลด์หน้าแรก...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" || loadState.status === "denied" ? (
        <section className="py-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            กรุณาเข้าสู่ระบบด้วยบัญชี admin ก่อนจัดการหน้าแรก
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="py-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="space-y-6 py-6">
          <div className="flex flex-wrap gap-2 border-b border-[var(--line)] pb-4">
            <button
              className={
                activeTab === "footer"
                  ? "min-h-11 rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-[var(--foreground)]"
                  : "min-h-11 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--muted)] hover:border-[var(--brand)]"
              }
              onClick={() => setActiveTab("footer")}
              type="button"
            >
              แถบล่างหน้าแรก
            </button>
            <button
              className={
                activeTab === "slides"
                  ? "min-h-11 rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-[var(--foreground)]"
                  : "min-h-11 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--muted)] hover:border-[var(--brand)]"
              }
              onClick={() => setActiveTab("slides")}
              type="button"
            >
              สไลด์หน้าแรก
            </button>
            <button
              className={
                activeTab === "background"
                  ? "min-h-11 rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-[var(--foreground)]"
                  : "min-h-11 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--muted)] hover:border-[var(--brand)]"
              }
              onClick={() => setActiveTab("background")}
              type="button"
            >
              สีพื้นหลัง
            </button>
          </div>

          {activeTab === "footer" ? (
            <FooterSettingsForm
              formState={footerFormState}
              onPatch={patchFooterFormState}
              onSubmit={handleFooterSave}
              saveState={footerSaveState}
            />
          ) : null}

          {activeTab === "background" ? (
            <AppearanceSettingsForm
              formState={appearanceFormState}
              onPatch={patchAppearanceFormState}
              onSubmit={handleAppearanceSave}
              saveState={appearanceSaveState}
            />
          ) : null}

          {activeTab === "slides" ? (
            <>
              <LogoSettingsCard
                disabled={logoSaveState.status === "saving"}
                logoUrl={logoUrl}
                onPatch={patchLogoUrl}
                onSubmit={handleLogoSave}
                saveState={logoSaveState}
              />

              <form
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5"
                onSubmit={handleCreate}
              >
                <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div>
                    {newFormState.imageUrl ? (
                      <img
                        alt={newFormState.title || "รูปสไลด์หน้าแรก"}
                        className="h-40 w-full rounded-md border border-[var(--line)] bg-[var(--surface-muted)] object-cover"
                        src={newFormState.imageUrl}
                      />
                    ) : (
                      <div className="grid h-40 place-items-center rounded-md border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-4 text-center text-sm text-[var(--muted)]">
                        อัปโหลดรูปสไลด์ใหม่
                      </div>
                    )}
                    <div className="mt-3">
                      <SlideImageUpload
                        disabled={createState.status === "saving"}
                        onUploaded={(publicUrl) =>
                          patchNewFormState({ imageUrl: publicUrl })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <h2 className="mb-4 text-xl font-black text-[var(--foreground)]">
                      เพิ่มสไลด์ใหม่
                    </h2>
                    <SlideFormFields
                      formState={newFormState}
                      onPatch={patchNewFormState}
                    />
                    <button
                      className="mt-5 min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-bold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={createState.status === "saving"}
                      type="submit"
                    >
                      {createState.status === "saving"
                        ? "กำลังเพิ่ม..."
                        : "เพิ่มสไลด์"}
                    </button>
                    {createState.status === "success" ? (
                      <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-[var(--success)]">
                        {createState.message}
                      </p>
                    ) : null}
                    {createState.status === "error" ? (
                      <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {createState.error}
                      </p>
                    ) : null}
                  </div>
                </div>
              </form>

              <div className="space-y-4">
                <div className="flex items-end justify-between gap-4 border-b border-[var(--line)] pb-3">
                  <div>
                    <h2 className="text-xl font-black text-[var(--foreground)]">
                      สไลด์ทั้งหมด
                    </h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      สไลด์ active จะแสดงบนหน้าแรกตามลำดับเลขที่กำหนด
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[var(--muted)]">
                    {loadState.slides.length} รายการ
                  </span>
                </div>
                {loadState.slides.length > 0 ? (
                  loadState.slides.map((slide) => (
                    <AdminSlideCard
                      key={slide.id}
                      onDeleted={handleDeleted}
                      onSaved={handleSaved}
                      slide={slide}
                      userId={loadState.userId}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
                    ยังไม่มีสไลด์หน้าแรก
                  </div>
                )}
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
