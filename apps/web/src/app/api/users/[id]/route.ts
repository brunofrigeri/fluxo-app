import { NextResponse } from "next/server";
import { clientFromBearer } from "@/lib/bearer";
import { removeUserServer } from "@/lib/users-server";

/** Remove a user. For the mobile app: Authorization: Bearer <access token>. Admin only (checked in removeUserServer). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = clientFromBearer(req);
  if (!supabase) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  const { id } = await params;
  const r = await removeUserServer(supabase, id);
  return r.error ? NextResponse.json({ error: r.error }, { status: 400 }) : NextResponse.json({ ok: true });
}
