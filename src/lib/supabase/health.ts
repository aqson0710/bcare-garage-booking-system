import { getSupabaseConfig } from "./config";

type SupabaseHealthResult = {
  ok: boolean;
  reachable?: boolean;
  status?: number;
  host?: string;
  message: string;
  error?: string;
  errorName?: string;
  errorCause?: string;
};

function getErrorCause(error: unknown): string | undefined {
  if (
    error &&
    typeof error === "object" &&
    "cause" in error &&
    error.cause instanceof Error
  ) {
    return error.cause.message;
  }

  return undefined;
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthResult> {
  let config: ReturnType<typeof getSupabaseConfig>;

  try {
    config = getSupabaseConfig();
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid Supabase config.",
    };
  }

  try {
    const host = new URL(config.url).host;
    const response = await fetch(`${config.url}/rest/v1/`, {
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`,
      },
      cache: "no-store",
    });

    const isReachable = response.ok || response.status === 401 || response.status === 403;

    return {
      ok: isReachable,
      reachable: isReachable,
      status: response.status,
      host,
      message: response.ok
        ? "Supabase connection is reachable."
        : "Supabase project is reachable. The Data API root endpoint requires elevated access, so this public key is expected to receive an authorization response.",
    };
  } catch (error) {
    return {
      ok: false,
      host: new URL(config.url).host,
      message: "Supabase connection failed.",
      error: error instanceof Error ? error.message : "Unknown connection error.",
      errorName: error instanceof Error ? error.name : undefined,
      errorCause: getErrorCause(error),
    };
  }
}
