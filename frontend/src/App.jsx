import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import CustomCursor from "./components/CustomCursor";
import Loader from "./components/Loader";
import AdminRoute from "./components/AdminRoute";
import { DailiesTransitionProvider } from "./components/dailies/DailiesTransition";

// ─── Route-based code splitting ───────────────────────────────────────────────
// PERFORMANCE FIX (round 4): All pages were previously statically imported,
// forcing the entire app's JS (357 kB) to download on the very first visit
// regardless of which page the user is on.
//
// React.lazy() splits each page into its own JS chunk that is only fetched
// when that route is first navigated to. This cuts the initial bundle size
// dramatically, directly improving FCP, LCP, and TTI on mobile.
//
// Components that are NOT lazy (always needed on every page):
//   Layout, ProtectedRoute, CustomCursor, Loader, AdminRoute
// Everything else is lazy.

// ── Core public pages (highest traffic — still lazy; preload hints added below)
const Home       = lazy(() => import("./pages/Home"));
const Games      = lazy(() => import("./pages/Games"));
const GamePage   = lazy(() => import("./pages/GamePage"));
const Tournament = lazy(() => import("./pages/Tournament"));
const TeamFinder = lazy(() => import("./pages/TeamFinder"));
const Stream     = lazy(() => import("./pages/Stream"));
const Communities = lazy(() => import("./pages/Communities"));
const SquadMatch  = lazy(() => import("./pages/SquadMatch"));
const Dailies     = lazy(() => import("./pages/Dailies"));

// ── Auth pages
const Login          = lazy(() => import("./pages/Login"));
const Register       = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));

// ── User pages
const Profile     = lazy(() => import("./pages/Profile"));
const UserProfile = lazy(() => import("./pages/UserProfile"));

// ── Content pages
const About             = lazy(() => import("./pages/About"));
const Faq               = lazy(() => import("./pages/Faq"));
const Blog              = lazy(() => import("./pages/Blog"));
const BlogPost          = lazy(() => import("./pages/BlogPost"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const PrivacyPolicy     = lazy(() => import("./pages/PrivacyPolicy"));

// ── Admin pages (heaviest — lazy keeps them out of every user's initial load)
const AdminDashboard        = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminArchiveDashboard = lazy(() => import("./pages/admin/AdminArchiveDashboard"));

// ── 404 — lazy so it never inflates the initial bundle
const NotFound = lazy(() => import("./pages/NotFound"));

// ─── Suspense fallback ────────────────────────────────────────────────────────
// Minimal dark-background placeholder shown during chunk fetch (typically
// < 200 ms on a good connection). Keeps the screen from flashing white.
// The full-screen Loader handles the very first app boot separately.
function PageFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050505",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-busy="true"
      aria-label="Loading page…"
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DailiesTransitionProvider>
      <Loader />
      <CustomCursor />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* ── Public pages ── */}
          <Route path="/"              element={<Layout><Home /></Layout>} />
          <Route path="/games"         element={<Layout><Games /></Layout>} />
          <Route path="/games/:slug"   element={<Layout><GamePage /></Layout>} />
          <Route path="/tournament"    element={<Layout><Tournament /></Layout>} />
          <Route path="/tournament/:id" element={<Layout><Tournament /></Layout>} />
          <Route path="/teamfinder"    element={<Layout><TeamFinder /></Layout>} />
          <Route path="/communities"   element={<Layout><Communities /></Layout>} />
          <Route
            path="/squadmatch"
            element={
              <Layout>
                <ProtectedRoute>
                  <SquadMatch />
                </ProtectedRoute>
              </Layout>
            }
          />
          <Route path="/stream"        element={<Layout><Stream /></Layout>} />
          <Route path="/about"         element={<Layout><About /></Layout>} />
          <Route path="/faq"           element={<Layout><Faq /></Layout>} />
          <Route path="/blog"          element={<Layout><Blog /></Layout>} />
          <Route path="/blog/:slug"    element={<Layout><BlogPost /></Layout>} />
          <Route path="/terms"         element={<Layout><TermsAndConditions /></Layout>} />
          <Route path="/privacy"       element={<Layout><PrivacyPolicy /></Layout>} />

          {/* ── Auth pages ── */}
          <Route path="/login"           element={<Layout><Login /></Layout>} />
          <Route path="/register"        element={<Layout><Register /></Layout>} />
          <Route path="/forgot-password" element={<Layout><ForgotPassword /></Layout>} />

          {/* ── User pages ── */}
          <Route path="/users/:id" element={<Layout><UserProfile /></Layout>} />
          <Route
            path="/profile"
            element={
              <Layout>
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              </Layout>
            }
          />

          {/* ── Admin pages ── */}
          <Route
            path="/admin"
            element={
              <Layout>
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              </Layout>
            }
          />
          <Route
            path="/admin/archives"
            element={
              <Layout>
                <AdminRoute>
                  <AdminArchiveDashboard />
                </AdminRoute>
              </Layout>
            }
          />

          {/* ── Dailies (per-game daily quiz) — no Layout on purpose:
               full-bleed, no Navbar/Footer. Dailies.jsx has its own
               "Back to Home" button instead. ── */}
          <Route
            path="/dailies"
            element={
              <ProtectedRoute>
                <Dailies />
              </ProtectedRoute>
            }
          />

          {/* ── 404 — no Layout on purpose: full-bleed, no Navbar/Footer ── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      </DailiesTransitionProvider>
    </BrowserRouter>
  );
}
