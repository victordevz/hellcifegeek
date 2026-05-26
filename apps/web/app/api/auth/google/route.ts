import { NextRequest, NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";

function siteUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
}

export function GET(request: NextRequest) {
  const redirectUri = `${siteUrl(request)}/api/auth/callback/google`;
  const state = crypto.randomUUID();
  const url = new URL(`${apiUrl}/auth/google`);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/api/auth/callback/google",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:"
  });

  return response;
}
