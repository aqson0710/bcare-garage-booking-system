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

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function getStatusStyle(status: AdminProduct["status"]) {
  if (status === "active") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-slate-100 text-slate-700";
}

function validateProductInput(input: AdminProductUpdateInput) {
  if (!input.name.trim()) {
    return "Product name is required.";
  }

  if (!input.product_category_id) {
    return "Category is required.";
  }

  if (!Number.isFinite(input.unit_price) || input.unit_price < 0) {
    return "Sale price must be 0 or more.";
  }

  if (!Number.isFinite(input.cost_price) || input.cost_price < 0) {
    return "Cost price must be 0 or more.";
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
  image.alt = "Product image placeholder";
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
}: {
  imageUrl: string | null;
  label: string;
}) {
  return (
    <img
      alt={label}
      className="h-24 w-24 rounded-md border border-[var(--line)] bg-slate-50 object-cover"
      onError={handleProductImageError}
      src={imageUrl || productImagePlaceholder}
    />
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
      message: "อัปโหลดรูปแล้ว กด Add product เพื่อบันทึกสินค้า",
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

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="border-b border-[var(--line)] pb-4">
        <p className="text-sm font-semibold text-[var(--brand)]">Add product</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          New products start with 0 stock. Stock in/out adjustments will be
          handled from inventory movements in the next part.
        </p>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_150px_150px_140px] lg:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Product name
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Category
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setProductCategoryId(event.target.value)}
              value={productCategoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.status === "inactive" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Sale price
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              min={0}
              onChange={(event) => setUnitPrice(event.target.value)}
              step="0.01"
              type="number"
              value={unitPrice}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Cost price
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              min={0}
              onChange={(event) => setCostPrice(event.target.value)}
              step="0.01"
              type="number"
              value={costPrice}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Status
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) =>
                setStatus(event.target.value as AdminProduct["status"])
              }
              value={status}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            SKU
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setSku(event.target.value)}
              value={sku}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Description
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </label>
        </div>

        <div className="grid gap-3 lg:grid-cols-[96px_minmax(0,1fr)_220px] lg:items-end">
          <ProductImagePreview imageUrl={imageUrl} label="New product preview" />

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Product image URL
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://... หรืออัปโหลดรูปจากเครื่อง"
              value={imageUrl}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Upload image
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating || categories.length === 0}
            type="submit"
          >
            {isCreating ? "Adding..." : "Add product"}
          </button>

          {createState.status === "error" ? (
            <p className="text-sm text-red-700">{createState.error}</p>
          ) : null}

          {createState.status === "created" ? (
            <p className="text-sm font-semibold text-[var(--brand-strong)]">
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
  onSave,
  product,
}: {
  actionState: ActionState;
  categories: AdminProductCategory[];
  onSave: (product: AdminProduct, input: AdminProductUpdateInput) => void;
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
      message: "อัปโหลดรูปแล้ว กด Save product เพื่อใช้รูปนี้",
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
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ProductImagePreview
            imageUrl={product.image_url}
            label={`${product.name} image`}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
                {product.category?.name ?? "No category"}
              </p>
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                  product.status,
                )}`}
              >
                {product.status}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
              {product.name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {product.description ?? "-"}
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              SKU: {product.sku ?? "-"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm lg:min-w-[360px]">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs text-[var(--muted)]">Sale</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {currencyFormatter.format(product.unit_price)}
            </p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs text-[var(--muted)]">Cost</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {currencyFormatter.format(product.cost_price)}
            </p>
          </div>
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-xs text-[var(--muted)]">Stock</p>
            <p className="mt-1 font-semibold text-[var(--foreground)]">
              {product.stock_quantity}
            </p>
          </div>
        </div>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_150px_150px_140px] lg:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Product name
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Category
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setProductCategoryId(event.target.value)}
              value={productCategoryId}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.status === "inactive" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Sale price
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              min={0}
              onChange={(event) => setUnitPrice(event.target.value)}
              step="0.01"
              type="number"
              value={unitPrice}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Cost price
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              min={0}
              onChange={(event) => setCostPrice(event.target.value)}
              step="0.01"
              type="number"
              value={costPrice}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Status
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) =>
                setStatus(event.target.value as AdminProduct["status"])
              }
              value={status}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 lg:grid-cols-[96px_minmax(0,1fr)_220px] lg:items-end">
          <ProductImagePreview imageUrl={imageUrl} label={`${name} preview`} />

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Product image URL
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://... หรืออัปโหลดรูปจากเครื่อง"
              value={imageUrl}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Upload image
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

        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_160px] lg:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            SKU
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setSku(event.target.value)}
              value={sku}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Description
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
          </label>

          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!hasChanges || isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save product"}
          </button>
        </div>
      </form>

      {actionState.status === "error" &&
      actionState.productId === product.id ? (
        <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {actionState.error}
        </p>
      ) : null}

      {actionState.status === "saved" &&
      actionState.productId === product.id ? (
        <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-semibold text-[var(--brand-strong)]">
          {actionState.message}
        </p>
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

  const lowStockProducts = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    return loadState.products.filter((product) => product.stock_quantity <= 2);
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
        error: "This SKU already exists.",
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
      message: "Product added successfully.",
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
        error: "This SKU already exists.",
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
      message: "Product saved successfully.",
      productId: product.id,
      status: "saved",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
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
              Admin Products
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Manage product details, SKU, price, cost, visibility, and current
              stock count.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/admin/inventory"
            >
              Manage inventory
            </Link>
            <Link
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin/inventory-review"
            >
              Review stock
            </Link>
            <Link
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin/product-categories"
            >
              Product categories
            </Link>
            <Link
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin"
            >
              Admin home
            </Link>
          </div>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            Loading admin products...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">Login required</p>
            <p className="mt-1">Sign in with an admin account.</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              Go to account
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">Access denied</p>
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
          <AddProductForm
            categories={loadState.categories}
            createState={createState}
            key={`${loadState.categories.length}-${loadState.products.length}`}
            onCreate={handleCreateProduct}
          />

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--line)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--muted)]">
                Products
              </p>
              <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                {loadState.products.length}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--muted)]">
                Active products
              </p>
              <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                {
                  loadState.products.filter(
                    (product) => product.status === "active",
                  ).length
                }
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--muted)]">
                Low stock
              </p>
              <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                {lowStockProducts.length}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {filteredProducts.length} of {loadState.products.length}{" "}
                products
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Stock is shown here but changed through inventory movements.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
              <input
                className="min-h-10 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search product, SKU, or category"
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
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredProducts.length > 0 ? (
            <div className="mt-5 space-y-4">
              {filteredProducts.map((product) => (
                <AdminProductRow
                  actionState={actionState}
                  categories={loadState.categories}
                  key={product.id}
                  onSave={handleSaveProduct}
                  product={product}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              No products match the current filters.
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
