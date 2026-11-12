import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { supabase } from "./config/supabaseClient";
import { setSession } from "./store/slices/authSlice";
import { fetchDealerProfile } from "./store/slices/dealerSlice";

import AuthLayout from "./layouts/AuthLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import OnboardingLayout from "./layouts/OnboardingLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

import Home from "./pages/Landing/Home";
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import Inventory from "./pages/Dashboard/Inventory";
import DashboardHome from "./pages/Dashboard/DashboardHome";
import StudioPage from "./pages/Dashboard/Studio/StudioPage";
import ViewerPage from "./pages/Player/ViewerPage";
import PublicLayout from "./layouts/PublicLayout";
import Showroom from "./pages/Microsite/Showroom";
import VehicleDetail from "./pages/Microsite/VehicleDetail";

import AccountStep from "./pages/Onboarding/AccountStep";
import PaymentStep from "./pages/Onboarding/PaymentStep";
import BrandingStep from "./pages/Onboarding/BrandingStep";
import EditorPage from "./pages/Dashboard/Studio/EditorPage";

import StudioWizard from "./pages/Dashboard/Studio/Wizard/StudioWizard";

const getSubdomain = () => {
  const host = window.location.hostname;

  // 1. Check if the host is a raw IP address (e.g., 108.61.189.3)
  const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host);

  // 2. If it's localhost, an IP, or your main domain, it's NOT a subdomain
  if (
    (host.includes("localhost") && !host.includes(".lvh.me")) ||
    isIP || // <--- ADD THIS LINE
    host === "axle.com" ||
    host === "www.axle.com" ||
    host === "app.axle.com"
  ) {
    return null;
  }

  const parts = host.split(".");
  if (parts.length >= 3) {
    return parts[0];
  }

  return null;
};

function App() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const subdomain = getSubdomain();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch(setSession(session));
      if (session?.user) {
        dispatch(fetchDealerProfile(session.user.id));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      dispatch(setSession(session));
      if (session?.user) {
        dispatch(fetchDealerProfile(session.user.id));
      }

      // If user confirms email or signs in and lands on root or auth routes, route to onboarding stepper
      if (window.location.hash.includes("access_token") || event === "SIGNED_IN") {
        const path = window.location.pathname;
        if (path === "/" || path === "/login" || path === "/register") {
          navigate("/onboarding/payment");
        }
      }
    });

    // Check on initial load if URL has email confirmation hash
    if (window.location.hash.includes("access_token")) {
      const path = window.location.pathname;
      if (path === "/" || path === "/login" || path === "/register") {
        navigate("/onboarding/payment");
      }
    }

    return () => subscription.unsubscribe();
  }, [dispatch, navigate]);

  if (subdomain) {
    return (
      <ErrorBoundary>
        <Routes>
          {/* Notice we pass subdomain as a prop, and removed /sites/:dealerId */}
          <Route path="/" element={<PublicLayout subdomain={subdomain} />}>
            <Route index element={<Showroom />} />
            <Route path="inventory/:carId" element={<VehicleDetail />} />
          </Route>

          {/* Buyers need to access the 3D player */}
          <Route path="/experience/:storyId" element={<ViewerPage />} />

          {/* If they type a weird URL on the microsite, send them back to the Showroom */}
          <Route path="*" element={<Showroom />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  // ======================================================================
  // 🛣️ ROUTING TREE B: THE REVV SAAS (e.g., localhost or app.axle.com)
  // ======================================================================
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingLayout />}>
            <Route path="account" element={<AccountStep />} />
            <Route path="payment" element={<PaymentStep />} />
            <Route path="branding" element={<BrandingStep />} />
          </Route>

          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="studio" element={<StudioPage />} />
            <Route path="studio/published" element={<StudioPage />} />
            <Route path="studio/trash" element={<StudioPage />} />

            <Route path="studio/wizard" element={<StudioWizard />} />
            <Route path="editor/:storyId" element={<EditorPage />} />
            <Route path="settings" element={<div>Settings Page</div>} />
          </Route>
        </Route>

        {/* Dealers also need to preview the 3D player from the dashboard */}
        <Route path="/experience/:storyId" element={<ViewerPage />} />

        <Route
          path="*"
          element={
            <div className="flex items-center justify-center min-h-screen bg-black text-white">
              <div className="text-center space-y-4">
                <h1 className="text-6xl font-bold">404</h1>
                <p className="text-xl text-white/60">Page not found</p>
                <a
                  href="/"
                  className="inline-block px-6 py-2 bg-white text-black rounded-full font-medium hover:bg-white/90 transition-colors"
                >
                  Go Home
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
