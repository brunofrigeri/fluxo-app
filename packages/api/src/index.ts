// Fluxo's data access, shared by web and mobile. Every function takes a Supabase client, so each platform brings
// its own session handling (cookies on web, secure storage on mobile) and everything still runs under RLS.
export * from "./agenda";
export * from "./home";
