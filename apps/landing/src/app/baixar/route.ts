import { NextResponse, type NextRequest } from "next/server";
import { destinationFor, platformOf } from "@/lib/stores";
import { appStoreUrl, playStoreUrl, signInUrl } from "@/lib/urls";

// A link that sends each phone to its own store (and everything else to the web app). Put it behind a QR code,
// a social bio or an e-mail: one address that works everywhere.
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const to = destinationFor(platformOf(req.headers.get("user-agent")), { appStoreUrl, playStoreUrl, webUrl: signInUrl });
  const res = NextResponse.redirect(to, 302);
  res.headers.set("Vary", "User-Agent");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
