import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase";
import { settleProductOrderPayment } from "@/features/products";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    paymentId: string;
  }>;
};

type SlipOkResponse = {
  data?: {
    amount?: number | string;
    message?: string;
    receiver?: {
      account?: {
        value?: string;
      };
      displayName?: string;
      name?: string;
      proxy?: {
        value?: string;
      };
    };
    receivingBank?: string;
    sender?: {
      account?: {
        value?: string;
      };
      displayName?: string;
      name?: string;
      proxy?: {
        value?: string;
      };
    };
    sendingBank?: string;
    success?: boolean;
    transRef?: string;
    transTimestamp?: string;
  };
  message?: string;
  success?: boolean;
};

type SlipOkFailureKind =
  | "amount_mismatch"
  | "duplicate_slip"
  | "provider_error"
  | "provider_unavailable"
  | "unauthorized_provider"
  | "unreadable_slip"
  | "verification_failed";

type VerifySlipOkRequestBody = {
  accessToken?: string;
};

function getSlipOkConfig() {
  const branchId = process.env.SLIPOK_BRANCH_ID?.trim();
  const apiKey = process.env.SLIPOK_API_KEY?.trim();

  if (!branchId || !apiKey) {
    throw new Error("ยังไม่ได้ตั้งค่า SLIPOK_BRANCH_ID หรือ SLIPOK_API_KEY");
  }

  return {
    apiKey,
    branchId,
  };
}

function getReadableSlipOkMessage(response: SlipOkResponse) {
  return (
    response.data?.message ??
    response.message ??
    "SlipOK ตรวจสลิปไม่ผ่าน กรุณาตรวจสอบรูปสลิปและยอดเงินอีกครั้ง"
  );
}

function getNormalizedSlipOkText(response: SlipOkResponse) {
  return getReadableSlipOkMessage(response).toLowerCase();
}

// Assumes SlipOK only uses non-2xx HTTP status for transport/config problems
// (bad auth, bad branch route, rate limit, outage), and that ANY 2xx
// response is SlipOK actually having received and processed the slip -
// including the edge case where it answers `success: true` but leaves out
// `data` entirely (seen in practice: a branch that isn't fully configured
// to return full analysis still logs the slip as "seen" on SlipOK's side).
// That is why the final fallback below resolves to "verification_failed"
// rather than "provider_error": a 2xx response must always end in a
// recorded, customer-visible outcome (see the isVerified branch further
// down), never the silent early-return reserved for genuine
// transport/config failures. Getting this wrong is exactly what caused a
// real bug - a `success: true` + no-`data` reply was falling into the
// early-return path, leaving the payment stuck on "submitted" with nothing
// recorded, while SlipOK had already marked that same slip as used. The
// next manual retry of the identical slip then came back "duplicate",
// which looked like a fresh submission failing for no reason.
function getSlipOkFailureKind(
  httpStatus: number,
  response: SlipOkResponse,
): SlipOkFailureKind {
  const normalizedText = getNormalizedSlipOkText(response);

  if (httpStatus === 401 || httpStatus === 403) {
    return "unauthorized_provider";
  }

  if (httpStatus === 408 || httpStatus === 429 || httpStatus >= 500) {
    return "provider_unavailable";
  }

  if (httpStatus < 200 || httpStatus >= 300) {
    return "provider_error";
  }

  if (
    normalizedText.includes("duplicate") ||
    normalizedText.includes("already") ||
    normalizedText.includes("ซ้ำ")
  ) {
    return "duplicate_slip";
  }

  if (
    normalizedText.includes("amount") ||
    normalizedText.includes("ยอด") ||
    normalizedText.includes("จำนวนเงิน")
  ) {
    return "amount_mismatch";
  }

  if (
    normalizedText.includes("qr") ||
    normalizedText.includes("image") ||
    normalizedText.includes("invalid") ||
    normalizedText.includes("not found") ||
    normalizedText.includes("อ่าน") ||
    normalizedText.includes("ไม่พบ")
  ) {
    return "unreadable_slip";
  }

  if (!response.success || response.data?.success === false) {
    return "verification_failed";
  }

  // Reached only on a 2xx response that didn't match any known
  // duplicate/amount/unreadable keyword and isn't an explicit
  // `success: false` - e.g. `success: true` with no `data` block at all.
  // Still a real, SlipOK-acknowledged attempt, so it must be treated as a
  // content-level result (persisted, customer-visible) and never grouped
  // with the transport/config failures above.
  return "verification_failed";
}

function getAdminSlipOkFailureMessage(
  failureKind: SlipOkFailureKind,
  response: SlipOkResponse,
) {
  const providerMessage = getReadableSlipOkMessage(response);

  if (failureKind === "unauthorized_provider") {
    return "SlipOK ไม่อนุญาตให้เรียก API กรุณาตรวจ Branch ID และ API Key";
  }

  if (failureKind === "provider_unavailable") {
    return "SlipOK ยังตรวจไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้งภายหลัง";
  }

  if (failureKind === "provider_error") {
    return `SlipOK เรียกใช้งานไม่สำเร็จ กรุณาตรวจสอบการตั้งค่าหรือลองใหม่อีกครั้ง: ${providerMessage}`;
  }

  if (failureKind === "duplicate_slip") {
    return `สลิปนี้อาจถูกใช้ตรวจไปแล้วหรือเป็นสลิปซ้ำ: ${providerMessage}`;
  }

  if (failureKind === "amount_mismatch") {
    return `ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องตรวจ: ${providerMessage}`;
  }

  if (failureKind === "unreadable_slip") {
    return `SlipOK อ่านสลิปนี้ไม่ได้ กรุณาขอให้ลูกค้าส่งรูปสลิปใหม่: ${providerMessage}`;
  }

  return `SlipOK ตรวจสลิปไม่ผ่าน: ${providerMessage}`;
}

function getCustomerSlipOkRejectedReason(
  failureKind: SlipOkFailureKind,
  response: SlipOkResponse,
) {
  const providerMessage = getReadableSlipOkMessage(response);

  if (failureKind === "duplicate_slip") {
    return "สลิปนี้อาจถูกใช้ไปแล้ว กรุณาส่งสลิปใหม่";
  }

  if (failureKind === "amount_mismatch") {
    return "ยอดเงินบนสลิปไม่ตรงกับยอดที่ต้องชำระ กรุณาส่งสลิปยอดที่ถูกต้อง";
  }

  if (failureKind === "unreadable_slip") {
    return "ระบบอ่านสลิปนี้ไม่ได้ กรุณาส่งรูปสลิปใหม่ที่ชัดเจน";
  }

  if (failureKind === "verification_failed") {
    return `SlipOK ตรวจสอบสลิปนี้ไม่สำเร็จและไม่ส่งผลตรวจกลับมา กรุณาส่งสลิปใหม่อีกครั้ง หรือแจ้งแอดมินให้ตรวจสอบและอนุมัติด้วยตนเอง (ข้อความจาก SlipOK: ${providerMessage})`;
  }

  return providerMessage;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

async function getRequestAccessToken(request: Request) {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    return {
      authSource: "header" as const,
      token: bearerToken,
    };
  }

  const body = (await request
    .json()
    .catch(() => null)) as VerifySlipOkRequestBody | null;
  const bodyToken = body?.accessToken?.trim();

  if (bodyToken) {
    return {
      authSource: "body" as const,
      token: bodyToken,
    };
  }

  return {
    authSource: "cookie" as const,
    token: null,
  };
}

async function ensureAuthorizedRequest(
  request: Request,
  paymentId: string,
  adminSupabase: ReturnType<typeof createAdminClient>,
) {
  const cookieSupabase = await createClient();

  let authSource: "body" | "cookie" | "header" = "cookie";
  let userResult = await cookieSupabase.auth.getUser();
  let {
    data: { user },
    error: userError,
  } = userResult;

  if (userError || !user) {
    const tokenResult = await getRequestAccessToken(request);
    authSource = tokenResult.authSource;

    if (tokenResult.token) {
      userResult = await cookieSupabase.auth.getUser(tokenResult.token);
      user = userResult.data.user;
      userError = userResult.error;
    }
  }

  if (userError || !user) {
    return {
      error: NextResponse.json(
        {
          authSource,
          message:
            authSource === "cookie"
              ? "กรุณาเข้าสู่ระบบก่อนตรวจสลิป"
              : "ระบบได้รับ session แล้ว แต่ session หมดอายุหรือใช้ตรวจไม่ได้ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่",
          ok: false,
        },
        { status: 401 },
      ),
      order: null,
      payment: null,
      userId: null,
    };
  }

  const paymentResult = await adminSupabase
    .from("product_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentResult.error) {
    return {
      error: NextResponse.json(
        {
          authSource,
          message: paymentResult.error.message,
          ok: false,
        },
        { status: 500 },
      ),
      order: null,
      payment: null,
      userId: null,
    };
  }

  const payment = paymentResult.data;

  if (!payment) {
    return {
      error: NextResponse.json(
        {
          authSource,
          message: "ไม่พบรายการชำระเงินนี้",
          ok: false,
        },
        { status: 404 },
      ),
      order: null,
      payment: null,
      userId: null,
    };
  }

  const profileResult = await adminSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileResult.error) {
    return {
      error: NextResponse.json(
        {
          authSource,
          message: profileResult.error.message,
          ok: false,
        },
        { status: 500 },
      ),
      order: null,
      payment: null,
      userId: null,
    };
  }

  const isAdmin = profileResult.data?.role === "admin";

  // Always load the order, for every caller, admin or customer. Its
  // total_amount is the single source of truth for how much SlipOK is asked
  // to confirm below — payment.amount / payment.slip_amount are customer
  // supplied at slip-upload time and must never be trusted to decide that,
  // or a customer could self-report a lower amount than they owe and have
  // it verified as if the order were paid in full.
  const orderResult = await adminSupabase
    .from("product_orders")
    .select("id, customer_id, payment_status, total_amount")
    .eq("id", payment.product_order_id)
    .maybeSingle();

  if (orderResult.error) {
    return {
      error: NextResponse.json(
        {
          authSource,
          message: orderResult.error.message,
          ok: false,
        },
        { status: 500 },
      ),
      order: null,
      payment: null,
      userId: null,
    };
  }

  const order = orderResult.data;

  if (!order) {
    return {
      error: NextResponse.json(
        {
          authSource,
          message: "ไม่พบคำสั่งซื้อของรายการชำระเงินนี้",
          ok: false,
        },
        { status: 404 },
      ),
      order: null,
      payment: null,
      userId: null,
    };
  }

  const isOwner = order.customer_id === user.id;

  if (!isAdmin && !isOwner) {
    // Reuse the same "not found" response as the missing-payment case above
    // so a non-owner probing a paymentId can't distinguish "doesn't exist"
    // from "exists but isn't yours".
    return {
      error: NextResponse.json(
        {
          authSource,
          message: "ไม่พบรายการชำระเงินนี้",
          ok: false,
        },
        { status: 404 },
      ),
      order: null,
      payment: null,
      userId: null,
    };
  }

  return {
    authSource,
    error: null,
    order,
    payment,
    userId: user.id,
  };
}

// Best-effort per-payment cooldown so a customer (who can now call this
// endpoint directly, not just an admin) can't spam the paid SlipOK API by
// re-posting the same paymentId in a tight loop. In-memory only: it resets
// on redeploy and isn't shared across multiple server instances, which is
// an accepted tradeoff for this app's current single-instance scale.
const SLIPOK_CALL_COOLDOWN_MS = 15_000;
const recentSlipOkCallAttempts = new Map<string, number>();

export async function POST(request: Request, context: RouteContext) {
  const { paymentId } = await context.params;

  if (!paymentId) {
    return NextResponse.json(
      {
        message: "ไม่พบ paymentId",
        ok: false,
      },
      { status: 400 },
    );
  }

  const adminSupabase = createAdminClient();
  const authCheck = await ensureAuthorizedRequest(
    request,
    paymentId,
    adminSupabase,
  );

  if (authCheck.error) {
    return authCheck.error;
  }

  const adminUserId = authCheck.userId;
  const order = authCheck.order;
  const payment = authCheck.payment;

  const lastAttemptAt = recentSlipOkCallAttempts.get(payment.id);
  const attemptedAt = Date.now();

  if (lastAttemptAt && attemptedAt - lastAttemptAt < SLIPOK_CALL_COOLDOWN_MS) {
    return NextResponse.json(
      {
        message: "เพิ่งตรวจสลิปนี้ไปเมื่อสักครู่ กรุณารอสักครู่แล้วลองใหม่",
        ok: false,
        payment,
      },
      { status: 429 },
    );
  }

  recentSlipOkCallAttempts.set(payment.id, attemptedAt);

  let slipOkConfig: ReturnType<typeof getSlipOkConfig>;

  try {
    slipOkConfig = getSlipOkConfig();
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "ตั้งค่า SlipOK ไม่ครบ",
        ok: false,
      },
      { status: 500 },
    );
  }

  if (payment.payment_status === "paid") {
    return NextResponse.json(
      {
        message: "รายการนี้ชำระเงินแล้ว",
        ok: true,
        payment,
      },
      { status: 200 },
    );
  }

  if (!payment.slip_image_url) {
    return NextResponse.json(
      {
        message: "รายการนี้ยังไม่มีรูปสลิป",
        ok: false,
      },
      { status: 400 },
    );
  }

  const slipResult = await adminSupabase.storage
    .from("payment-slips")
    .download(payment.slip_image_url);

  if (slipResult.error) {
    return NextResponse.json(
      {
        message: slipResult.error.message,
        ok: false,
      },
      { status: 500 },
    );
  }

  // Authoritative amount: always the order's own total, never anything the
  // customer supplied on the slip-upload form. See the comment in
  // ensureAuthorizedRequest for why payment.amount / payment.slip_amount
  // must not be used here.
  const amountToVerify = order.total_amount;
  const formData = new FormData();
  formData.append("files", slipResult.data, "payment-slip.jpg");
  formData.append("amount", String(amountToVerify));
  formData.append("log", "true");

  let slipOkHttpResponse: Response;

  try {
    slipOkHttpResponse = await fetch(
      `https://api.slipok.com/api/line/apikey/${slipOkConfig.branchId}`,
      {
        body: formData,
        headers: {
          "x-authorization": slipOkConfig.apiKey,
        },
        method: "POST",
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        failureKind: "provider_unavailable" satisfies SlipOkFailureKind,
        message:
          error instanceof Error
            ? `SlipOK connection failed: ${error.message}`
            : "SlipOK connection failed",
        ok: false,
      },
      { status: 503 },
    );
  }

  let slipOkResponse: SlipOkResponse;

  try {
    slipOkResponse = (await slipOkHttpResponse.json()) as SlipOkResponse;
  } catch {
    return NextResponse.json(
      {
        failureKind: "provider_error" satisfies SlipOkFailureKind,
        message: "SlipOK response ไม่ใช่ JSON ที่อ่านได้",
        ok: false,
        status: slipOkHttpResponse.status,
      },
      { status: 502 },
    );
  }

  const failureKind = getSlipOkFailureKind(
    slipOkHttpResponse.status,
    slipOkResponse,
  );

  if (
    failureKind === "provider_unavailable" ||
    failureKind === "unauthorized_provider" ||
    failureKind === "provider_error"
  ) {
    return NextResponse.json(
      {
        failureKind,
        message: getAdminSlipOkFailureMessage(failureKind, slipOkResponse),
        ok: false,
        slipOkStatus: slipOkHttpResponse.status,
      },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  const isVerified =
    slipOkHttpResponse.ok &&
    slipOkResponse.success === true &&
    slipOkResponse.data?.success === true;

  if (isVerified) {
    const paymentUpdateResult = await adminSupabase
      .from("product_payments")
      .update({
        paid_at: now,
        payment_status: "paid",
        provider_reference: slipOkResponse.data?.transRef ?? null,
        rejected_reason: null,
        slip_amount:
          typeof slipOkResponse.data?.amount === "number"
            ? slipOkResponse.data.amount
            : amountToVerify,
        slip_receiver_account:
          slipOkResponse.data?.receiver?.account?.value ??
          slipOkResponse.data?.receiver?.proxy?.value ??
          null,
        slip_receiver_bank: slipOkResponse.data?.receivingBank ?? null,
        slip_receiver_name:
          slipOkResponse.data?.receiver?.displayName ??
          slipOkResponse.data?.receiver?.name ??
          null,
        slip_sender_account:
          slipOkResponse.data?.sender?.account?.value ??
          slipOkResponse.data?.sender?.proxy?.value ??
          null,
        slip_sender_bank: slipOkResponse.data?.sendingBank ?? null,
        slip_transfer_at: slipOkResponse.data?.transTimestamp ?? null,
        verification_provider: "slipok",
        verification_response: toJson({
          httpStatus: slipOkHttpResponse.status,
          response: slipOkResponse,
        }),
        verification_status: "verified",
        verified_at: now,
        verified_by: adminUserId,
      })
      .eq("id", payment.id)
      .select("*")
      .single();

    if (paymentUpdateResult.error) {
      return NextResponse.json(
        {
          message: paymentUpdateResult.error.message,
          ok: false,
        },
        { status: 500 },
      );
    }

    // Record this as a verified transaction on the ledger rather than
    // writing product_orders.payment_status directly. provider_reference is
    // unique across the whole table, so the same real bank slip can never
    // be recorded as a successful payment twice, on this order or any
    // other. A missing transRef (SlipOK didn't return one) falls back to a
    // reference scoped to this one payment attempt, so it still satisfies
    // the not-null/unique constraints without ever colliding with — or
    // catching — anything else.
    const transactionResult = await adminSupabase
      .from("product_payment_transactions")
      .insert({
        product_order_id: order.id,
        product_payment_id: payment.id,
        provider_reference:
          slipOkResponse.data?.transRef ?? `no-transref:${payment.id}`,
        verified_amount: amountToVerify,
        verified_by_type: "system_slipok",
        verified_by_user_id: adminUserId,
        verified_at: now,
      })
      .select("*")
      .single();

    if (transactionResult.error) {
      // Postgres unique_violation: this exact SlipOK transaction reference
      // was already recorded as a verified payment elsewhere.
      const isDuplicateReference = transactionResult.error.code === "23505";

      return NextResponse.json(
        {
          failureKind: (isDuplicateReference
            ? "duplicate_slip"
            : "provider_error") satisfies SlipOkFailureKind,
          message: isDuplicateReference
            ? "สลิปนี้เคยถูกใช้ยืนยันการชำระเงินสำเร็จไปแล้วในรายการอื่น"
            : transactionResult.error.message,
          ok: false,
        },
        { status: isDuplicateReference ? 409 : 500 },
      );
    }

    const settlementResult = await settleProductOrderPayment(
      adminSupabase,
      order.id,
    );

    if (settlementResult.error || !settlementResult.data) {
      return NextResponse.json(
        {
          message: settlementResult.error?.message ?? "ตั้งยอดชำระเงินไม่สำเร็จ",
          ok: false,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "SlipOK ตรวจสลิปผ่านและอัปเดตยอดชำระเงินแล้ว",
      ok: true,
      order: settlementResult.data.order,
      payment: paymentUpdateResult.data,
      paymentStatus: settlementResult.data.paymentStatus,
      slipOkStatus: slipOkHttpResponse.status,
    });
  }

  const rejectedReason = getCustomerSlipOkRejectedReason(
    failureKind,
    slipOkResponse,
  );
  const paymentUpdateResult = await adminSupabase
    .from("product_payments")
    .update({
      paid_at: null,
      payment_status: "failed",
      rejected_reason: rejectedReason,
      verification_provider: "slipok",
      verification_response: toJson({
        failureKind,
        httpStatus: slipOkHttpResponse.status,
        response: slipOkResponse,
      }),
      verification_status: "rejected",
      verified_at: now,
      verified_by: adminUserId,
    })
    .eq("id", payment.id)
    .select("*")
    .single();

  if (paymentUpdateResult.error) {
    return NextResponse.json(
      {
        message: paymentUpdateResult.error.message,
        ok: false,
      },
      { status: 500 },
    );
  }

  // Re-settle from the ledger rather than re-deriving from product_payments
  // rows directly: if this order already has a verified transaction from an
  // earlier attempt, settlement correctly keeps it paid/partially_paid; if
  // it has none, it correctly falls back to unpaid. Same single function
  // the success branch above uses.
  const settlementResult = await settleProductOrderPayment(
    adminSupabase,
    payment.product_order_id,
  );

  if (settlementResult.error || !settlementResult.data) {
    return NextResponse.json(
      {
        message: settlementResult.error?.message ?? "ตั้งยอดชำระเงินไม่สำเร็จ",
        ok: false,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      failureKind,
      message: rejectedReason,
      ok: false,
      order: settlementResult.data.order,
      payment: paymentUpdateResult.data,
      paymentStatus: settlementResult.data.paymentStatus,
      slipOkStatus: slipOkHttpResponse.status,
    },
    { status: 422 },
  );
}
