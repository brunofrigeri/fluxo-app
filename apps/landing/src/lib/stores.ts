export type Platform = "ios" | "android" | "other";

/** iPadOS 13+ reports itself as a Mac, so touch support is checked by the caller when it can. */
export function platformOf(userAgent: string | null | undefined): Platform {
  const ua = userAgent ?? "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "other";
}

type Targets = { appStoreUrl: string | null; playStoreUrl: string | null; webUrl: string };

/** Where a visitor on this device should land: their store if it is set, otherwise the web app. */
export function destinationFor(platform: Platform, t: Targets): string {
  if (platform === "ios" && t.appStoreUrl) return t.appStoreUrl;
  if (platform === "android" && t.playStoreUrl) return t.playStoreUrl;
  return t.webUrl;
}
