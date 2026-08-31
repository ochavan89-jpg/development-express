import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthContext";

import Layout from "./components/Layout/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Machines from "./pages/Machines";
import Wallet from "./pages/Wallet";
import Reports from "./pages/Reports";
import Operators from "./pages/Operators";
import Bookings from "./pages/Bookings";
import Users from "./pages/Users";

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--navy)", color: "var(--gold)", letterSpacing: 2 }}>
      LOADING...
    </div>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/dashboard" replace /> : <Login />;
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  return user ? <Layout /> : <Navigate to="/login" replace state={{ from: location }} />;
}

function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return roles.includes(user.role) ? children : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" />

        <Routes>
          <Route path="/" element={<LoginRoute />} />
          <Route path="/login" element={<LoginRoute />} />

          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/machines" element={<RequireRole roles={["admin", "owner"]}><Machines /></RequireRole>} />
            <Route path="/wallet" element={<RequireRole roles={["admin", "owner", "client"]}><Wallet /></RequireRole>} />
            <Route path="/reports" element={<RequireRole roles={["admin", "owner"]}><Reports /></RequireRole>} />
            <Route path="/operators" element={<RequireRole roles={["admin"]}><Operators /></RequireRole>} />
            <Route path="/bookings" element={<RequireRole roles={["admin", "owner", "client"]}><Bookings /></RequireRole>} />
            <Route path="/users" element={<RequireRole roles={["admin"]}><Users /></RequireRole>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </BrowserRouter>
    </AuthProvider>
  );
}