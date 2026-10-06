import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Seg } from "@/components/Seg";
import { formatShort, hhmm, todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type Search = { q?: string; situacao?: string; pagina?: string };

function href(params: { q?: string; situacao: string; pagina?: number }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.situacao !== "ativos") sp.set("situacao", params.situacao);
  if (params.pagina && params.pagina > 1) sp.set("pagina", String(params.pagina));
  const qs = sp.toString();
  return qs ? `/clientes?${qs}` : "/clientes";
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default async function ClientesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const situacao = sp.situacao === "arquivados" ? "arquivados" : "ativos";
  const q = (sp.q ?? "").replace(/[,()%*]/g, " ").trim();
  const pagina = Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1);
  const from = (pagina - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, name, phone, active", { count: "exact" })
    .eq("active", situacao === "ativos")
    .order("name")
    .range(from, from + PAGE_SIZE - 1);
  if (q) query = query.or(`name.ilike.%${q}%,document.ilike.%${q}%`);

  const { data, count, error } = await query;
  if (error) throw new Error(`clientes: ${error.message}`);
  const clients = data ?? [];
  const ids = clients.map((c) => c.id as string);
  const today = todayISO();

  // Next session and weekly frequency for the clients on this page.
  const nextByClient = new Map<string, string>();
  const freqByClient = new Map<string, number>();
  if (ids.length > 0) {
    const [nextRes, slotsRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("client_id, date, start_time")
        .in("client_id", ids)
        .gte("date", today)
        .or("status.is.null,status.eq.PRESENCE_CONFIRMED,status.eq.REPLACEMENT")
        .order("date")
        .order("start_time")
        .limit(500),
      supabase
        .from("recurring_slots")
        .select("client_id")
        .in("client_id", ids)
        .or(`active_until.is.null,active_until.gte.${today}`),
    ]);
    if (nextRes.error) throw new Error(`próximas sessões: ${nextRes.error.message}`);
    if (slotsRes.error) throw new Error(`horários fixos: ${slotsRes.error.message}`);
    for (const b of nextRes.data ?? []) {
      const id = b.client_id as string;
      if (!nextByClient.has(id)) nextByClient.set(id, `${formatShort(b.date as string)}, ${hhmm(b.start_time as string)}`);
    }
    for (const s of slotsRes.data ?? []) {
      const id = s.client_id as string;
      freqByClient.set(id, (freqByClient.get(id) ?? 0) + 1);
    }
  }

  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <header className="pagehead">
        <h1 className="t-display">Clientes</h1>
        <Link className="btn pri" href="/clientes/novo"><Icon name="plus" size={18} />Novo cliente</Link>
      </header>

      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row" style={{ padding: "16px 20px", gap: 16, flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
          <form action="/clientes" method="get" className="inwrap" style={{ width: 380, maxWidth: "100%" }} role="search">
            <span className="ic i-search lead" aria-hidden="true" />
            <input className="input with-ic" name="q" defaultValue={sp.q ?? ""} aria-label="Buscar por nome ou documento" placeholder="Buscar por nome ou documento" />
            {situacao === "arquivados" && <input type="hidden" name="situacao" value="arquivados" />}
          </form>
          <Seg
            label="Situação"
            style={{ marginLeft: "auto" }}
            items={[
              { href: href({ q, situacao: "ativos" }), label: "Ativos", on: situacao === "ativos" },
              { href: href({ q, situacao: "arquivados" }), label: "Arquivados", on: situacao === "arquivados" },
            ]}
          />
        </div>

        {clients.length === 0 ? (
          <div className="empty">
            <div className="badge"><Icon name="users" size={20} /></div>
            <h2 className="t-h3" style={{ color: "var(--ink)" }}>{q ? "Nenhum cliente encontrado" : situacao === "ativos" ? "Nenhum cliente ainda" : "Nenhum cliente arquivado"}</h2>
            <p className="t-small">{q ? "Tente buscar por outro nome ou documento." : "Os clientes cadastrados aparecem aqui."}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Próxima sessão</th>
                  <th>Frequência semanal</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const id = c.id as string;
                  const freq = freqByClient.get(id);
                  const archived = !c.active;
                  return (
                    <tr key={id} className={archived ? "arch" : ""}>
                      <td>
                        <div className="row">
                          <span className="avatar sm">{initials(c.name as string)}</span>
                          <Link className="tag-link" href={`/clientes/${id}`}>{c.name as string}</Link>
                        </div>
                      </td>
                      <td>{(c.phone as string | null) ?? "—"}</td>
                      <td>{archived ? "—" : (nextByClient.get(id) ?? "Sem sessão marcada")}</td>
                      <td>{freq ? `${freq}x por semana` : "—"}</td>
                      <td><span className={`pill${archived ? "" : " acc"}`}>{archived ? "Arquivado" : "Ativo"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="row" style={{ padding: "14px 20px", justifyContent: "space-between", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
            <span className="t-small muted">
              {from + 1} a {Math.min(from + PAGE_SIZE, total)} de {total} {total === 1 ? "cliente" : "clientes"}
            </span>
            <div className="row" style={{ gap: 6 }}>
              {pagina > 1 ? (
                <Link className="btn sm icon" href={href({ q, situacao, pagina: pagina - 1 })} aria-label="Página anterior"><Icon name="chevl" size={16} /></Link>
              ) : (
                <span className="btn sm icon dis" aria-hidden="true"><Icon name="chevl" size={16} /></span>
              )}
              <span className="pill acc">{pagina}</span>
              <span className="t-small muted">de {lastPage}</span>
              {pagina < lastPage ? (
                <Link className="btn sm icon" href={href({ q, situacao, pagina: pagina + 1 })} aria-label="Próxima página"><Icon name="chevr" size={16} /></Link>
              ) : (
                <span className="btn sm icon dis" aria-hidden="true"><Icon name="chevr" size={16} /></span>
              )}
            </div>
          </div>
        )}
      </section>

      <p className="t-small muted" style={{ marginTop: 14 }}>Clientes arquivados ficam esmaecidos e não recebem novos agendamentos.</p>
    </>
  );
}
