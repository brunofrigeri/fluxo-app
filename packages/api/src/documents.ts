import type { SupabaseClient } from "@supabase/supabase-js";
import { attempt, friendly, NOT_ALLOWED, type Result } from "./errors";

export const DOCUMENTS_BUCKET = "client-documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"] as const;

export type DocumentItem = { id: string; name: string; mimeType: string; sizeBytes: number; createdAt: string };

export async function listDocuments(supabase: SupabaseClient, clientId: string): Promise<DocumentItem[]> {
  const { data, error } = await supabase.from("documents").select("id, name, mime_type, size_bytes, created_at").eq("client_id", clientId).is("payment_id", null).order("created_at", { ascending: false });
  if (error) throw new Error(`documentos: ${error.message}`);
  return (data ?? []).map((d) => ({ id: d.id as string, name: d.name as string, mimeType: d.mime_type as string, sizeBytes: d.size_bytes as number, createdAt: d.created_at as string }));
}

/** A random id for the storage path. React Native has no `crypto.randomUUID` by default; the path is not a secret (RLS guards it). */
function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** "230 KB", "1.4 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type UploadInput = {
  clientId: string;
  /** A Blob/File on the web, an ArrayBuffer on mobile. */
  body: Blob | ArrayBuffer | Uint8Array;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Shown name; the file name when empty. */
  label?: string;
  /** Makes this file the receipt of a payment: admins only, kept apart from the client's own documents. */
  paymentId?: string;
};

/** Uploads to the private bucket, then records it. If recording fails the file is removed again. */
export function uploadDocument(supabase: SupabaseClient, input: UploadInput): Promise<Result> {
  return attempt(async () => {
    if (!input.sizeBytes) return { error: "Escolha um arquivo." };
    if (!(ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(input.mimeType)) return { error: "Formato não suportado. Envie PDF, JPG, PNG ou HEIC." };
    if (input.sizeBytes > MAX_DOCUMENT_BYTES) return { error: "O arquivo deve ter até 10MB." };

    const label = input.label?.trim() || input.fileName;
    const ext = input.fileName.includes(".") ? input.fileName.slice(input.fileName.lastIndexOf(".")) : "";
    // Receipts live under "<clientId>/payments/": storage policies hide that folder from non-admins.
    const path = input.paymentId ? `${input.clientId}/payments/${randomId()}${ext}` : `${input.clientId}/${randomId()}${ext}`;
    const { error: uploadError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, input.body, { contentType: input.mimeType });
    if (uploadError) return { error: friendly(uploadError) };
    const { error } = await supabase.from("documents").insert({ client_id: input.clientId, name: label, storage_path: path, mime_type: input.mimeType, size_bytes: input.sizeBytes, payment_id: input.paymentId ?? null });
    if (error) {
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
      return { error: friendly(error) };
    }
    return {};
  });
}

export function deleteDocument(supabase: SupabaseClient, clientId: string, documentId: string): Promise<Result> {
  return attempt(async () => {
    const { data: doc, error: findError } = await supabase.from("documents").select("storage_path").eq("id", documentId).eq("client_id", clientId).maybeSingle();
    if (findError) return { error: friendly(findError) };
    if (!doc) return { error: NOT_ALLOWED };
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path as string]);
    const { error } = await supabase.from("documents").delete().eq("id", documentId).eq("client_id", clientId);
    return error ? { error: friendly(error) } : {};
  });
}

/** A short-lived (60 s) signed URL. Never a permanent public link. */
export async function getDocumentUrl(supabase: SupabaseClient, clientId: string, documentId: string): Promise<{ url?: string; error?: string }> {
  try {
    const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", documentId).eq("client_id", clientId).maybeSingle();
    if (!doc) return { error: "Documento não encontrado." };
    const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.storage_path as string, 60);
    if (error || !data) return { error: "Não foi possível abrir o documento." };
    return { url: data.signedUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
