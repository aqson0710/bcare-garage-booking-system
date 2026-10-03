import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

// Server-side gate for the staff areas. Runs before /admin and /technician
// pages render, so a visitor without the right role is redirected straight
// away instead of loading the admin/technician app and seeing an error.
//
// This is a first line of defence for navigation only. The data itself is
// still protected by Supabase RLS policies, which apply no matter how a
// request reaches the database.

const roleForPath: { prefix: string; role: "admin" | "technician" }[] = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/technician", role: "technician" },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rule = roleForPath.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!rule) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // Lets Supabase refresh an expiring session cookie on the way through.
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // getClaims() verifies the session token instead of trusting the cookie.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth";
    loginUrl.search = "";
    return withSessionCookies(NextResponse.redirect(loginUrl), response);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.role !== rule.role) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return withSessionCookies(NextResponse.redirect(homeUrl), response);
  }

  return response;
}

// Keep any refreshed session cookies when we redirect.
function withSessionCookies(redirect: NextResponse, from: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export const config = {
  matcher: ["/admin/:path*", "/technician/:path*"],
};
