import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { UserForm } from "@/components/UserForm";
import { getAdmin } from "@/lib/admin";
import { initialsOf } from "@/lib/age";
import { createClient } from "@/lib/supabase/server";
import { inviteUser, removeUser, updateUser } from "./actions";

export const metadata: Metadata = { title: "Usuários" };
export const dynamic = "force-dynamic";

type Search = { novo?: string; editar?: string };

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", instructor: "Instrutor" };

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<Search> }) {
  const me = await getAdmin();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/");

  const sp = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").order("name");
  if (error) throw new Error(`usuários: ${error.message}`);
  const users = data ?? [];
  const editing = users.find((u) => u.id === sp.editar) ?? null;

  return (
    <>
      <header className="pagehead row" style={{ justifyContent: "space-between" }}>
        <h1 className="t-display">Usuários</h1>
        <Link className="btn pri" href="/usuarios?novo=1"><Icon name="plus" size={16} />Convidar usuário</Link>
      </header>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        {users.length === 0 ? (
          <div className="empty"><Icon name="users" size={20} /><b style={{ color: "var(--ink)" }}>Nenhum usuário ainda</b></div>
        ) : (
          users.map((u) => (
            <div className="li" key={u.id as string}>
              <span className="avatar sm">{initialsOf(u.name as string)}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {u.name as string}
                  {u.id === me.id && <span className="t-small muted"> (você)</span>}
                </div>
                <div className="t-small muted" style={{ overflowWrap: "anywhere" }}>{u.email as string}</div>
              </div>
              <span className={`pill${u.role === "admin" ? " acc" : ""}`}>{ROLE_LABEL[u.role as string] ?? u.role}</span>
              {u.working_hours && <span className="t-small muted">{u.working_hours as string}</span>}
              <Link className="ibtn" href={`/usuarios?editar=${u.id}`} aria-label="Editar"><Icon name="edit" /></Link>
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

      {sp.novo === "1" && (
        <Modal title="Convidar usuário" closeHref="/usuarios">
          <UserForm mode="invite" action={inviteUser} values={{ name: "", email: "", role: "instructor", working_hours: "" }} closeHref="/usuarios" />
        </Modal>
      )}

      {editing && (
        <Modal title={`Editar ${editing.name}`} closeHref="/usuarios">
          <UserForm
            mode="edit"
            action={updateUser.bind(null, editing.id as string)}
            values={{
              name: editing.name as string,
              email: editing.email as string,
              role: editing.role as "admin" | "instructor",
              working_hours: (editing.working_hours as string | null) ?? "",
            }}
            closeHref="/usuarios"
          />
        </Modal>
      )}
    </>
  );
}
