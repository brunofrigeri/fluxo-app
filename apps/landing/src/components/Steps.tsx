import { landing } from "@fluxo/copy";
import { Icon, type IconName } from "@fluxo/ui-web";

export function Steps() {
  const s = landing.steps;
  return (
    <section id="como-funciona" className="lp-sec">
      <div className="lp-in lp-stack" style={{ gap: 40 }}>
        <div className="lp-stack" style={{ maxWidth: 680, gap: 14 }}><span className="lp-eyebrow">{s.eyebrow}</span><h2 className="lp-h2">{s.title}</h2></div>
        <ol className="lp-3 lp-steps">
          {s.items.map((it, i) => (
            <li key={it.title} className="lp-stack" style={{ gap: 14 }}>
              <span className="lp-num" aria-hidden="true">{i + 1}</span>
              <h3 className="t-h2">{it.title}</h3>
              <p className="t-body muted">{it.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Trial() {
  const t = landing.trial;
  return (
    <section className="lp-sec">
      <div className="lp-in">
        <div className="card lp-trial">
          <div className="lp-stack" style={{ maxWidth: 640, gap: 12 }}><span className="lp-eyebrow">{t.eyebrow}</span><h2 className="lp-h2">{t.title}</h2></div>
          <div className="lp-3" style={{ gap: 28 }}>
            {t.items.map((it) => (
              <div key={it.title} className="lp-stack" style={{ gap: 8 }}>
                <span className="bubble acc"><Icon name={it.icon as IconName} size={16} /></span>
                <h3 className="t-h3">{it.title}</h3>
                <p className="t-body muted">{it.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  const f = landing.faq;
  return (
    <section id="perguntas" className="lp-sec" style={{ paddingTop: 0 }}>
      <div className="lp-in lp-faq-grid">
        <div className="lp-stack" style={{ gap: 14 }}><span className="lp-eyebrow">{f.eyebrow}</span><h2 className="lp-h2">{f.title}</h2></div>
        <div className="lp-faq">
          {f.items.map((it, i) => (
            <details key={it.q} open={i === 0}>
              <summary>{it.q}</summary>
              <p>{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
