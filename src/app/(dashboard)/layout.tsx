import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { DashboardSidebar, DashboardHeader, PageTransition } from "@/components/layout";

export const dynamic = "force-dynamic";

function getSecret(): Uint8Array {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

export default async function DashboardLayout({
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
    await jwtVerify(token, getSecret());
  } catch {
    redirect("/login");
  }

  return (
    <div className="relative flex min-h-screen">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <DashboardSidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden lg:pl-64">
        <DashboardHeader />
        <main className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
