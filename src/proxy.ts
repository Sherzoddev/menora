import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    let isAdmin = false;
    if (user) {
      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = !!adminRow;
    }

    const isLoginPage = pathname === "/admin/login";

    if (!isLoginPage && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    if (isLoginPage && isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.searchParams.delete("redirect");
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (pathname.startsWith("/cabinet")) {
    let isOwner = false;
    if (user) {
      const { data: ownerRow } = await supabase
        .from("venue_users")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      isOwner = !!ownerRow;
    }

    const isLoginPage = pathname === "/cabinet/login";
    const isActivatePage = pathname === "/cabinet/activate";

    if (!isLoginPage && !isActivatePage && !isOwner) {
      const url = request.nextUrl.clone();
      url.pathname = "/cabinet/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    if (isLoginPage && isOwner) {
      const url = request.nextUrl.clone();
      url.pathname = "/cabinet";
      url.searchParams.delete("redirect");
      return NextResponse.redirect(url);
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/cabinet/:path*"],
};
