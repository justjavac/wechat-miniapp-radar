import { NextResponse } from "next/server";
import crypto from "crypto";
import { ADMIN_SESSION_COOKIE, isAdminTokenValid } from "@/lib/admin-auth";

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function adminRedirect(request: Request, search = "") {
  return NextResponse.redirect(new URL(`/admin${search}`, request.url), 303);
}

function clearAdminSession(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const token = form?.get("token");

  if (typeof token !== "string" || !isAdminTokenValid(token)) {
    const response = adminRedirect(request, "?auth=failed");
    clearAdminSession(response);
    return response;
  }

  const response = adminRedirect(request);
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  response.cookies.set(ADMIN_SESSION_COOKIE, tokenHash, {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}

export async function DELETE(request: Request) {
  const response = adminRedirect(request);
  clearAdminSession(response);
  return response;
}
