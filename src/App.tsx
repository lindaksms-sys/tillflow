import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { BusinessProvider, useBusiness } from "@/hooks/useBusiness";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Stock from "./pages/Stock";
import Sales from "./pages/Sales";
import Expenses from "./pages/Expenses";
import Insights from "./pages/Insights";
import Staff from "./pages/Staff";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import CreditCustomers from "./pages/CreditCustomers";
import BottomNav from "./components/BottomNav";
import TrialBanner from "./components/TrialBanner";
import TrialExpired from "./components/TrialExpired";
import AcceptInvite from "./pages/AcceptInvite";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RoleGuard({ allowed, children }: { allowed: string[]; children: React.ReactNode }) {
  const { role } = useBusiness();
  if (!role || !allowed.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useBusiness();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading: authLoading } = useAuth();
  const { businessId, plan, trialEndsAt, loading: bizLoading } = useBusiness();

  // Public routes accessible without auth
  const pathname = window.location.pathname;
  if (pathname.startsWith("/accept-invite")) {
    return (
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvite />} />
      </Routes>
    );
  }
  if (pathname.startsWith("/reset-password")) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
      </Routes>
    );
  }

  if (authLoading || (user && bizLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;
  if (!businessId) return <Onboarding />;

  // Only block expired Pro users — free plan users get limited access
  if (plan === "expired") {
    return <TrialExpired />;
  }

  return (
    <>
      <TrialBanner />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/products" element={<RoleGuard allowed={["owner", "manager"]}><Products /></RoleGuard>} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/credit-customers" element={<CreditCustomers />} />
        <Route path="/expenses" element={<RoleGuard allowed={["owner", "manager"]}><Expenses /></RoleGuard>} />
        <Route path="/insights" element={<RoleGuard allowed={["owner", "manager"]}><Insights /></RoleGuard>} />
        <Route path="/staff" element={<RoleGuard allowed={["owner"]}><Staff /></RoleGuard>} />
        <Route path="/settings" element={<RoleGuard allowed={["owner"]}><Settings /></RoleGuard>} />
        <Route path="/admin" element={<AdminGuard><Admin /></AdminGuard>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <BusinessProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </BusinessProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
