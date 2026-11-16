import { brand, landing } from "@fluxo/copy";
import { Icon, Logo } from "@fluxo/ui-web";
import { contact, privacyUrl, signInUrl, signUpUrl, termsUrl } from "@/lib/urls";

export function Header() {
  const n = landing.nav;
  return (
    <header className="lp-in lp-header">
      <a href="#top" aria-label={brand.name} className="lp-brand"><Logo /></a>
      <nav className="lp-links" aria-label={n.label}>
        <a href="#recursos">{n.features}</a>
        <a href="#como-funciona">{n.howItWorks}</a>
        <a href="#planos">{n.plans}</a>
        <a href="#perguntas">{n.faq}</a>
      </nav>
      <div className="lp-header-actions">
        <a className="btn quiet" href={signInUrl}>{n.signIn}</a>
        <a className="btn pri" href={signUpUrl}>{n.trial}</a>
      </div>
    </header>
  );
}

export function FinalCta() {
  const c = landing.cta;
  return (
    <section className="lp-final">
      <div className="lp-in">
        <div className="lp-final-box">
          <h2 className="lp-h2" style={{ maxWidth: 640 }}>{c.title}</h2>
          <p className="lp-lead" style={{ color: "inherit", opacity: 0.9, maxWidth: 560 }}>{c.text}</p>
          <a className="btn lp-btn lp-btn-inv" href={signUpUrl}>{c.button}</a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const f = landing.footer;
  const year = new Date().getFullYear();
  return (
    <footer className="lp-footer">
      <div className="lp-in lp-footer-in">
        <div className="brand">
          <div className="lm"><Icon name="wave" size={20} /></div>
          <span className="wordmark">{brand.name}</span>
        </div>
        <nav className="lp-footer-links" aria-label={f.label}>
          {termsUrl && <a href={termsUrl}>{f.terms}</a>}
          {privacyUrl && <a href={privacyUrl}>{f.privacy}</a>}
          {contact && <a href={contact.href}>{contact.label}</a>}
        </nav>
        <span className="t-small muted">© {year} {brand.name}. {f.rights}</span>
      </div>
    </footer>
  );
}
