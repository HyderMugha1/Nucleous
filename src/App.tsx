import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PublicLayout } from "@/components/auth/PublicLayout";
import HomePage from "./pages/HomePage";
import OverviewHome from "./pages/OverviewHome";
import CommandCenter from "./pages/CommandCenter";
import MentionExplorer from "./pages/MentionExplorer";
import NarrativeMonitor from "./pages/NarrativeMonitor";
import EntityConsole from "./pages/EntityConsole";
import CompetitorBenchmark from "./pages/CompetitorBenchmark";
import CampaignRoom from "./pages/CampaignRoom";
import CrisisRoom from "./pages/CrisisRoom";
import ReportStudio from "./pages/ReportStudio";
import AlertsPage from "./pages/AlertsPage";
import AdminPage from "./pages/AdminPage";
import InfluencersPage from "./pages/InfluencersPage";
import TVIntelligence from "./pages/TVIntelligence";
import NewsIntelligence from "./pages/NewsIntelligence";
import MediaIntelligencePage from "./pages/MediaIntelligencePage";
import SupabaseTestPage from "./pages/SupabaseTestPage";
import NotFound from "./pages/NotFound";
import AboutUs from "./pages/public/AboutUs";
import AuthCallbackPage from "./pages/public/AuthCallbackPage";
import ContactUs from "./pages/public/ContactUs";
import ForgotPasswordPage from "./pages/public/ForgotPasswordPage";
import LoginPage from "./pages/public/LoginPage";
import PrivacyPolicy from "./pages/public/PrivacyPolicy";
import ResetPasswordPage from "./pages/public/ResetPasswordPage";
import SignupPage from "./pages/public/SignupPage";
import TermsOfService from "./pages/public/TermsOfService";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
