import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ProductOrderPaymentSettlement } from "./types";

type BCareSupabaseClient = SupabaseClient<Database>;

// A tiny rounding tolerance so a numeric(10,2) round-trip (e.g. 499.999999
// vs 500) never blocks an order that has in fact been paid in full.
const AMOUNT_TOLERANCE = 0.01;

// The order.payment_status values that mean "this order is done, payment
// math shouldn't move it anymore" — set deliberately by an explicit admin
// action elsewhere, not something settlement should recompute over.
const TERMINAL_PAYMENT_STATUSES: ReadonlySet<
  Database["public"]["Tables"]["product_orders"]["Row"]["payment_status"]
> = new Set(["refunded", "cancelled"]);

/**
 * The single place allowed to decide product_orders.payment_status.
 *
 * Recomputes it from the sum of every verified row in
 * product_payment_transactions for this order, compared against
 * product_orders.total_amount — never from a single payment attempt in
 * isolation. Call this after inserting a transaction row (a successful
 * SlipOK verification, or an admin's manual approval), and after a
 * rejection too (so a rejected attempt on top of zero verified money
 * correctly settles back to "unpaid").
 *
 * This replaces the old pattern of each call site (the SlipOK route, and
 * the admin approve/reject actions) writing product_orders.payment_status
 * directly and independently — that pattern is what let a payment for less
 * than the order total close the order as fully paid.
 */
export async function settleProductOrderPayment(
  supabase: BCareSupabaseClient,
  orderId: string,
): Promise<{
  data: ProductOrderPaymentSettlement | null;
  error: Error | null;
}> {
  const orderResult = await supabase
    .from("product_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderResult.error) {
    return { data: null, error: orderResult.error };
  }

  const order = orderResult.data;

  if (!order) {
    return { data: null, error: new Error("ไม่พบคำสั่งซื้อสำหรับการตั้งยอดชำระเงิน") };
  }

  const transactionsResult = await supabase
    .from("product_payment_transactions")
    .select("*")
    .eq("product_order_id", orderId)
    .order("verified_at", { ascending: true });

  if (transactionsResult.error) {
    return { data: null, error: transactionsResult.error };
  }

  const transactions = transactionsResult.data ?? [];
  const amountPaid = transactions.reduce(
    (sum, transaction) => sum + transaction.verified_amount,
    0,
  );
  const amountRemaining = Math.max(order.total_amount - amountPaid, 0);

  if (TERMINAL_PAYMENT_STATUSES.has(order.payment_status)) {
    return {
      data: {
        amountPaid,
        amountRemaining,
        order,
        paymentStatus: order.payment_status,
        transactions,
      },
      error: null,
    };
  }

  const nextPaymentStatus =
    amountPaid <= 0
      ? "unpaid"
      : amountPaid + AMOUNT_TOLERANCE >= order.total_amount
        ? "paid"
        : "partially_paid";

  if (nextPaymentStatus === order.payment_status) {
    return {
      data: { amountPaid, amountRemaining, order, paymentStatus: nextPaymentStatus, transactions },
      error: null,
    };
  }

  const updateResult = await supabase
    .from("product_orders")
    .update({ payment_status: nextPaymentStatus })
    .eq("id", orderId)
    .select("*")
    .single();

  if (updateResult.error) {
    return { data: null, error: updateResult.error };
  }

  return {
    data: {
      amountPaid,
      amountRemaining,
      order: updateResult.data,
      paymentStatus: nextPaymentStatus,
      transactions,
    },
    error: null,
  };
}
