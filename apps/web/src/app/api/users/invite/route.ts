import { NextResponse } from "next/server";
import { z } from "zod";
import { clientFromBearer, originOf } from "@/lib/bearer";
import { inviteUserServer } from "@/lib/users-server";

const body = z.object({ name: z.string(), email: z.string(), role: z.string(), workingHours: z.string().nullable().optional(), modalityIds: z.array(z.string()) });

/** Invite a user. For the mobile app: Authorization: Bearer <access token>. Admin only (checked in inviteUserServer). */
export async function POST(req: Request) {
  const supabase = clientFromBearer(req);
  if (!supabase) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const r = await inviteUserServer(supabase, { ...parsed.data, workingHours: parsed.data.workingHours ?? null }, originOf(req));
  return r.error ? NextResponse.json({ error: r.error }, { status: 400 }) : NextResponse.json({ ok: true });
}
