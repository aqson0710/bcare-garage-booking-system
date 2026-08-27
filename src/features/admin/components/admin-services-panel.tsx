"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { FormEvent, SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminServiceCategories,
  getAdminServices,
  updateAdminService,
  type AdminAccessResult,
  type AdminService,
  type AdminServiceCategory,
  type AdminServiceUpdateInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

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
  | { status: "error"; serviceId: string; error: string; message: null }
  | { status: "saved"; serviceId: string; error: null; message: string };

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
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-slate-100 text-slate-700";
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
  if (!Number.isFinite(input.base_price) || input.base_price < 0) {
    return "ราคาเริ่มต้นต้องเป็น 0 บาทขึ้นไป";
  }

  if (
    !Number.isFinite(input.estimated_duration_minutes) ||
    input.estimated_duration_minutes < 1
  ) {
    return "เวลาประมาณต้องอย่างน้อย 1 นาที";
  }

  if (!input.service_category_id) {
    return "กรุณาเลือกหมวดบริการ";
  }

  return null;
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
      className="h-24 w-32 rounded-md border border-[var(--line)] bg-slate-50 object-cover"
      onError={handleServiceImageError}
      src={imageUrl || serviceImagePlaceholder}
    />
  );
}

function AdminServiceRow({
  actionState,
  categories,
  onSave,
  service,
}: {
  actionState: ActionState;
  categories: AdminServiceCategory[];
  onSave: (service: AdminService, input: AdminServiceUpdateInput) => void;
  service: AdminService;
}) {
  const [categoryId, setCategoryId] = useState(service.service_category_id);
  const [basePrice, setBasePrice] = useState(String(service.base_price));
  const [durationMinutes, setDurationMinutes] = useState(
    String(service.estimated_duration_minutes),
  );
  const [imageUrl, setImageUrl] = useState(service.image_url ?? "");
  const [status, setStatus] = useState<AdminService["status"]>(service.status);
  const [imageUploadState, setImageUploadState] =
    useState<ServiceImageUploadState>({
      error: null,
      message: null,
      status: "idle",
    });
  const isSaving =
    actionState.status === "saving" && actionState.serviceId === service.id;
  const hasChanges =
    categoryId !== service.service_category_id ||
    Number(basePrice) !== service.base_price ||
    Number(durationMinutes) !== service.estimated_duration_minutes ||
    imageUrl.trim() !== (service.image_url ?? "") ||
    status !== service.status;

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
      message: "อัปโหลดรูปแล้ว กดบันทึกบริการเพื่อใช้รูปนี้",
      status: "uploaded",
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(service, {
      base_price: Number(basePrice),
      estimated_duration_minutes: Number(durationMinutes),
      image_url: imageUrl.trim() || null,
      service_category_id: categoryId,
      status,
    });
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ServiceImagePreview
            imageUrl={service.image_url}
            label={`${service.name} image`}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
                {service.category?.name ?? "No category"}
              </p>
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                  service.status,
                )}`}
              >
                {formatServiceStatus(service.status)}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
              {service.name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {service.description ?? "-"}
            </p>
          </div>
        </div>

        <div className="text-sm text-[var(--muted)] lg:text-right">
          <p className="font-semibold text-[var(--foreground)]">
            {currencyFormatter.format(service.base_price)}
          </p>
          <p className="mt-1">{service.estimated_duration_minutes} min</p>
        </div>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_140px_160px_140px] md:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            หมวดบริการ
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
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
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              min={0}
              onChange={(event) => setBasePrice(event.target.value)}
              type="number"
              value={basePrice}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            เวลาประมาณ
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              min={1}
              onChange={(event) => setDurationMinutes(event.target.value)}
              type="number"
              value={durationMinutes}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            สถานะ
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
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

        <div className="grid gap-3 lg:grid-cols-[128px_minmax(0,1fr)_220px] lg:items-end">
          <ServiceImagePreview imageUrl={imageUrl} label={`${service.name} preview`} />

          <label className="text-sm font-semibold text-[var(--foreground)]">
            URL รูปบริการ
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://... หรืออัปโหลดรูปจากเครื่อง"
              value={imageUrl}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            อัปโหลดรูปบริการ
            <input
              accept="image/png,image/jpeg,image/webp"
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)]"
              disabled={imageUploadState.status === "uploading"}
              onChange={(event) => {
                void handleImageUpload(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
              type="file"
            />
          </label>
        </div>

        {imageUploadState.status === "uploading" ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            กำลังอัปโหลดรูปบริการ...
          </div>
        ) : null}

        {imageUploadState.status === "uploaded" ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]">
            {imageUploadState.message}
          </div>
        ) : null}

        {imageUploadState.status === "error" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
            {imageUploadState.error}
          </div>
        ) : null}

        <button
          className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!hasChanges || isSaving}
          type="submit"
        >
          {isSaving ? "กำลังบันทึก..." : "บันทึกบริการ"}
        </button>
      </form>

      {actionState.status === "error" &&
      actionState.serviceId === service.id ? (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {actionState.error}
        </p>
      ) : null}

      {actionState.status === "saved" &&
      actionState.serviceId === service.id ? (
        <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-[var(--brand-strong)]">
          {actionState.message}
        </p>
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
  const [actionState, setActionState] = useState<ActionState>({
    error: null,
    message: null,
    serviceId: null,
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
      services: loadState.services.map((currentService) =>
        currentService.id === service.id
          ? {
              ...currentService,
              base_price: data.base_price,
              estimated_duration_minutes: data.estimated_duration_minutes,
              image_url: data.image_url,
              service_category_id: data.service_category_id,
              category:
                loadState.categories.find(
                  (category) => category.id === data.service_category_id,
                ) ?? null,
              status: data.status,
              updated_at: data.updated_at,
            }
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              จัดการบริการ
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              จัดการราคา ระยะเวลาโดยประมาณ และสถานะบริการที่แสดงในหน้าจองของลูกค้า
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            หน้าแอดมิน
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดบริการ...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบ</p>
            <p className="mt-1">กรุณาเข้าสู่ระบบด้วยบัญชีแอดมิน</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่บัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
            <p className="mt-2">{loadState.access.reason}</p>
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {filteredServices.length} of {loadState.services.length}{" "}
                บริการ
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                บริการที่ปิดใช้งานจะไม่แสดงในหน้าจองบริการของลูกค้า
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
              <input
                className="min-h-10 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="ค้นหาบริการหรือหมวดบริการ"
                type="search"
                value={searchInput}
              />
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                {statusFilters.map((status) => (
                  <button
                    className={
                      statusFilter === status
                        ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                        : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                    }
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    type="button"
                  >
                    {formatServiceStatus(status)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredServices.length > 0 ? (
            <div className="mt-5 space-y-4">
              {filteredServices.map((service) => (
                <AdminServiceRow
                  actionState={actionState}
                  categories={loadState.categories}
                  key={service.id}
                  onSave={handleSaveService}
                  service={service}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบบริการที่ตรงกับตัวกรองปัจจุบัน
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
