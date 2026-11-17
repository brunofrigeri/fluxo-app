import { landing } from "@fluxo/copy";
import { appStoreUrl, playStoreUrl, signInUrl } from "@/lib/urls";
import { StoreButtons } from "./GetApp";

/** Both ways in: the app from the store, or the web app in the browser. */
export function AppSection() {
  const a = landing.app;
  return (
    <section id="app" className="lp-sec" style={{ paddingTop: 0 }}>
      <div className="lp-in">
        <div className="card lp-app">
          <div className="lp-stack" style={{ gap: 12, maxWidth: 560 }}>
            <span className="lp-eyebrow">{a.eyebrow}</span>
            <h2 className="lp-h2">{a.title}</h2>
            <p className="lp-lead">{a.text}</p>
          </div>
          <div className="lp-app-actions">
            <StoreButtons appStoreUrl={appStoreUrl} playStoreUrl={playStoreUrl} />
            <a className="btn lp-btn" href={signInUrl}>{a.web}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
