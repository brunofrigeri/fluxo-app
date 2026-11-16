"use client";

import { useState } from "react";
import { landing } from "@fluxo/copy";
import { Icon } from "@fluxo/ui-web";

type Props = { signUpUrl: string };

/** The only interactive part of the page. Switching period only changes what is shown, so it never waits on anything. */
export function Pricing({ signUpUrl }: Props) {
  const p = landing.pricing;
  const [annual, setAnnual] = useState(false);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <section id="planos" className="lp-sec lp-stone">
      <div className="lp-in lp-stack" style={{ gap: 40 }}>
        <div className="lp-stack" style={{ gap: 14, alignItems: "center", textAlign: "center" }}>
          <span className="lp-eyebrow">{p.eyebrow}</span>
          <h2 className="lp-h2" style={{ maxWidth: 720 }}>{p.title}</h2>
          <p className="lp-lead" style={{ maxWidth: 620 }}>{p.lead}</p>
          <div className="seg" role="group" aria-label={p.periodLabel} style={{ marginTop: 8 }}>
            <button type="button" className={annual ? "" : "on"} aria-pressed={!annual} onClick={() => setAnnual(false)} style={{ height: 44, padding: "0 22px" }}>{p.monthly}</button>
            <button type="button" className={annual ? "on" : ""} aria-pressed={annual} onClick={() => setAnnual(true)} style={{ height: 44, padding: "0 22px" }}>
              {p.annual}<span className="pill acc" style={{ height: 22, padding: "0 8px", fontSize: 12 }}>{p.annualBadge}</span>
            </button>
          </div>
        </div>

        <div className="lp-3" style={{ alignItems: "stretch" }}>
          {p.plans.map((plan) => {
            const price = annual ? plan.annual : plan.monthly;
            const sub = annual ? plan.annual.sub : p.monthlyBilling;
            const extra = "extra" in plan ? plan.extra : null;
            return (
              <article key={plan.name} className={`card lp-plan${plan.highlight ? " hl" : ""}`}>
                <div className="lp-stack" style={{ gap: 6, minHeight: 64 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <h3 className="t-h2">{plan.name}</h3>
                    {plan.highlight && <span className="pill acc">{p.forStudios}</span>}
                  </div>
                  <p className="t-body muted">{plan.who}</p>
                </div>
                <div>
                  <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
                    <span className="lp-price">{price.price}</span>
                    <span className="muted" style={{ fontWeight: 600 }}>{annual ? p.perYear : p.perMonth}</span>
                  </div>
                  <div className="t-small muted" style={{ marginTop: 4 }}><s>{price.list}</s> · {p.founder}</div>
                  <div className="t-small" style={{ marginTop: 2, fontWeight: 600, color: "var(--accent)" }}>{sub}</div>
                </div>
                <a className={`btn lp-btn${plan.highlight ? " pri" : ""}`} href={signUpUrl} style={{ width: "100%" }}>{p.cta}</a>
                <hr className="hair" />
                <ul className="lp-checks">
                  {[cap(plan.who), ...p.common, ...(extra ? [extra] : [])].map((f) => (
                    <li key={f} className="lp-check"><Icon name="check" size={16} />{f}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="t-small muted" style={{ textAlign: "center", maxWidth: 720, margin: "0 auto" }}>{p.note}</p>
      </div>
    </section>
  );
}
