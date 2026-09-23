"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { FormEvent, SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  createAdminProduct,
  getAdminProductCategories,
  getAdminProducts,
  updateAdminProduct,
  type AdminAccessResult,
  type AdminProduct,
  type AdminProductCategory,
  type AdminProductCreateInput,
  type AdminProductUpdateInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | {
      status: "loading";
      access: null;
      categories: null;
      products: null;
      error: null;
    }
  | {
      status: "signed-out";
      access: null;
      categories: null;
      products: null;
      error: null;
    }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      categories: null;
      products: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      categories: AdminProductCategory[];
      products: AdminProduct[];
      error: null;
    }
  | {
      status: "error";
      access: null;
      categories: null;
      products: null;
      error: string;
    };

type ActionState =
  | { status: "idle"; productId: null; error: null; message: null }
  | { status: "saving"; productId: string; error: null; message: null }
  | { status: "error"; productId: string; error: string; message: null }
  | { status: "saved"; productId: string; error: null; message: string };

type CreateState =
  | { status: "idle"; error: null; message: null }
  | { status: "creating"; error: null; message: null }
  | { status: "error"; error: string; message: null }
  | { status: "created"; error: null; message: string };

type ProductImageUploadState =
  | { status: "idle"; error: null; message: null }
  | { status: "uploading"; error: null; message: null }
  | { status: "uploaded"; error: null; message: string }
  | { status: "error"; error: string; message: null };

type StatusFilter = "all" | AdminProduct["status"];

const statusFilters: StatusFilter[] = ["all", "active", "inactive"];
const productImagesBucket = "product-images";
const productImagePlaceholder = "/product-placeholder.svg";
const lowStockThreshold = 2;

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function getStatusStyle(status: AdminProduct["status"]) {
  if (status === "active") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-[var(--surface-muted)] text-[var(--foreground)]";
}

function formatProductStatus(status: StatusFilter) {
  if (status === "active") {
    return "เปิดใช้งาน";
  }

  if (status === "inactive") {
    return "ปิดใช้งาน";
  }

  return "ทั้งหมด";
}

function validateProductInput(input: AdminProductUpdateInput) {
  if (!input.name.trim()) {
    return "กรุณากรอกชื่อสินค้า";
  }

  if (!input.product_category_id) {
    return "กรุณาเลือกหมวดสินค้า";
  }

  if (!Number.isFinite(input.unit_price) || input.unit_price < 0) {
    return "ราคาขายต้องเป็น 0 บาทขึ้นไป";
  }

  if (!Number.isFinite(input.cost_price) || input.cost_price < 0) {
    return "ต้นทุนต้องเป็น 0 บาทขึ้นไป";
  }

  return null;
}

function buildProductPayload({
  costPrice,
  description,
  imageUrl,
  name,
  productCategoryId,
  sku,
  status,
  unitPrice,
}: {
  costPrice: string;
  description: string;
  imageUrl: string;
  name: string;
  productCategoryId: string;
  sku: string;
  status: AdminProduct["status"];
  unitPrice: string;
}): AdminProductUpdateInput {
  return {
    cost_price: Number(costPrice),
    description: description.trim() || null,
    image_url: imageUrl.trim() || null,
    name: name.trim(),
    product_category_id: productCategoryId,
    sku: sku.trim() || null,
    status,
    unit_price: Number(unitPrice),
  };
}

function getSafeProductImageExtension(file: File) {
  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function handleProductImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;

  if (image.src.endsWith(productImagePlaceholder)) {
    return;
  }

  image.src = productImagePlaceholder;
  image.alt = "รูปสินค้าเริ่มต้น";
}

async function uploadProductImage(file: File) {
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
      error: "ไฟล์รูปสินค้าต้องไม่เกิน 2 MB",
      publicUrl: null,
    };
  }

  const extension = getSafeProductImageExtension(file);
  const uploadPath = `products/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const supabase = createClient();
  const uploadResult = await supabase.storage
    .from(productImagesBucket)
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
          ? "ยังไม่มี bucket product-images กรุณารันไฟล์ supabase/product-image-upload.sql ก่อน"
          : uploadResult.error.message,
      publicUrl: null,
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(productImagesBucket).getPublicUrl(uploadPath);

  return {
    error: null,
    publicUrl,
  };
}

function ProductImagePreview({
  imageUrl,
  label,
  size = "md",
}: {
  imageUrl: string | null;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <img
      alt={label}
      className={
        size === "sm"
          ? "h-12 w-12 shrink-0 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] object-cover"
          : "h-24 w-24 shrink-0 rounded-md border border-[var(--line)] bg-[var(--surface-muted)] object-cover"
      }
      onError={handleProductImageError}
      src={imageUrl || productImagePlaceholder}
    />
  );
}

function ProductFormFields({
  categories,
  costPrice,
  description,
  imageUploadState,
  imageUrl,
  name,
  onImageUpload,
  productCategoryId,
  setCostPrice,
  setDescription,
  setImageUrl,
  setName,
  setProductCategoryId,
  setSku,
  setStatus,
  setUnitPrice,
  sku,
  status,
  unitPrice,
}: {
  categories: AdminProductCategory[];
  costPrice: string;
  description: string;
  imageUploadState: ProductImageUploadState;
  imageUrl: string;
  name: string;
  onImageUpload: (file: File | null) => void;
  productCategoryId: string;
  setCostPrice: (value: string) => void;
  setDescription: (value: string) => void;
  setImageUrl: (value: string) => void;
  setName: (value: string) => void;
  setProductCategoryId: (value: string) => void;
  setSku: (value: string) => void;
  setStatus: (value: AdminProduct["status"]) => void;
  setUnitPrice: (value: string) => void;
  sku: string;
  status: AdminProduct["status"];
  unitPrice: string;
}) {
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_150px_150px_140px] lg:items-end">
        <label className="text-sm font-semibold text-[var(--foreground)]">
          ชื่อสินค้า
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          หมวดสินค้า
          <select
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setProductCategoryId(event.target.value)}
            value={productCategoryId}
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
          ราคาขาย
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            min={0}
            onChange={(event) => setUnitPrice(event.target.value)}
            step="0.01"
            type="number"
            value={unitPrice}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          ต้นทุน
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            min={0}
            onChange={(event) => setCostPrice(event.target.value)}
            step="0.01"
            type="number"
            value={costPrice}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          สถานะ
          <select
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) =>
              setStatus(event.target.value as AdminProduct["status"])
            }
            value={status}
          >
            <option value="active">เปิดใช้งาน</option>
            <option value="inactive">ปิดใช้งาน</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <label className="text-sm font-semibold text-[var(--foreground)]">
          SKU
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setSku(event.target.value)}
            value={sku}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          รายละเอียด
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-[96px_minmax(0,1fr)_220px] lg:items-end">
        <ProductImagePreview imageUrl={imageUrl} label={`ตัวอย่างรูป ${name}`} />

        <label className="text-sm font-semibold text-[var(--foreground)]">
          URL รูปสินค้า
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://... หรืออัปโหลดรูปจากเครื่อง"
            value={imageUrl}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          อัปโหลดรูปสินค้า
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
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
          กำลังอัปโหลดรูปสินค้า...
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
    </>
  );
}

function AddProductForm({
  categories,
  createState,
  onCreate,
}: {
  categories: AdminProductCategory[];
  createState: CreateState;
  onCreate: (input: AdminProductCreateInput) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sku, setSku] = useState("");
  const [productCategoryId, setProductCategoryId] = useState(
    categories[0]?.id ?? "",
  );
  const [unitPrice, setUnitPrice] = useState("0");
  const [costPrice, setCostPrice] = useState("0");
  const [status, setStatus] = useState<AdminProduct["status"]>("active");
  const [imageUploadState, setImageUploadState] =
    useState<ProductImageUploadState>({
      error: null,
      message: null,
      status: "idle",
    });
  const isCreating = createState.status === "creating";

  async function handleImageUpload(file: File | null) {
    if (!file) {
      return;
    }

    setImageUploadState({
      error: null,
      message: null,
      status: "uploading",
    });

    const result = await uploadProductImage(file);

    if (result.error || !result.publicUrl) {
      setImageUploadState({
        error: result.error ?? "อัปโหลดรูปสินค้าไม่สำเร็จ",
        message: null,
        status: "error",
      });
      return;
    }

    setImageUrl(result.publicUrl);
    setImageUploadState({
      error: null,
      message: "อัปโหลดรูปแล้ว กดเพิ่มสินค้าเพื่อบันทึกสินค้า",
      status: "uploaded",
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate(
      buildProductPayload({
        costPrice,
        description,
        imageUrl,
        name,
        productCategoryId,
        sku,
        status,
        unitPrice,
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
        + เพิ่มสินค้า
      </button>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between border-b border-[var(--line)] pb-4">
        <div>
          <p className="text-sm font-semibold text-[var(--brand)]">เพิ่มสินค้า</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            สินค้าใหม่จะเริ่มต้นที่สต๊อก 0 รายการ การเพิ่มหรือลดสต๊อกให้ทำจากหน้าคลังสินค้า
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
        <ProductFormFields
          categories={categories}
          costPrice={costPrice}
          description={description}
          imageUploadState={imageUploadState}
          imageUrl={imageUrl}
          name={name}
          onImageUpload={handleImageUpload}
          productCategoryId={productCategoryId}
          setCostPrice={setCostPrice}
          setDescription={setDescription}
          setImageUrl={setImageUrl}
          setName={setName}
          setProductCategoryId={setProductCategoryId}
          setSku={setSku}
          setStatus={setStatus}
          setUnitPrice={setUnitPrice}
          sku={sku}
          status={status}
          unitPrice={unitPrice}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating || categories.length === 0}
            type="submit"
          >
            {isCreating ? "กำลังเพิ่ม..." : "เพิ่มสินค้า"}
          </button>

          {createState.status === "error" ? (
            <p className="text-sm text-[var(--danger)]">{createState.error}</p>
          ) : null}

          {createState.status === "created" ? (
            <p className="text-sm font-semibold text-emerald-400">
              {createState.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function AdminProductRow({
  actionState,
  categories,
  isExpanded,
  onSave,
  onToggle,
  product,
}: {
  actionState: ActionState;
  categories: AdminProductCategory[];
  isExpanded: boolean;
  onSave: (product: AdminProduct, input: AdminProductUpdateInput) => void;
  onToggle: () => void;
  product: AdminProduct;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [imageUrl, setImageUrl] = useState(product.image_url ?? "");
  const [sku, setSku] = useState(product.sku ?? "");
  const [productCategoryId, setProductCategoryId] = useState(
    product.product_category_id,
  );
  const [unitPrice, setUnitPrice] = useState(String(product.unit_price));
  const [costPrice, setCostPrice] = useState(String(product.cost_price));
  const [status, setStatus] = useState<AdminProduct["status"]>(product.status);
  const [imageUploadState, setImageUploadState] =
    useState<ProductImageUploadState>({
      error: null,
      message: null,
      status: "idle",
    });
  const isSaving =
    actionState.status === "saving" && actionState.productId === product.id;
  const hasChanges =
    name.trim() !== product.name ||
    description.trim() !== (product.description ?? "") ||
    imageUrl.trim() !== (product.image_url ?? "") ||
    sku.trim() !== (product.sku ?? "") ||
    productCategoryId !== product.product_category_id ||
    Number(unitPrice) !== product.unit_price ||
    Number(costPrice) !== product.cost_price ||
    status !== product.status;
  const isLowStock = product.stock_quantity <= lowStockThreshold;

  async function handleImageUpload(file: File | null) {
    if (!file) {
      return;
    }

    setImageUploadState({
      error: null,
      message: null,
      status: "uploading",
    });

    const result = await uploadProductImage(file);

    if (result.error || !result.publicUrl) {
      setImageUploadState({
        error: result.error ?? "อัปโหลดรูปสินค้าไม่สำเร็จ",
        message: null,
        status: "error",
      });
      return;
    }

    setImageUrl(result.publicUrl);
    setImageUploadState({
      error: null,
      message: "อัปโหลดรูปแล้ว กดบันทึกสินค้าเพื่อใช้รูปนี้",
      status: "uploaded",
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(
      product,
      buildProductPayload({
        costPrice,
        description,
        imageUrl,
        name,
        productCategoryId,
        sku,
        status,
        unitPrice,
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
        <ProductImagePreview
          imageUrl={product.image_url}
          label={`รูปสินค้า ${product.name}`}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-[var(--foreground)]">
              {product.name}
            </h2>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${getStatusStyle(product.status)}`}
            >
              {formatProductStatus(product.status)}
            </span>
            {isLowStock ? (
              <span className="shrink-0 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                สต๊อกใกล้หมด
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">
            {product.category?.name ?? "ยังไม่มีหมวดสินค้า"} · SKU{" "}
            {product.sku ?? "-"}
          </p>
        </div>
        <div className="hidden shrink-0 gap-4 text-right text-sm sm:flex">
          <div>
            <p className="text-xs text-[var(--muted)]">ราคาขาย</p>
            <p className="font-semibold text-[var(--foreground)]">
              {currencyFormatter.format(product.unit_price)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">สต๊อก</p>
            <p className="font-semibold text-[var(--foreground)]">
              {product.stock_quantity}
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
          <ProductFormFields
            categories={categories}
            costPrice={costPrice}
            description={description}
            imageUploadState={imageUploadState}
            imageUrl={imageUrl}
            name={name}
            onImageUpload={handleImageUpload}
            productCategoryId={productCategoryId}
            setCostPrice={setCostPrice}
            setDescription={setDescription}
            setImageUrl={setImageUrl}
            setName={setName}
            setProductCategoryId={setProductCategoryId}
            setSku={setSku}
            setStatus={setStatus}
            setUnitPrice={setUnitPrice}
            sku={sku}
            status={status}
            unitPrice={unitPrice}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!hasChanges || isSaving}
              type="submit"
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึกสินค้า"}
            </button>

            <p className="text-xs text-[var(--muted)]">
              สต๊อกปัจจุบัน {product.stock_quantity} ชิ้น · ปรับสต๊อกได้ที่หน้าคลังสินค้า
            </p>
          </div>

          {actionState.status === "error" &&
          actionState.productId === product.id ? (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {actionState.error}
            </p>
          ) : null}

          {actionState.status === "saved" &&
          actionState.productId === product.id ? (
            <p className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-[var(--brand-strong)]">
              {actionState.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </article>
  );
}

export function AdminProductsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    categories: null,
    error: null,
    products: null,
    status: "loading",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null,
  );
  const [actionState, setActionState] = useState<ActionState>({
    error: null,
    message: null,
    productId: null,
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

    async function loadProducts() {
      setLoadState({
        access: null,
        categories: null,
        error: null,
        products: null,
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
          products: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          categories: null,
          error: null,
          products: null,
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
          products: null,
          status: "access-denied",
        });
        return;
      }

      const [productsResult, categoriesResult] = await Promise.all([
        getAdminProducts(supabase),
        getAdminProductCategories(supabase),
      ]);

      if (!isMounted) {
        return;
      }

      if (productsResult.error) {
        setLoadState({
          access: null,
          categories: null,
          error: productsResult.error.message,
          products: null,
          status: "error",
        });
        return;
      }

      if (categoriesResult.error) {
        setLoadState({
          access: null,
          categories: null,
          error: categoriesResult.error.message,
          products: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        categories: categoriesResult.data ?? [],
        error: null,
        products: productsResult.data ?? [],
        status: "ready",
      });
    }

    loadProducts();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadProducts();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    const normalizedSearch = searchInput.trim().toLowerCase();

    return loadState.products.filter((product) => {
      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        (product.description ?? "").toLowerCase().includes(normalizedSearch) ||
        (product.sku ?? "").toLowerCase().includes(normalizedSearch) ||
        (product.category?.name ?? "").toLowerCase().includes(normalizedSearch);

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

    for (const product of loadState.products) {
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        (product.description ?? "").toLowerCase().includes(normalizedSearch) ||
        (product.sku ?? "").toLowerCase().includes(normalizedSearch) ||
        (product.category?.name ?? "").toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        continue;
      }

      counts.set("all", (counts.get("all") ?? 0) + 1);
      counts.set(product.status, (counts.get(product.status) ?? 0) + 1);
    }

    return counts;
  }, [loadState, searchInput]);

  const lowStockProducts = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    return loadState.products.filter(
      (product) => product.stock_quantity <= lowStockThreshold,
    );
  }, [loadState]);

  async function handleCreateProduct(input: AdminProductCreateInput) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateProductInput(input);

    if (validationError) {
      setCreateState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    const duplicateSku =
      input.sku &&
      loadState.products.find(
        (product) =>
          product.sku?.toLowerCase() === input.sku?.toLowerCase(),
      );

    if (duplicateSku) {
      setCreateState({
        error: "SKU นี้มีอยู่แล้ว",
        message: null,
        status: "error",
      });
      return;
    }

    setCreateState({
      error: null,
      message: null,
      status: "creating",
    });

    const supabase = createClient();
    const { data, error } = await createAdminProduct(supabase, input);

    if (error) {
      setCreateState({
        error: error.message,
        message: null,
        status: "error",
      });
      return;
    }

    const nextProduct = {
      ...data,
      category:
        loadState.categories.find(
          (category) => category.id === data.product_category_id,
        ) ?? null,
    } satisfies AdminProduct;

    setLoadState({
      ...loadState,
      products: [...loadState.products, nextProduct].sort((a, b) =>
        a.name.localeCompare(b.name, "th"),
      ),
    });
    setCreateState({
      error: null,
      message: "เพิ่มสินค้าเรียบร้อยแล้ว",
      status: "created",
    });
  }

  async function handleSaveProduct(
    product: AdminProduct,
    input: AdminProductUpdateInput,
  ) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateProductInput(input);

    if (validationError) {
      setActionState({
        error: validationError,
        message: null,
        productId: product.id,
        status: "error",
      });
      return;
    }

    const duplicateSku =
      input.sku &&
      loadState.products.find(
        (currentProduct) =>
          currentProduct.id !== product.id &&
          currentProduct.sku?.toLowerCase() === input.sku?.toLowerCase(),
      );

    if (duplicateSku) {
      setActionState({
        error: "SKU นี้มีอยู่แล้ว",
        message: null,
        productId: product.id,
        status: "error",
      });
      return;
    }

    setActionState({
      error: null,
      message: null,
      productId: product.id,
      status: "saving",
    });

    const supabase = createClient();
    const { data, error } = await updateAdminProduct(
      supabase,
      product.id,
      input,
    );

    if (error) {
      setActionState({
        error: error.message,
        message: null,
        productId: product.id,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      products: loadState.products.map((currentProduct) =>
        currentProduct.id === product.id
          ? {
              ...data,
              category:
                loadState.categories.find(
                  (category) => category.id === data.product_category_id,
                ) ?? null,
            }
          : currentProduct,
      ),
    });
    setActionState({
      error: null,
      message: "บันทึกสินค้าเรียบร้อยแล้ว",
      productId: product.id,
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
              จัดการสินค้า
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              จัดการรายละเอียดสินค้า SKU ราคา ต้นทุน สถานะการขาย และจำนวนสต๊อกปัจจุบัน
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/admin/inventory"
            >
              จัดการคลังสินค้า
            </Link>
            <Link
              className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin/inventory-review"
            >
              ตรวจสต๊อก
            </Link>
            <Link
              className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin/product-categories"
            >
              หมวดสินค้า
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
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดสินค้า...
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
          <div className="max-w-xl rounded-lg border border-red-200 bg-[var(--surface)] px-5 py-4 text-sm text-[var(--danger)] shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          <AddProductForm
            categories={loadState.categories}
            createState={createState}
            key={`${loadState.categories.length}-${loadState.products.length}`}
            onCreate={handleCreateProduct}
          />

          <div className="mt-5 flex divide-x divide-[var(--line)] overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-sm">
            <div className="min-w-[8rem] flex-1 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                สินค้าทั้งหมด
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {loadState.products.length}
              </p>
            </div>
            <div className="min-w-[8rem] flex-1 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                สินค้าที่เปิดขาย
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {
                  loadState.products.filter(
                    (product) => product.status === "active",
                  ).length
                }
              </p>
            </div>
            <div className="min-w-[8rem] flex-1 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                สต๊อกใกล้หมด
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {lowStockProducts.length}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 border-b border-[var(--line)] pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {filteredProducts.length} จาก {loadState.products.length} รายการ
              </p>

              <input
                className="min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] lg:w-80"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="ค้นหาสินค้า SKU หรือหมวดสินค้า"
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
                    {formatProductStatus(status)}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                    {statusCounts.get(status) ?? 0}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="mt-5 space-y-3">
              {filteredProducts.map((product) => (
                <AdminProductRow
                  actionState={actionState}
                  categories={loadState.categories}
                  isExpanded={expandedProductId === product.id}
                  key={product.id}
                  onSave={handleSaveProduct}
                  onToggle={() =>
                    setExpandedProductId((current) =>
                      current === product.id ? null : product.id,
                    )
                  }
                  product={product}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบสินค้าที่ตรงกับตัวกรองปัจจุบัน
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
