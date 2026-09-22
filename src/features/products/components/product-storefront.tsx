"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/browser";
import {
  addProductToCart,
  getCartSummary,
  getStorefrontProducts,
  type CartSummary,
  type ProductCategoryWithProducts,
  type ProductWithCategory,
} from "@/features/products";

type AuthState =
  | { status: "loading"; user: null; error: null }
  | { status: "signed-out"; user: null; error: null }
  | { status: "ready"; user: User; error: null }
  | { status: "error"; user: null; error: string };

type ProductsState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | {
      status: "ready";
      data: {
        categories: ProductCategoryWithProducts[];
        products: ProductWithCategory[];
        uncategorizedProducts: ProductWithCategory[];
      };
      error: null;
    }
  | { status: "error"; data: null; error: string };

type CartState =
  | { status: "idle"; summary: CartSummary; error: null }
  | { status: "loading"; summary: CartSummary; error: null }
  | { status: "ready"; summary: CartSummary; error: null }
  | { status: "error"; summary: CartSummary; error: string };

type AddToCartState =
  | { status: "idle"; productId: null; message: null }
  | { status: "adding"; productId: string; message: null }
  | { status: "success"; productId: string; message: string }
  | { status: "error"; productId: string; message: string };

type SortOption = "relevance" | "newest" | "price_asc" | "price_desc";

const pageSize = 20;

const emptyCartSummary: CartSummary = {
  cart: null,
  itemCount: 0,
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});
const productImagePlaceholder = "/product-placeholder.svg";

function handleProductImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;

  if (image.src.endsWith(productImagePlaceholder)) {
    return;
  }

  image.src = productImagePlaceholder;
  image.alt = "ภาพสินค้าเริ่มต้น";
}

function getStockInfo(product: ProductWithCategory) {
  if (product.stock_quantity <= 0) {
    return { dotClassName: "bg-red-500", label: "หมดสต๊อก" };
  }

  if (product.stock_quantity <= 2) {
    return {
      dotClassName: "bg-amber-500",
      label: `เหลือน้อย · ${product.stock_quantity} ชิ้น`,
    };
  }

  return {
    dotClassName: "bg-emerald-500",
    label: `มีสินค้า · ${product.stock_quantity} ชิ้น`,
  };
}

function ProductCard({
  addToCartState,
  onAddToCart,
  product,
}: {
  addToCartState: AddToCartState;
  onAddToCart: (product: ProductWithCategory) => void;
  product: ProductWithCategory;
}) {
  const isAdding =
    addToCartState.status === "adding" && addToCartState.productId === product.id;
  const isOutOfStock = product.stock_quantity <= 0;
  const stockInfo = getStockInfo(product);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] transition-shadow hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--surface-muted)]">
        <img
          alt={`รูปสินค้า ${product.name}`}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          onError={handleProductImageError}
          src={product.image_url || productImagePlaceholder}
        />
        {isOutOfStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--foreground)]/90 px-2.5 py-1 text-xs font-semibold text-white">
            สินค้าหมด
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
            {product.category?.name ?? "ไม่มีหมวดสินค้า"}
          </p>
          <h3 className="mt-1 line-clamp-2 text-base font-bold leading-6 text-[var(--foreground)]">
            {product.name}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <span className={`h-1.5 w-1.5 rounded-full ${stockInfo.dotClassName}`} />
          {stockInfo.label}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          <p className="truncate text-lg font-bold text-[var(--foreground)] sm:text-xl">
            {currencyFormatter.format(product.unit_price)}
          </p>
          <button
            className="flex min-h-9 w-full items-center justify-center rounded-md bg-[var(--brand)] px-2 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:text-sm"
            disabled={isOutOfStock || isAdding}
            onClick={() => onAddToCart(product)}
            type="button"
          >
            {isOutOfStock ? "สินค้าหมด" : isAdding ? "กำลังเพิ่ม..." : "หยิบใส่ตะกร้า"}
          </button>
        </div>
      </div>
    </article>
  );
}

function FilterSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="border-b border-[var(--line)] py-4 first:pt-0 last:border-b-0 last:pb-0">
      <p className="text-sm font-bold text-[var(--foreground)]">{title}</p>
      <div className="mt-3 space-y-2.5">{children}</div>
    </div>
  );
}

function SortTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? "min-h-9 rounded-md bg-[var(--brand)] px-3 text-sm font-semibold text-white"
          : "min-h-9 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--brand)]"
      }
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function ProductStorefront() {
  const [authState, setAuthState] = useState<AuthState>({
    error: null,
    status: "loading",
    user: null,
  });
  const [productsState, setProductsState] = useState<ProductsState>({
    data: null,
    error: null,
    status: "idle",
  });
  const [cartState, setCartState] = useState<CartState>({
    error: null,
    status: "idle",
    summary: emptyCartSummary,
  });
  const [searchText, setSearchText] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceMinInput, setPriceMinInput] = useState("");
  const [priceMaxInput, setPriceMaxInput] = useState("");
  const [appliedPriceMin, setAppliedPriceMin] = useState<number | null>(null);
  const [appliedPriceMax, setAppliedPriceMax] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [currentPage, setCurrentPage] = useState(1);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [addToCartState, setAddToCartState] = useState<AddToCartState>({
    message: null,
    productId: null,
    status: "idle",
  });

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((current) => {
      const next = new Set(current);

      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }

      return next;
    });
  }

  function applyPriceRange() {
    const parsedMin = Number(priceMinInput);
    const parsedMax = Number(priceMaxInput);

    setAppliedPriceMin(
      priceMinInput.trim() && Number.isFinite(parsedMin) ? parsedMin : null,
    );
    setAppliedPriceMax(
      priceMaxInput.trim() && Number.isFinite(parsedMax) ? parsedMax : null,
    );
  }

  function clearAllFilters() {
    setSelectedCategoryIds(new Set());
    setInStockOnly(false);
    setPriceMinInput("");
    setPriceMaxInput("");
    setAppliedPriceMin(null);
    setAppliedPriceMax(null);
  }

  function togglePriceSort() {
    setSortBy((current) =>
      current === "price_asc" ? "price_desc" : "price_asc",
    );
  }

  const hasActiveFilters =
    selectedCategoryIds.size > 0 ||
    inStockOnly ||
    appliedPriceMin !== null ||
    appliedPriceMax !== null;

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadAuthState() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthState({ error: error.message, status: "error", user: null });
        return;
      }

      if (!session?.user) {
        setAuthState({ error: null, status: "signed-out", user: null });
        return;
      }

      setAuthState({ error: null, status: "ready", user: session.user });
    }

    loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAuthState();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      if (authState.status !== "ready") {
        setProductsState({ data: null, error: null, status: "idle" });
        return;
      }

      setProductsState({ data: null, error: null, status: "loading" });

      const supabase = createClient();
      const { data, error } = await getStorefrontProducts(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setProductsState({ data: null, error: error.message, status: "error" });
        return;
      }

      setProductsState({ data, error: null, status: "ready" });
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [authState.status]);

  useEffect(() => {
    let isMounted = true;

    async function loadCartSummary() {
      if (authState.status !== "ready") {
        setCartState({ error: null, status: "idle", summary: emptyCartSummary });
        return;
      }

      setCartState((currentState) => ({
        error: null,
        status: "loading",
        summary: currentState.summary,
      }));

      const supabase = createClient();
      const { data, error } = await getCartSummary(supabase, authState.user.id);

      if (!isMounted) {
        return;
      }

      if (error) {
        setCartState((currentState) => ({
          error: error.message,
          status: "error",
          summary: currentState.summary,
        }));
        return;
      }

      setCartState({ error: null, status: "ready", summary: data ?? emptyCartSummary });
    }

    loadCartSummary();

    return () => {
      isMounted = false;
    };
  }, [authState]);

  const categories = useMemo(
    () => productsState.data?.categories ?? [],
    [productsState.data],
  );
  const products = useMemo(
    () => productsState.data?.products ?? [],
    [productsState.data],
  );
  const visibleProducts = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const matchesCategory =
        selectedCategoryIds.size === 0 ||
        selectedCategoryIds.has(product.product_category_id);
      const matchesSearch =
        normalizedSearchText.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearchText) ||
        (product.description ?? "").toLowerCase().includes(normalizedSearchText) ||
        (product.sku ?? "").toLowerCase().includes(normalizedSearchText) ||
        (product.category?.name ?? "").toLowerCase().includes(normalizedSearchText);
      const matchesStock = !inStockOnly || product.stock_quantity > 0;
      const matchesMinPrice =
        appliedPriceMin === null || product.unit_price >= appliedPriceMin;
      const matchesMaxPrice =
        appliedPriceMax === null || product.unit_price <= appliedPriceMax;

      return (
        matchesCategory &&
        matchesSearch &&
        matchesStock &&
        matchesMinPrice &&
        matchesMaxPrice
      );
    });

    const sorted = [...filtered];

    if (sortBy === "newest") {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else if (sortBy === "price_asc") {
      sorted.sort((a, b) => a.unit_price - b.unit_price);
    } else if (sortBy === "price_desc") {
      sorted.sort((a, b) => b.unit_price - a.unit_price);
    }

    return sorted;
  }, [
    appliedPriceMax,
    appliedPriceMin,
    inStockOnly,
    products,
    searchText,
    selectedCategoryIds,
    sortBy,
  ]);

  const pageCount = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const pagedProducts = useMemo(
    () =>
      visibleProducts.slice((safePage - 1) * pageSize, safePage * pageSize),
    [safePage, visibleProducts],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    appliedPriceMax,
    appliedPriceMin,
    inStockOnly,
    searchText,
    selectedCategoryIds,
    sortBy,
  ]);

  async function handleAddToCart(product: ProductWithCategory) {
    if (authState.status !== "ready") {
      return;
    }

    setAddToCartState({ message: null, productId: product.id, status: "adding" });

    const supabase = createClient();
    const { data, error } = await addProductToCart(
      supabase,
      authState.user.id,
      product.id,
    );

    if (error) {
      setAddToCartState({ message: error.message, productId: product.id, status: "error" });
      return;
    }

    setCartState({ error: null, status: "ready", summary: data ?? emptyCartSummary });
    setAddToCartState({
      message: `เพิ่ม ${product.name} ลงตะกร้าแล้ว`,
      productId: product.id,
      status: "success",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-24 pt-0 sm:px-8 sm:pb-6">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <h1 className="text-3xl font-bold leading-tight text-[var(--foreground)]">
          สินค้าสำหรับ BigO-RepairCar
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          เลือกซื้ออะไหล่และสินค้าดูแลรถจากอู่ หยิบใส่ตะกร้าไว้ก่อน แล้วค่อยไปยืนยันคำสั่งซื้อในขั้นตอนถัดไป
        </p>
      </header>

      {authState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังตรวจสอบบัญชี...
          </div>
        </section>
      ) : null}

      {authState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อนดูหน้าร้าน</p>
            <p className="mt-2">
              ตอนนี้ระบบสินค้าใช้ข้อมูลลูกค้าจากบัญชีของคุณ เพื่อแยกตะกร้าและคำสั่งซื้อให้ถูกคน
            </p>
            <Link
              className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่หน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {authState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-200 bg-[var(--surface)] px-5 py-4 text-sm text-[var(--danger)] shadow-sm">
            {authState.error}
          </div>
        </section>
      ) : null}

      {authState.status === "ready" ? (
        <section className="flex flex-col gap-5 py-6 lg:flex-row lg:items-start lg:gap-6">
          <aside className="lg:w-64 lg:shrink-0">
            <button
              className="flex min-h-11 w-full items-center justify-between rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] lg:hidden"
              onClick={() => setIsFilterOpen((current) => !current)}
              type="button"
            >
              ตัวกรอง
              {hasActiveFilters ? (
                <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-xs font-bold text-white">
                  กำลังใช้งาน
                </span>
              ) : null}
              <span>{isFilterOpen ? "▲" : "▼"}</span>
            </button>

            <div
              className={
                isFilterOpen
                  ? "mt-3 block lg:sticky lg:top-4 lg:mt-0"
                  : "hidden lg:sticky lg:top-4 lg:mt-0 lg:block"
              }
            >
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-black text-[var(--foreground)]">
                    ค้นหาแบบละเอียด
                  </h2>
                  {hasActiveFilters ? (
                    <button
                      className="text-xs font-semibold text-[var(--brand)] hover:underline"
                      onClick={clearAllFilters}
                      type="button"
                    >
                      ล้างตัวกรอง
                    </button>
                  ) : null}
                </div>

                <FilterSection title="หมวดหมู่สินค้า">
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <label
                        className="flex cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]"
                        key={category.id}
                      >
                        <input
                          checked={selectedCategoryIds.has(category.id)}
                          className="h-4 w-4 accent-[var(--brand)]"
                          onChange={() => toggleCategory(category.id)}
                          type="checkbox"
                        />
                        {category.name}
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--muted)]">
                      ยังไม่มีหมวดหมู่สินค้า
                    </p>
                  )}
                </FilterSection>

                <FilterSection title="สถานะสินค้า">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]">
                    <input
                      checked={inStockOnly}
                      className="h-4 w-4 accent-[var(--brand)]"
                      onChange={(event) =>
                        setInStockOnly(event.target.checked)
                      }
                      type="checkbox"
                    />
                    มีสินค้าเท่านั้น
                  </label>
                </FilterSection>

                <FilterSection title="ช่วงราคา">
                  <div className="flex items-center gap-2">
                    <input
                      className="min-h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                      inputMode="numeric"
                      onChange={(event) => setPriceMinInput(event.target.value)}
                      placeholder="ใส่ราคาต่ำสุด"
                      value={priceMinInput}
                    />
                    <span className="text-[var(--muted)]">-</span>
                    <input
                      className="min-h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                      inputMode="numeric"
                      onChange={(event) => setPriceMaxInput(event.target.value)}
                      placeholder="ใส่ราคาสูงสุด"
                      value={priceMaxInput}
                    />
                  </div>
                  <button
                    className="min-h-9 w-full rounded-md bg-[var(--brand)] text-sm font-semibold text-white"
                    onClick={applyPriceRange}
                    type="button"
                  >
                    ตกลง
                  </button>
                </FilterSection>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-5 py-3 sm:mx-0 sm:flex-row sm:items-center sm:gap-4 sm:rounded-xl sm:border sm:px-4">
              <input
                className="min-h-11 flex-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="ค้นหาสินค้า, SKU หรือหมวดสินค้า"
                value={searchText}
              />
              <Link
                className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)]"
                href="/cart"
              >
                ตะกร้า
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-xs font-bold text-white">
                  {cartState.summary.itemCount}
                </span>
              </Link>
            </div>

            {searchText.trim().length > 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                ค้นหา &lsquo;{searchText.trim()}&rsquo; · พบ {visibleProducts.length} รายการ
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[var(--muted)]">เรียงโดย</span>
                <SortTabButton
                  active={sortBy === "relevance"}
                  onClick={() => setSortBy("relevance")}
                >
                  เกี่ยวข้อง
                </SortTabButton>
                <SortTabButton
                  active={sortBy === "newest"}
                  onClick={() => setSortBy("newest")}
                >
                  ล่าสุด
                </SortTabButton>
                <SortTabButton
                  active={sortBy === "price_asc" || sortBy === "price_desc"}
                  onClick={togglePriceSort}
                >
                  ราคา
                  {sortBy === "price_asc"
                    ? " ↑"
                    : sortBy === "price_desc"
                      ? " ↓"
                      : ""}
                </SortTabButton>
              </div>

              {pageCount > 1 ? (
                <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                  <span>
                    {safePage}/{pageCount}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={safePage <= 1}
                      onClick={() =>
                        setCurrentPage((current) => Math.max(1, current - 1))
                      }
                      type="button"
                    >
                      ‹
                    </button>
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={safePage >= pageCount}
                      onClick={() =>
                        setCurrentPage((current) =>
                          Math.min(pageCount, current + 1),
                        )
                      }
                      type="button"
                    >
                      ›
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {addToCartState.status === "error" ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                {addToCartState.message}
              </div>
            ) : null}

            {cartState.status === "error" ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                {cartState.error}
              </div>
            ) : null}

            {productsState.status === "loading" ? (
              <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
                กำลังโหลดสินค้า...
              </div>
            ) : null}

            {productsState.status === "error" ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-[var(--surface)] px-5 py-4 text-sm text-[var(--danger)] shadow-sm">
                {productsState.error}
              </div>
            ) : null}

            {productsState.status === "ready" ? (
              pagedProducts.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {pagedProducts.map((product) => (
                    <ProductCard
                      addToCartState={addToCartState}
                      key={product.id}
                      onAddToCart={handleAddToCart}
                      product={product}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
                  ไม่พบสินค้าตามตัวกรองนี้
                </div>
              )
            ) : null}

            {pageCount > 1 && pagedProducts.length > 0 ? (
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={safePage <= 1}
                  onClick={() =>
                    setCurrentPage((current) => Math.max(1, current - 1))
                  }
                  type="button"
                >
                  ‹
                </button>
                <span className="text-sm text-[var(--muted)]">
                  หน้า {safePage} จาก {pageCount}
                </span>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={safePage >= pageCount}
                  onClick={() =>
                    setCurrentPage((current) => Math.min(pageCount, current + 1))
                  }
                  type="button"
                >
                  ›
                </button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {authState.status === "ready" && cartState.summary.itemCount > 0 ? (
        <Link
          className="fixed inset-x-5 bottom-5 z-20 flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-lg sm:hidden"
          href="/cart"
        >
          ไปที่ตะกร้า · {cartState.summary.itemCount} ชิ้น
        </Link>
      ) : null}
    </main>
  );
}
