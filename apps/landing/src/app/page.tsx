import { brand, landing } from "@fluxo/copy";
import { Icon, Logo, type IconName } from "@fluxo/ui-web";
import { signInUrl, signUpUrl } from "@/lib/urls";

export default function Home() {
  const year = new Date().getFullYear();
  return (
    <div className="fx lp" data-theme="light">
      <header className="lp-header">
        <div className="lp-wrap lp-header-in">
          <a href="#top" aria-label={brand.name} className="lp-logo">
            <Logo />
          </a>
          <nav className="lp-nav" aria-label="Principal">
            <a href="#recursos" className="lp-link">{landing.nav.features}</a>
            <a href={signInUrl} className="btn quiet sm">{landing.nav.signIn}</a>
            <a href={signUpUrl} className="btn pri sm">{landing.nav.signUp}</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-in">
            <p className="t-tiny lp-eyebrow">{landing.hero.eyebrow}</p>
            <h1 className="t-display lp-title">{landing.hero.title}</h1>
            <p className="t-body muted lp-sub">{landing.hero.subtitle}</p>
            <div className="lp-actions">
              <a href={signUpUrl} className="btn pri">{landing.hero.primary}</a>
              <a href={signInUrl} className="btn">{landing.hero.secondary}</a>
            </div>
          </div>
        </section>

        <section id="recursos" className="lp-section">
          <div className="lp-wrap">
            <h2 className="t-h1 lp-h2">{landing.features.title}</h2>
            <ul className="lp-grid">
              {landing.features.items.map((f) => (
                <li key={f.title} className="card lp-feature">
                  <span className="lp-ico"><Icon name={f.icon as IconName} size={20} /></span>
                  <h3 className="t-h3">{f.title}</h3>
                  <p className="t-body muted">{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-section lp-mods">
          <div className="lp-wrap lp-mods-in">
            <h2 className="t-h2">{landing.modalities.title}</h2>
            <ul className="lp-pills">
              {landing.modalities.items.map((m) => (
                <li key={m} className="pill acc">{m}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-wrap">
            <div className="card lp-cta">
              <h2 className="t-h1">{landing.cta.title}</h2>
              <p className="t-body muted">{landing.cta.text}</p>
              <a href={signUpUrl} className="btn pri">{landing.cta.button}</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-in t-small faint">
          <span>© {year} {brand.name}. {landing.footer.rights}</span>
        </div>
      </footer>
    </div>
  );
}
