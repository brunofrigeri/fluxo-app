"use client";

import { useEffect, useState } from "react";
import { landing } from "@fluxo/copy";
import { platformOf, type Platform } from "@/lib/stores";

type Props = { appStoreUrl: string | null; playStoreUrl: string | null };

/** Store marks, drawn at the size of the badge. They are brand logos: do not recolor them. */
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="#fff" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg viewBox="2 0 21 24" width="28" height="28" aria-hidden="true">
      <path d="M4 2 12 12 4 22z" fill="#00A0FF" />
      <path d="M4 2 12 12 17 12 17 9.65z" fill="#00E27A" />
      <path d="M4 22 12 12 17 12 17 14.35z" fill="#FF3A44" />
      <path d="M17 9.65 21 12 17 14.35z" fill="#FFD500" />
    </svg>
  );
}

/**
 * Store badges. A store that has no address yet is not shown. On a phone the visitor's own store comes first;
 * the server renders both in a fixed order, so the page is the same for everyone until it hydrates.
 */
export function StoreButtons({ appStoreUrl, playStoreUrl }: Props) {
  const a = landing.app;
  const [platform, setPlatform] = useState<Platform>("other");
  useEffect(() => {
    // iPadOS 13+ says "Macintosh"; a touch screen tells it apart from a real Mac.
    const ipad = /macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
    setPlatform(ipad ? "ios" : platformOf(navigator.userAgent));
  }, []);

  if (!appStoreUrl && !playStoreUrl) return null;
  const buttons = [
    appStoreUrl && { key: "ios", href: appStoreUrl, mark: <AppleMark />, ...a.appStore },
    playStoreUrl && { key: "android", href: playStoreUrl, mark: <PlayMark />, ...a.googlePlay },
  ].filter(Boolean) as { key: Platform; href: string; mark: React.ReactNode; kicker: string; name: string }[];
  buttons.sort((x, y) => Number(y.key === platform) - Number(x.key === platform));

  return (
    <div className="lp-stores" role="group" aria-label={a.storesLabel}>
      {buttons.map((b) => (
        <a key={b.key} className={`lp-store lp-store-${b.key}`} href={b.href} rel="noopener" aria-label={`${b.kicker} ${b.name}`}>
          {b.mark}
          <span className="lp-store-text"><span className="lp-store-kicker">{b.kicker}</span><span className="lp-store-name">{b.name}</span></span>
        </a>
      ))}
    </div>
  );
}
