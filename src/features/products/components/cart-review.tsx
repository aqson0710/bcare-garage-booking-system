"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/browser";
import {
  getCartDetails,
  removeCartItem,
  updateCartItemQuantity,
  type CartDetails,
  type CartItemWithProduct,
} from "@/features/products";
import { ProductImageThumb } from "./product-image-thumb";

type AuthState =
  | { status: "loading"; user: null; error: null }
  | { status: "signed-out"; user: null; error: null }
  | { status: "ready"; user: User; error: null }
  | { status: "error"; user: null; error: string };

type CartLoadState =
  | { status: "idle"; details: CartDetails; error: null }
  | { status: "loading"; details: CartDetails; error: null }
  | { status: "ready"; details: CartDetails; error: null }
  | { status: "error"; details: CartDetails; error: string };

type ActionState =
  | { status: "idle"; itemId: null; message: null }
  | { status: "updating"; itemId: string; message: null }
  | { status: "removing"; itemId: string; message: null }
  | { status: "success"; itemId: string | null; message: string }
  | { status: "error"; itemId: string | null; message: string };

const emptyCartDetails: CartDetails = {
  cart: null,
  itemCount: 0,
  items: [],
  subtotal: 0,
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function getLineTotal(item: CartItemWithProduct) {
  return (item.product?.unit_price ?? 0) * item.quantity;
}

function CartItemRow({
  actionState,
  item,
  onRemove,
  onUpdateQuantity,
}: {
  actionState: ActionState;
  item: CartItemWithProduct;
  onRemove: (item: CartItemWithProduct) => void;
  onUpdateQuantity: (item: CartItemWithProduct, quantity: number) => void;
}) {
  const product = item.product;
  const isUpdating =
    actionState.itemId === item.id &&
    (actionState.status === "updating" || actionState.status === "removing");
  const maxQuantity = product?.stock_quantity ?? item.quantity;
  const canDecrease = item.quantity > 1;
  const canIncrease = product ? item.quantity < product.stock_quantity : false;

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ProductImageThumb
            alt={`รูปสินค้า ${product?.name ?? "สินค้า"}`}
            size="lg"
            src={product?.image_url}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
              {product?.category?.name ?? "สินค้า"}
            </p>
            <h2 className="mt-2 text-lg font-bold text-[var(--foreground)]">
              {product?.name ?? "ไม่พบข้อมูลสินค้า"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              SKU: {product?.sku || "-"} · มีสินค้า{" "}
              {product?.stock_quantity ?? 0} ชิ้น
            </p>
            {product?.description ? (
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {product.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
              ยอดรายการนี้
            </p>
            <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
              {currencyFormatter.format(getLineTotal(item))}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {currencyFormatter.format(product?.unit_price ?? 0)} x {item.quantity}
            </p>
          </div>

          <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-white text-lg font-bold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canDecrease || isUpdating}
              onClick={() => onUpdateQuantity(item, item.quantity - 1)}
              type="button"
            >
              -
            </button>
            <input
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-center text-sm font-semibold text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              disabled={isUpdating}
              max={maxQuantity}
              min={1}
              onChange={(event) => {
                const quantity = Number(event.target.value);

                if (Number.isInteger(quantity)) {
                  onUpdateQuantity(item, quantity);
                }
              }}
              type="number"
              value={item.quantity}
            />
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-white text-lg font-bold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canIncrease || isUpdating}
              onClick={() => onUpdateQuantity(item, item.quantity + 1)}
              type="button"
            >
              +
            </button>
          </div>

          <button
            className="min-h-10 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUpdating}
            onClick={() => onRemove(item)}
            type="button"
          >
            {actionState.status === "removing" && actionState.itemId === item.id
              ? "กำลังลบ..."
              : "ลบออกจากตะกร้า"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function CartReview() {
  const [authState, setAuthState] = useState<AuthState>({
    error: null,
    status: "loading",
    user: null,
  });
  const [cartState, setCartState] = useState<CartLoadState>({
    details: emptyCartDetails,
    error: null,
    status: "idle",
  });
  const [actionState, setActionState] = useState<ActionState>({
    itemId: null,
    message: null,
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

    async function loadCart() {
      if (authState.status !== "ready") {
        setCartState({
          details: emptyCartDetails,
          error: null,
          status: "idle",
        });
        return;
      }

      setCartState((currentState) => ({
        details: currentState.details,
        error: null,
        status: "loading",
      }));

      const supabase = createClient();
      const { data, error } = await getCartDetails(supabase, authState.user.id);

      if (!isMounted) {
        return;
      }

      if (error) {
        setCartState((currentState) => ({
          details: currentState.details,
          error: error.message,
          status: "error",
        }));
        return;
      }

      setCartState({
        details: data ?? emptyCartDetails,
        error: null,
        status: "ready",
      });
    }

    loadCart();

    return () => {
      isMounted = false;
    };
  }, [authState]);

  async function handleUpdateQuantity(
    item: CartItemWithProduct,
    quantity: number,
  ) {
    if (authState.status !== "ready" || quantity === item.quantity) {
      return;
    }

    setActionState({
      itemId: item.id,
      message: null,
      status: "updating",
    });

    const supabase = createClient();
    const { data, error } = await updateCartItemQuantity(
      supabase,
      authState.user.id,
      item.id,
      quantity,
    );

    if (error) {
      setActionState({
        itemId: item.id,
        message: error.message,
        status: "error",
      });
      return;
    }

    setCartState({
      details: data ?? emptyCartDetails,
      error: null,
      status: "ready",
    });
    setActionState({
      itemId: item.id,
      message: "อัปเดตจำนวนสินค้าแล้ว",
      status: "success",
    });
  }

  async function handleRemove(item: CartItemWithProduct) {
    if (authState.status !== "ready") {
      return;
    }

    setActionState({
      itemId: item.id,
      message: null,
      status: "removing",
    });

    const supabase = createClient();
    const { data, error } = await removeCartItem(
      supabase,
      authState.user.id,
      item.id,
    );

    if (error) {
      setActionState({
        itemId: item.id,
        message: error.message,
        status: "error",
      });
      return;
    }

    setCartState({
      details: data ?? emptyCartDetails,
      error: null,
      status: "ready",
    });
    setActionState({
      itemId: null,
      message: "ลบสินค้าออกจากตะกร้าแล้ว",
      status: "success",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8">
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
              ตะกร้าสินค้า
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ตรวจรายการสินค้า แก้จำนวน หรือลบสินค้าออกจากตะกร้าก่อนเข้าสู่ขั้นตอนยืนยันคำสั่งซื้อ
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-80">
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                จำนวน
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {cartState.details.itemCount}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                ยอดรวม
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {currencyFormatter.format(cartState.details.subtotal)}
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
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อนดูตะกร้า</p>
            <p className="mt-2">ระบบจะแยกตะกร้าตามบัญชีลูกค้าแต่ละคน</p>
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
          <div className="space-y-4">
            {cartState.status === "loading" ? (
              <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
                กำลังโหลดตะกร้า...
              </div>
            ) : null}

            {cartState.status === "error" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                {cartState.error}
              </div>
            ) : null}

            {actionState.status === "success" ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-[var(--brand-strong)]">
                {actionState.message}
              </div>
            ) : null}

            {actionState.status === "error" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                {actionState.message}
              </div>
            ) : null}

            {cartState.details.items.length > 0 ? (
              cartState.details.items.map((item) => (
                <CartItemRow
                  actionState={actionState}
                  item={item}
                  key={item.id}
                  onRemove={handleRemove}
                  onUpdateQuantity={handleUpdateQuantity}
                />
              ))
            ) : cartState.status === "ready" ? (
              <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
                <p className="font-semibold text-[var(--foreground)]">
                  ยังไม่มีสินค้าในตะกร้า
                </p>
                <p className="mt-2">กลับไปเลือกสินค้าจากหน้าร้านก่อน</p>
                <Link
                  className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                  href="/products"
                >
                  ไปเลือกสินค้า
                </Link>
              </div>
            ) : null}
          </div>

          <aside className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <p className="text-sm font-semibold text-[var(--brand)]">
              สรุปตะกร้า
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--muted)]">จำนวนสินค้า</dt>
                <dd className="font-semibold text-[var(--foreground)]">
                  {cartState.details.itemCount} ชิ้น
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] pt-3">
                <dt className="text-[var(--muted)]">ยอดสินค้า</dt>
                <dd className="text-xl font-bold text-[var(--foreground)]">
                  {currencyFormatter.format(cartState.details.subtotal)}
                </dd>
              </div>
            </dl>

            <Link
              className={
                cartState.details.items.length > 0
                  ? "mt-5 flex min-h-11 w-full items-center justify-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                  : "mt-5 flex min-h-11 w-full items-center justify-center rounded-md border border-[var(--line)] bg-slate-50 px-4 text-sm font-semibold text-[var(--muted)]"
              }
              href="/checkout"
            >
              ไป checkout
            </Link>
            <Link
              className="mt-3 flex min-h-10 items-center justify-center rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
              href="/products"
            >
              เลือกสินค้าเพิ่ม
            </Link>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
