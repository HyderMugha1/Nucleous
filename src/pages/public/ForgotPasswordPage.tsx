import { FormEvent, useState } from "react";
import { MailCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setError("");
      setLoading(true);
      setSent(false);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[78vh] items-center justify-center py-6 animate-fade-in">
      <div className="grid w-full max-w-5xl gap-5 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[2rem] border border-primary/15 gradient-hero p-8">
          <img src="/logo-mark.svg" alt="Nucleus" className="h-14 w-14 rounded-2xl shadow-[0_16px_36px_-20px_rgba(15,23,42,0.55)]" />
          <h1 className="mt-6 text-4xl font-bold premium-heading">Reset your password and recover account access.</h1>
          <p className="mt-4 text-sm leading-7 text-soft">
            If an older account password was entered differently than expected, this lets you recover access cleanly
            without losing your workspace.
          </p>
        </div>

        <div className="glass-premium w-full rounded-[2rem] p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
            <MailCheck className="h-3.5 w-3.5" />
            Password Recovery
          </div>
          <h2 className="mt-4 text-2xl font-bold premium-heading">Forgot Password</h2>
          <p className="mt-2 text-sm text-soft">Enter your work email and we will send you a secure reset link.</p>

          <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
            <Input
              placeholder="Work Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-xl border-border/60 bg-muted/35"
              autoComplete="email"
            />
            <Button type="submit" className="h-11 w-full rounded-xl gradient-primary text-primary-foreground" disabled={!email.trim() || loading}>
              {loading ? "Sending Link..." : "Send Reset Link"}
            </Button>
          </form>

          {sent && <p className="mt-4 text-sm text-nucleus-positive">Reset link sent. Check your inbox and open the link from this browser.</p>}
          {error && <p className="mt-4 text-sm text-nucleus-negative">{error}</p>}

          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            Remembered it?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Back to login
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
