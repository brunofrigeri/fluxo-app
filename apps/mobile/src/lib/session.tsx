import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "./supabase";

type State = { session: Session | null; loading: boolean };
const Ctx = createContext<State>({ session: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ session: null, loading: true });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }));
    return () => data.subscription.unsubscribe();
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
