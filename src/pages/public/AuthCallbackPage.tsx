import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { exchangeOAuthSession } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const OAUTH_PENDING_KEY = "nucleus-oauth-pending";
const OAUTH_REDIRECT_KEY = "nucleus-oauth-redirect";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function handleOAuthCallback() {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session?.access_token) {
        if (active) navigate("/login", { replace: true, state: { error: error?.message || "Unable to complete OAuth login" } });
        return;
      }

      try {
        const response = await exchangeOAuthSession(data.session.access_token);
        if (!active) return;

        if (response.onboarded && response.user) {
          sessionStorage.removeItem(OAUTH_PENDING_KEY);
          const redirectTo = sessionStorage.getItem(OAUTH_REDIRECT_KEY) || "/home";
          sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
          navigate(redirectTo, { replace: true });
          return;
        }

        if (response.oauthProfile) {
          sessionStorage.setItem(
            OAUTH_PENDING_KEY,
            JSON.stringify({
              accessToken: data.session.access_token,
              ...response.oauthProfile,
            }),
          );
          navigate("/signup?oauth=1", { replace: true });
          return;
        }

        navigate("/login", { replace: true, state: { error: "OAuth account could not be mapped to this workspace." } });
      } catch (callbackError) {
        if (!active) return;
        navigate("/login", {
          replace: true,
          state: { error: callbackError instanceof Error ? callbackError.message : "OAuth login failed" },
        });
      }
    }

    void handleOAuthCallback();

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="glass-premium rounded-2xl p-8 text-center">
        <p className="text-sm text-muted-foreground">Completing secure sign-in...</p>
      </div>
    </div>
  );
}
