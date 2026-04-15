import { NextRequest, NextResponse } from "next/server";

const COOKIE = "fundcalm_uid";

/**
 * If the user visits /dashboard without ?user= but has a fundcalm_uid cookie,
 * redirect them server-side before the page renders. This is more reliable than
 * any client-side approach because it runs before React hydrates.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/dashboard") {
    const hasUser = req.nextUrl.searchParams.get("user");
    if (!hasUser) {
      const uid = req.cookies.get(COOKIE)?.value;
      if (uid) {
        const url = req.nextUrl.clone();
        url.searchParams.set("user", uid);
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard"],
};
