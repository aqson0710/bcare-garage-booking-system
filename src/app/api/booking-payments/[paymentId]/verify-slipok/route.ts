import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Same automatic-verification flow as
// src/app/api/product-payments/[paymentId]/verify-slipok/route.ts, adapted
// to bookings: a booking only ever owes one flat amount
// (bookings.payment_amount, snapshotted when the repair job closes), so
// there's no ledger of multiple verified transactions to sum here - this
// route (and the manual admin approve/reject RPCs it shares guards with)
// writes straight to booking_payments/bookings instead of a settlement
// table. The two anti-double-verification guarantees still match the
// product flow exactly: a unique index on booking_payments.provider_reference
// (see booking-payment-auto-verify.sql) so the same real slip can never
// verify two different bookings, and this route refusing to act on a
// payment that isn't currently "pending / submitted".

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

// See the matching comment in the product-payments version of this route -
// any 2xx SlipOK response must end in a recorded, customer-visible outcome
// (the isVerified branch further down), never the silent early-return
// reserved for genuine transport/config failures.
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
      booking: null,
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
      payment: null,
      userId: null,
    };
  }

  const paymentResult = await adminSupabase
    .from("booking_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentResult.error) {
    return {
      booking: null,
      error: NextResponse.json(
        {
          authSource,
          message: paymentResult.error.message,
          ok: false,
        },
        { status: 500 },
      ),
      payment: null,
      userId: null,
    };
  }

  const payment = paymentResult.data;

  if (!payment) {
    return {
      booking: null,
      error: NextResponse.json(
        {
          authSource,
          message: "ไม่พบรายการชำระเงินนี้",
          ok: false,
        },
        { status: 404 },
      ),
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
      booking: null,
      error: NextResponse.json(
        {
          authSource,
          message: profileResult.error.message,
          ok: false,
        },
        { status: 500 },
      ),
      payment: null,
      userId: null,
    };
  }

  const isAdmin = profileResult.data?.role === "admin";

  // Always load the booking, for every caller, admin or customer. Its
  // payment_amount is the single source of truth for how much SlipOK is
  // asked to confirm below - never payment.amount, which is only a
  // snapshot taken at slip-upload time.
  const bookingResult = await adminSupabase
    .from("bookings")
    .select("id, customer_id, payment_status, payment_amount")
    .eq("id", payment.booking_id)
    .maybeSingle();

  if (bookingResult.error) {
    return {
      booking: null,
      error: NextResponse.json(
        {
          authSource,
          message: bookingResult.error.message,
          ok: false,
        },
        { status: 500 },
      ),
      payment: null,
      userId: null,
    };
  }

  const booking = bookingResult.data;

  if (!booking) {
    return {
      booking: null,
      error: NextResponse.json(
        {
          authSource,
          message: "ไม่พบการจองของรายการชำระเงินนี้",
          ok: false,
        },
        { status: 404 },
      ),
      payment: null,
      userId: null,
    };
  }

  const isOwner = booking.customer_id === user.id;

  if (!isAdmin && !isOwner) {
    // Same "not found" response as the missing-payment case above, so a
    // non-owner probing a paymentId can't distinguish "doesn't exist" from
    // "exists but isn't yours".
    return {
      booking: null,
      error: NextResponse.json(
        {
          authSource,
          message: "ไม่พบรายการชำระเงินนี้",
          ok: false,
        },
        { status: 404 },
      ),
      payment: null,
      userId: null,
    };
  }

  return {
    authSource,
    booking,
    error: null,
    payment,
    userId: user.id,
  };
}

// Same best-effort per-payment cooldown as the product-payments route.
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

  const callerUserId = authCheck.userId;
  const booking = authCheck.booking;
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

  // Guards against re-verifying a payment that isn't currently awaiting
  // review anymore - e.g. an admin already rejected it manually right
  // before this call landed. Mirrors the same-state guard in
  // approve_booking_payment/reject_booking_payment.
  if (
    payment.payment_status !== "pending" ||
    payment.verification_status !== "submitted"
  ) {
    return NextResponse.json(
      {
        message: "รายการนี้ถูกตรวจสอบไปแล้ว",
        ok: false,
        payment,
      },
      { status: 409 },
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

  // Authoritative amount: always the booking's own payment_amount, never
  // anything from the payment row itself.
  const amountToVerify = booking.payment_amount ?? 0;
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
    // provider_reference is unique across every booking_payments row (see
    // booking-payment-auto-verify.sql), so this exact SlipOK transaction can
    // never be recorded as a successful payment twice - on this booking or
    // any other.
    const paymentUpdateResult = await adminSupabase
      .from("booking_payments")
      .update({
        paid_at: now,
        payment_status: "paid",
        provider_reference:
          slipOkResponse.data?.transRef ?? `no-transref:${payment.id}`,
        rejected_reason: null,
        slip_amount:
          typeof slipOkResponse.data?.amount === "number"
            ? slipOkResponse.data.amount
            : amountToVerify,
        verification_provider: "slipok",
        verification_response: toJson({
          httpStatus: slipOkHttpResponse.status,
          response: slipOkResponse,
        }),
        verification_status: "verified",
        verified_at: now,
        verified_by: callerUserId,
      })
      .eq("id", payment.id)
      .select("*")
      .single();

    if (paymentUpdateResult.error) {
      const isDuplicateReference = paymentUpdateResult.error.code === "23505";

      return NextResponse.json(
        {
          failureKind: (isDuplicateReference
            ? "duplicate_slip"
            : "provider_error") satisfies SlipOkFailureKind,
          message: isDuplicateReference
            ? "สลิปนี้เคยถูกใช้ยืนยันการชำระเงินสำเร็จไปแล้วในรายการอื่น"
            : paymentUpdateResult.error.message,
          ok: false,
        },
        { status: isDuplicateReference ? 409 : 500 },
      );
    }

    const bookingUpdateResult = await adminSupabase
      .from("bookings")
      .update({ payment_status: "paid" })
      .eq("id", booking.id)
      .select("payment_status")
      .single();

    if (bookingUpdateResult.error) {
      return NextResponse.json(
        {
          message: bookingUpdateResult.error.message,
          ok: false,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      booking: bookingUpdateResult.data,
      message: "SlipOK ตรวจสลิปผ่านและยืนยันการชำระเงินแล้ว",
      ok: true,
      payment: paymentUpdateResult.data,
      slipOkStatus: slipOkHttpResponse.status,
    });
  }

  const rejectedReason = getCustomerSlipOkRejectedReason(
    failureKind,
    slipOkResponse,
  );
  const paymentUpdateResult = await adminSupabase
    .from("booking_payments")
    .update({
      paid_at: null,
      payment_status: "rejected",
      rejected_reason: rejectedReason,
      verification_provider: "slipok",
      verification_response: toJson({
        failureKind,
        httpStatus: slipOkHttpResponse.status,
        response: slipOkResponse,
      }),
      verification_status: "rejected",
      verified_at: now,
      verified_by: callerUserId,
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

  const bookingUpdateResult = await adminSupabase
    .from("bookings")
    .update({ payment_status: "rejected" })
    .eq("id", booking.id)
    .select("payment_status")
    .single();

  if (bookingUpdateResult.error) {
    return NextResponse.json(
      {
        message: bookingUpdateResult.error.message,
        ok: false,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      booking: bookingUpdateResult.data,
      failureKind,
      message: rejectedReason,
      ok: false,
      payment: paymentUpdateResult.data,
      slipOkStatus: slipOkHttpResponse.status,
    },
    { status: 422 },
  );
}
