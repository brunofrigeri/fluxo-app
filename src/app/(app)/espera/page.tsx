import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { Seg } from "@/components/Seg";
import { WaitForm } from "@/components/WaitForm";
import { formatBR, todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { PERIODS, PERIOD_LABELS, PERIOD_SLUGS, periodFromSlug, type Period } from "@/lib/waitlist";
import { addToWaitList, removeFromWaitList, updateWaitEntry } from "./actions";

export const metadata: Metadata = { title: "Lista de espera" };
export const dynamic = "force-dynamic";

type Search = { periodo?: string; editar?: string };

function href(periodo: Period | null, editar?: string): string {
  const sp = new URLSearchParams();
  if (periodo) sp.set("periodo", PERIOD_SLUGS[periodo]);
  if (editar) sp.set("editar", editar);
  const qs = sp.toString();
  return qs ? `/espera?${qs}` : "/espera";
}

export default async function WaitListPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const filter = periodFromSlug(sp.periodo);

  const supabase = await createClient();
  const { data, error } = await supabase.from("wait_list").select("id, name, phone, period, created_at").order("created_at");
  if (error) throw new Error(`lista de espera: ${error.message}`);
  const all = (data ?? []) as { id: string; name: string; phone: string; period: Period; created_at: string }[];

  const counts: Record<Period, number> = { MORNING: 0, AFTERNOON: 0, NIGHT: 0 };
  for (const r of all) counts[r.period] += 1;
  const rows = filter ? all.filter((r) => r.period === filter) : all;
  const editing = sp.editar ? all.find((r) => r.id === sp.editar) : undefined;

  return (
    <>
      <header className="pagehead">
        <div>
          <h1 className="t-display">Lista de espera</h1>
          <p className="t-body muted" style={{ marginTop: 2 }}>
            {all.length === 0 ? "Ninguém na lista" : `${all.length} ${all.length === 1 ? "pessoa" : "pessoas"} esperando uma vaga`}. Quem entra primeiro aparece primeiro.
          </p>
        </div>
      </header>

      <section className="card" style={{ marginBottom: 20 }} aria-labelledby="add-h">
        <h2 className="t-h3" id="add-h" style={{ marginBottom: 14 }}>Adicionar à lista</h2>
        <WaitForm action={addToWaitList} />
      </section>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <Seg
            label="Período"
            items={[
              { href: href(null), label: `Todos (${all.length})`, on: filter === null },
              ...PERIODS.map((p) => ({ href: href(p), label: `${PERIOD_LABELS[p]} (${counts[p]})`, on: filter === p })),
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <div className="empty">
            <div className="badge"><Icon name="clock" size={20} /></div>
            <b style={{ color: "var(--ink)" }}>{filter ? "Ninguém na lista para este período" : "Ninguém na lista de espera"}</b>
            <span className="t-small">{filter ? "Escolha outro período ou veja todos." : "Adicione quem está esperando uma vaga no formulário acima."}</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Período</th>
                  <th style={{ width: 120, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div className="t-small muted">Na lista desde {formatBR(todayISO(new Date(r.created_at)))}</div>
                    </td>
                    <td><a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a></td>
                    <td><span className="pill">{PERIOD_LABELS[r.period]}</span></td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link className="ibtn" href={href(filter, r.id)} aria-label={`Editar ${r.name}`}><Icon name="edit" /></Link>
                      <form action={removeFromWaitList.bind(null, r.id)} style={{ display: "inline" }}>
                        <ConfirmButton className="ibtn" ariaLabel={`Remover ${r.name} da lista`} message={`Remover ${r.name} da lista de espera?`}>
                          <Icon name="x" />
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <Modal title="Editar pessoa da lista" closeHref={href(filter)} width={520}>
          <WaitForm key={editing.id} action={updateWaitEntry.bind(null, editing.id)} initial={{ name: editing.name, phone: editing.phone, period: editing.period }} closeHref={href(filter)} />
        </Modal>
      )}
    </>
  );
}
