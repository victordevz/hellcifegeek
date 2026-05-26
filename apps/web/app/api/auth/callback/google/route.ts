import { NextRequest, NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";

function siteUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("google_oauth_state")?.value;
  const homeUrl = new URL("/", siteUrl(request));

  const redirectWithError = (message: string) => {
    homeUrl.hash = `auth_error=${encodeURIComponent(message)}`;
    const redirect = NextResponse.redirect(homeUrl);
    redirect.cookies.set("google_oauth_state", "", {
      maxAge: 0,
      path: "/api/auth/callback/google"
    });
    return redirect;
  };

  if (error || !code) {
    return redirectWithError(error ?? "google_callback_sem_codigo");
  }

  if (!state || !storedState || state !== storedState) {
    return redirectWithError("google_state_invalido");
  }

  const response = await fetch(`${apiUrl}/auth/google/callback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code,
      redirectUri: `${siteUrl(request)}/api/auth/callback/google`
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: "google_auth_failed" })) as { message?: string };
    return redirectWithError(data.message ?? "google_auth_failed");
  }

  const data = (await response.json()) as { token: string; user: unknown };
  const params = new URLSearchParams({
    auth_token: data.token,
    auth_user: JSON.stringify(data.user)
  });
  homeUrl.hash = params.toString();

  const redirect = NextResponse.redirect(homeUrl);
  redirect.cookies.set("google_oauth_state", "", {
    maxAge: 0,
    path: "/api/auth/callback/google"
  });

  return redirect;
}
