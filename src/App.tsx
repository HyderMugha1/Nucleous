import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PublicLayout } from "@/components/auth/PublicLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabaseConfigError } from "@/lib/supabase";
const HomePage = lazy(() => import("./pages/HomePage"));
const OverviewHome = lazy(() => import("./pages/OverviewHome"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const MentionExplorer = lazy(() => import("./pages/MentionExplorer"));
const NarrativeMonitor = lazy(() => import("./pages/NarrativeMonitor"));
const EntityConsole = lazy(() => import("./pages/EntityConsole"));
const CompetitorBenchmark = lazy(() => import("./pages/CompetitorBenchmark"));
const CampaignRoom = lazy(() => import("./pages/CampaignRoom"));
const CrisisRoom = lazy(() => import("./pages/CrisisRoom"));
const ReportStudio = lazy(() => import("./pages/ReportStudio"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const InfluencersPage = lazy(() => import("./pages/InfluencersPage"));
const TVIntelligence = lazy(() => import("./pages/TVIntelligence"));
const NewsIntelligence = lazy(() => import("./pages/NewsIntelligence"));
const MediaIntelligencePage = lazy(() => import("./pages/MediaIntelligencePage"));
const MediaBrandingPage = lazy(() => import("./pages/MediaBrandingPage"));
const SupabaseTestPage = lazy(() => import("./pages/SupabaseTestPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AboutUs = lazy(() => import("./pages/public/AboutUs"));
const AuthCallbackPage = lazy(() => import("./pages/public/AuthCallbackPage"));
const ContactUs = lazy(() => import("./pages/public/ContactUs"));
const ForgotPasswordPage = lazy(() => import("./pages/public/ForgotPasswordPage"));
const LoginPage = lazy(() => import("./pages/public/LoginPage"));
const PrivacyPolicy = lazy(() => import("./pages/public/PrivacyPolicy"));
const ResetPasswordPage = lazy(() => import("./pages/public/ResetPasswordPage"));
const SignupPage = lazy(() => import("./pages/public/SignupPage"));
const TermsOfService = lazy(() => import("./pages/public/TermsOfService"));

const queryClient = new QueryClient();

function ProtectedApp() {
  return (
    <AuthGuard>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </AuthGuard>
  );
}

function RouteLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6">
      <div className="glass-premium rounded-2xl px-6 py-5 text-sm text-muted-foreground">
        Loading workspace...
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          {supabaseConfigError ? (
            <div className="px-4 pt-4">
              <Alert className="mx-auto max-w-5xl border-amber-300/60 bg-amber-50 text-amber-950">
                <AlertTitle>Deployment configuration needed</AlertTitle>
                <AlertDescription>{supabaseConfigError}</AlertDescription>
              </Alert>
            </div>
          ) : null}
          <BrowserRouter>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/about" element={<AboutUs />} />
                  <Route path="/contact" element={<ContactUs />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                </Route>

                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />

                <Route element={<ProtectedApp />}>
                  <Route path="/home" element={<OverviewHome />} />
                  <Route path="/dashboard" element={<CommandCenter />} />
                  <Route path="/mentions" element={<MentionExplorer />} />
                  <Route path="/narratives" element={<NarrativeMonitor />} />
                  <Route path="/entities" element={<EntityConsole />} />
                  <Route path="/influencers" element={<InfluencersPage />} />
                  <Route path="/tv" element={<TVIntelligence />} />
                  <Route path="/news" element={<NewsIntelligence />} />
                  <Route path="/media-intelligence" element={<MediaIntelligencePage />} />
                  <Route path="/media-intelligence/branding" element={<MediaBrandingPage />} />
                  <Route path="/competitors" element={<CompetitorBenchmark />} />
                  <Route path="/campaigns" element={<CampaignRoom />} />
                  <Route path="/crisis" element={<CrisisRoom />} />
                  <Route path="/reports" element={<ReportStudio />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/supabase-test" element={<SupabaseTestPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
