import { NextRequest, NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";

function siteUrl(request: NextRequest) {
  return process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
}

export function GET(request: NextRequest) {
  const redirectUri = `${siteUrl(request)}/api/auth/callback/google`;
  const state = crypto.randomUUID();
  const mode = request.nextUrl.searchParams.get("mode") === "signup" ? "signup" : "login";
  const termsAccepted = request.nextUrl.searchParams.get("termsAccepted") === "1";
  const marketingEmailsOptIn = request.nextUrl.searchParams.get("marketingEmailsOptIn") === "1";
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
  response.cookies.set("google_oauth_mode", mode, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/api/auth/callback/google",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:"
  });
  response.cookies.set("google_oauth_terms", termsAccepted ? "true" : "false", {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/api/auth/callback/google",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:"
  });
  response.cookies.set("google_oauth_marketing", marketingEmailsOptIn ? "true" : "false", {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/api/auth/callback/google",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:"
  });

  return response;
}
