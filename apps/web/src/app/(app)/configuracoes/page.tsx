import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModalityToggle } from "@/components/ModalityToggle";
import { getAdmin } from "@/lib/admin";
import { getModalities, getStudioModalities } from "@/lib/modalities";

export const metadata: Metadata = { title: "Configurações" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await getAdmin();
  if (!me) redirect("/login");
  if (me.role !== "admin") redirect("/");

  const [all, enabled] = await Promise.all([getModalities(), getStudioModalities()]);
  const on = new Set(enabled.map((m) => m.id));

  return (
    <>
      <header className="pagehead">
        <h1 className="t-display">Configurações</h1>
      </header>
      <section className="card" style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h2 className="t-h2">Modalidades</h2>
          <p className="t-small muted" style={{ marginTop: 4 }}>
            Escolha o que o estúdio oferece. Cada modalidade tem a própria agenda, avaliação e evolução. Uma modalidade só pode ser desativada quando nenhum cliente está inscrito nela.
          </p>
        </div>
        {all.map((m) => (
          <ModalityToggle key={m.id} modalityId={m.id} name={m.name} enabled={on.has(m.id)} />
        ))}
        <p className="help">Depois de ativar uma modalidade, marque quem a ensina em Usuários.</p>
      </section>
    </>
  );
}
