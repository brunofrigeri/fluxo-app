import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/ClientForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { EvaluationsPanel, type EvaluationRow } from "@/components/EvaluationsPanel";
import { Icon } from "@/components/Icon";
import { ModalityTag } from "@/components/ModalityTag";
import { Seg } from "@/components/Seg";
import { TagList } from "@/components/TagList";
import { Tabs } from "@/components/Tabs";
import { getAdmin } from "@/lib/admin";
import { ageFrom, initialsOf } from "@fluxo/domain";
import { formatBR, hhmm, todayISO, weekdayName } from "@fluxo/domain";
import { getForm, summarize, type ModalityKey, type RecordData } from "@fluxo/forms";
import { getInstructorsByModality, getStudioModalities, pickModality, type Modality } from "@/lib/modalities";
import { createClient } from "@/lib/supabase/server";
import { addRecurringSlot, deleteDocument, removeRecurringSlot, setArchived, updateClientAction, uploadDocument } from "../actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Params = { id: string };
type Search = { aba?: string; pagina?: string; avaliacao?: string; salvo?: string; modalidade?: string };

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

  const [me, clientRes, slotsRes, enrollRes, studioModalities, byModality] = await Promise.all([
    getAdmin(),
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("recurring_slots").select("id, weekday, start_time, active_until, modality_id").eq("client_id", id).order("weekday").order("start_time"),
    supabase.from("client_modality_instructors").select("modality_id, instructor_id").eq("client_id", id),
    getStudioModalities(),
    getInstructorsByModality(),
  ]);
  if (clientRes.error) throw new Error(`cliente: ${clientRes.error.message}`);
  const client = clientRes.data;
  if (!client) notFound();
  const canReassign = me?.role === "admin";

  // The modalities this person sees the client in (an instructor: only the ones they are responsible for).
  const enrollRows = (enrollRes.data ?? []) as { modality_id: string; instructor_id: string | null }[];
  const enrolled = studioModalities.filter((m) => enrollRows.some((r) => r.modality_id === m.id));
  const enrollment = Object.fromEntries(enrolled.map((m) => [m.key, enrollRows.find((r) => r.modality_id === m.id)?.instructor_id ?? ""]));
  const choices = studioModalities.map((m) => ({ key: m.key, name: m.name, instructors: byModality.get(m.id) ?? [] }));
  const modalityOf = new Map(studioModalities.map((m) => [m.id, m]));

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
            {enrolled.map((m) => (
              <ModalityTag key={m.id} modality={m.key} />
            ))}
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
              <span key={s.id as string} className="pill acc">{WEEKDAY_SHORT[s.weekday as number]} {hhmm(s.start_time as string)}{enrolled.length > 1 && modalityOf.get(s.modality_id as string) ? ` · ${modalityOf.get(s.modality_id as string)!.name}` : ""}</span>
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
              sex: (client.sex as string | null) ?? "",
              marital_status: (client.marital_status as string | null) ?? "",
              city: (client.city as string | null) ?? "",
              profession: (client.profession as string | null) ?? "",
              workplace: (client.workplace as string | null) ?? "",
              children: (client.children as string | null) ?? "",
              parents: (client.parents as string | null) ?? "",
            }}
            action={updateClientAction.bind(null, id)}
            cancelHref={`${base}?aba=dados`}
            saved={sp.salvo === "1"}
            modalities={choices}
            enrollment={enrollment}
            canEditModalities={canReassign}
            canReassign={canReassign}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <TagList title="Doenças" name="diseases" formId="client-form" initial={(client.diseases as string[]) ?? []} placeholder="Adicionar doença" />
              <div style={{ height: 6 }} />
              <TagList title="Cirurgias" name="surgeries" formId="client-form" initial={(client.surgeries as string[]) ?? []} placeholder="Adicionar cirurgia" />
              <div style={{ height: 6 }} />
              <TagList title="Tratamentos atuais" name="current_treatments" formId="client-form" initial={(client.current_treatments as string[]) ?? []} placeholder="Adicionar tratamento atual" />
              <div style={{ height: 6 }} />
              <TagList title="Tratamentos anteriores" name="previous_treatments" formId="client-form" initial={(client.previous_treatments as string[]) ?? []} placeholder="Adicionar tratamento anterior" />
              <div style={{ height: 6 }} />
              <TagList title="Medicação" name="medications" formId="client-form" initial={(client.medications as string[]) ?? []} placeholder="Adicionar medicação" />
              <p className="help">O histórico de saúde é gravado com o botão Salvar dos dados pessoais.</p>
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
                    <span className="grow row" style={{ fontWeight: 600, gap: 8 }}>
                      {weekdayName(s.weekday as number)}
                      {modalityOf.get(s.modality_id as string) && <ModalityTag modality={modalityOf.get(s.modality_id as string)!.key} />}
                    </span>
                    <span>{String(hour).padStart(2, "0")}:00 – {String(hour + 1).padStart(2, "0")}:00</span>
                    <form action={removeRecurringSlot.bind(null, id, s.id as string)}>
                      <ConfirmButton className="ibtn" ariaLabel="Remover horário" message="Remover este horário fixo? As sessões futuras ainda sem status também serão removidas da agenda.">
                        <Icon name="x" size={16} />
                      </ConfirmButton>
                    </form>
                  </div>
                );
              })}
              {active && enrolled.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary className="btn sm" style={{ listStyle: "none", width: "fit-content" }}>
                    <Icon name="plus" size={16} />
                    Adicionar horário
                  </summary>
                  <form action={addRecurringSlot.bind(null, id)} className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                    <select name="modality_id" className="input" aria-label="Modalidade" defaultValue={enrolled[0]?.id} style={{ width: 150, height: 40 }} required>
                      {enrolled.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
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

      {aba === "evolucoes" && <EvolutionsTab clientId={id} pagina={sp.pagina} enrolled={enrolled} filter={pickModality(sp.modalidade, enrolled)} />}
      {aba === "avaliacoes" && <EvaluationsTab clientId={id} selected={sp.avaliacao} today={today} enrolled={enrolled} filter={pickModality(sp.modalidade, enrolled)} newModality={pickModality(sp.modalidade, enrolled) ?? (enrolled.length === 1 ? enrolled[0] : null)} />}
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

/** The modality filter and the "new" buttons of a tab. */
function ModalityBar({ base, aba, enrolled, filter, newLabel, newHref }: { base: string; aba: string; enrolled: Modality[]; filter: Modality | null; newLabel: string; newHref: (m: Modality) => string }) {
  return (
    <div className="row" style={{ padding: "0 24px 16px", gap: 12, flexWrap: "wrap" }}>
      {enrolled.length > 1 && (
        <Seg
          label="Modalidade"
          items={[
            { href: `${base}?aba=${aba}`, label: "Todas", on: !filter },
            ...enrolled.map((m) => ({ href: `${base}?aba=${aba}&modalidade=${m.key}`, label: m.name, on: filter?.id === m.id })),
          ]}
        />
      )}
      <span style={{ marginLeft: "auto" }} />
      {enrolled.map((m) => (
        <Link key={m.id} className="btn pri" href={newHref(m)}>
          <Icon name="plus" size={16} />
          {enrolled.length > 1 ? `${newLabel} · ${m.name}` : newLabel}
        </Link>
      ))}
    </div>
  );
}

async function EvolutionsTab({ clientId, pagina, enrolled, filter }: { clientId: string; pagina?: string; enrolled: Modality[]; filter: Modality | null }) {
  const supabase = await createClient();
  const page = Math.max(1, Number.parseInt(pagina ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  let query = supabase
    .from("evolutions")
    .select("id, date, session_number, data, modalities(key)", { count: "exact" })
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (filter) query = query.eq("modality_id", filter.id);
  const { data, count, error } = await query;
  if (error) throw new Error(`evoluções: ${error.message}`);
  const rows = (data ?? []) as unknown as { id: string; date: string; session_number: number; data: RecordData; modalities: { key: ModalityKey } | { key: ModalityKey }[] | null }[];
  const total = count ?? 0;
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const base = `/clientes/${clientId}`;
  const filterQs = filter ? `&modalidade=${filter.key}` : "";

  return (
    <section className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row" style={{ padding: "18px 24px", justifyContent: "space-between" }}>
        <h2 className="t-h2">Evoluções</h2>
      </div>
      <ModalityBar base={base} aba="evolucoes" enrolled={enrolled} filter={filter} newLabel="Nova evolução" newHref={(m) => `${base}/evolucoes/nova?modalidade=${m.key}`} />
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
                <th style={{ width: 70 }}>Nº</th>
                <th>Evolução</th>
                <th style={{ width: 160 }}><span className="sortable">Data <Icon name="down" size={14} /></span></th>
                <th style={{ width: 140, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = Array.isArray(r.modalities) ? r.modalities[0] : r.modalities;
                const key = m?.key;
                const s = key ? summarize(getForm(key, "evolution"), r.data) : { title: "Evolução", text: "", extra: 0 };
                return (
                  <tr key={r.id}>
                    <td>{r.session_number}</td>
                    <td>
                      <Link href={`${base}/evolucoes/${r.id}`} style={{ color: "var(--ink)", textDecoration: "none" }}>
                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600 }}>{s.title}{s.extra > 0 && <span className="muted" style={{ fontWeight: 500 }}> · +{s.extra} {s.extra === 1 ? "campo" : "campos"}</span>}</span>
                          {key && enrolled.length > 1 && <ModalityTag modality={key} />}
                        </div>
                        {s.text && <div className="t-small muted" style={{ maxWidth: 560, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.text}</div>}
                      </Link>
                    </td>
                    <td>{formatBR(r.date)}</td>
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
            {page > 1 ? <Link className="btn sm icon" href={`${base}?aba=evolucoes${filterQs}&pagina=${page - 1}`} aria-label="Página anterior"><Icon name="chevl" size={16} /></Link> : <span className="btn sm icon dis" aria-hidden="true"><Icon name="chevl" size={16} /></span>}
            <span className="pill acc">{page}</span>
            <span className="t-small muted">de {last}</span>
            {page < last ? <Link className="btn sm icon" href={`${base}?aba=evolucoes${filterQs}&pagina=${page + 1}`} aria-label="Próxima página"><Icon name="chevr" size={16} /></Link> : <span className="btn sm icon dis" aria-hidden="true"><Icon name="chevr" size={16} /></span>}
          </div>
        </div>
      )}
    </section>
  );
}

async function EvaluationsTab({ clientId, selected, today, enrolled, filter, newModality }: { clientId: string; selected?: string; today: string; enrolled: Modality[]; filter: Modality | null; newModality: Modality | null }) {
  const supabase = await createClient();
  let query = supabase.from("evaluations").select("id, date, data, modality_id, modalities(key)").eq("client_id", clientId).order("date", { ascending: false }).order("created_at", { ascending: false });
  if (filter) query = query.eq("modality_id", filter.id);
  const { data, error } = await query;
  if (error) throw new Error(`avaliações: ${error.message}`);
  const found = (data ?? []) as unknown as { id: string; date: string; data: RecordData; modality_id: string; modalities: { key: ModalityKey } | { key: ModalityKey }[] | null }[];
  const keyOf = (r: (typeof found)[number]) => (Array.isArray(r.modalities) ? r.modalities[0]?.key : r.modalities?.key) as ModalityKey;

  // Rows are newest first: within a modality the oldest one is the initial evaluation.
  const rows: EvaluationRow[] = found.map((r) => {
    const same = found.filter((x) => x.modality_id === r.modality_id);
    const modality = keyOf(r);
    return {
      id: r.id,
      date: r.date,
      modality,
      title: same[same.length - 1].id === r.id ? "Avaliação inicial" : "Reavaliação",
      text: summarize(getForm(modality, "evaluation"), r.data).text,
      data: r.data,
    };
  });

  // ?avaliacao= only matters on arrival (e.g. right after creating an Acupuncture client): the panel opens from it once.
  const fromUrl = rows.find((r) => r.id === selected);
  const initialOpen = fromUrl ? { id: fromUrl.id, modality: fromUrl.modality } : selected === "nova" && newModality ? { id: null, modality: newModality.key } : null;

  return (
    <EvaluationsPanel
      clientId={clientId}
      rows={rows}
      enrolled={enrolled.map((m) => ({ key: m.key, name: m.name }))}
      filter={filter?.key ?? null}
      today={today}
      initialOpen={initialOpen}
      base={`/clientes/${clientId}`}
    />
  );
}
