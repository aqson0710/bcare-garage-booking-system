"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  checkAdminAccess,
  getAdminProductOrderById,
  type AdminAccessResult,
  type AdminProductOrder,
} from "@/features/admin";
import { ProductOrderReceiptDocument } from "@/features/products/components/product-order-receipt-document";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; order: null; error: null }
  | { status: "signed-out"; access: null; order: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      order: null;
      error: null;
    }
  | { status: "not-found"; access: AdminAccessResult; order: null; error: null }
  | {
      status: "ready";
      access: AdminAccessResult;
      order: AdminProductOrder;
      error: null;
    }
  | { status: "error"; access: null; order: null; error: string };

export function AdminProductOrderReceiptPanel({
  orderId,
}: {
  orderId: string;
}) {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    order: null,
    status: "loading",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadReceipt() {
      const supabase = createClient();
      const userResult = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (!userResult.data.user) {
        setLoadState({
          access: null,
          error: null,
          order: null,
          status: "signed-out",
        });
        return;
      }

      const access = await checkAdminAccess(supabase, userResult.data.user.id);

      if (!isMounted) {
        return;
      }

      if (!access.allowed) {
        setLoadState({
          access,
          error: null,
          order: null,
          status: "access-denied",
        });
        return;
      }

      const orderResult = await getAdminProductOrderById(supabase, orderId);

      if (!isMounted) {
        return;
      }

      if (orderResult.error) {
        setLoadState({
          access: null,
          error: orderResult.error.message,
          order: null,
          status: "error",
        });
        return;
      }

      if (!orderResult.data) {
        setLoadState({
          access,
          error: null,
          order: null,
          status: "not-found",
        });
        return;
      }

      setLoadState({
        access,
        error: null,
        order: orderResult.data,
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
          <p className="font-semibold">
            กรุณาเข้าสู่ระบบด้วยบัญชี admin ก่อนดูใบเสร็จ
          </p>
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

  if (loadState.status === "access-denied") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
          <p className="font-semibold">ไม่มีสิทธิ์ดูใบเสร็จ admin</p>
          <p className="mt-1">{loadState.access.reason}</p>
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
            href="/admin/product-orders"
          >
            กลับไปออเดอร์สินค้า
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
      backHref={`/admin/product-orders/${loadState.order.id}`}
      order={loadState.order}
    />
  );
}
