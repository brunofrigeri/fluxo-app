import type { Metadata } from "next";
import Link from "next/link";
import { Icon, type IconName } from "@fluxo/ui-web";
import { ModalityTag } from "@/components/ModalityTag";
import { Seg } from "@/components/Seg";
import { PaymentActions } from "@/components/PaymentActions";
import { StatusMenu } from "@/components/StatusMenu";
import { getAdmin } from "@/lib/admin";
import { initialsOf } from "@fluxo/domain";
import { formatBR, formatLong, greeting } from "@fluxo/domain";
import { paymentCopy } from "@fluxo/copy";
import { getStudioModalities, pickModality } from "@/lib/modalities";
import { getHomeData } from "@/lib/queries/home";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

function CardHead({ icon, title, count, accent }: { icon: IconName; title: string; count?: string | number; accent?: boolean }) {
  return (
    <div className="cardhead">
      <div className={`bubble${accent ? " acc" : ""}`}>
        <Icon name={icon} size={16} />
      </div>
      <h2 className="t-h3">{title}</h2>
      {count !== undefined && <span className="pill" style={{ marginLeft: "auto" }}>{count}</span>}
    </div>
  );
}

function Empty({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="empty" style={{ padding: "20px 8px" }}>
      {title && <b style={{ color: "var(--ink)" }}>{title}</b>}
      <span className="t-small">{children}</span>
    </div>
  );
}

function ClientLink({ id, name }: { id: string; name: string }) {
  return (
    <Link className="tag-link" href={`/clientes/${id}`}>
      {name}
    </Link>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ mod?: string }> }) {
  const sp = await searchParams;
  const studioModalities = await getStudioModalities();
  const filter = pickModality(sp.mod, studioModalities);
  const [admin, data] = await Promise.all([getAdmin(), getHomeData(filter?.id)]);
  const manyModalities = studioModalities.length > 1;
  const { slots, unmarked, missingEvolution, toReschedule, attention, birthdays, attendance, payments } = data;
  const yesterdayPending = unmarked.length + missingEvolution.length;

  return (
    <>
      <header className="pagehead" style={{ alignItems: "flex-start" }}>
        <div>
          <h1 className="t-display">
            {greeting()}, {admin?.firstName}
          </h1>
          <p className="t-body muted" style={{ marginTop: 2 }}>{formatLong(data.today)}</p>
        </div>
        {manyModalities && (
          <Seg
            label="Modalidade"
            items={[
              { href: "/", label: "Todas", on: !filter },
              ...studioModalities.map((m) => ({ href: `/?mod=${m.key}`, label: m.name, on: filter?.id === m.id })),
            ]}
          />
        )}
      </header>

      <div className="home-main">
        {/* 1. Sessões de hoje */}
        <section className="card" style={{ padding: "24px 24px 12px", display: "flex", flexDirection: "column" }} aria-labelledby="c1">
          <div className="cardhead" style={{ marginBottom: 8 }}>
            <div className="bubble acc"><Icon name="clock" size={16} /></div>
            <h2 className="t-h2" id="c1">Sessões de hoje</h2>
            <span className="pill" style={{ marginLeft: "auto" }}>{slots.length === 1 ? "1 horário" : `${slots.length} horários`}</span>
          </div>
          {slots.length === 0 ? (
            <Empty title="Dia livre">Nenhuma sessão marcada para hoje.</Empty>
          ) : (
            slots.map((slot) => (
              <div className="slot-row" key={slot.time}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                  <span style={{ fontWeight: 700, fontSize: 17, lineHeight: "24px" }}>{slot.time}</span>
                  <span className="occ">{slot.clients.length === 1 ? "1 cliente" : `${slot.clients.length} clientes`}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {slot.clients.map((c) => (
                    <div key={c.bookingId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 40, flexWrap: "wrap" }}>
                      <div>
                        <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                          <ClientLink id={c.clientId} name={c.name} />
                          {(manyModalities || c.label) && <ModalityTag modality={c.modalityKey} label={c.label} />}
                        </span>
                        {c.status === "JUSTIFIED_MISS" && c.missReason && <div className="t-small muted">Motivo: {c.missReason}</div>}
                      </div>
                      <StatusMenu bookingId={c.bookingId} status={c.status} missReason={c.missReason} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        <div className="home-col">
          {/* 2. Pendências de ontem */}
          <section className="card" aria-labelledby="c2">
            <CardHead icon="alert" title="Pendências de ontem" count={yesterdayPending} />
            {unmarked.map((p) => (
              <div className="li" key={`u-${p.bookingId}`}>
                <div className="grow">
                  <ClientLink id={p.clientId} name={p.name} />
                  <div className="t-small muted">{p.when}</div>
                </div>
                <StatusMenu bookingId={p.bookingId} status={null} />
              </div>
            ))}
            {missingEvolution.map((p) => (
              <div className="li" key={`e-${p.bookingId}`}>
                <div className="grow">
                  <ClientLink id={p.clientId} name={p.name} />
                  <div className="t-small muted">{p.when}</div>
                </div>
                <Link className="btn sm" href={`/clientes/${p.clientId}/evolucoes/nova?sessao=${p.bookingId}`}>
                  <Icon name="note" size={16} />
                  Escrever evolução
                </Link>
              </div>
            ))}
            {yesterdayPending === 0 && <Empty title="Tudo em dia por aqui">Nenhuma pendência de ontem.</Empty>}
          </section>

          {/* 3. Reposições a agendar */}
          <section className="card" aria-labelledby="c3">
            <CardHead icon="repeat" title="Reposições a agendar" count={toReschedule.length} />
            {toReschedule.length === 0 ? (
              <Empty>Nenhuma reposição pendente.</Empty>
            ) : (
              toReschedule.map((p) => (
                <div className="li" key={p.bookingId}>
                  <div className="grow">
                    <ClientLink id={p.clientId} name={p.name} />
                    <div className="t-small muted">{p.when}</div>
                  </div>
                  <Link className="btn sm" href={`/agenda?vista=semana&novo=1&cliente=${p.clientId}&reposicao=${p.bookingId}`}>
                    Agendar reposição
                  </Link>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      {/* Pagamentos sem atualização: due dates that passed and were never marked paid (admins only; empty for instructors). */}
      {admin?.role === "admin" && (
        <section className="card" aria-label={paymentCopy.homeTitle} style={{ margin: "20px 0" }}>
          <CardHead icon="archive" title={paymentCopy.homeTitle} count={payments.total} />
          {payments.items.length === 0 ? (
            <Empty>{paymentCopy.homeEmpty}</Empty>
          ) : (
            <>
              {payments.items.slice(0, 8).map((p) => (
                <div className="li" key={p.clientId} style={{ flexWrap: "wrap" }}>
                  <div className="grow">
                    <ClientLink id={p.clientId} name={p.name} />
                    <div className="t-small muted">
                      Venceu em {formatBR(p.dueDate)}{p.count > 1 ? ` · ${p.count} vencimentos em aberto` : ""}{p.unpaid ? " · marcado como não pago" : ""}
                    </div>
                  </div>
                  <PaymentActions clientId={p.clientId} dueDate={p.dueDate} status={p.unpaid ? "unpaid" : "pending"} overdue compact />
                </div>
              ))}
              {payments.total > 8 && <Link className="btn sm" href="/pagamentos?estado=atrasados" style={{ marginTop: 10 }}>Ver todos ({payments.total})</Link>}
            </>
          )}
        </section>
      )}

      <div className="home-row">
        {/* 4. Clientes em atenção */}
        <section className="card" aria-labelledby="c4">
          <CardHead icon="users" title="Clientes em atenção" />
          {attention.length === 0 ? (
            <Empty>Nenhum cliente em atenção.</Empty>
          ) : (
            attention.map((a) => (
              <div className="li" key={a.clientId}>
                <div className="grow">
                  <ClientLink id={a.clientId} name={a.name} />
                  <div className="t-small muted">{a.reason}</div>
                </div>
                <Link href={`/clientes/${a.clientId}`} aria-label={`Abrir ${a.name}`} className="faint"><Icon name="chevr" /></Link>
              </div>
            ))
          )}
        </section>

        {/* 5. Aniversariantes da semana */}
        <section className="card" aria-labelledby="c5">
          <CardHead icon="cake" title="Aniversariantes da semana" accent />
          {birthdays.length === 0 ? (
            <Empty>Nenhum aniversário nos próximos 7 dias.</Empty>
          ) : (
            birthdays.map((b) => (
              <div className="li" key={b.clientId}>
                <span className="avatar sm">{initialsOf(b.name)}</span>
                <div className="grow">
                  <ClientLink id={b.clientId} name={b.name} />
                  <div className="t-small muted">{b.label}</div>
                </div>
                <Link href={`/clientes/${b.clientId}`} aria-label={`Abrir ${b.name}`} className="faint"><Icon name="chevr" /></Link>
              </div>
            ))
          )}
        </section>

        {/* 6. Frequência da semana */}
        <section className="card" aria-labelledby="c6" style={{ display: "flex", flexDirection: "column" }}>
          <CardHead icon="check" title="Frequência da semana" accent />
          {attendance.rate === null ? (
            <Empty>Ainda não há presenças marcadas nesta semana.</Empty>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: "auto", flexWrap: "wrap" }}>
                <span style={{ fontSize: 52, lineHeight: "56px", fontWeight: 700, letterSpacing: "-.03em" }}>{attendance.rate}%</span>
                {attendance.deltaPoints !== null && attendance.deltaPoints !== 0 && (
                  <span className={`st ${attendance.deltaPoints > 0 ? "st-ok" : "st-jm"}`} style={{ height: 26 }}>
                    <Icon name={attendance.deltaPoints > 0 ? "up" : "down"} size={14} />
                    {Math.abs(attendance.deltaPoints)} {Math.abs(attendance.deltaPoints) === 1 ? "ponto" : "pontos"}
                  </span>
                )}
              </div>
              <p className="t-small muted" style={{ marginTop: 6 }}>
                de presença{attendance.deltaPoints !== null ? ", em relação à semana anterior" : " nesta semana"}
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
