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

function getStockLabel(product: ProductWithCategory) {
  if (product.stock_quantity <= 0) {
    return "หมดสต๊อก";
  }

  if (product.stock_quantity <= 2) {
    return `เหลือน้อย ${product.stock_quantity} ชิ้น`;
  }

  return `มีสินค้า ${product.stock_quantity} ชิ้น`;
}

function getStockClassName(product: ProductWithCategory) {
  if (product.stock_quantity <= 0) {
    return "bg-red-50 text-red-700";
  }

  if (product.stock_quantity <= 2) {
    return "bg-amber-50 text-amber-800";
  }

  return "bg-emerald-50 text-[var(--brand-strong)]";
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

  return (
    <article className="flex min-h-80 flex-col justify-between overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-sm">
      <div>
        <img
          alt={`รูปสินค้า ${product.name}`}
          className="h-44 w-full border-b border-[var(--line)] bg-slate-50 object-cover"
          onError={handleProductImageError}
          src={product.image_url || productImagePlaceholder}
        />
        <div className="flex items-start justify-between gap-4 p-5 pb-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
              {product.category?.name ?? "ไม่มีหมวดสินค้า"}
            </p>
            <h3 className="mt-2 text-lg font-bold leading-6 text-[var(--foreground)]">
              {product.name}
            </h3>
          </div>
          <span
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${getStockClassName(
              product,
            )}`}
          >
            {getStockLabel(product)}
          </span>
        </div>

        {product.description ? (
          <p className="px-5 pt-3 text-sm leading-6 text-[var(--muted)]">
            {product.description}
          </p>
        ) : null}
      </div>

      <div className="mt-5 p-5 pt-0">
        <dl className="grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 text-sm">
          <div>
            <dt className="text-[var(--muted)]">ราคา</dt>
            <dd className="mt-1 text-lg font-bold text-[var(--foreground)]">
              {currencyFormatter.format(product.unit_price)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--muted)]">SKU</dt>
            <dd className="mt-1 break-all font-semibold text-[var(--foreground)]">
              {product.sku || "-"}
            </dd>
          </div>
        </dl>

        <button
          className="mt-5 min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isOutOfStock || isAdding}
          onClick={() => onAddToCart(product)}
          type="button"
        >
          {isOutOfStock
            ? "สินค้าหมด"
            : isAdding
              ? "กำลังเพิ่ม..."
              : "เพิ่มลงตะกร้า"}
        </button>
      </div>
    </article>
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
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [addToCartState, setAddToCartState] = useState<AddToCartState>({
    message: null,
    productId: null,
    status: "idle",
  });

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
        setAuthState({
          error: error.message,
          status: "error",
          user: null,
        });
        return;
      }

      if (!session?.user) {
        setAuthState({
          error: null,
          status: "signed-out",
          user: null,
        });
        return;
      }

      setAuthState({
        error: null,
        status: "ready",
        user: session.user,
      });
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
        setProductsState({
          data: null,
          error: null,
          status: "idle",
        });
        return;
      }

      setProductsState({
        data: null,
        error: null,
        status: "loading",
      });

      const supabase = createClient();
      const { data, error } = await getStorefrontProducts(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setProductsState({
          data: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setProductsState({
        data,
        error: null,
        status: "ready",
      });
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
        setCartState({
          error: null,
          status: "idle",
          summary: emptyCartSummary,
        });
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

      setCartState({
        error: null,
        status: "ready",
        summary: data ?? emptyCartSummary,
      });
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

    return products.filter((product) => {
      const matchesCategory =
        selectedCategoryId === "all" ||
        product.product_category_id === selectedCategoryId;
      const matchesSearch =
        normalizedSearchText.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearchText) ||
        (product.description ?? "").toLowerCase().includes(normalizedSearchText) ||
        (product.sku ?? "").toLowerCase().includes(normalizedSearchText) ||
        (product.category?.name ?? "").toLowerCase().includes(normalizedSearchText);

      return matchesCategory && matchesSearch;
    });
  }, [products, searchText, selectedCategoryId]);

  async function handleAddToCart(product: ProductWithCategory) {
    if (authState.status !== "ready") {
      return;
    }

    setAddToCartState({
      message: null,
      productId: product.id,
      status: "adding",
    });

    const supabase = createClient();
    const { data, error } = await addProductToCart(
      supabase,
      authState.user.id,
      product.id,
    );

    if (error) {
      setAddToCartState({
        message: error.message,
        productId: product.id,
        status: "error",
      });
      return;
    }

    setCartState({
      error: null,
      status: "ready",
      summary: data ?? emptyCartSummary,
    });
    setAddToCartState({
      message: `เพิ่ม ${product.name} ลงตะกร้าแล้ว`,
      productId: product.id,
      status: "success",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
            BCare
          </p>
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold leading-tight text-[var(--foreground)]">
              สินค้าสำหรับ BigO-RepairCar
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              เลือกซื้ออะไหล่และสินค้าดูแลรถจากอู่ เพิ่มลงตะกร้าไว้ก่อน แล้วค่อยไปยืนยันคำสั่งซื้อในขั้นตอนถัดไป
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-80">
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                สินค้า
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {productsState.status === "ready" ? products.length : "-"}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                ในตะกร้า
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {cartState.summary.itemCount}
              </p>
            </div>
          </div>
        </div>
      </header>

      {authState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
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
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่หน้าบัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {authState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
            {authState.error}
          </div>
        </section>
      ) : null}

      {authState.status === "ready" ? (
        <section className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
                ค้นหาสินค้า
                <input
                  className="min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="ชื่อสินค้า, SKU, หมวดสินค้า"
                  value={searchText}
                />
              </label>
              <div className="grid gap-2 text-sm font-medium text-[var(--foreground)] sm:w-64">
                หมวดสินค้า
                <select
                  className="min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) => setSelectedCategoryId(event.target.value)}
                  value={selectedCategoryId}
                >
                  <option value="all">สินค้าทั้งหมด</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {productsState.status === "loading" ? (
              <div className="mt-6 rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
                กำลังโหลดสินค้า...
              </div>
            ) : null}

            {productsState.status === "error" ? (
              <div className="mt-6 rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
                {productsState.error}
              </div>
            ) : null}

            {productsState.status === "ready" ? (
              <div className="mt-6">
                {visibleProducts.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visibleProducts.map((product) => (
                      <ProductCard
                        addToCartState={addToCartState}
                        key={product.id}
                        onAddToCart={handleAddToCart}
                        product={product}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">
                    ไม่พบสินค้าตามตัวกรองนี้
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <aside className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <p className="text-sm font-semibold text-[var(--brand)]">
              ตะกร้าสินค้า
            </p>
            <p className="mt-3 text-3xl font-bold text-[var(--foreground)]">
              {cartState.summary.itemCount} ชิ้น
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Part นี้เพิ่มสินค้าลงตะกร้าได้แล้ว ส่วนหน้าดูตะกร้าและยืนยันคำสั่งซื้อจะทำใน Part ถัดไป
            </p>

            {cartState.status === "loading" ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                กำลังโหลดตะกร้า...
              </p>
            ) : null}

            {cartState.status === "error" ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                {cartState.error}
              </div>
            ) : null}

            {addToCartState.status === "success" ? (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-[var(--brand-strong)]">
                {addToCartState.message}
              </div>
            ) : null}

            {addToCartState.status === "error" ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                {addToCartState.message}
              </div>
            ) : null}

            <Link
              className={
                cartState.summary.itemCount > 0
                  ? "mt-5 flex min-h-11 w-full items-center justify-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                  : "mt-5 flex min-h-11 w-full items-center justify-center rounded-md border border-[var(--line)] bg-slate-50 px-4 text-sm font-semibold text-[var(--muted)]"
              }
              href="/cart"
            >
              ไปที่ตะกร้า
            </Link>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
