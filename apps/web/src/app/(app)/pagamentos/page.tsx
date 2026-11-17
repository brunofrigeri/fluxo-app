import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import * as api from "@fluxo/api";
import { paymentCopy, paymentLabels } from "@fluxo/copy";
import { addDays, addMonths, formatMonthYear, formatShort, isValidISO, todayISO } from "@fluxo/domain";
import { Icon } from "@fluxo/ui-web";
import { PaymentActions } from "@/components/PaymentActions";
import { Seg } from "@/components/Seg";
import { getAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pagamentos" };
export const dynamic = "force-dynamic";

type Search = { mes?: string; estado?: string };
const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "atrasados", label: "Em atraso" },
  { key: "pagos", label: "Pagos" },
  { key: "naopagos", label: "Não pagos" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

function matches(c: api.PaymentCycle, f: Filter): boolean {
  if (f === "pagos") return c.status === "paid";
  if (f === "naopagos") return c.status === "unpaid";
  if (f === "atrasados") return c.overdue;
  return true;
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const me = await getAdmin();
  if (me?.role !== "admin") redirect("/");

  const today = todayISO();
  const month = sp.mes && isValidISO(`${sp.mes}-01`) ? `${sp.mes}-01` : `${today.slice(0, 7)}-01`;
  const monthEnd = addDays(addMonths(month, 1), -1);
  const filter = FILTERS.find((f) => f.key === sp.estado)?.key ?? "todos";
  const qs = (m: string, e: Filter = filter) => `/pagamentos?mes=${m.slice(0, 7)}${e === "todos" ? "" : `&estado=${e}`}`;

  const cycles = await api.listPaymentCycles(await createClient(), month, monthEnd, today);
  const shown = cycles.filter((c) => matches(c, filter));
  const count = (f: Filter) => cycles.filter((c) => matches(c, f)).length;

  const byDate = new Map<string, api.PaymentCycle[]>();
  for (const c of shown) byDate.set(c.dueDate, [...(byDate.get(c.dueDate) ?? []), c]);

  return (
    <>
      <header className="pagehead">
        <h1 className="t-display">{paymentCopy.title}</h1>
      </header>

      <section className="card" style={{ padding: 0 }}>
        <div className="row" style={{ padding: "16px 20px", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--line)" }}>
          <div className="row" style={{ gap: 4 }}>
            <Link className="btn sm icon" href={qs(addMonths(month, -1))} aria-label="Mês anterior"><Icon name="chevl" /></Link>
            <Link className="btn sm icon" href={qs(addMonths(month, 1))} aria-label="Próximo mês"><Icon name="chevr" /></Link>
          </div>
          <Link className="btn sm" href={qs(today)}>Este mês</Link>
          <h2 className="t-h2" style={{ marginLeft: 8 }}>{formatMonthYear(month)}</h2>
          <Seg label="Situação" style={{ marginLeft: "auto", flexWrap: "wrap" }} items={FILTERS.map((f) => ({ href: qs(month, f.key), label: `${f.label} · ${count(f.key)}`, on: filter === f.key }))} />
        </div>

        {shown.length === 0 ? (
          <div className="empty" style={{ padding: "40px 16px" }}>
            <div className="badge"><Icon name="calendar" /></div>
            <b style={{ color: "var(--ink)" }}>{cycles.length === 0 ? "Nenhum vencimento neste mês" : "Nada com este filtro"}</b>
            <span className="t-small">{cycles.length === 0 ? "Defina o dia do pagamento de cada cliente em Clientes, na aba Dados." : "Troque a situação para ver os outros vencimentos do mês."}</span>
          </div>
        ) : (
          <div style={{ padding: "4px 20px 12px" }}>
            {[...byDate.entries()].map(([date, list]) => (
              <div key={date} className="pay-day">
                <div className="pay-date"><b>{formatShort(date)}</b>{date === today && <span className="pill acc">Hoje</span>}</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {list.map((c) => (
                    <div key={c.clientId + c.dueDate} className="pay-row">
                      <Link className="tag-link grow" href={`/clientes/${c.clientId}?aba=pagamentos`}>{c.clientName}</Link>
                      <PaymentActions clientId={c.clientId} dueDate={c.dueDate} status={c.status} overdue={c.overdue} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="t-small muted" style={{ marginTop: 12 }}>
        O Fluxo não cobra nem recebe pagamentos: você registra aqui o que o cliente pagou. O que passar do vencimento sem registro aparece na Home como “{paymentLabels.overdue}”.
      </p>
    </>
  );
}
