const trim = (u: string) => u.replace(/\/+$/, "");

/** The studio app (apps/web). */
export const APP_URL = trim(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
/** This site. */
export const SITE_URL = trim(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001");

export const signUpUrl = `${APP_URL}/signup`;
export const signInUrl = `${APP_URL}/login`;
