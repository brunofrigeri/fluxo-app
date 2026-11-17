import { landing, statusLabels } from "@fluxo/copy";
import { Icon, type IconName } from "@fluxo/ui-web";
import { StatusDot, StatusPill } from "./Status";

function Checks({ items }: { items: readonly string[] }) {
  return (
    <ul className="lp-checks">
      {items.map((c) => (
        <li key={c} className="lp-check"><Icon name="check" size={16} />{c}</li>
      ))}
    </ul>
  );
}

function Copy({ title, text, checks }: { title: string; text: string; checks: readonly string[] }) {
  return (
    <div className="lp-stack" style={{ gap: 14 }}>
      <h3 className="lp-h3">{title}</h3>
      <p className="lp-lead">{text}</p>
      <Checks items={checks} />
    </div>
  );
}

export function Audience() {
  return (
    <section className="lp-sec" style={{ paddingTop: 0 }}>
      <div className="lp-in">
        <div className="lp-3">
          {landing.audience.map((a) => <InfoCard key={a.title} icon={a.icon} title={a.title} text={a.text} />)}
        </div>
      </div>
    </section>
  );
}

function InfoCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="card flat lp-stack" style={{ gap: 10 }}>
      <div className="bubble acc"><Icon name={icon as IconName} size={16} /></div>
      <h3 className="t-h3">{title}</h3>
      <p className="t-body muted">{text}</p>
    </div>
  );
}

function AgendaDemo() {
  return (
    <div className="card lp-agenda">
      {landing.features.agenda.days.map((d) => (
        <div key={d.label} className="lp-stack" style={{ gap: 8 }}>
          <div className="t-tiny faint" style={{ textAlign: "center" }}>{d.label}</div>
          {d.slots.map((s) => (
            <div key={s.time} className={`ev${s.full ? " full" : ""}`} style={{ margin: 0 }}>
              <div className="top">
                <b className="t-small">{s.time}</b>
                <span className={`occ${s.full ? " full" : ""}`}>{s.full && <Icon name="lock" />}{s.occupancy}</span>
              </div>
              <div className="chips">
                {s.clients.map((c) => (
                  <span key={c.name} className={`cchip${c.status === "jm" || c.status === "um" ? " miss" : ""}`}><StatusDot status={c.status} />{c.name}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function AttendanceDemo() {
  const d = landing.features.attendance.demo;
  const options = [
    { status: "ok", label: statusLabels.PRESENCE_CONFIRMED },
    { status: "jm", label: statusLabels.JUSTIFIED_MISS },
    { status: "um", label: statusLabels.UNJUSTIFIED_MISS },
    { status: "rp", label: statusLabels.REPLACEMENT },
  ] as const;
  return (
    <div className="card lp-stack" style={{ padding: 22, gap: 16 }}>
      <div className="row">
        <span className="avatar">{d.initials}</span>
        <div style={{ lineHeight: 1.35 }}><div className="t-h3">{d.name}</div><div className="t-small muted">{d.when}</div></div>
      </div>
      {/* A picture of the real control: it shows the states, it does not change them. */}
      <div className="stsel lp-stsel" aria-hidden="true">
        {options.map((o) => (
          <span key={o.status} className={`st st-${o.status}${o.status === "ok" ? " sel" : ""}`}><StatusDot status={o.status} />{o.label}</span>
        ))}
      </div>
      <div className="card stone row" style={{ padding: "12px 14px", borderRadius: 12, flexWrap: "wrap" }}>
        <StatusPill status="rp" label={d.replacementLabel} />
        <span className="t-small muted">{d.replacementNote}</span>
      </div>
    </div>
  );
}

function EvolutionDemo() {
  const { open, closed } = landing.features.evolution.demo;
  return (
    <div className="lp-stack" style={{ gap: 10 }} aria-hidden="true">
      <div className="accord open">
        <div className="h"><Icon name="chevd" />{open.name}<span className="acc-count">{open.count}</span></div>
        <div className="lp-stack" style={{ padding: "14px 18px 18px", gap: 12 }}>
          <div className="seg" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
            {open.options.map((o) => <span key={o} className={`lp-seg${o === open.selected ? " on" : ""}`}>{o}</span>)}
          </div>
          <div className="field">
            <span className="label">{open.field}</span>
            <div className="input" style={{ height: "auto", padding: "12px 14px", lineHeight: "22px" }}>{open.value}</div>
          </div>
        </div>
      </div>
      {closed.map((c) => (
        <div key={c.name} className="accord"><div className="h"><Icon name="chevr" />{c.name}{"count" in c && <span className="acc-count">{c.count}</span>}</div></div>
      ))}
    </div>
  );
}

export function Features() {
  const f = landing.features;
  return (
    <section id="recursos" className="lp-sec lp-surface">
      <div className="lp-in lp-stack" style={{ gap: "clamp(56px, 8cqi, 96px)" }}>
        <div className="lp-stack" style={{ maxWidth: 680, gap: 14 }}>
          <span className="lp-eyebrow">{f.eyebrow}</span>
          <h2 className="lp-h2">{f.title}</h2>
        </div>
        <div className="lp-row"><Copy {...f.agenda} /><AgendaDemo /></div>
        <div className="lp-row lp-rev"><Copy {...f.attendance} /><AttendanceDemo /></div>
        <div className="lp-row"><Copy {...f.evolution} /><EvolutionDemo /></div>
        <div className="lp-3">{f.extras.map((e) => <InfoCard key={e.title} {...e} />)}</div>
      </div>
    </section>
  );
}
