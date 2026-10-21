"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { FormEvent, SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { AdminDeleteButton } from "@/features/admin/components/admin-delete-button";
import {
  checkAdminAccess,
  createAdminService,
  deleteAdminService,
  getAdminServiceCategories,
  getAdminServices,
  updateAdminService,
  type AdminAccessResult,
  type AdminService,
  type AdminServiceCategory,
  type AdminServiceCreateInput,
  type AdminServiceUpdateInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import { PageSkeleton } from "@/components/page-skeleton";

type LoadState =
  | {
      status: "loading";
      access: null;
      categories: null;
      services: null;
      error: null;
    }
  | {
      status: "signed-out";
      access: null;
      categories: null;
      services: null;
      error: null;
    }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      categories: null;
      services: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      categories: AdminServiceCategory[];
      services: AdminService[];
      error: null;
    }
  | {
      status: "error";
      access: null;
      categories: null;
      services: null;
      error: string;
    };

type ActionState =
  | { status: "idle"; serviceId: null; error: null; message: null }
  | { status: "saving"; serviceId: string; error: null; message: null }
  | { status: "deleting"; serviceId: string; error: null; message: null }
  | { status: "error"; serviceId: string; error: string; message: null }
  | { status: "saved"; serviceId: string; error: null; message: string };

type CreateState =
  | { status: "idle"; error: null; message: null }
  | { status: "creating"; error: null; message: null }
  | { status: "error"; error: string; message: null }
  | { status: "created"; error: null; message: string };

type ServiceImageUploadState =
  | { status: "idle"; error: null; message: null }
  | { status: "uploading"; error: null; message: null }
  | { status: "uploaded"; error: null; message: string }
  | { status: "error"; error: string; message: null };

type StatusFilter = "all" | AdminService["status"];

const statusFilters: StatusFilter[] = ["all", "active", "inactive"];
const serviceImagesBucket = "product-images";
const serviceImagePlaceholder = "/service-placeholder.svg";

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function getStatusStyle(status: AdminService["status"]) {
  if (status === "active") {
    return "bg-emerald-400/15 text-emerald-200";
  }

  return "bg-[var(--surface-muted)] text-[var(--foreground)]";
}

function formatServiceStatus(status: StatusFilter) {
  if (status === "active") {
    return "เปิดใช้งาน";
  }

  if (status === "inactive") {
    return "ปิดใช้งาน";
  }

  return "ทั้งหมด";
}


function validateServiceInput(input: AdminServiceUpdateInput) {
  if (!input.name.trim()) {
    return "กรุณากรอกชื่อบริการ";
  }

  if (!input.service_category_id) {
    return "กรุณาเลือกหมวดบริการ";
  }

  if (!Number.isFinite(input.base_price) || input.base_price < 0) {
    return "ราคาเริ่มต้นต้องเป็น 0 บาทขึ้นไป";
  }

  if (
    !Number.isFinite(input.estimated_duration_minutes) ||
    input.estimated_duration_minutes < 1
  ) {
    return "เวลาประมาณต้องอย่างน้อย 1 นาที";
  }

  return null;
}

function buildServicePayload({
  basePrice,
  categoryId,
  description,
  durationMinutes,
  imageUrl,
  name,
  status,
}: {
  basePrice: string;
  categoryId: string;
  description: string;
  durationMinutes: string;
  imageUrl: string;
  name: string;
  status: AdminService["status"];
}): AdminServiceUpdateInput {
  return {
    base_price: Number(basePrice),
    description: description.trim() || null,
    estimated_duration_minutes: Number(durationMinutes),
    image_url: imageUrl.trim() || null,
    name: name.trim(),
    service_category_id: categoryId,
    status,
  };
}

function getSafeServiceImageExtension(file: File) {
  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function handleServiceImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;

  if (image.src.endsWith(serviceImagePlaceholder)) {
    return;
  }

  image.src = serviceImagePlaceholder;
  image.alt = "รูปบริการเริ่มต้น";
}

async function uploadServiceImage(file: File) {
  if (
    file.type !== "image/png" &&
    file.type !== "image/jpeg" &&
    file.type !== "image/webp"
  ) {
    return {
      error: "รองรับเฉพาะไฟล์ PNG, JPG หรือ WEBP",
      publicUrl: null,
    };
  }

  if (file.size > 2 * 1024 * 1024) {
    return {
      error: "ไฟล์รูปบริการต้องไม่เกิน 2 MB",
      publicUrl: null,
    };
  }

  const extension = getSafeServiceImageExtension(file);
  const uploadPath = `services/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const supabase = createClient();
  const uploadResult = await supabase.storage
    .from(serviceImagesBucket)
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
          ? "ยังไม่มี bucket product-images กรุณารันไฟล์ supabase/service-image-upload.sql ก่อน"
          : uploadResult.error.message,
      publicUrl: null,
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(serviceImagesBucket).getPublicUrl(uploadPath);

  return {
    error: null,
    publicUrl,
  };
}

function ServiceImagePreview({
  imageUrl,
  label,
}: {
  imageUrl: string | null;
  label: string;
}) {
  return (
    <img
      alt={label}
      className="h-24 w-32 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] object-cover"
      onError={handleServiceImageError}
      src={imageUrl || serviceImagePlaceholder}
    />
  );
}


const inputClassName =
  "mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]";

// Same layout as ProductFormFields on the products page, shared by the
// "add service" form and every service's edit form.
function ServiceFormFields({
  basePrice,
  categories,
  categoryId,
  description,
  durationMinutes,
  imageUploadState,
  imageUrl,
  name,
  onImageUpload,
  setBasePrice,
  setCategoryId,
  setDescription,
  setDurationMinutes,
  setImageUrl,
  setName,
  setStatus,
  status,
}: {
  basePrice: string;
  categories: AdminServiceCategory[];
  categoryId: string;
  description: string;
  durationMinutes: string;
  imageUploadState: ServiceImageUploadState;
  imageUrl: string;
  name: string;
  onImageUpload: (file: File | null) => void;
  setBasePrice: (value: string) => void;
  setCategoryId: (value: string) => void;
  setDescription: (value: string) => void;
  setDurationMinutes: (value: string) => void;
  setImageUrl: (value: string) => void;
  setName: (value: string) => void;
  setStatus: (value: AdminService["status"]) => void;
  status: AdminService["status"];
}) {
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_150px_150px_140px] lg:items-end">
        <label className="text-sm font-semibold text-[var(--foreground)]">
          ชื่อบริการ
          <input
            className={inputClassName}
            onChange={(event) => setName(event.target.value)}
            placeholder="เช่น เปลี่ยนน้ำมันเครื่อง"
            value={name}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          หมวดบริการ
          <select
            className={inputClassName}
            onChange={(event) => setCategoryId(event.target.value)}
            value={categoryId}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.status === "inactive" ? " (ปิดใช้งาน)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          ราคาเริ่มต้น
          <input
            className={inputClassName}
            min={0}
            onChange={(event) => setBasePrice(event.target.value)}
            step="0.01"
            type="number"
            value={basePrice}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          เวลาประมาณ (นาที)
          <input
            className={inputClassName}
            min={1}
            onChange={(event) => setDurationMinutes(event.target.value)}
            type="number"
            value={durationMinutes}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          สถานะ
          <select
            className={inputClassName}
            onChange={(event) =>
              setStatus(event.target.value as AdminService["status"])
            }
            value={status}
          >
            <option value="active">เปิดใช้งาน</option>
            <option value="inactive">ปิดใช้งาน</option>
          </select>
        </label>
      </div>

      <label className="text-sm font-semibold text-[var(--foreground)]">
        รายละเอียด
        <input
          className={inputClassName}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="คำอธิบายสั้น ๆ ที่แสดงในหน้าจองบริการของลูกค้า"
          value={description}
        />
      </label>

      <div className="grid gap-3 lg:grid-cols-[128px_minmax(0,1fr)_220px] lg:items-end">
        <ServiceImagePreview imageUrl={imageUrl} label={`ตัวอย่างรูป ${name}`} />

        <label className="text-sm font-semibold text-[var(--foreground)]">
          URL รูปบริการ
          <input
            className={inputClassName}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://... หรืออัปโหลดรูปจากเครื่อง"
            value={imageUrl}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          อัปโหลดรูปบริการ
          <input
            accept="image/png,image/jpeg,image/webp"
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
            disabled={imageUploadState.status === "uploading"}
            onChange={(event) => {
              onImageUpload(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
            type="file"
          />
        </label>
      </div>

      {imageUploadState.status === "uploading" ? (
        <div className="rounded-md border border-amber-300/40 bg-amber-400/15 p-3 text-sm leading-6 text-amber-200">
          กำลังอัปโหลดรูปบริการ...
        </div>
      ) : null}

      {imageUploadState.status === "uploaded" ? (
        <div className="rounded-md border border-emerald-300/40 bg-emerald-400/15 p-3 text-sm leading-6 text-emerald-200">
          {imageUploadState.message}
        </div>
      ) : null}

      {imageUploadState.status === "error" ? (
        <div className="rounded-md border border-red-400/40 bg-red-500/15 p-3 text-sm leading-6 text-red-200">
          {imageUploadState.error}
        </div>
      ) : null}
    </>
  );
}

// Image upload state + handler shared by the add form and the edit rows.
function useServiceImageUpload(
  setImageUrl: (value: string) => void,
  successMessage: string,
) {
  const [imageUploadState, setImageUploadState] =
    useState<ServiceImageUploadState>({
      error: null,
      message: null,
      status: "idle",
    });

  async function handleImageUpload(file: File | null) {
    if (!file) {
      return;
    }

    setImageUploadState({
      error: null,
      message: null,
      status: "uploading",
    });

    const result = await uploadServiceImage(file);

    if (result.error || !result.publicUrl) {
      setImageUploadState({
        error: result.error ?? "อัปโหลดรูปบริการไม่สำเร็จ",
        message: null,
        status: "error",
      });
      return;
    }

    setImageUrl(result.publicUrl);
    setImageUploadState({
      error: null,
      message: successMessage,
      status: "uploaded",
    });
  }

  return { handleImageUpload, imageUploadState };
}

function AddServiceForm({
  categories,
  createState,
  onCreate,
}: {
  categories: AdminServiceCategory[];
  createState: CreateState;
  onCreate: (input: AdminServiceCreateInput) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [basePrice, setBasePrice] = useState("0");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [status, setStatus] = useState<AdminService["status"]>("active");
  const { handleImageUpload, imageUploadState } = useServiceImageUpload(
    setImageUrl,
    "อัปโหลดรูปแล้ว กดเพิ่มบริการเพื่อบันทึกบริการ",
  );
  const isCreating = createState.status === "creating";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate(
      buildServicePayload({
        basePrice,
        categoryId,
        description,
        durationMinutes,
        imageUrl,
        name,
        status,
      }),
    );
  }

  if (!isOpen) {
    return (
      <button
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--foreground)]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        + เพิ่มบริการ
      </button>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between border-b border-[var(--line)] pb-4">
        <div>
          <p className="text-sm font-semibold text-[var(--brand)]">เพิ่มบริการ</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            บริการที่เปิดใช้งานจะแสดงในหน้าจองบริการของลูกค้าทันที
          </p>
        </div>
        <button
          className="text-sm font-semibold text-[var(--muted)]"
          onClick={() => setIsOpen(false)}
          type="button"
        >
          ปิด
        </button>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <ServiceFormFields
          basePrice={basePrice}
          categories={categories}
          categoryId={categoryId}
          description={description}
          durationMinutes={durationMinutes}
          imageUploadState={imageUploadState}
          imageUrl={imageUrl}
          name={name}
          onImageUpload={handleImageUpload}
          setBasePrice={setBasePrice}
          setCategoryId={setCategoryId}
          setDescription={setDescription}
          setDurationMinutes={setDurationMinutes}
          setImageUrl={setImageUrl}
          setName={setName}
          setStatus={setStatus}
          status={status}
        />

        {categories.length === 0 ? (
          <p className="rounded-md bg-amber-400/15 p-3 text-sm text-amber-200">
            ยังไม่มีหมวดบริการ กรุณาเพิ่มหมวดบริการก่อนที่หน้า &quot;หมวดบริการ&quot;
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--on-brand)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating || categories.length === 0}
            type="submit"
          >
            {isCreating ? "กำลังเพิ่ม..." : "เพิ่มบริการ"}
          </button>

          {createState.status === "error" ? (
            <p className="text-sm text-[var(--danger)]">{createState.error}</p>
          ) : null}

          {createState.status === "created" ? (
            <p className="text-sm font-semibold text-[var(--brand)]">
              {createState.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function AdminServiceRow({
  actionState,
  categories,
  isExpanded,
  onDelete,
  onSave,
  onToggle,
  service,
}: {
  actionState: ActionState;
  categories: AdminServiceCategory[];
  isExpanded: boolean;
  onDelete: (service: AdminService) => void;
  onSave: (service: AdminService, input: AdminServiceUpdateInput) => void;
  onToggle: () => void;
  service: AdminService;
}) {
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? "");
  const [categoryId, setCategoryId] = useState(service.service_category_id);
  const [basePrice, setBasePrice] = useState(String(service.base_price));
  const [durationMinutes, setDurationMinutes] = useState(
    String(service.estimated_duration_minutes),
  );
  const [imageUrl, setImageUrl] = useState(service.image_url ?? "");
  const [status, setStatus] = useState<AdminService["status"]>(service.status);
  const { handleImageUpload, imageUploadState } = useServiceImageUpload(
    setImageUrl,
    "อัปโหลดรูปแล้ว กดบันทึกบริการเพื่อใช้รูปนี้",
  );
  const isSaving =
    actionState.status === "saving" && actionState.serviceId === service.id;
  const isDeleting =
    actionState.status === "deleting" && actionState.serviceId === service.id;
  const hasChanges =
    name.trim() !== service.name ||
    description.trim() !== (service.description ?? "") ||
    categoryId !== service.service_category_id ||
    Number(basePrice) !== service.base_price ||
    Number(durationMinutes) !== service.estimated_duration_minutes ||
    imageUrl.trim() !== (service.image_url ?? "") ||
    status !== service.status;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(
      service,
      buildServicePayload({
        basePrice,
        categoryId,
        description,
        durationMinutes,
        imageUrl,
        name,
        status,
      }),
    );
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <button
        className="flex w-full items-center gap-3 p-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <img
          alt={`รูปบริการ ${service.name}`}
          className="h-12 w-12 shrink-0 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] object-cover"
          onError={handleServiceImageError}
          src={service.image_url || serviceImagePlaceholder}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-[var(--foreground)]">
              {service.name}
            </h2>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${getStatusStyle(service.status)}`}
            >
              {formatServiceStatus(service.status)}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">
            {service.category?.name ?? "ยังไม่มีหมวดบริการ"}
            {service.description ? ` · ${service.description}` : ""}
          </p>
        </div>
        <div className="hidden shrink-0 gap-4 text-right text-sm sm:flex">
          <div>
            <p className="text-xs text-[var(--muted)]">ราคาเริ่มต้น</p>
            <p className="font-semibold text-[var(--foreground)]">
              {currencyFormatter.format(service.base_price)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">เวลาประมาณ</p>
            <p className="font-semibold text-[var(--foreground)]">
              {service.estimated_duration_minutes} นาที
            </p>
          </div>
        </div>
        <span className="shrink-0 text-sm font-semibold text-[var(--muted)]">
          {isExpanded ? "ย่อ" : "แก้ไข"}
        </span>
      </button>

      {isExpanded ? (
        <form
          className="grid gap-3 border-t border-[var(--line)] p-4"
          onSubmit={handleSubmit}
        >
          <ServiceFormFields
            basePrice={basePrice}
            categories={categories}
            categoryId={categoryId}
            description={description}
            durationMinutes={durationMinutes}
            imageUploadState={imageUploadState}
            imageUrl={imageUrl}
            name={name}
            onImageUpload={handleImageUpload}
            setBasePrice={setBasePrice}
            setCategoryId={setCategoryId}
            setDescription={setDescription}
            setDurationMinutes={setDurationMinutes}
            setImageUrl={setImageUrl}
            setName={setName}
            setStatus={setStatus}
            status={status}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--on-brand)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!hasChanges || isSaving || isDeleting}
                type="submit"
              >
                {isSaving ? "กำลังบันทึก..." : "บันทึกบริการ"}
              </button>
              <AdminDeleteButton
                confirmMessage={`ต้องการลบบริการ "${service.name}" ใช่หรือไม่?\n\nลบแล้วกู้คืนไม่ได้ (บริการที่เคยมีการจองแล้วจะลบไม่ได้ ให้ใช้ "ปิดใช้งาน" แทน)`}
                disabled={isSaving}
                isDeleting={isDeleting}
                label="ลบบริการ"
                onConfirm={() => onDelete(service)}
              />
            </div>

            <p className="text-xs text-[var(--muted)]">
              อัปเดตล่าสุด {new Date(service.updated_at).toLocaleString("th-TH")}
            </p>
          </div>

          {actionState.status === "error" &&
          actionState.serviceId === service.id ? (
            <p className="rounded-md bg-red-500/15 p-3 text-sm text-red-200">
              {actionState.error}
            </p>
          ) : null}

          {actionState.status === "saved" &&
          actionState.serviceId === service.id ? (
            <p className="rounded-md bg-emerald-400/15 p-3 text-sm font-semibold text-emerald-200">
              {actionState.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </article>
  );
}

export function AdminServicesPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    categories: null,
    error: null,
    services: null,
    status: "loading",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(
    null,
  );
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({
    error: null,
    message: null,
    serviceId: null,
    status: "idle",
  });
  const [createState, setCreateState] = useState<CreateState>({
    error: null,
    message: null,
    status: "idle",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadServices() {
      setLoadState({
        access: null,
        categories: null,
        error: null,
        services: null,
        status: "loading",
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
          access: null,
          categories: null,
          error: sessionError.message,
          services: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          categories: null,
          error: null,
          services: null,
          status: "signed-out",
        });
        return;
      }

      const access = await checkAdminAccess(supabase, session.user.id);

      if (!isMounted) {
        return;
      }

      if (!access.allowed) {
        setLoadState({
          access,
          categories: null,
          error: null,
          services: null,
          status: "access-denied",
        });
        return;
      }

      const [servicesResult, categoriesResult] = await Promise.all([
        getAdminServices(supabase),
        getAdminServiceCategories(supabase),
      ]);

      if (!isMounted) {
        return;
      }

      if (servicesResult.error) {
        setLoadState({
          access: null,
          categories: null,
          error: servicesResult.error.message,
          services: null,
          status: "error",
        });
        return;
      }

      if (categoriesResult.error) {
        setLoadState({
          access: null,
          categories: null,
          error: categoriesResult.error.message,
          services: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        categories: categoriesResult.data ?? [],
        error: null,
        services: servicesResult.data ?? [],
        status: "ready",
      });
    }

    loadServices();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadServices();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredServices = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    const normalizedSearch = searchInput.trim().toLowerCase();

    return loadState.services.filter((service) => {
      const matchesStatus =
        statusFilter === "all" || service.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        service.name.toLowerCase().includes(normalizedSearch) ||
        (service.description ?? "").toLowerCase().includes(normalizedSearch) ||
        (service.category?.name ?? "").toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [loadState, searchInput, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = new Map<StatusFilter, number>(
      statusFilters.map((status) => [status, 0]),
    );

    if (loadState.status !== "ready") {
      return counts;
    }

    const normalizedSearch = searchInput.trim().toLowerCase();

    for (const service of loadState.services) {
      const matchesSearch =
        !normalizedSearch ||
        service.name.toLowerCase().includes(normalizedSearch) ||
        (service.description ?? "").toLowerCase().includes(normalizedSearch) ||
        (service.category?.name ?? "").toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        continue;
      }

      counts.set("all", (counts.get("all") ?? 0) + 1);
      counts.set(service.status, (counts.get(service.status) ?? 0) + 1);
    }

    return counts;
  }, [loadState, searchInput]);


  function withCategory(
    service: Omit<AdminService, "category">,
    categories: AdminServiceCategory[],
  ): AdminService {
    return {
      ...service,
      category:
        categories.find(
          (category) => category.id === service.service_category_id,
        ) ?? null,
    };
  }

  function findDuplicateName(
    services: AdminService[],
    input: AdminServiceUpdateInput,
    ignoreServiceId: string | null,
  ) {
    return services.find(
      (service) =>
        service.id !== ignoreServiceId &&
        service.service_category_id === input.service_category_id &&
        service.name.toLowerCase() === input.name.toLowerCase(),
    );
  }

  async function handleCreateService(input: AdminServiceCreateInput) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateServiceInput(input);

    if (validationError) {
      setCreateState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    if (findDuplicateName(loadState.services, input, null)) {
      setCreateState({
        error: "มีบริการชื่อนี้อยู่ในหมวดนี้แล้ว",
        message: null,
        status: "error",
      });
      return;
    }

    setDeleteNotice(null);
    setCreateState({
      error: null,
      message: null,
      status: "creating",
    });

    const supabase = createClient();
    const { data, error } = await createAdminService(supabase, input);

    if (error || !data) {
      setCreateState({
        error: error?.message ?? "เพิ่มบริการไม่สำเร็จ",
        message: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      services: [
        ...loadState.services,
        withCategory(data, loadState.categories),
      ].sort((a, b) => a.name.localeCompare(b.name, "th")),
    });
    setCreateState({
      error: null,
      message: "เพิ่มบริการเรียบร้อยแล้ว",
      status: "created",
    });
  }

  async function handleSaveService(
    service: AdminService,
    input: AdminServiceUpdateInput,
  ) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateServiceInput(input);

    if (validationError) {
      setActionState({
        error: validationError,
        message: null,
        serviceId: service.id,
        status: "error",
      });
      return;
    }

    if (findDuplicateName(loadState.services, input, service.id)) {
      setActionState({
        error: "มีบริการชื่อนี้อยู่ในหมวดนี้แล้ว",
        message: null,
        serviceId: service.id,
        status: "error",
      });
      return;
    }

    setActionState({
      error: null,
      message: null,
      serviceId: service.id,
      status: "saving",
    });

    const supabase = createClient();
    const { data, error } = await updateAdminService(
      supabase,
      service.id,
      input,
    );

    if (error || !data) {
      setActionState({
        error: error?.message ?? "บันทึกบริการไม่สำเร็จ",
        message: null,
        serviceId: service.id,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      services: loadState.services.map((currentService) =>
        currentService.id === service.id
          ? withCategory(data, loadState.categories)
          : currentService,
      ),
    });
    setActionState({
      error: null,
      message: "บันทึกบริการเรียบร้อยแล้ว",
      serviceId: service.id,
      status: "saved",
    });
  }

  async function handleDeleteService(service: AdminService) {
    if (loadState.status !== "ready") {
      return;
    }

    setDeleteNotice(null);
    setActionState({
      error: null,
      message: null,
      serviceId: service.id,
      status: "deleting",
    });

    const supabase = createClient();
    const { error } = await deleteAdminService(supabase, service.id);

    if (error) {
      setActionState({
        error: error.message,
        message: null,
        serviceId: service.id,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      services: loadState.services.filter(
        (currentService) => currentService.id !== service.id,
      ),
    });
    setExpandedServiceId(null);
    setActionState({
      error: null,
      message: null,
      serviceId: null,
      status: "idle",
    });
    setDeleteNotice(`ลบบริการ "${service.name}" เรียบร้อยแล้ว`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col pb-8 pt-0 px-4 sm:px-6 lg:px-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] leading-tight">
              จัดการบริการ
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              จัดการชื่อ ราคา ระยะเวลาโดยประมาณ และสถานะบริการที่แสดงในหน้าจองของลูกค้า
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-[var(--on-brand)]"
              href="/admin/service-categories"
            >
              หมวดบริการ
            </Link>
            <Link
              className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin"
            >
              หน้าแอดมิน
            </Link>
          </div>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <PageSkeleton label="กำลังโหลดบริการ..." variant="list" />
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-300/40 bg-amber-400/15 p-5 text-sm leading-6 text-amber-200">
            <p className="font-semibold">ต้องเข้าสู่ระบบ</p>
            <p className="mt-1">กรุณาเข้าสู่ระบบด้วยบัญชีแอดมิน</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-[var(--on-brand)]"
              href="/auth"
            >
              ไปที่บัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-400/40 bg-red-500/15 p-5 text-sm leading-6 text-red-200">
            <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
            <p className="mt-2">{loadState.access.reason}</p>
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-400/40 bg-[var(--surface)] px-5 py-4 text-sm text-[var(--danger)] shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          <AddServiceForm
            categories={loadState.categories}
            createState={createState}
            key={`${loadState.categories.length}-${loadState.services.length}`}
            onCreate={handleCreateService}
          />

          {deleteNotice ? (
            <p className="mt-3 rounded-md bg-emerald-400/15 p-3 text-sm font-semibold text-emerald-200">
              {deleteNotice}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-4 border-b border-[var(--line)] pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {filteredServices.length} จาก {loadState.services.length}{" "}
                  บริการ
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  บริการที่ปิดใช้งานจะไม่แสดงในหน้าจองบริการของลูกค้า
                </p>
              </div>

              <input
                className="min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] lg:w-80"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="ค้นหาบริการหรือหมวดบริการ"
                type="search"
                value={searchInput}
              />
            </div>

            <div className="flex divide-x divide-[var(--line)] overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-sm">
              {statusFilters.map((status) => (
                <button
                  className={`min-w-[7rem] flex-1 px-4 py-3 text-left transition ${
                    statusFilter === status
                      ? "bg-[var(--accent-soft)]"
                      : "hover:bg-[var(--accent-soft)]"
                  }`}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {formatServiceStatus(status)}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                    {statusCounts.get(status) ?? 0}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {filteredServices.length > 0 ? (
            <div className="mt-5 space-y-3">
              {filteredServices.map((service) => (
                <AdminServiceRow
                  actionState={actionState}
                  categories={loadState.categories}
                  isExpanded={expandedServiceId === service.id}
                  key={service.id}
                  onDelete={handleDeleteService}
                  onSave={handleSaveService}
                  onToggle={() =>
                    setExpandedServiceId((current) =>
                      current === service.id ? null : service.id,
                    )
                  }
                  service={service}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบบริการที่ตรงกับตัวกรองปัจจุบัน
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
