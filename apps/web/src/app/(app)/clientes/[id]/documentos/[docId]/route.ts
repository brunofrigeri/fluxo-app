import { NextResponse } from "next/server";
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
  const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", docId).eq("client_id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  const { data, error } = await supabase.storage.from("client-documents").createSignedUrl(doc.storage_path as string, 60);
  if (error || !data) return NextResponse.json({ error: "Não foi possível abrir o documento." }, { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
