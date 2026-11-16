import { NextResponse } from "next/server";
import { getDocumentUrl } from "@fluxo/api";
import { db } from "@/lib/auth";

/** Redirects to a short-lived signed URL for a client's document. Never exposes a permanent public link. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  let supabase;
  try {
    supabase = await db();
  } catch {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  const { url, error } = await getDocumentUrl(supabase, id, docId);
  if (!url) return NextResponse.json({ error }, { status: error === "Documento não encontrado." ? 404 : 500 });
  return NextResponse.redirect(url);
}
