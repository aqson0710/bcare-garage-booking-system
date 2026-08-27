"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentProfile, type Profile } from "@/features/auth";
import {
  getCustomerProductOrderById,
  type ProductOrderWithItems,
} from "@/features/products";
import { createClient } from "@/lib/supabase/browser";
import { ProductOrderReceiptDocument } from "./product-order-receipt-document";

type LoadState =
  | { status: "loading"; order: null; profile: null; error: null }
  | { status: "signed-out"; order: null; profile: null; error: null }
  | { status: "not-found"; order: null; profile: null; error: null }
  | {
      status: "ready";
      order: ProductOrderWithItems;
      profile: Profile | null;
      error: null;
    }
  | { status: "error"; order: null; profile: null; error: string };

export function CustomerProductOrderReceiptPanel({
  orderId,
}: {
  orderId: string;
}) {
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    order: null,
    profile: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadReceipt() {
      const supabase = createClient();
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;

      if (!isMounted) {
        return;
      }

      if (!user) {
        setLoadState({
          error: null,
          order: null,
          profile: null,
          status: "signed-out",
        });
        return;
      }

      const [orderResult, profileResult] = await Promise.all([
        getCustomerProductOrderById(supabase, user.id, orderId),
        getCurrentProfile(supabase, user.id),
      ]);

      if (!isMounted) {
        return;
      }

      if (orderResult.error) {
        setLoadState({
          error: orderResult.error.message,
          order: null,
          profile: null,
          status: "error",
        });
        return;
      }

      if (!orderResult.data) {
        setLoadState({
          error: null,
          order: null,
          profile: null,
          status: "not-found",
        });
        return;
      }

      setLoadState({
        error: null,
        order: orderResult.data,
        profile: profileResult.data ?? null,
        status: "ready",
      });
    }

    void loadReceipt();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  if (loadState.status === "loading") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)] shadow-sm">
          กำลังโหลดใบเสร็จ...
        </div>
      </main>
    );
  }

  if (loadState.status === "signed-out") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
          <p className="font-semibold">ต้องเข้าสู่ระบบก่อนดูใบเสร็จ</p>
          <Link
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
            href="/auth"
          >
            ไปที่หน้าบัญชี
          </Link>
        </div>
      </main>
    );
  }

  if (loadState.status === "not-found") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-[var(--line)] bg-white p-5 text-sm leading-6 text-[var(--muted)] shadow-sm">
          <p className="font-semibold text-[var(--foreground)]">
            ไม่พบใบเสร็จของคำสั่งซื้อนี้
          </p>
          <Link
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
            href="/my-product-orders"
          >
            กลับไปคำสั่งซื้อ
          </Link>
        </div>
      </main>
    );
  }

  if (loadState.status === "error") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700 shadow-sm">
          {loadState.error}
        </div>
      </main>
    );
  }

  return (
    <ProductOrderReceiptDocument
      backHref={`/my-product-orders/${loadState.order.id}`}
      order={{
        ...loadState.order,
        customer: loadState.profile,
      }}
    />
  );
}
