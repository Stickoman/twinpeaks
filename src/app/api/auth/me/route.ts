import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore);

  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return NextResponse.json({
    userId: session.userId,
    role: session.role,
    username: session.username,
  });
}
