"use client";

import { useEffect, useState } from "react";
import { landing } from "@fluxo/copy";
import { Icon } from "@fluxo/ui-web";
import { platformOf, type Platform } from "@/lib/stores";

type Props = { appStoreUrl: string | null; playStoreUrl: string | null };

/**
 * Store buttons. A store that has no address yet is not shown. On a phone the visitor's own store comes first;
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
    appStoreUrl && { key: "ios", href: appStoreUrl, ...a.appStore },
    playStoreUrl && { key: "android", href: playStoreUrl, ...a.googlePlay },
  ].filter(Boolean) as { key: Platform; href: string; kicker: string; name: string }[];
  buttons.sort((x, y) => Number(y.key === platform) - Number(x.key === platform));

  return (
    <div className="lp-stores" role="group" aria-label={a.storesLabel}>
      {buttons.map((b) => (
        <a key={b.key} className="lp-store" href={b.href} rel="noopener">
          <Icon name="phone" size={24} />
          <span className="lp-store-text"><span className="lp-store-kicker">{b.kicker}</span><span className="lp-store-name">{b.name}</span></span>
        </a>
      ))}
    </div>
  );
}
