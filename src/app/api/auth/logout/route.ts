import { NextResponse } from "next/server";
import { COOKIE_NAME, cookieOptions, getSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { logAudit } from "@/lib/audit";

export async function POST() {
  // Try to get user id for audit logging before clearing the cookie
  const cookieStore = await cookies();
  const session = await getSession(cookieStore);

  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0,
  });

  if (session) {
    logAudit({
      action: "logout",
      entityType: "auth",
      actorId: session.userId,
    });
  }

  return response;
}
