import { FormEvent, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const OAUTH_REDIRECT_KEY = "nucleus-oauth-redirect";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/home";
  const locationError = (location.state as { error?: string } | null)?.error || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(locationError);
  const [loading, setLoading] = useState(false);

  const continueWithEmail = async () => {
    try {
      setError("");
      setLoading(true);
      await login({
        platform: "Email",
        password,
        profile: {
          email: email.trim() || undefined,
        },
      });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await continueWithEmail();
  };

  const continueWithOAuth = async (provider: "google" | "azure") => {
    try {
      setError("");
      setLoading(true);
      sessionStorage.setItem(OAUTH_REDIRECT_KEY, from);

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth login failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[78vh] items-center justify-center py-6 animate-fade-in">
      <div className="grid w-full max-w-6xl gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-primary/15 gradient-hero p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary">
            <LockKeyhole className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="mt-6 text-4xl font-bold premium-heading">Login to unlock the protected intelligence workspace.</h1>
          <p className="mt-4 text-sm leading-7 text-soft">
            Public pages show the product clearly. Your authenticated workspace is where live dashboards, reports, and
            company-specific monitoring become available.
          </p>
          <div className="mt-6 space-y-3">
            {[
              "Protected routes keep dashboard data inaccessible until login.",
              "Email and platform sign-in options support different team workflows.",
              "Existing signup details can be reused to personalize the dashboard experience.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-border/50 bg-background/30 px-4 py-3 text-sm leading-6 text-soft">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-premium w-full rounded-[2rem] p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure Sign In
          </div>
          <h2 className="mt-4 text-2xl font-bold premium-heading">Welcome back</h2>
          <p className="mt-2 text-sm text-soft">Use the same email and password you created during signup to enter your protected workspace.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button variant="outline" className="h-11 rounded-xl border-border/60 bg-background/35" onClick={() => void continueWithOAuth("google")} disabled={loading}>
              Continue with Google
            </Button>
            <Button variant="outline" className="h-11 rounded-xl border-border/60 bg-background/35" onClick={() => void continueWithOAuth("azure")} disabled={loading}>
              Continue with Microsoft
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">or email</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <Input
              placeholder="Work Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl border-border/60 bg-muted/35"
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl border-border/60 bg-muted/35"
              autoComplete="current-password"
            />

            <Button
              type="submit"
              className="h-11 w-full rounded-xl gradient-primary text-primary-foreground"
              disabled={!email.trim() || !password.trim() || loading}
            >
              {loading ? "Signing In..." : "Login With Email"}
            </Button>
          </form>

          {error && <p className="mt-3 text-sm text-nucleus-negative">{error}</p>}

          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            After login, the app routes you directly into the protected dashboard experience.
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Forgot your password?{" "}
            <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
              Reset it here
            </Link>
            .
          </p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            New here?{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline">
              Create an account first
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
