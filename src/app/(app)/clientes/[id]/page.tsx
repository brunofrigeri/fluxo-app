import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/ClientForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EvaluationForm } from "@/components/EvaluationForm";
import { Icon } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { TagList } from "@/components/TagList";
import { Tabs } from "@/components/Tabs";
import { getAdmin } from "@/lib/admin";
import { ageFrom, initialsOf } from "@/lib/age";
import { summarize } from "@/lib/apparatus";
import { formatBR, hhmm, todayISO, weekdayName } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { addRecurringSlot, deleteDocument, deleteEvaluation, removeRecurringSlot, saveEvaluation, setArchived, updateClientAction, uploadDocument } from "../actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Params = { id: string };
type Search = { aba?: string; pagina?: string; avaliacao?: string; salvo?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("name").eq("id", id).maybeSingle();
  return { title: (data?.name as string | undefined) ?? "Cliente" };
}

export default async function ClientPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const aba = sp.aba === "evolucoes" || sp.aba === "avaliacoes" ? sp.aba : "dados";
  const supabase = await createClient();

  const [me, clientRes, slotsRes, instructorsRes] = await Promise.all([
    getAdmin(),
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("recurring_slots").select("id, weekday, start_time, active_until").eq("client_id", id).order("weekday").order("start_time"),
    supabase.from("profiles").select("id, name").order("name"),
  ]);
  if (clientRes.error) throw new Error(`cliente: ${clientRes.error.message}`);
  const client = clientRes.data;
  if (!client) notFound();
  const instructors = (instructorsRes.data ?? []) as { id: string; name: string }[];
  const canReassign = me?.role === "admin";

  const today = todayISO();
  const slots = (slotsRes.data ?? []).filter((s) => !s.active_until || (s.active_until as string) >= today);
  const sortedSlots = [...slots].sort((a, b) => WEEKDAY_ORDER.indexOf(a.weekday as number) - WEEKDAY_ORDER.indexOf(b.weekday as number) || (a.start_time as string).localeCompare(b.start_time as string));
  const age = ageFrom(client.date_of_birth as string | null, today);
  const active = client.active as boolean;
  const base = `/clientes/${id}`;

  return (
    <>
      <nav className="t-small muted row" style={{ gap: 6, marginBottom: 14, flexWrap: "wrap" }} aria-label="Você está em">
        <Link href="/clientes">Clientes</Link>
        <Icon name="chevr" size={14} />
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{client.name as string}</span>
        {aba !== "dados" && (
          <>
            <Icon name="chevr" size={14} />
            <span>{aba === "evolucoes" ? "Evoluções" : "Avaliações"}</span>
          </>
        )}
      </nav>

      <section className="card" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", padding: "24px 28px" }}>
        <span className="avatar lg">{initialsOf(client.name as string)}</span>
        <div className="grow" style={{ minWidth: 260, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <h1 className="t-h1">{client.name as string}</h1>
            {age !== null && <span className="t-body muted">{age} anos</span>}
            <span className={`pill${active ? " acc" : ""}`}>{active ? "Ativo" : "Arquivado"}</span>
          </div>
          <div className="row t-small muted" style={{ gap: 20, flexWrap: "wrap" }}>
            {client.phone && <span className="row" style={{ gap: 6 }}><Icon name="phone" size={16} />{client.phone as string}</span>}
            {client.email && <span className="row" style={{ gap: 6 }}><Icon name="mail" size={16} />{client.email as string}</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
          <span className="t-tiny faint">Rotina semanal · {sortedSlots.length}x por semana</span>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {sortedSlots.length === 0 && <span className="t-small muted">Sem horários fixos</span>}
            {sortedSlots.map((s) => (
              <span key={s.id as string} className="pill acc">{WEEKDAY_SHORT[s.weekday as number]} {hhmm(s.start_time as string)}</span>
            ))}
          </div>
        </div>
      </section>

      <Tabs
        items={[
          { href: `${base}?aba=dados`, label: "Dados", on: aba === "dados" },
          { href: `${base}?aba=evolucoes`, label: "Evoluções", on: aba === "evolucoes" },
          { href: `${base}?aba=avaliacoes`, label: "Avaliações", on: aba === "avaliacoes" },
        ]}
      />

      {aba === "dados" && (
        <div className="detail-grid">
          <ClientForm
            formId="client-form"
            values={{
              document: client.document as string,
              name: client.name as string,
              email: (client.email as string | null) ?? "",
              phone: (client.phone as string | null) ?? "",
              emergency_contact_name: (client.emergency_contact_name as string | null) ?? "",
              emergency_contact_phone: (client.emergency_contact_phone as string | null) ?? "",
              date_of_birth: (client.date_of_birth as string | null) ?? "",
              instructor_id: (client.instructor_id as string | null) ?? "",
            }}
            action={updateClientAction.bind(null, id)}
            cancelHref={`${base}?aba=dados`}
            saved={sp.salvo === "1"}
            instructors={instructors}
            canReassign={canReassign}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <TagList title="Doenças" name="diseases" formId="client-form" initial={(client.diseases as string[]) ?? []} placeholder="Adicionar doença" />
              <div style={{ height: 6 }} />
              <TagList title="Cirurgias" name="surgeries" formId="client-form" initial={(client.surgeries as string[]) ?? []} placeholder="Adicionar cirurgia" />
              <p className="help">Doenças e cirurgias são gravadas com o botão Salvar dos dados pessoais.</p>
            </section>

            <DocumentsSection clientId={id} />

            <section className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <h2 className="t-h3 grow">Horários semanais</h2>
              </div>
              {sortedSlots.length === 0 && <p className="t-small muted" style={{ marginTop: 8 }}>Nenhum horário fixo. Os agendamentos podem ser feitos na Agenda.</p>}
              {sortedSlots.map((s, i) => {
                const hour = Number((s.start_time as string).slice(0, 2));
                return (
                  <div className="li" key={s.id as string} style={i === 0 ? { marginTop: 8 } : undefined}>
                    <Icon name="repeat" size={16} className="faint" />
                    <span className="grow" style={{ fontWeight: 600 }}>{weekdayName(s.weekday as number)}</span>
                    <span>{String(hour).padStart(2, "0")}:00 – {String(hour + 1).padStart(2, "0")}:00</span>
                    <form action={removeRecurringSlot.bind(null, id, s.id as string)}>
                      <ConfirmButton className="ibtn" ariaLabel="Remover horário" message="Remover este horário fixo? As sessões futuras ainda sem status também serão removidas da agenda.">
                        <Icon name="x" size={16} />
                      </ConfirmButton>
                    </form>
                  </div>
                );
              })}
              {active && (
                <details style={{ marginTop: 10 }}>
                  <summary className="btn sm" style={{ listStyle: "none", width: "fit-content" }}>
                    <Icon name="plus" size={16} />
                    Adicionar horário
                  </summary>
                  <form action={addRecurringSlot.bind(null, id)} className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                    <select name="weekday" className="input" aria-label="Dia da semana" defaultValue="1" style={{ width: 150, height: 40 }}>
                      {WEEKDAY_ORDER.map((d) => (
                        <option key={d} value={d}>{weekdayName(d)}</option>
                      ))}
                    </select>
                    <select name="hour" className="input" aria-label="Horário" defaultValue="7" style={{ width: 110, height: 40 }}>
                      {Array.from({ length: 15 }, (_, i) => 6 + i).map((h) => (
                        <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                      ))}
                    </select>
                    <button className="btn pri sm" type="submit">Adicionar</button>
                  </form>
                </details>
              )}
            </section>

            <form action={setArchived.bind(null, id, active)}>
              <ConfirmButton
                className="btn quiet"
                message={active ? `Arquivar ${client.name}? Ele sai das listas e das sessões futuras, e o histórico é mantido.` : `Reativar ${client.name}?`}
              >
                <Icon name="archive" size={16} />
                {active ? "Arquivar cliente" : "Reativar cliente"}
              </ConfirmButton>
            </form>
          </div>
        </div>
      )}

      {aba === "evolucoes" && <EvolutionsTab clientId={id} pagina={sp.pagina} />}
      {aba === "avaliacoes" && <EvaluationsTab clientId={id} selected={sp.avaliacao} today={today} />}
    </>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function DocumentsSection({ clientId }: { clientId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, name, mime_type, size_bytes, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`documentos: ${error.message}`);
  const docs = data ?? [];

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 className="t-h3">Documentos</h2>
      {docs.length === 0 ? (
        <p className="t-small muted">Nenhum documento ainda.</p>
      ) : (
        docs.map((d) => (
          <div className="li" key={d.id as string}>
            <Icon name="note" size={16} className="faint" />
            <a className="grow" style={{ fontWeight: 600, color: "var(--ink)", textDecoration: "none" }} href={`/clientes/${clientId}/documentos/${d.id}`} target="_blank" rel="noopener noreferrer">
              {d.name as string}
            </a>
            <span className="t-small muted">{formatSize(d.size_bytes as number)}</span>
            <span className="t-small muted">{formatBR(d.created_at as string)}</span>
            <form action={deleteDocument.bind(null, clientId, d.id as string)}>
              <ConfirmButton className="ibtn" ariaLabel="Remover documento" message={`Remover "${d.name}"? Isso não pode ser desfeito.`}>
                <Icon name="x" size={16} />
              </ConfirmButton>
            </form>
          </div>
        ))
      )}
      <details>
        <summary className="btn sm" style={{ listStyle: "none", width: "fit-content" }}>
          <Icon name="plus" size={16} />
          Adicionar documento
        </summary>
        <form action={uploadDocument.bind(null, clientId)} className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
          <input type="text" name="name" className="input" placeholder="Nome (opcional)" style={{ flex: "1 1 180px", height: 40 }} />
          <input type="file" name="file" className="input" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif" required style={{ flex: "1 1 220px", height: 40, padding: "6px 10px" }} />
          <button className="btn pri sm" type="submit">Enviar</button>
        </form>
        <p className="help" style={{ marginTop: 6 }}>PDF, JPG, PNG ou HEIC, até 10MB.</p>
      </details>
    </section>
  );
}

async function EvolutionsTab({ clientId, pagina }: { clientId: string; pagina?: string }) {
  const supabase = await createClient();
  const page = Math.max(1, Number.parseInt(pagina ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("evolutions")
    .select("id, date, apparatus", { count: "exact" })
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`evoluções: ${error.message}`);
  const rows = data ?? [];
  const total = count ?? 0;
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/clientes/${clientId}`;

  return (
    <section className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row" style={{ padding: "18px 24px", justifyContent: "space-between" }}>
        <h2 className="t-h2">Evoluções</h2>
        <Link className="btn pri" href={`${base}/evolucoes/nova`}><Icon name="plus" size={16} />Nova evolução</Link>
      </div>
      {rows.length === 0 ? (
        <div className="empty" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="badge"><Icon name="note" size={20} /></div>
          <b style={{ color: "var(--ink)" }}>Nenhuma evolução ainda</b>
          <span className="t-small">As evoluções registradas nas sessões aparecem aqui.</span>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>Evolução</th>
                <th style={{ width: 160 }}><span className="sortable">Data <Icon name="down" size={14} /></span></th>
                <th style={{ width: 140, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = summarize(r.apparatus);
                return (
                  <tr key={r.id as string}>
                    <td>
                      <Link href={`${base}/evolucoes/${r.id}`} style={{ color: "var(--ink)", textDecoration: "none" }}>
                        <div style={{ fontWeight: 600 }}>{s.title}{s.extra > 0 && <span className="muted" style={{ fontWeight: 500 }}> · +{s.extra} {s.extra === 1 ? "campo" : "campos"}</span>}</div>
                        {s.text && <div className="t-small muted" style={{ maxWidth: 560, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.text}</div>}
                      </Link>
                    </td>
                    <td>{formatBR(r.date as string)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link className="ibtn" href={`${base}/evolucoes/${r.id}`} aria-label="Ver detalhes"><Icon name="eye" /></Link>
                      <Link className="ibtn" href={`${base}/evolucoes/${r.id}/editar`} aria-label="Editar"><Icon name="edit" /></Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {total > 0 && (
        <div className="row" style={{ padding: "14px 24px", justifyContent: "space-between", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
          <span className="t-small muted">{from + 1} a {Math.min(from + PAGE_SIZE, total)} de {total} {total === 1 ? "evolução" : "evoluções"}</span>
          <div className="row" style={{ gap: 6 }}>
            {page > 1 ? <Link className="btn sm icon" href={`${base}?aba=evolucoes&pagina=${page - 1}`} aria-label="Página anterior"><Icon name="chevl" size={16} /></Link> : <span className="btn sm icon dis" aria-hidden="true"><Icon name="chevl" size={16} /></span>}
            <span className="pill acc">{page}</span>
            <span className="t-small muted">de {last}</span>
            {page < last ? <Link className="btn sm icon" href={`${base}?aba=evolucoes&pagina=${page + 1}`} aria-label="Próxima página"><Icon name="chevr" size={16} /></Link> : <span className="btn sm icon dis" aria-hidden="true"><Icon name="chevr" size={16} /></span>}
          </div>
        </div>
      )}
    </section>
  );
}

async function EvaluationsTab({ clientId, selected, today }: { clientId: string; selected?: string; today: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("evaluations").select("*").eq("client_id", clientId).order("date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(`avaliações: ${error.message}`);
  const rows = data ?? [];
  const base = `/clientes/${clientId}`;
  const closeHref = `${base}?aba=avaliacoes`;
  const titleOf = (index: number) => (index === rows.length - 1 ? "Avaliação inicial" : "Reavaliação");

  const isNew = selected === "nova";
  const index = rows.findIndex((r) => r.id === selected);
  const current = index >= 0 ? rows[index] : null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  return (
    <>
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row" style={{ padding: "18px 24px", justifyContent: "space-between" }}>
          <h2 className="t-h2">Avaliações</h2>
          <Link className="btn pri" href={`${closeHref}&avaliacao=nova`}><Icon name="plus" size={16} />Nova avaliação</Link>
        </div>
        {rows.length === 0 ? (
          <div className="empty" style={{ borderTop: "1px solid var(--line)" }}>
            <div className="badge"><Icon name="note" size={20} /></div>
            <b style={{ color: "var(--ink)" }}>Nenhuma avaliação ainda</b>
            <span className="t-small">Registre a avaliação inicial deste cliente.</span>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Avaliação</th>
                  <th style={{ width: 160 }}><span className="sortable">Data <Icon name="down" size={14} /></span></th>
                  <th style={{ width: 140, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id as string}>
                    <td>
                      <Link href={`${closeHref}&avaliacao=${r.id}`} style={{ color: "var(--ink)", textDecoration: "none" }}>
                        <div style={{ fontWeight: 600 }}>{titleOf(i)}</div>
                        {r.main_complaint && <div className="t-small muted">{r.main_complaint as string}</div>}
                      </Link>
                    </td>
                    <td>{formatBR(r.date as string)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link className="ibtn" href={`${closeHref}&avaliacao=${r.id}`} aria-label="Ver detalhes"><Icon name="eye" /></Link>
                      <Link className="ibtn" href={`${closeHref}&avaliacao=${r.id}`} aria-label="Editar"><Icon name="edit" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row" style={{ padding: "14px 24px", borderTop: "1px solid var(--line)" }}>
          <span className="t-small muted">{rows.length} {rows.length === 1 ? "avaliação" : "avaliações"}</span>
        </div>
      </section>

      {(isNew || current) && (
        <Modal title={isNew ? "Nova avaliação" : `${titleOf(index)} · ${formatBR(current!.date as string)}`} closeHref={closeHref}>
          <EvaluationForm
            key={current?.id ?? "nova"}
            closeHref={closeHref}
            action={saveEvaluation.bind(null, clientId, current ? (current.id as string) : null)}
            values={{
              date: current ? (current.date as string) : today,
              main_complaint: str(current?.main_complaint),
              diagnosis: str(current?.diagnosis),
              hdp: str(current?.hdp),
              hda: str(current?.hda),
              medications: str(current?.medications),
              movement_restrictions: str(current?.movement_restrictions),
              obs: str(current?.obs),
            }}
            onDelete={
              current ? (
                <ConfirmButton form="delete-evaluation" className="btn quiet" message="Excluir esta avaliação? Isso não pode ser desfeito.">
                  Excluir
                </ConfirmButton>
              ) : null
            }
          />
        </Modal>
      )}
      {current && <form id="delete-evaluation" action={deleteEvaluation.bind(null, clientId, current.id as string)} />}
    </>
  );
}
