import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, tokenStore, type AuthUser } from "./api";

interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setUser(tokenStore.getUser());
    setIsReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<LoginResponse>("/auth/login/", {
      method: "POST",
      auth: false,
      body: { email, password },
    });
    tokenStore.set(res.access, res.refresh, res.user);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) {
        await api("/auth/logout/", { method: "POST", body: { refresh } });
      }
    } catch {
      // ignore
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isReady,
      login,
      logout,
    }),
    [user, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
