import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const OAUTH_PENDING_KEY = "nucleus-oauth-pending";
const OAUTH_REDIRECT_KEY = "nucleus-oauth-redirect";

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup, completeOAuthSignup } = useAuth();
  const oauthMode = searchParams.get("oauth") === "1";
  const pendingOAuth = (() => {
    if (!oauthMode) return null;
    const raw = sessionStorage.getItem(OAUTH_PENDING_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as {
        accessToken: string;
        email: string;
        fullName: string;
        platform: string;
      };
    } catch {
      return null;
    }
  })();
  const [platform, setPlatform] = useState(pendingOAuth?.platform || "Email");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    company: "",
    contactNumber: "",
    competitors: "",
    role: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required";
    if (!form.company.trim()) nextErrors.company = "Company is required";
    if (!form.contactNumber.trim()) nextErrors.contactNumber = "Contact number is required";
    if (!form.competitors.trim()) nextErrors.competitors = "Competitors are required";
    if (!form.email.includes("@")) nextErrors.email = "Valid email is required";
    if (!oauthMode && form.password.length < 6) nextErrors.password = "Password must be at least 6 characters";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    try {
      setSubmitError("");
      setIsSubmitting(true);
      if (oauthMode && pendingOAuth) {
        await completeOAuthSignup({
          accessToken: pendingOAuth.accessToken,
          fullName: form.fullName,
          company: form.company,
          contactNumber: form.contactNumber,
          competitors: form.competitors,
          role: form.role,
          email: pendingOAuth.email,
          platform: pendingOAuth.platform,
        });
        sessionStorage.removeItem(OAUTH_PENDING_KEY);
      } else {
        await signup({ ...form, platform });
      }
      const redirectTo = sessionStorage.getItem(OAUTH_REDIRECT_KEY) || "/home";
      sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
      navigate(redirectTo);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueWithOAuth = async (provider: "google" | "azure", label: "Google" | "Microsoft") => {
    try {
      setSubmitError("");
      setIsSubmitting(true);
      sessionStorage.setItem(OAUTH_REDIRECT_KEY, "/home");

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : `${label} signup failed`);
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!pendingOAuth) return;
    setPlatform(pendingOAuth.platform);
    setForm((current) => ({
      ...current,
      fullName: pendingOAuth.fullName || current.fullName,
      email: pendingOAuth.email || current.email,
    }));
  }, [pendingOAuth]);

  return (
    <div className="flex min-h-[82vh] items-center justify-center py-6 animate-fade-in">
      <div className="grid w-full max-w-6xl gap-5 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="rounded-[2rem] border border-primary/15 gradient-hero p-8">
          <img src="/logo-mark.svg" alt="Nucleus" className="h-14 w-14 rounded-2xl shadow-[0_16px_36px_-20px_rgba(15,23,42,0.55)]" />
          <h1 className="mt-6 text-4xl font-bold premium-heading">Create your account and unlock protected platform access.</h1>
          <p className="mt-4 text-sm leading-7 text-soft">
            Signup captures the information needed to personalize your secure workspace. We show the product publicly, but
            the real data remains locked until this step is complete.
          </p>
          <div className="mt-6 space-y-3">
            {[
              "Required onboarding includes name, company, contact number, competitors, and work email.",
              "You can indicate the platform you prefer for access, including Google, Microsoft, or Email.",
              "After signup, users are sent straight into the authenticated dashboard experience.",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-border/50 bg-background/30 px-4 py-3 text-sm leading-6 text-soft">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="glass-premium w-full space-y-5 rounded-[2rem] p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary">
            <UserPlus className="h-3.5 w-3.5" />
            Signup & Onboarding
          </div>
          <div>
            <h2 className="text-2xl font-bold premium-heading">Create Your Account</h2>
            <p className="mt-2 text-sm text-soft">
              {oauthMode ? "Finish workspace onboarding for your OAuth account." : "Choose a preferred platform, then complete the onboarding fields below."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Google" },
              { label: "Microsoft" },
              { label: "Email" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  if (oauthMode) return;
                  if (option.label === "Google") {
                    void continueWithOAuth("google", "Google");
                    return;
                  }
                  if (option.label === "Microsoft") {
                    void continueWithOAuth("azure", "Microsoft");
                    return;
                  }
                  setPlatform(option.label);
                }}
                disabled={isSubmitting || oauthMode}
                className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm transition-colors ${
                  platform === option.label
                    ? "border-primary/45 bg-primary/12 text-primary"
                    : "border-border/60 bg-background/35 text-foreground hover:border-primary/25 hover:bg-primary/8"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Input
                placeholder="Full Name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="h-11 rounded-xl border-border/50 bg-muted/40"
                disabled={oauthMode && Boolean(pendingOAuth?.fullName)}
              />
              {errors.fullName && <p className="mt-1 text-[10px] text-nucleus-negative">{errors.fullName}</p>}
            </div>

            <div>
              <Input
                placeholder="Company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="h-11 rounded-xl border-border/50 bg-muted/40"
              />
              {errors.company && <p className="mt-1 text-[10px] text-nucleus-negative">{errors.company}</p>}
            </div>

            <div>
              <Input
                placeholder="Contact Number"
                value={form.contactNumber}
                onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                className="h-11 rounded-xl border-border/50 bg-muted/40"
              />
              {errors.contactNumber && <p className="mt-1 text-[10px] text-nucleus-negative">{errors.contactNumber}</p>}
            </div>

            <div>
              <Input
                placeholder="Competitors (comma-separated)"
                value={form.competitors}
                onChange={(e) => setForm({ ...form, competitors: e.target.value })}
                className="h-11 rounded-xl border-border/50 bg-muted/40"
              />
              {errors.competitors && <p className="mt-1 text-[10px] text-nucleus-negative">{errors.competitors}</p>}
            </div>

            <div>
              <Input
                placeholder="Work Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="h-11 rounded-xl border-border/50 bg-muted/40"
                disabled={oauthMode}
              />
              {errors.email && <p className="mt-1 text-[10px] text-nucleus-negative">{errors.email}</p>}
            </div>

            {!oauthMode && (
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-11 rounded-xl border-border/50 bg-muted/40"
                />
                {errors.password && <p className="mt-1 text-[10px] text-nucleus-negative">{errors.password}</p>}
              </div>
            )}

            <div className="md:col-span-2">
              <Input
                placeholder="Role / Team (optional)"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="h-11 rounded-xl border-border/50 bg-muted/40"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-background/25 p-4 text-sm text-soft">
            Selected platform: <span className="font-semibold text-foreground">{platform}</span>
          </div>

          <Button className="w-full h-11 rounded-xl gradient-primary text-primary-foreground" onClick={submit} disabled={isSubmitting}>
            {isSubmitting ? "Creating Account..." : oauthMode ? "Finish OAuth Signup" : "Sign Up And Unlock Workspace"}
          </Button>

          {submitError && <p className="text-sm text-nucleus-negative">{submitError}</p>}
          <p className="text-xs leading-6 text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Login here
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
