import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { completeOAuthSignup as completeOAuthSignupRequest, getCurrentUser, login as loginRequest, signup as signupRequest } from "@/lib/api";
import { supabase } from "@/lib/supabase";

export interface AuthProfile {
  id?: string;
  fullName: string;
  company: string;
  contactNumber: string;
  competitors: string;
  email: string;
  platform: string;
  role?: string;
  organizationId?: string;
}

interface LoginOptions {
  platform?: string;
  profile?: Partial<AuthProfile>;
  password?: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthProfile | null;
  isLoading: boolean;
  login: (options?: LoginOptions) => Promise<void>;
  signup: (profile: AuthProfile & { password?: string }) => Promise<void>;
  completeOAuthSignup: (profile: AuthProfile & { accessToken: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "Authentication failed";

  if (message === "fetch failed" || message === "Failed to fetch") {
    return "Unable to reach Supabase authentication. Check `VITE_SUPABASE_URL`, `SUPABASE_URL`, and your DNS/network connection.";
  }

  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const syncAuthenticatedUser = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        if (!data.session) {
          if (!active) return;
          setUser(null);
          setIsAuthenticated(false);
          return;
        }

        const response = await getCurrentUser();
        if (!active) return;
        setUser(response.user);
        setIsAuthenticated(true);
      } catch {
        if (!active) return;
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void syncAuthenticatedUser();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void syncAuthenticatedUser();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const login = async (options?: LoginOptions) => {
    try {
      const email = options?.profile?.email?.trim();
      const password = options?.password;

      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const loginResponse = await loginRequest({
        email: email.toLowerCase(),
        password,
        platform: options?.platform,
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (error || !data.session) {
        throw new Error(error?.message || "Unable to establish browser session");
      }

      setUser(loginResponse.user);
      setIsAuthenticated(true);
    } catch (error) {
      throw new Error(normalizeAuthError(error));
    }
  };

  const signup = async (profile: AuthProfile & { password?: string }) => {
    try {
      if (!profile.password) {
        throw new Error("Password is required");
      }

      const response = await signupRequest({
        ...profile,
        password: profile.password,
        platform: profile.platform,
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: profile.email.trim().toLowerCase(),
        password: profile.password,
      });

      if (error || !data.session) {
        throw new Error(error?.message || "Account was created, but the browser session could not be established. Please try logging in.");
      }

      setUser(response.user);
      setIsAuthenticated(true);
    } catch (error) {
      throw new Error(normalizeAuthError(error));
    }
  };

  const completeOAuthSignup = async (profile: AuthProfile & { accessToken: string }) => {
    const response = await completeOAuthSignupRequest({
      accessToken: profile.accessToken,
      fullName: profile.fullName,
      company: profile.company,
      contactNumber: profile.contactNumber,
      competitors: profile.competitors,
      role: profile.role,
      platform: profile.platform,
    });

    setUser(response.user);
    setIsAuthenticated(true);
  };

  const logout = () => {
    sessionStorage.removeItem("nucleus-oauth-pending");
    sessionStorage.removeItem("nucleus-oauth-redirect");
    setIsAuthenticated(false);
    setUser(null);
    void supabase.auth.signOut();
  };

  const value = useMemo(
    () => ({ isAuthenticated, user, isLoading, login, signup, completeOAuthSignup, logout }),
    [isAuthenticated, user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
