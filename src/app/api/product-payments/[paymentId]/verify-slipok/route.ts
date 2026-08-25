import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase";

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

  return "provider_error";
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

async function ensureAdminRequest(request: Request) {
  const cookieSupabase = await createClient();
  const adminSupabase = createAdminClient();

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
              ? "กรุณาเข้าสู่ระบบด้วยบัญชี admin ก่อนตรวจสลิป"
              : "ระบบได้รับ session แล้ว แต่ session หมดอายุหรือใช้ตรวจไม่ได้ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่",
          ok: false,
        },
        { status: 401 },
      ),
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
    };
  }

  if (profileResult.data?.role !== "admin") {
    return {
      error: NextResponse.json(
        {
          authSource,
          message: "บัญชีนี้ไม่มีสิทธิ์ admin สำหรับตรวจสลิป",
          ok: false,
        },
        { status: 403 },
      ),
    };
  }

  return {
    authSource,
    error: null,
    userId: user.id,
  };
}

export async function POST(request: Request, context: RouteContext) {
  const adminCheck = await ensureAdminRequest(request);

  if (adminCheck.error) {
    return adminCheck.error;
  }

  const adminUserId = adminCheck.userId;

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

  const adminSupabase = createAdminClient();
  const paymentResult = await adminSupabase
    .from("product_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentResult.error) {
    return NextResponse.json(
      {
        message: paymentResult.error.message,
        ok: false,
      },
      { status: 500 },
    );
  }

  const payment = paymentResult.data;

  if (!payment) {
    return NextResponse.json(
      {
        message: "ไม่พบรายการชำระเงินนี้",
        ok: false,
      },
      { status: 404 },
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

  const amountToVerify = payment.slip_amount ?? payment.amount;
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
    failureKind === "unauthorized_provider"
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

    const orderUpdateResult = await adminSupabase
      .from("product_orders")
      .update({ payment_status: "paid" })
      .eq("id", payment.product_order_id)
      .select("*")
      .single();

    if (orderUpdateResult.error) {
      return NextResponse.json(
        {
          message: orderUpdateResult.error.message,
          ok: false,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "SlipOK ตรวจสลิปผ่านและอัปเดตเป็นชำระเงินแล้ว",
      ok: true,
      order: orderUpdateResult.data,
      payment: paymentUpdateResult.data,
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

  const paidPaymentsResult = await adminSupabase
    .from("product_payments")
    .select("id")
    .eq("product_order_id", payment.product_order_id)
    .eq("payment_status", "paid")
    .limit(1);

  if (paidPaymentsResult.error) {
    return NextResponse.json(
      {
        message: paidPaymentsResult.error.message,
        ok: false,
      },
      { status: 500 },
    );
  }

  const nextOrderPaymentStatus =
    (paidPaymentsResult.data?.length ?? 0) > 0 ? "paid" : "unpaid";

  const orderUpdateResult = await adminSupabase
    .from("product_orders")
    .update({ payment_status: nextOrderPaymentStatus })
    .eq("id", payment.product_order_id)
    .select("*")
    .single();

  if (orderUpdateResult.error) {
    return NextResponse.json(
      {
        message: orderUpdateResult.error.message,
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
      order: orderUpdateResult.data,
      payment: paymentUpdateResult.data,
      slipOkStatus: slipOkHttpResponse.status,
    },
    { status: 422 },
  );
}
