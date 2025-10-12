import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { DriverLayout } from "@/components/driver/driver-layout";

export const dynamic = "force-dynamic";

function getSecret(): Uint8Array {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export default async function DriverRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tp-session")?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== "driver") {
      redirect("/");
    }
  } catch {
    redirect("/login");
  }

  return <DriverLayout>{children}</DriverLayout>;
}
