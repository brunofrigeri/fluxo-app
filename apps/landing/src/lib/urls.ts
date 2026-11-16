const trim = (u: string) => u.replace(/\/+$/, "");

/**
 * Footer links the business has to provide. Unset means the link is not shown: the page never ships a dead
 * "#" link or a placeholder where an address belongs.
 */
const optional = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);

type Env = Record<string, string | undefined>;

export function readUrls(env: Env) {
  const app = trim(env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const email = optional(env.NEXT_PUBLIC_CONTACT_EMAIL);
  return {
    /** The studio app (apps/web). */
    appUrl: app,
    /** This site. */
    siteUrl: trim(env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"),
    signUpUrl: `${app}/signup`,
    signInUrl: `${app}/login`,
    termsUrl: optional(env.NEXT_PUBLIC_TERMS_URL),
    privacyUrl: optional(env.NEXT_PUBLIC_PRIVACY_URL),
    contact: email ? { label: email, href: `mailto:${email}` } : null,
  };
}

// Next inlines NEXT_PUBLIC_* only for literal `process.env.NAME` reads, so they are listed here, not spread.
const urls = readUrls({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_TERMS_URL: process.env.NEXT_PUBLIC_TERMS_URL,
  NEXT_PUBLIC_PRIVACY_URL: process.env.NEXT_PUBLIC_PRIVACY_URL,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
});

export const { appUrl: APP_URL, siteUrl: SITE_URL, signUpUrl, signInUrl, termsUrl, privacyUrl, contact } = urls;
