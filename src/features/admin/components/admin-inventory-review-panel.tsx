"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  getAdminInventoryMovements,
  getAdminProducts,
  type AdminAccessResult,
  type AdminInventoryMovement,
  type AdminProduct,
} from "@/features/admin";
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

type StockFilter = "all" | "out" | "low" | "healthy" | "inactive";

type ReviewProduct = AdminProduct & {
  latestMovement: AdminInventoryMovement | null;
};

const stockFilters: { label: string; value: StockFilter }[] = [
  { label: "all", value: "all" },
  { label: "out", value: "out" },
  { label: "low", value: "low" },
  { label: "healthy", value: "healthy" },
  { label: "inactive", value: "inactive" },
];

const lowStockThreshold = 2;

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStockStatus(product: AdminProduct): StockFilter {
  if (product.status === "inactive") {
    return "inactive";
  }

  if (product.stock_quantity <= 0) {
    return "out";
  }

  if (product.stock_quantity <= lowStockThreshold) {
    return "low";
  }

  return "healthy";
}

function getStockStatusStyle(stockStatus: StockFilter) {
  if (stockStatus === "out") {
    return "bg-red-50 text-red-700";
  }

  if (stockStatus === "low") {
    return "bg-amber-50 text-amber-800";
  }

  if (stockStatus === "inactive") {
    return "bg-slate-100 text-slate-700";
  }

  return "bg-emerald-50 text-[var(--brand-strong)]";
}

function buildReviewProducts(
  products: AdminProduct[],
  movements: AdminInventoryMovement[],
) {
  const latestMovementByProductId = new Map<string, AdminInventoryMovement>();

  for (const movement of movements) {
    if (!latestMovementByProductId.has(movement.product_id)) {
      latestMovementByProductId.set(movement.product_id, movement);
    }
  }

  return products.map(
    (product) =>
      ({
        ...product,
        latestMovement: latestMovementByProductId.get(product.id) ?? null,
      }) satisfies ReviewProduct,
  );
}

function ReviewProductRow({ product }: { product: ReviewProduct }) {
  const stockStatus = getStockStatus(product);

  return (
    <tr className="border-b border-[var(--line)] align-top">
      <td className="px-4 py-3">
        <div className="font-semibold text-[var(--foreground)]">
          {product.name}
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          SKU {product.sku ?? "-"}
        </div>
      </td>
      <td className="px-4 py-3 text-[var(--muted)]">
        {product.category?.name ?? "-"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStockStatusStyle(
            stockStatus,
          )}`}
        >
          {stockStatus}
        </span>
      </td>
      <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
        {product.stock_quantity}
      </td>
      <td className="px-4 py-3 text-[var(--muted)]">
        {currencyFormatter.format(product.unit_price)}
      </td>
      <td className="px-4 py-3 text-[var(--muted)]">
        {product.latestMovement ? (
          <div>
            <div className="font-medium text-[var(--foreground)]">
              {product.latestMovement.movement_type} /{" "}
              {product.latestMovement.quantity}
            </div>
            <div className="mt-1 text-xs">
              {formatDateTime(product.latestMovement.created_at)}
            </div>
          </div>
        ) : (
          "-"
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-2">
          <Link
            className="min-h-9 rounded-md bg-[var(--brand)] px-3 py-2 text-center text-xs font-semibold text-white"
            href="/admin/inventory"
          >
            Stock in/out
          </Link>
          <Link
            className="min-h-9 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-center text-xs font-semibold text-[var(--muted)]"
            href="/admin/products"
          >
            Edit product
          </Link>
        </div>
      </td>
    </tr>
  );
}

export function AdminInventoryReviewPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    movements: null,
    products: null,
    status: "loading",
  });
  const [searchInput, setSearchInput] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadInventoryReview() {
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

      if (!isMounted) {
        return;
      }

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

      if (!isMounted) {
        return;
      }

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
        getAdminInventoryMovements(supabase, 200),
      ]);

      if (!isMounted) {
        return;
      }

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

    loadInventoryReview();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadInventoryReview();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const reviewProducts = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    return buildReviewProducts(loadState.products, loadState.movements);
  }, [loadState]);

  const summary = useMemo(() => {
    const activeProducts = reviewProducts.filter(
      (product) => product.status === "active",
    );

    return {
      activeCount: activeProducts.length,
      healthyCount: activeProducts.filter(
        (product) => getStockStatus(product) === "healthy",
      ).length,
      lowCount: activeProducts.filter(
        (product) => getStockStatus(product) === "low",
      ).length,
      outCount: activeProducts.filter(
        (product) => getStockStatus(product) === "out",
      ).length,
      totalStock: activeProducts.reduce(
        (total, product) => total + product.stock_quantity,
        0,
      ),
    };
  }, [reviewProducts]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchInput.trim().toLowerCase();

    return reviewProducts.filter((product) => {
      const stockStatus = getStockStatus(product);
      const matchesStockFilter =
        stockFilter === "all" || stockStatus === stockFilter;
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        (product.sku ?? "").toLowerCase().includes(normalizedSearch) ||
        (product.description ?? "").toLowerCase().includes(normalizedSearch) ||
        (product.category?.name ?? "").toLowerCase().includes(normalizedSearch);

      return matchesStockFilter && matchesSearch;
    });
  }, [reviewProducts, searchInput, stockFilter]);

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
              Inventory Review
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Review out-of-stock, low-stock, and healthy products before
              recording new stock movements.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/admin/inventory"
            >
              Record movement
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
            Loading inventory review...
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
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-lg border border-[var(--line)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--muted)]">
                Active products
              </p>
              <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                {summary.activeCount}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-5">
              <p className="text-sm font-semibold text-[var(--muted)]">
                Total stock
              </p>
              <p className="mt-2 text-3xl font-bold text-[var(--foreground)]">
                {summary.totalStock}
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-white p-5">
              <p className="text-sm font-semibold text-red-700">Out</p>
              <p className="mt-2 text-3xl font-bold text-red-700">
                {summary.outCount}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white p-5">
              <p className="text-sm font-semibold text-amber-800">Low</p>
              <p className="mt-2 text-3xl font-bold text-amber-800">
                {summary.lowCount}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-5">
              <p className="text-sm font-semibold text-[var(--brand-strong)]">
                Healthy
              </p>
              <p className="mt-2 text-3xl font-bold text-[var(--brand-strong)]">
                {summary.healthyCount}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {filteredProducts.length} of {reviewProducts.length} products
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Low stock means active product stock is {lowStockThreshold} or
                lower.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-3xl">
              <input
                className="min-h-10 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search product, SKU, or category"
                type="search"
                value={searchInput}
              />
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                {stockFilters.map((filter) => (
                  <button
                    className={
                      stockFilter === filter.value
                        ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                        : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                    }
                    key={filter.value}
                    onClick={() => setStockFilter(filter.value)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="mt-5 overflow-auto rounded-lg border border-[var(--line)] bg-white shadow-sm">
            {filteredProducts.length > 0 ? (
              <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                <thead className="border-b border-[var(--line)] bg-slate-50 text-[var(--foreground)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Stock status</th>
                    <th className="px-4 py-3 font-semibold">Stock</th>
                    <th className="px-4 py-3 font-semibold">Sale price</th>
                    <th className="px-4 py-3 font-semibold">Latest movement</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <ReviewProductRow key={product.id} product={product} />
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 text-sm leading-6 text-[var(--muted)]">
                No products match the current filters.
              </div>
            )}
          </section>
        </section>
      ) : null}
    </main>
  );
}
