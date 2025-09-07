import { OrderForm } from "@/components/forms/order-form";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { PublicItem, TokenGrade } from "@/types/database";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ token: string }>;
}

type TokenError = "invalid" | "expired" | "locked" | "used" | "rate_limited";

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<TokenError, { title: string; description: string }> = {
  invalid: {
    title: "Invalid Link",
    description:
      "This order link does not exist or has been removed. Please contact your supplier to get a new link.",
  },
  expired: {
    title: "Link Expired",
    description:
      "This order link has expired. Links are valid for a limited time. Please request a new one.",
  },
  locked: {
    title: "Access Locked",
    description:
      "This link has been locked due to too many access attempts. Please contact your supplier.",
  },
  used: {
    title: "Link Already Used",
    description: "This order link has already been used. Each link can only be used once.",
  },
  rate_limited: {
    title: "Too Many Requests",
    description: "You are making too many requests. Please wait a moment and try again.",
  },
};

function mapErrorCode(code: string): TokenError {
  switch (code) {
    case "TOKEN_NOT_FOUND":
      return "invalid";
    case "TOKEN_EXPIRED":
      return "expired";
    case "TOKEN_LOCKED":
    case "TOKEN_MAX_ATTEMPTS":
      return "locked";
    case "TOKEN_USED":
      return "used";
    case "RATE_LIMITED":
      return "rate_limited";
    default:
      return "invalid";
  }
}

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────

export default async function OrderFormPage({ params }: PageProps) {
  const { token: tokenValue } = await params;

  // Build absolute URL for internal API call
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${protocol}://${host}`;

  const res = await fetch(`${baseUrl}/api/tokens/${tokenValue}`, {
    headers: {
      "x-forwarded-for": headersList.get("x-forwarded-for") ?? "127.0.0.1",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.json()) as { code?: string };
    const errorType = mapErrorCode(body.code ?? "");
    const { title, description } = ERROR_MESSAGES[errorType];

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const data = (await res.json()) as {
    grade: TokenGrade;
    expires_at: string;
    items: PublicItem[];
    settings?: {
      currency_symbol?: string;
      delivery_fee_tiers?: { min_miles: number; max_miles: number; fee: number }[];
    };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-5 md:p-6 lg:p-8">
        <OrderForm
          items={data.items}
          token={tokenValue}
          grade={data.grade}
          expiresAt={data.expires_at}
          currencySymbol={data.settings?.currency_symbol}
          feeTiers={data.settings?.delivery_fee_tiers}
        />
      </div>
    </div>
  );
}
