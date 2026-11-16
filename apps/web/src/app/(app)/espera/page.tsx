import type { Metadata } from "next";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Icon } from "@/components/Icon";
import { Seg } from "@/components/Seg";
import { ModalityTag } from "@/components/ModalityTag";
import { WaitEditDialog } from "@/components/WaitEditDialog";
import { WaitForm } from "@/components/WaitForm";
import { getStudioModalities } from "@/lib/modalities";
import { formatBR, todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { PERIODS, PERIOD_LABELS, PERIOD_SLUGS, periodFromSlug, type Period } from "@/lib/waitlist";
import { addToWaitList, removeFromWaitList } from "./actions";

export const metadata: Metadata = { title: "Lista de espera" };
export const dynamic = "force-dynamic";

type Search = { periodo?: string };

function href(periodo: Period | null): string {
  const sp = new URLSearchParams();
  if (periodo) sp.set("periodo", PERIOD_SLUGS[periodo]);
  const qs = sp.toString();
  return qs ? `/espera?${qs}` : "/espera";
}

export default async function WaitListPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const filter = periodFromSlug(sp.periodo);

  const supabase = await createClient();
  const [{ data, error }, modalities] = await Promise.all([
    supabase.from("wait_list").select("id, name, phone, period, created_at, modality_id").order("created_at"),
    getStudioModalities(),
  ]);
  if (error) throw new Error(`lista de espera: ${error.message}`);
  const modalityOf = new Map(modalities.map((m) => [m.id, m]));
  // Entries for a modality the studio has switched off are hidden entirely (and kept, in case it is switched back on).
  const all = ((data ?? []) as { id: string; name: string; phone: string; period: Period; created_at: string; modality_id: string }[]).filter((r) => modalityOf.has(r.modality_id));

  const counts: Record<Period, number> = { MORNING: 0, AFTERNOON: 0, NIGHT: 0 };
  for (const r of all) counts[r.period] += 1;
  const rows = filter ? all.filter((r) => r.period === filter) : all;
  const dialogModalities = modalities.map((m) => ({ id: m.id, name: m.name }));

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
        <WaitForm action={addToWaitList} modalities={modalities} />
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
                  {modalities.length > 1 && <th>Modalidade</th>}
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
                    {modalities.length > 1 && <td>{modalityOf.get(r.modality_id) ? <ModalityTag modality={modalityOf.get(r.modality_id)!.key} /> : "—"}</td>}
                    <td><span className="pill">{PERIOD_LABELS[r.period]}</span></td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <WaitEditDialog id={r.id} name={r.name} phone={r.phone} period={r.period} modalityId={r.modality_id} modalities={dialogModalities} />
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
    </>
  );
}
