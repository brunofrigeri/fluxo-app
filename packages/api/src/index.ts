// Fluxo's data access, shared by web and mobile. Every function takes a Supabase client, so each platform brings
// its own session handling (cookies on web, secure storage on mobile) and everything still runs under RLS.
export * from "./errors";
export * from "./profile";
export * from "./modalities";
export * from "./bookings";
export * from "./agenda";
export * from "./home";
export * from "./waitlist";
export * from "./clients";
export * from "./records";
export * from "./documents";
