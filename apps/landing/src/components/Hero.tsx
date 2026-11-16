import { landing } from "@fluxo/copy";
import { Icon } from "@fluxo/ui-web";
import { signUpUrl } from "@/lib/urls";
import { StatusPill } from "./Status";

export function Hero() {
  const h = landing.hero;
  return (
    <section className="lp-hero">
      <svg className="lp-waves" viewBox="0 0 1440 700" preserveAspectRatio="none" fill="none" stroke="var(--accent)" strokeWidth="1.5" aria-hidden="true">
        <path d="M-20 520c180-110 360-110 540 0s360 110 540 0 300-90 420-30" />
        <path d="M-20 580c180-110 360-110 540 0s360 110 540 0 300-90 420-30" />
        <path d="M-20 640c180-110 360-110 540 0s360 110 540 0 300-90 420-30" />
      </svg>
      <div className="lp-in lp-row lp-hero-in">
        <div className="lp-stack" style={{ gap: 24, alignItems: "flex-start" }}>
          <span className="pill acc">{h.pill}</span>
          <h1 className="lp-h1">{h.title}</h1>
          <p className="lp-lead" style={{ maxWidth: 540 }}>{h.lead}</p>
          <div className="lp-actions">
            <a className="btn pri lp-btn" href={signUpUrl}>{h.primary}</a>
            <a className="btn lp-btn" href="#planos">{h.secondary}</a>
          </div>
          <p className="t-small muted lp-assure">
            <Icon name="check" size={16} className="lp-accent" />
            {h.assurances.map((a, i) => (
              <span key={a} style={{ display: "contents" }}>
                {i > 0 && <span className="faint" aria-hidden="true">·</span>}
                {a}
              </span>
            ))}
          </p>
        </div>
        <div style={{ position: "relative", paddingBottom: 20 }}>
          <div className="card lp-demo">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div><div className="t-tiny faint">{h.card.date}</div><div className="t-h3">{h.card.title}</div></div>
              <span className="pill">{h.card.time}</span>
            </div>
            <div className="card stone lp-demo-slot">
              <div className="row" style={{ justifyContent: "space-between", padding: "6px 0" }}>
                <span style={{ fontWeight: 700, fontSize: 17 }}>{h.card.time}</span>
                <span className="occ">{h.card.occupancy}</span>
              </div>
              {h.card.sessions.map((s) => (
                <div key={s.name} className="row lp-demo-row">
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <StatusPill status={s.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="toast lp-toast" role="status"><Icon name="check" />{h.card.toast}</div>
        </div>
      </div>
    </section>
  );
}
