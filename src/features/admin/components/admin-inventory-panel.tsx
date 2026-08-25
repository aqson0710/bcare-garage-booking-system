"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  createAdminInventoryMovement,
  getAdminInventoryMovements,
  getAdminProducts,
  type AdminAccessResult,
  type AdminInventoryMovement,
  type AdminInventoryMovementCreateInput,
  type AdminProduct,
} from "@/features/admin";
import { ProductImageThumb } from "@/features/products/components/product-image-thumb";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | {
      status: "loading";
      access: null;
      movements: null;
      products: null;
      error: null;
    }
  | {
      status: "signed-out";
      access: null;
      movements: null;
      products: null;
      error: null;
    }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      movements: null;
      products: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      movements: AdminInventoryMovement[];
      products: AdminProduct[];
      error: null;
    }
  | {
      status: "error";
      access: null;
      movements: null;
      products: null;
      error: string;
    };

type CreateState =
  | { status: "idle"; error: null; message: null }
  | { status: "saving"; error: null; message: null }
  | { status: "error"; error: string; message: null }
  | { status: "saved"; error: null; message: string };

type MovementType = AdminInventoryMovement["movement_type"];

const movementOptions: { label: string; value: MovementType }[] = [
  { label: "Stock in", value: "stock_in" },
  { label: "Stock out", value: "stock_out" },
  { label: "Adjustment in", value: "adjustment_in" },
  { label: "Adjustment out", value: "adjustment_out" },
  { label: "Repair usage", value: "repair_usage" },
  { label: "Return", value: "return" },
];

const stockIncreasingMovements: MovementType[] = [
  "stock_in",
  "adjustment_in",
  "return",
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getMovementDelta(movement: AdminInventoryMovement) {
  return stockIncreasingMovements.includes(movement.movement_type)
    ? movement.quantity
    : -movement.quantity;
}

function getMovementStyle(movementType: MovementType) {
  if (stockIncreasingMovements.includes(movementType)) {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-amber-50 text-amber-800";
}

function getProductLabel(product: AdminProduct) {
  return `${product.name}${product.sku ? ` (${product.sku})` : ""}`;
}

function validateMovementInput(
  input: AdminInventoryMovementCreateInput,
  products: AdminProduct[],
) {
  if (!input.product_id) {
    return "Product is required.";
  }

  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return "Quantity must be at least 1.";
  }

  const product = products.find(
    (currentProduct) => currentProduct.id === input.product_id,
  );

  if (!product) {
    return "Selected product was not found.";
  }

  const isStockOut = !stockIncreasingMovements.includes(input.movement_type);

  if (isStockOut && input.quantity > product.stock_quantity) {
    return "Quantity is greater than current stock.";
  }

  return null;
}

function MovementForm({
  createState,
  onCreate,
  products,
}: {
  createState: CreateState;
  onCreate: (input: AdminInventoryMovementCreateInput) => void;
  products: AdminProduct[];
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [movementType, setMovementType] = useState<MovementType>("stock_in");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const selectedProduct = products.find((product) => product.id === productId);
  const isSaving = createState.status === "saving";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      movement_type: movementType,
      note: note.trim() || null,
      product_id: productId,
      quantity: Number(quantity),
    });
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="border-b border-[var(--line)] pb-4">
        <p className="text-sm font-semibold text-[var(--brand)]">
          Record inventory movement
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          Each movement creates a history row and updates product stock through
          the database trigger.
        </p>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_140px] lg:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            Product
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setProductId(event.target.value)}
              value={productId}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {getProductLabel(product)} / stock {product.stock_quantity}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Movement type
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) =>
                setMovementType(event.target.value as MovementType)
              }
              value={movementType}
            >
              {movementOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            Quantity
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              min={1}
              onChange={(event) => setQuantity(event.target.value)}
              type="number"
              value={quantity}
            />
          </label>
        </div>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          Note
          <textarea
            className="mt-2 min-h-20 w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--muted)]">
            {selectedProduct ? (
              <span>
                Current stock:{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {selectedProduct.stock_quantity}
                </span>
              </span>
            ) : (
              <span>No product selected.</span>
            )}
          </div>

          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving || products.length === 0}
            type="submit"
          >
            {isSaving ? "Saving..." : "Record movement"}
          </button>
        </div>

        {createState.status === "error" ? (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {createState.error}
          </p>
        ) : null}

        {createState.status === "saved" ? (
          <p className="rounded-md bg-emerald-50 p-3 text-sm font-semibold text-[var(--brand-strong)]">
            {createState.message}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function MovementRow({ movement }: { movement: AdminInventoryMovement }) {
  const delta = getMovementDelta(movement);

  return (
    <tr className="border-b border-[var(--line)]">
      <td className="px-4 py-3 text-[var(--foreground)]">
        {formatDateTime(movement.created_at)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <ProductImageThumb
            alt={`รูปสินค้า ${movement.product?.name ?? "สินค้า"}`}
            size="sm"
            src={movement.product?.image_url}
          />
          <div>
            <div className="font-semibold text-[var(--foreground)]">
              {movement.product?.name ?? "Product not found"}
            </div>
            <div className="text-xs text-[var(--muted)]">
              SKU {movement.product?.sku ?? "-"}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getMovementStyle(
            movement.movement_type,
          )}`}
        >
          {movement.movement_type}
        </span>
      </td>
      <td
        className={
          delta >= 0
            ? "px-4 py-3 font-semibold text-[var(--brand-strong)]"
            : "px-4 py-3 font-semibold text-amber-800"
        }
      >
        {delta >= 0 ? "+" : ""}
        {delta}
      </td>
      <td className="px-4 py-3 text-[var(--muted)]">
        {movement.note ?? "-"}
      </td>
      <td className="px-4 py-3 text-[var(--muted)]">
        {movement.createdBy?.full_name ?? "-"}
      </td>
    </tr>
  );
}

export function AdminInventoryPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    movements: null,
    products: null,
    status: "loading",
  });
  const [createState, setCreateState] = useState<CreateState>({
    error: null,
    message: null,
    status: "idle",
  });

  async function loadInventory() {
    const supabase = createClient();
    setLoadState({
      access: null,
      error: null,
      movements: null,
      products: null,
      status: "loading",
    });

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      setLoadState({
        access: null,
        error: sessionError.message,
        movements: null,
        products: null,
        status: "error",
      });
      return;
    }

    if (!session?.user) {
      setLoadState({
        access: null,
        error: null,
        movements: null,
        products: null,
        status: "signed-out",
      });
      return;
    }

    const access = await checkAdminAccess(supabase, session.user.id);

    if (!access.allowed) {
      setLoadState({
        access,
        error: null,
        movements: null,
        products: null,
        status: "access-denied",
      });
      return;
    }

    const [productsResult, movementsResult] = await Promise.all([
      getAdminProducts(supabase),
      getAdminInventoryMovements(supabase, 80),
    ]);

    if (productsResult.error) {
      setLoadState({
        access: null,
        error: productsResult.error.message,
        movements: null,
        products: null,
        status: "error",
      });
      return;
    }

    if (movementsResult.error) {
      setLoadState({
        access: null,
        error: movementsResult.error.message,
        movements: null,
        products: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      access,
      error: null,
      movements: movementsResult.data ?? [],
      products: productsResult.data ?? [],
      status: "ready",
    });
  }

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadWhenMounted() {
      await loadInventory();
    }

    if (isMounted) {
      loadWhenMounted();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadWhenMounted();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const stockSummary = useMemo(() => {
    if (loadState.status !== "ready") {
      return {
        lowStockCount: 0,
        totalStock: 0,
      };
    }

    return {
      lowStockCount: loadState.products.filter(
        (product) => product.stock_quantity <= 2,
      ).length,
      totalStock: loadState.products.reduce(
        (total, product) => total + product.stock_quantity,
        0,
      ),
    };
  }, [loadState]);

  async function handleCreateMovement(input: AdminInventoryMovementCreateInput) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateMovementInput(input, loadState.products);

    if (validationError) {
      setCreateState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    setCreateState({
      error: null,
      message: null,
      status: "saving",
    });

    const supabase = createClient();
    const { error } = await createAdminInventoryMovement(supabase, input);

    if (error) {
      setCreateState({
        error: error.message,
        message: null,
        status: "error",
      });
      return;
    }

    await loadInventory();
    setCreateState({
      error: null,
      message: "Inventory movement saved successfully.",
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
              Admin Inventory
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Record stock in, stock out, adjustments, repair usage, and
              returns with a full movement history.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/admin/inventory-review"
            >
              Review stock
            </Link>
            <Link
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin/products"
            >
              Manage products
            </Link>
          </div>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            Loading inventory...
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
          <MovementForm
            createState={createState}
            onCreate={handleCreateMovement}
            products={loadState.products}
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
                Total stock
              </p>
              <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                {stockSummary.totalStock}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--muted)]">
                Low stock
              </p>
              <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                {stockSummary.lowStockCount}
              </p>
            </div>
          </div>

          <section className="mt-5 rounded-lg border border-[var(--line)] bg-white shadow-sm">
            <div className="border-b border-[var(--line)] p-5">
              <h2 className="text-xl font-bold text-[var(--foreground)]">
                Recent inventory movements
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Latest stock changes across all products.
              </p>
            </div>

            {loadState.movements.length > 0 ? (
              <div className="overflow-auto">
                <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                  <thead className="border-b border-[var(--line)] bg-slate-50 text-[var(--foreground)]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Quantity</th>
                      <th className="px-4 py-3 font-semibold">Note</th>
                      <th className="px-4 py-3 font-semibold">Created by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadState.movements.map((movement) => (
                      <MovementRow key={movement.id} movement={movement} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-sm leading-6 text-[var(--muted)]">
                No inventory movements yet.
              </div>
            )}
          </section>
        </section>
      ) : null}
    </main>
  );
}
