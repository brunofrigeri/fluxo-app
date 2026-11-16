import { roleLabels } from "@fluxo/copy";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Icon } from "@/components/Icon";
import { ModalityTag } from "@/components/ModalityTag";
import { UserDialog } from "@/components/UserDialog";
import { getAdmin } from "@/lib/admin";
import { initialsOf } from "@fluxo/domain";
import { getStudioModalities } from "@/lib/modalities";
import { createClient } from "@/lib/supabase/server";
import { removeUser } from "./actions";

export const metadata: Metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = roleLabels;

export default async function UsuariosPage() {
  const me = await getAdmin();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/");

  const supabase = await createClient();
  const [{ data, error }, taught, modalities] = await Promise.all([
    supabase.from("profiles").select("*").order("name"),
    supabase.from("user_modalities").select("user_id, modality_id"),
    getStudioModalities(),
  ]);
  if (error) throw new Error(`usuários: ${error.message}`);
  if (taught.error) throw new Error(`modalidades dos usuários: ${taught.error.message}`);
  const users = data ?? [];
  const modalityIdsOf = (userId: string) => (taught.data ?? []).filter((t) => t.user_id === userId).map((t) => t.modality_id as string);
  const dialogModalities = modalities.map((m) => ({ id: m.id, name: m.name }));

  return (
    <>
      <header className="pagehead row" style={{ justifyContent: "space-between" }}>
        <h1 className="t-display">Usuários</h1>
        <UserDialog mode="invite" modalities={dialogModalities} />
      </header>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {users.length === 0 ? (
          <div className="empty"><Icon name="shield" size={20} /><b style={{ color: "var(--ink)" }}>Nenhum usuário ainda</b></div>
        ) : (
          users.map((u) => (
            <div className="li user-row" key={u.id as string}>
              <span className="avatar sm">{initialsOf(u.name as string)}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {u.name as string}
                  {u.id === me.id && <span className="t-small muted"> (você)</span>}
                </div>
                <div className="t-small muted" style={{ overflowWrap: "anywhere" }}>{u.email as string}</div>
              </div>
              <div className="user-meta">
              <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {modalities.filter((m) => modalityIdsOf(u.id as string).includes(m.id)).map((m) => (
                  <ModalityTag key={m.id} modality={m.key} />
                ))}
              </span>
              <span className={`pill${u.role === "admin" ? " acc" : ""}`}>{ROLE_LABEL[u.role as string] ?? u.role}</span>
              {u.working_hours && <span className="t-small muted">{u.working_hours as string}</span>}
              </div>
              <UserDialog
                mode="edit"
                userId={u.id as string}
                name={u.name as string}
                modalities={dialogModalities}
                values={{
                  name: u.name as string,
                  email: u.email as string,
                  role: u.role as "admin" | "instructor",
                  working_hours: (u.working_hours as string | null) ?? "",
                  modality_ids: modalityIdsOf(u.id as string),
                }}
              />
              {u.id !== me.id && (
                <form action={removeUser.bind(null, u.id as string)}>
                  <ConfirmButton className="ibtn" ariaLabel="Remover usuário" message={`Remover ${u.name}? A conta e o acesso ao Fluxo são excluídos; os clientes dessa pessoa ficam sem instrutor atribuído.`}>
                    <Icon name="x" size={16} />
                  </ConfirmButton>
                </form>
              )}
            </div>
          ))
        )}
      </section>
    </>
  );
}
