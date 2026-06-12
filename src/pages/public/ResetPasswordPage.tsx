import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    const initializeRecovery = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      if (data.session) {
        setReady(true);
        return;
      }

      const hash = window.location.hash;
      if (!hash.includes("access_token")) {
        setError("This reset link is invalid or has expired. Request a new one.");
        return;
      }

      setReady(true);
    };

    void initializeRecovery();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      setMessage("Password updated successfully. Redirecting to login...");
      setTimeout(() => {
        navigate("/login", { replace: true, state: { error: "" } });
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[78vh] items-center justify-center py-6 animate-fade-in">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[2rem] border border-primary/15 gradient-hero p-8">
          <img src="/logo-mark.svg" alt="Nucleus" className="h-14 w-14 rounded-2xl shadow-[0_16px_36px_-20px_rgba(15,23,42,0.55)]" />
          <h1 className="mt-6 text-4xl font-bold premium-heading">Choose a new password for your workspace.</h1>
          <p className="mt-4 text-sm leading-7 text-soft">
            This updates your Supabase account password directly, so once it saves you can log in normally again.
          </p>
        </div>

        <div className="glass-premium w-full rounded-[2rem] p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure Reset
          </div>
          <h2 className="mt-4 text-2xl font-bold premium-heading">Reset Password</h2>
          <p className="mt-2 text-sm text-soft">Set a new password for your existing account.</p>

          {!ready && !error && <p className="mt-6 text-sm text-muted-foreground">Preparing secure recovery session...</p>}

          {ready && (
            <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
              <Input
                type="password"
                placeholder="New Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 rounded-xl border-border/60 bg-muted/35"
                autoComplete="new-password"
              />
              <Input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-11 rounded-xl border-border/60 bg-muted/35"
                autoComplete="new-password"
              />
              <Button type="submit" className="h-11 w-full rounded-xl gradient-primary text-primary-foreground" disabled={!password || !confirmPassword || loading}>
                {loading ? "Updating Password..." : "Save New Password"}
              </Button>
            </form>
          )}

          {message && <p className="mt-4 text-sm text-nucleus-positive">{message}</p>}
          {error && <p className="mt-4 text-sm text-nucleus-negative">{error}</p>}

          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            Need a fresh link?{" "}
            <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
              Request another reset email
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
